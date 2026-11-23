import { google } from 'googleapis'
import { AUTO_SHARE_DOMAINS } from '../config.mjs'
import {
  createDriveItemWithParentCheck,
  ensureCreatedDriveAccess,
  folderMetadata,
  grantDrivePermissions,
  parseEmailList,
  readFileContent,
  searchFiles,
  trashOrDelete,
  uploadRequest
} from '../drive-helpers.mjs'
import { getAccountOrWorkspaceAuth, getWorkspaceAuth } from '../google-auth.mjs'
import { assertSafeSheetWrite, verifySheetWrite } from '../sheets-guard.mjs'
import { json, text } from './respond.mjs'

const MODIFIED_SEARCH_FIELDS =
  'nextPageToken, files(id, name, mimeType, modifiedTime, createdTime, owners, lastModifyingUser, size, webViewLink, sharedWithMeTime)'

function workspaceDrive(args) {
  const { auth, user } = getWorkspaceAuth(args?.impersonateUser)
  return { drive: google.drive({ version: 'v3', auth }), user }
}

function sheetsFor(args) {
  return google.sheets({ version: 'v4', auth: getAccountOrWorkspaceAuth(args).auth })
}

export const driveHandlers = {
  async gdrive_create_folder(args) {
    const { drive, user } = workspaceDrive(args)
    const res = await createDriveItemWithParentCheck(drive, {
      requestBody: folderMetadata(args),
      fields: 'id, name, mimeType, webViewLink, parents, driveId, createdTime',
      supportsAllDrives: true
    }, user, args.parentId)
    const appliedPermissions = await ensureCreatedDriveAccess(drive, res.data, args)
    return json({ ...res.data, createdBy: user, appliedPermissions })
  },

  async gdrive_upload_file(args) {
    const { drive, user } = workspaceDrive(args)
    const res = await createDriveItemWithParentCheck(drive, {
      ...uploadRequest(args),
      fields: 'id, name, mimeType, size, webViewLink, parents, driveId, createdTime',
      supportsAllDrives: true
    }, user, args.parentId)
    const appliedPermissions = await ensureCreatedDriveAccess(drive, res.data, args)
    return json({ ...res.data, createdBy: user, appliedPermissions })
  },

  async gdrive_share_file(args) {
    const { drive, user } = workspaceDrive(args)
    const emails = parseEmailList(args.emails)
    const domains = args.domain ? [args.domain] : (emails.length ? [] : AUTO_SHARE_DOMAINS)
    if (!emails.length && !domains.length) {
      throw new Error('Provide "emails" and/or "domain" (or configure GOOGLE_AUTO_SHARE_DOMAINS).')
    }
    const appliedPermissions = await grantDrivePermissions(drive, args.fileId, {
      emails,
      domains,
      role: args.role || 'writer',
      sendNotificationEmail: Boolean(args.sendNotificationEmail)
    })
    return json({ fileId: args.fileId, impersonateUser: user, appliedPermissions })
  },

  async gdrive_list_shared_drives(args) {
    const { drive } = workspaceDrive(args)
    const params = { pageSize: Math.min(args?.pageSize || 50, 100) }
    if (args?.pageToken) params.pageToken = args.pageToken
    const res = await drive.drives.list(params)
    return json({ drives: res.data.drives || [], nextPageToken: res.data.nextPageToken })
  },

  async gdrive_search_modified_files(args) {
    const { drive } = workspaceDrive(args)
    return json(await searchFiles(drive, args, { defaultDays: 30, defaultPageSize: 50, fields: MODIFIED_SEARCH_FIELDS }))
  },

  async gdrive_get_file_metadata(args) {
    const { drive } = workspaceDrive(args)
    const res = await drive.files.get({ fileId: args.fileId, fields: '*', supportsAllDrives: true })
    return json(res.data)
  },

  async gdrive_read_file_content(args) {
    const { drive } = workspaceDrive(args)
    return text(await readFileContent(drive, args.fileId))
  },

  async gdrive_delete_file(args) {
    const { drive } = workspaceDrive(args)
    return json(await trashOrDelete(drive, args))
  },

  async gdrive_read_apps_script(args) {
    const { auth } = getWorkspaceAuth(args?.impersonateUser)
    const script = google.script({ version: 'v1', auth })
    const res = await script.projects.getContent({ scriptId: args.scriptId })
    return json(res.data.files || [])
  },

  async gsheets_read_data(args) {
    const res = await sheetsFor(args).spreadsheets.values.get({
      spreadsheetId: args.spreadsheetId,
      range: args.range,
      valueRenderOption: args.valueRenderOption || 'FORMATTED_VALUE'
    })
    return json(res.data.values || [])
  },

  async gsheets_write_data(args) {
    const sheets = sheetsFor(args)
    await assertSafeSheetWrite(sheets, args.spreadsheetId, args.range, args.values, {
      allowFormulaOverwrite: Boolean(args.allowFormulaOverwrite)
    })
    const res = await sheets.spreadsheets.values.update({
      spreadsheetId: args.spreadsheetId,
      range: args.range,
      valueInputOption: args.valueInputOption || 'USER_ENTERED',
      requestBody: { values: args.values }
    })
    const verification = await verifySheetWrite(sheets, args.spreadsheetId, res.data.updatedRange || args.range, args.values, {
      updatedRows: res.data.updatedRows
    })
    return json({ ...res.data, verification })
  },

  async gsheets_append_data(args) {
    const sheets = sheetsFor(args)
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: args.spreadsheetId,
      range: args.range,
      valueInputOption: args.valueInputOption || 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: args.values }
    })
    const appendedRange = res.data.updates?.updatedRange
    const verification = appendedRange
      ? await verifySheetWrite(sheets, args.spreadsheetId, appendedRange, args.values, {
        updatedRows: res.data.updates?.updatedRows
      })
      : { verifiedOk: false, reason: 'The API returned no updates.updatedRange; appended rows could not be re-read.' }
    return json({ ...res.data, verification })
  },

  async gsheets_get_spreadsheet(args) {
    const res = await sheetsFor(args).spreadsheets.get({
      spreadsheetId: args.spreadsheetId,
      fields: 'spreadsheetId, properties(title, locale, timeZone), sheets(properties(sheetId, title, index, gridProperties(rowCount, columnCount)))'
    })
    return json({
      spreadsheetId: res.data.spreadsheetId,
      title: res.data.properties?.title,
      locale: res.data.properties?.locale,
      timeZone: res.data.properties?.timeZone,
      sheets: (res.data.sheets || []).map((s) => ({
        sheetId: s.properties?.sheetId,
        title: s.properties?.title,
        index: s.properties?.index,
        rowCount: s.properties?.gridProperties?.rowCount,
        columnCount: s.properties?.gridProperties?.columnCount
      }))
    })
  }
}
