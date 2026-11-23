import fs from 'node:fs'
import path from 'node:path'
import { AUTO_SHARE_DOMAINS, assertInternalShareTargets } from './config.mjs'

const DAY_MS = 24 * 60 * 60 * 1000

export function daysAgoISO(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

function quote(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

export function parseEmailList(value) {
  if (Array.isArray(value)) return value.map((e) => String(e).trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map((e) => e.trim()).filter(Boolean)
  return []
}

export async function grantDrivePermissions(drive, fileId, { emails = [], domains = [], role = 'writer', sendNotificationEmail = false } = {}) {
  assertInternalShareTargets(emails, domains)
  const applied = []
  for (const emailAddress of emails) {
    try {
      const res = await drive.permissions.create({
        fileId,
        requestBody: { type: 'user', role, emailAddress },
        sendNotificationEmail,
        supportsAllDrives: true,
        fields: 'id, type, role, emailAddress'
      })
      applied.push({ type: 'user', emailAddress, role, ok: true, id: res.data.id })
    } catch (err) {
      applied.push({ type: 'user', emailAddress, role, ok: false, error: err.message })
    }
  }
  for (const domain of domains) {
    try {
      const res = await drive.permissions.create({
        fileId,
        requestBody: { type: 'domain', role, domain },
        supportsAllDrives: true,
        fields: 'id, type, role, domain'
      })
      applied.push({ type: 'domain', domain, role, ok: true, id: res.data.id })
    } catch (err) {
      applied.push({ type: 'domain', domain, role, ok: false, error: err.message })
    }
  }
  return applied
}

// Items created in a service mailbox's "My Drive" are invisible to the team unless
// shared, so they are opened to GOOGLE_AUTO_SHARE_DOMAINS (if set). Inside a Shared
// Drive members inherit access, so only explicit shareWith emails are added there.
export async function ensureCreatedDriveAccess(drive, data, args) {
  if (args?.private === true || !data?.id) return []
  const emails = parseEmailList(args?.shareWith)
  const domains = data.driveId ? [] : AUTO_SHARE_DOMAINS
  if (!emails.length && !domains.length) return []
  return grantDrivePermissions(drive, data.id, {
    emails,
    domains,
    role: args?.shareRole || 'writer',
    sendNotificationEmail: false
  })
}

export async function createDriveItemWithParentCheck(drive, params, userEmail, parentId) {
  try {
    return await drive.files.create(params)
  } catch (err) {
    if (parentId && /File not found/i.test(err?.message || '')) {
      const who = userEmail || 'the authenticated account'
      throw new Error(
        `${who} has no access to parent folder parentId=${parentId} (Drive returned "File not found"). ` +
        `Pass impersonateUser with a user that can access that folder, or share the folder / Shared Drive with ${who}.`
      )
    }
    throw err
  }
}

export function folderMetadata(args) {
  const meta = {
    name: args.name,
    mimeType: 'application/vnd.google-apps.folder',
    description: args.description || ''
  }
  if (args.parentId) meta.parents = [args.parentId]
  return meta
}

// Shared by personal and Workspace upload tools: local filePath or inline content.
export function uploadRequest(args) {
  let fileName = args.name
  let body
  if (args.filePath) {
    if (!fs.existsSync(args.filePath)) throw new Error(`File not found: ${args.filePath}`)
    if (!fileName) fileName = path.basename(args.filePath)
    body = fs.createReadStream(args.filePath)
  } else if (args.content) {
    if (!fileName) fileName = 'uploaded_file.txt'
    body = args.isBase64 ? Buffer.from(args.content, 'base64') : args.content
  } else {
    throw new Error('Provide "filePath" or "content" to upload a file.')
  }

  const requestBody = { name: fileName, description: args.description || '' }
  if (args.parentId) requestBody.parents = [args.parentId]
  return {
    requestBody,
    media: { mimeType: args.mimeType || 'application/octet-stream', body }
  }
}

export function buildFileSearchQuery(args, defaultDays = null) {
  const parts = ['trashed = false']
  if (args?.name) parts.push(`name contains ${quote(args.name)}`)
  const days = args?.days ?? defaultDays
  if (days) parts.push(`modifiedTime >= '${daysAgoISO(days)}'`)
  if (args?.mimeType) parts.push(`mimeType = ${quote(args.mimeType)}`)
  if (args?.q) parts.push(`(${args.q})`)
  return parts.join(' and ')
}

export async function searchFiles(drive, args, { defaultDays = null, defaultPageSize = 30, fields }) {
  const params = {
    q: buildFileSearchQuery(args, defaultDays),
    pageSize: Math.min(args?.pageSize || defaultPageSize, 1000),
    fields,
    orderBy: 'modifiedTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  }
  if (args?.pageToken) params.pageToken = args.pageToken
  if (args?.sharedDriveId) {
    params.driveId = args.sharedDriveId
    params.corpora = 'drive'
  } else if (args?.corpora) {
    params.corpora = args.corpora
  }
  const res = await drive.files.list(params)
  return { files: res.data.files || [], nextPageToken: res.data.nextPageToken }
}

export async function readFileContent(drive, fileId) {
  const meta = await drive.files.get({ fileId, fields: 'mimeType, name', supportsAllDrives: true })
  let res
  if (meta.data.mimeType === 'application/vnd.google-apps.document') {
    res = await drive.files.export({ fileId, mimeType: 'text/plain' })
  } else if (meta.data.mimeType === 'application/vnd.google-apps.spreadsheet') {
    res = await drive.files.export({ fileId, mimeType: 'text/csv' })
  } else {
    res = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true })
  }
  return typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
}

export async function trashOrDelete(drive, { fileId, permanent }) {
  if (permanent) {
    await drive.files.delete({ fileId, supportsAllDrives: true })
    return { ok: true, deletedPermanent: true, fileId }
  }
  const res = await drive.files.update({ fileId, requestBody: { trashed: true }, supportsAllDrives: true })
  return { ok: true, trashed: true, fileId: res.data.id }
}
