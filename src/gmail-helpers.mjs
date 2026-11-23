import { createMimeMessage } from './mime.mjs'

const MAX_ENRICHED_RESULTS = 100

function header(headers, name) {
  return headers.find((h) => h.name === name)?.value || ''
}

function clampMax(value, fallback) {
  const n = Number(value ?? fallback)
  return Math.max(1, Math.min(Number.isFinite(n) ? n : fallback, MAX_ENRICHED_RESULTS))
}

// Gmail has no batch "get" in googleapis: metadata lookups run in parallel and are
// capped at MAX_ENRICHED_RESULTS per page; use pageToken to continue.
export async function searchMessages(gmail, args, toolName) {
  const q = String(args?.q ?? args?.query ?? '').trim()
  if (!q) throw new Error(`${toolName} requires a non-empty "q" (or "query") search string.`)

  const listParams = { userId: 'me', q, maxResults: clampMax(args?.maxResults ?? args?.limit, 50) }
  if (args?.pageToken) listParams.pageToken = args.pageToken
  const res = await gmail.users.messages.list(listParams)

  const messages = await Promise.all(
    (res.data.messages || []).map(async (m) => {
      try {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date']
        })
        const headers = msg.data.payload?.headers || []
        return {
          id: m.id,
          threadId: m.threadId,
          snippet: msg.data.snippet,
          subject: header(headers, 'Subject'),
          from: header(headers, 'From'),
          to: header(headers, 'To'),
          date: header(headers, 'Date')
        }
      } catch (err) {
        return { id: m.id, error: err.message }
      }
    })
  )

  return { messages, nextPageToken: res.data.nextPageToken, resultSizeEstimate: res.data.resultSizeEstimate }
}

export async function getMessage(gmail, messageId) {
  const res = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' })
  return res.data
}

function buildRaw(args, from) {
  return createMimeMessage({
    to: args.to,
    subject: args.subject,
    body: args.body,
    htmlBody: args.htmlBody,
    from: from || undefined,
    cc: args.cc,
    bcc: args.bcc,
    replyTo: args.replyTo,
    attachments: args.attachments || []
  })
}

export async function sendMessage(gmail, args, from) {
  const requestBody = { raw: buildRaw(args, from) }
  if (args.threadId) requestBody.threadId = args.threadId
  const res = await gmail.users.messages.send({ userId: 'me', requestBody })
  return { ok: true, id: res.data.id, threadId: res.data.threadId }
}

export async function createDraft(gmail, args, from) {
  const requestBody = { message: { raw: buildRaw(args, from) } }
  if (args.threadId) requestBody.message.threadId = args.threadId
  const res = await gmail.users.drafts.create({ userId: 'me', requestBody })
  return { ok: true, draftId: res.data.id, message: res.data.message }
}

export async function listDrafts(gmail, args) {
  const listParams = { userId: 'me', maxResults: clampMax(args?.maxResults, 20) }
  if (args?.pageToken) listParams.pageToken = args.pageToken
  const res = await gmail.users.drafts.list(listParams)

  const drafts = await Promise.all(
    (res.data.drafts || []).map(async (d) => {
      try {
        const draft = await gmail.users.drafts.get({ userId: 'me', id: d.id, format: 'metadata' })
        const headers = draft.data.message?.payload?.headers || []
        return {
          id: d.id,
          messageId: draft.data.message?.id,
          threadId: draft.data.message?.threadId,
          snippet: draft.data.message?.snippet,
          subject: header(headers, 'Subject'),
          to: header(headers, 'To'),
          date: header(headers, 'Date')
        }
      } catch (err) {
        return { id: d.id, error: err.message }
      }
    })
  )

  return { drafts, nextPageToken: res.data.nextPageToken }
}

export async function sendDraft(gmail, draftId) {
  const res = await gmail.users.drafts.send({ userId: 'me', requestBody: { id: draftId } })
  return { ok: true, id: res.data.id, threadId: res.data.threadId }
}

export async function deleteDraft(gmail, draftId) {
  await gmail.users.drafts.delete({ userId: 'me', id: draftId })
  return { ok: true, deletedDraftId: draftId }
}

export async function manageForwarding(gmail, args) {
  const settings = gmail.users.settings
  switch (args?.action) {
    case 'list': {
      const [addresses, auto] = await Promise.all([
        settings.forwardingAddresses.list({ userId: 'me' }),
        settings.getAutoForwarding({ userId: 'me' })
      ])
      return { forwardingAddresses: addresses.data.forwardingAddresses || [], autoForwarding: auto.data }
    }
    case 'add_address': {
      if (!args.forwardingEmail) throw new Error('"forwardingEmail" is required for add_address.')
      const res = await settings.forwardingAddresses.create({
        userId: 'me',
        requestBody: { forwardingEmail: args.forwardingEmail }
      })
      return {
        ok: true,
        result: res.data,
        note: `Google sent a verification email to ${args.forwardingEmail}. Forwarding stays inactive until the address owner verifies it.`
      }
    }
    case 'delete_address': {
      if (!args.forwardingEmail) throw new Error('"forwardingEmail" is required for delete_address.')
      await settings.forwardingAddresses.delete({ userId: 'me', forwardingEmail: args.forwardingEmail })
      return { ok: true, deletedAddress: args.forwardingEmail }
    }
    case 'get_auto_forwarding': {
      const res = await settings.getAutoForwarding({ userId: 'me' })
      return res.data
    }
    case 'set_auto_forwarding': {
      const requestBody = { enabled: Boolean(args.enabled) }
      if (args.forwardingEmail) requestBody.emailAddress = args.forwardingEmail
      if (args.disposition) requestBody.disposition = args.disposition
      const res = await settings.updateAutoForwarding({ userId: 'me', requestBody })
      return { ok: true, autoForwarding: res.data }
    }
    default:
      throw new Error(`Unknown action "${args?.action}" for gmail_manage_forwarding.`)
  }
}

export async function manageFilters(gmail, args) {
  const filters = gmail.users.settings.filters
  switch (args?.action) {
    case 'list': {
      const res = await filters.list({ userId: 'me' })
      return res.data.filter || []
    }
    case 'create': {
      if (!args.criteria) throw new Error('"criteria" is required to create a filter.')
      const res = await filters.create({
        userId: 'me',
        requestBody: { criteria: args.criteria, action: args.actionConfig || {} }
      })
      return { ok: true, filter: res.data }
    }
    case 'delete': {
      if (!args.filterId) throw new Error('"filterId" is required to delete a filter.')
      await filters.delete({ userId: 'me', id: args.filterId })
      return { ok: true, deletedFilterId: args.filterId }
    }
    default:
      throw new Error(`Unknown action "${args?.action}" for gmail_manage_filters.`)
  }
}
