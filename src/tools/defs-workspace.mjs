import {
  ACCOUNT_OVERRIDE,
  COMPOSE_PROPS,
  DRAFT_LIST_PROPS,
  IMPERSONATE,
  SEARCH_PROPS,
  num,
  str,
  strArray
} from './fragments.mjs'

// Calendar, Directory groups, Admin audit logs and Workspace Gmail (service account / DWD).
export const workspaceTools = [
  {
    name: 'calendar_list_events',
    description: 'List upcoming events from a user\'s primary Google Calendar.',
    inputSchema: {
      type: 'object',
      properties: {
        userEmail: str('Calendar owner to impersonate (default: GOOGLE_IMPERSONATED_USER)'),
        account: ACCOUNT_OVERRIDE,
        days: num('Days ahead to include (default 7)'),
        maxResults: num('Maximum events (default 20)')
      }
    }
  },
  {
    name: 'calendar_create_event',
    description: 'Create an event in a user\'s primary Google Calendar.',
    inputSchema: {
      type: 'object',
      properties: {
        userEmail: str('Organizer to impersonate (default: GOOGLE_IMPERSONATED_USER)'),
        account: ACCOUNT_OVERRIDE,
        summary: str('Event title'),
        description: str('Event notes'),
        startISO: str('Start date-time, ISO 8601 (e.g. 2026-08-31T15:00:00-03:00)'),
        endISO: str('End date-time, ISO 8601 (e.g. 2026-08-31T16:00:00-03:00)'),
        attendees: strArray('Attendee emails')
      },
      required: ['summary', 'startISO', 'endISO']
    }
  },
  {
    name: 'calendar_delete_event',
    description: 'Delete an event from a user\'s primary Google Calendar by eventId.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: str('Event ID'),
        userEmail: str('Calendar owner to impersonate (default: GOOGLE_IMPERSONATED_USER)'),
        account: ACCOUNT_OVERRIDE
      },
      required: ['eventId']
    }
  },
  {
    name: 'workspace_list_groups',
    description: 'List Google Groups in the Workspace domain (requires an admin to impersonate).',
    inputSchema: {
      type: 'object',
      properties: {
        customer: str('Customer ID (default "my_customer")'),
        maxResults: num('Maximum groups (default 50)'),
        impersonateUser: IMPERSONATE
      }
    }
  },
  {
    name: 'admin_get_drive_audit_logs',
    description: 'Fetch Google Workspace Admin audit events for Drive (who viewed, edited or downloaded files). Requires an admin to impersonate.',
    inputSchema: {
      type: 'object',
      properties: {
        days: num('Days back to audit (default 30)'),
        eventName: str('Optional event filter (e.g. view, edit, download, create, delete)'),
        userEmail: str('Optional actor filter (default "all")'),
        maxResults: num('Maximum events (default 50, max 1000)'),
        impersonateUser: IMPERSONATE
      }
    }
  },
  {
    name: 'gmail_search_messages',
    description: 'Search a Workspace mailbox with Gmail query syntax (returns id, threadId, subject, from, to, date, snippet).',
    inputSchema: {
      type: 'object',
      properties: { ...SEARCH_PROPS, impersonateUser: IMPERSONATE },
      required: ['q']
    }
  },
  {
    name: 'gmail_get_message_body',
    description: 'Get the full content of a Workspace Gmail message by ID.',
    inputSchema: {
      type: 'object',
      properties: { messageId: str('Gmail message ID'), impersonateUser: IMPERSONATE },
      required: ['messageId']
    }
  },
  {
    name: 'gmail_send_message',
    description: 'Send an email from a Workspace mailbox (text, HTML, CC, BCC, Reply-To, threads and attachments).',
    inputSchema: {
      type: 'object',
      properties: { ...COMPOSE_PROPS, impersonateUser: IMPERSONATE },
      required: ['to', 'subject']
    }
  },
  {
    name: 'gmail_create_draft',
    description: 'Create a Gmail draft in a Workspace mailbox for review before sending.',
    inputSchema: {
      type: 'object',
      properties: { ...COMPOSE_PROPS, impersonateUser: IMPERSONATE }
    }
  },
  {
    name: 'gmail_list_drafts',
    description: 'List drafts in a Workspace mailbox.',
    inputSchema: {
      type: 'object',
      properties: { ...DRAFT_LIST_PROPS, impersonateUser: IMPERSONATE }
    }
  },
  {
    name: 'gmail_send_draft',
    description: 'Send an existing draft from a Workspace mailbox.',
    inputSchema: {
      type: 'object',
      properties: { draftId: str('Draft ID'), impersonateUser: IMPERSONATE },
      required: ['draftId']
    }
  },
  {
    name: 'gmail_delete_draft',
    description: 'Delete a draft from a Workspace mailbox.',
    inputSchema: {
      type: 'object',
      properties: { draftId: str('Draft ID'), impersonateUser: IMPERSONATE },
      required: ['draftId']
    }
  }
]
