import { google } from 'googleapis'
import { daysAgoISO } from '../drive-helpers.mjs'
import {
  createDraft,
  deleteDraft,
  getMessage,
  listDrafts,
  searchMessages,
  sendDraft,
  sendMessage
} from '../gmail-helpers.mjs'
import { getAccountOrWorkspaceAuth, getWorkspaceAuth } from '../google-auth.mjs'
import { json } from './respond.mjs'

function calendarFor(args) {
  return google.calendar({ version: 'v3', auth: getAccountOrWorkspaceAuth(args).auth })
}

function workspaceGmail(args) {
  const { auth, user } = getWorkspaceAuth(args?.impersonateUser)
  return { gmail: google.gmail({ version: 'v1', auth }), user }
}

export const workspaceHandlers = {
  async calendar_list_events(args) {
    const days = args?.days || 7
    const res = await calendarFor(args).events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      timeMax: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
      maxResults: Math.min(args?.maxResults || 20, 2500),
      singleEvents: true,
      orderBy: 'startTime'
    })
    return json(res.data.items || [])
  },

  async calendar_create_event(args) {
    const res = await calendarFor(args).events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: args.summary,
        description: args.description || '',
        start: { dateTime: args.startISO },
        end: { dateTime: args.endISO },
        attendees: (args.attendees || []).map((email) => ({ email }))
      }
    })
    return json(res.data)
  },

  async calendar_delete_event(args) {
    await calendarFor(args).events.delete({ calendarId: 'primary', eventId: args.eventId })
    return json({ ok: true, deletedEventId: args.eventId })
  },

  async workspace_list_groups(args) {
    const { auth } = getWorkspaceAuth(args?.impersonateUser)
    const admin = google.admin({ version: 'directory_v1', auth })
    const res = await admin.groups.list({
      customer: args?.customer || 'my_customer',
      maxResults: Math.min(args?.maxResults || 50, 200)
    })
    return json(res.data.groups || [])
  },

  async admin_get_drive_audit_logs(args) {
    const { auth } = getWorkspaceAuth(args?.impersonateUser)
    const reports = google.admin({ version: 'reports_v1', auth })
    const params = {
      userKey: args?.userEmail || 'all',
      applicationName: 'drive',
      startTime: daysAgoISO(args?.days || 30),
      maxResults: Math.min(args?.maxResults || 50, 1000)
    }
    if (args?.eventName) params.eventName = args.eventName
    const res = await reports.activities.list(params)
    return json(res.data.items || [])
  },

  async gmail_search_messages(args) {
    const { gmail } = workspaceGmail(args)
    return json(await searchMessages(gmail, args, 'gmail_search_messages'))
  },

  async gmail_get_message_body(args) {
    const { gmail } = workspaceGmail(args)
    return json(await getMessage(gmail, args.messageId))
  },

  async gmail_send_message(args) {
    const { gmail, user } = workspaceGmail(args)
    return json(await sendMessage(gmail, args, user))
  },

  async gmail_create_draft(args) {
    const { gmail, user } = workspaceGmail(args)
    return json(await createDraft(gmail, args, user))
  },

  async gmail_list_drafts(args) {
    const { gmail } = workspaceGmail(args)
    return json(await listDrafts(gmail, args))
  },

  async gmail_send_draft(args) {
    const { gmail } = workspaceGmail(args)
    return json(await sendDraft(gmail, args.draftId))
  },

  async gmail_delete_draft(args) {
    const { gmail } = workspaceGmail(args)
    return json(await deleteDraft(gmail, args.draftId))
  }
}
