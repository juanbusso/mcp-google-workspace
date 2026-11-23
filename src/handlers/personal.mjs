import { google } from 'googleapis'
import { folderMetadata, readFileContent, searchFiles, trashOrDelete, uploadRequest } from '../drive-helpers.mjs'
import {
  createDraft,
  deleteDraft,
  getMessage,
  listDrafts,
  manageFilters,
  manageForwarding,
  searchMessages,
  sendDraft,
  sendMessage
} from '../gmail-helpers.mjs'
import { getProfileAuth } from '../google-auth.mjs'
import { json, text } from './respond.mjs'

function profileGmail(args) {
  const { auth, user } = getProfileAuth(args?.account)
  return { gmail: google.gmail({ version: 'v1', auth }), user }
}

function profileDrive(args) {
  return google.drive({ version: 'v3', auth: getProfileAuth(args?.account).auth })
}

const PERSONAL_SEARCH_FIELDS = 'nextPageToken, files(id, name, mimeType, modifiedTime, createdTime, size, webViewLink, owners, parents)'

export const personalHandlers = {
  async gmail_personal_search_messages(args) {
    const { gmail } = profileGmail(args)
    return json(await searchMessages(gmail, args, 'gmail_personal_search_messages'))
  },

  async gmail_personal_get_message_body(args) {
    const { gmail } = profileGmail(args)
    return json(await getMessage(gmail, args.messageId))
  },

  async gmail_personal_send_message(args) {
    const { gmail, user } = profileGmail(args)
    return json(await sendMessage(gmail, args, user))
  },

  async gmail_personal_create_draft(args) {
    const { gmail, user } = profileGmail(args)
    return json(await createDraft(gmail, args, user))
  },

  async gmail_personal_list_drafts(args) {
    const { gmail } = profileGmail(args)
    return json(await listDrafts(gmail, args))
  },

  async gmail_personal_send_draft(args) {
    const { gmail } = profileGmail(args)
    return json(await sendDraft(gmail, args.draftId))
  },

  async gmail_personal_delete_draft(args) {
    const { gmail } = profileGmail(args)
    return json(await deleteDraft(gmail, args.draftId))
  },

  async gmail_get_profile(args) {
    const { gmail } = profileGmail(args)
    const res = await gmail.users.getProfile({ userId: 'me' })
    return json(res.data)
  },

  async gmail_manage_forwarding(args) {
    const { gmail } = profileGmail(args)
    return json(await manageForwarding(gmail, args))
  },

  async gmail_manage_filters(args) {
    const { gmail } = profileGmail(args)
    return json(await manageFilters(gmail, args))
  },

  async gdrive_personal_search_files(args) {
    return json(await searchFiles(profileDrive(args), args, { defaultPageSize: 30, fields: PERSONAL_SEARCH_FIELDS }))
  },

  async gdrive_personal_get_file_metadata(args) {
    const res = await profileDrive(args).files.get({ fileId: args.fileId, fields: '*', supportsAllDrives: true })
    return json(res.data)
  },

  async gdrive_personal_read_file_content(args) {
    return text(await readFileContent(profileDrive(args), args.fileId))
  },

  async gdrive_personal_create_folder(args) {
    const res = await profileDrive(args).files.create({
      requestBody: folderMetadata(args),
      fields: 'id, name, mimeType, webViewLink, parents, createdTime',
      supportsAllDrives: true
    })
    return json(res.data)
  },

  async gdrive_personal_upload_file(args) {
    const res = await profileDrive(args).files.create({
      ...uploadRequest(args),
      fields: 'id, name, mimeType, size, webViewLink, parents, createdTime',
      supportsAllDrives: true
    })
    return json(res.data)
  },

  async gdrive_personal_delete_file(args) {
    return json(await trashOrDelete(profileDrive(args), args))
  }
}
