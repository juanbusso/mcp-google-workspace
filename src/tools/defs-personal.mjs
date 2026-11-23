import {
  ACCOUNT,
  COMPOSE_PROPS,
  DELETE_PROPS,
  DRAFT_LIST_PROPS,
  SEARCH_PROPS,
  UPLOAD_PROPS,
  bool,
  num,
  str,
  strArray
} from './fragments.mjs'

// Tools backed by OAuth2 user profiles (consumer Gmail or any Google account).
// Hidden from tools/list when no OAuth tokens file exists for any profile.
export const personalTools = [
  {
    name: 'gmail_personal_search_messages',
    description: 'Search an OAuth-profile Gmail mailbox with Gmail query syntax.',
    inputSchema: {
      type: 'object',
      properties: { ...SEARCH_PROPS, account: ACCOUNT },
      required: ['q']
    }
  },
  {
    name: 'gmail_personal_get_message_body',
    description: 'Get the full content of a message from an OAuth-profile Gmail mailbox.',
    inputSchema: {
      type: 'object',
      properties: { messageId: str('Gmail message ID'), account: ACCOUNT },
      required: ['messageId']
    }
  },
  {
    name: 'gmail_personal_send_message',
    description: 'Send an email from an OAuth-profile Gmail mailbox (text, HTML, CC, BCC, Reply-To, threads and attachments).',
    inputSchema: {
      type: 'object',
      properties: { account: ACCOUNT, ...COMPOSE_PROPS },
      required: ['to', 'subject']
    }
  },
  {
    name: 'gmail_personal_create_draft',
    description: 'Create a draft in an OAuth-profile Gmail mailbox for review before sending.',
    inputSchema: {
      type: 'object',
      properties: { account: ACCOUNT, ...COMPOSE_PROPS }
    }
  },
  {
    name: 'gmail_personal_list_drafts',
    description: 'List drafts in an OAuth-profile Gmail mailbox.',
    inputSchema: {
      type: 'object',
      properties: { account: ACCOUNT, ...DRAFT_LIST_PROPS }
    }
  },
  {
    name: 'gmail_personal_send_draft',
    description: 'Send an existing draft from an OAuth-profile Gmail mailbox.',
    inputSchema: {
      type: 'object',
      properties: { draftId: str('Draft ID'), account: ACCOUNT },
      required: ['draftId']
    }
  },
  {
    name: 'gmail_personal_delete_draft',
    description: 'Delete a draft from an OAuth-profile Gmail mailbox.',
    inputSchema: {
      type: 'object',
      properties: { draftId: str('Draft ID'), account: ACCOUNT },
      required: ['draftId']
    }
  },
  {
    name: 'gmail_get_profile',
    description: 'Get mailbox info for an OAuth profile (emailAddress, messagesTotal, threadsTotal, historyId).',
    inputSchema: {
      type: 'object',
      properties: { account: ACCOUNT }
    }
  },
  {
    name: 'gmail_manage_forwarding',
    description:
      'Manage Gmail forwarding for an OAuth profile. Actions: "list" (addresses + auto-forwarding status), "add_address" (Google emails a verification link), ' +
      '"delete_address", "get_auto_forwarding", "set_auto_forwarding" (enable/disable forwarding to a verified address).',
    inputSchema: {
      type: 'object',
      properties: {
        account: ACCOUNT,
        action: {
          type: 'string',
          enum: ['list', 'add_address', 'delete_address', 'get_auto_forwarding', 'set_auto_forwarding'],
          description: 'Action to perform'
        },
        forwardingEmail: str('Forwarding address (required for add_address and delete_address)'),
        enabled: bool('Enable (true) or disable (false) auto-forwarding (set_auto_forwarding)'),
        disposition: {
          type: 'string',
          enum: ['leaveInInbox', 'archive', 'trash', 'markRead'],
          description: 'What to do with the original message (default "leaveInInbox")'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'gmail_manage_filters',
    description: 'Manage Gmail filters for an OAuth profile. Actions: "list", "create" (criteria + actions: forward, add/remove labels), "delete" (by filterId).',
    inputSchema: {
      type: 'object',
      properties: {
        account: ACCOUNT,
        action: { type: 'string', enum: ['list', 'create', 'delete'], description: 'Action to perform' },
        filterId: str('Filter ID (required for delete)'),
        criteria: {
          type: 'object',
          description: 'Match criteria',
          properties: {
            from: str('Sender'),
            to: str('Recipient'),
            subject: str('Words in the subject'),
            query: str('Free-text Gmail query'),
            hasAttachment: bool('Has attachments')
          }
        },
        actionConfig: {
          type: 'object',
          description: 'Actions applied to matching messages',
          properties: {
            forward: str('Verified forwarding address'),
            addLabelIds: strArray('Label IDs to add'),
            removeLabelIds: strArray('Label IDs to remove (e.g. ["INBOX"] to archive)')
          }
        }
      },
      required: ['action']
    }
  },
  {
    name: 'gdrive_personal_search_files',
    description: 'Search files in an OAuth-profile Google Drive by name, MIME type, modification date or raw Drive query (My Drive, Shared Drives and shared files).',
    inputSchema: {
      type: 'object',
      properties: {
        account: ACCOUNT,
        q: str('Optional raw Drive query (e.g. "\'FOLDER_ID\' in parents")'),
        name: str('Name or part of the name'),
        days: num('Only files modified in the last N days'),
        mimeType: str('MIME type filter'),
        pageSize: num('Maximum results (default 30)'),
        pageToken: str('Next-page token'),
        sharedDriveId: str('Restrict to a Shared Drive'),
        corpora: str('Corpora: "user", "drive" or "allDrives"')
      }
    }
  },
  {
    name: 'gdrive_personal_get_file_metadata',
    description: 'Get full metadata of a file in an OAuth-profile Google Drive.',
    inputSchema: {
      type: 'object',
      properties: { fileId: str('Drive file ID'), account: ACCOUNT },
      required: ['fileId']
    }
  },
  {
    name: 'gdrive_personal_read_file_content',
    description: 'Read a file from an OAuth-profile Google Drive (Docs as text, Sheets as CSV, other files raw).',
    inputSchema: {
      type: 'object',
      properties: { fileId: str('Drive file ID'), account: ACCOUNT },
      required: ['fileId']
    }
  },
  {
    name: 'gdrive_personal_create_folder',
    description: 'Create a folder in an OAuth-profile Google Drive.',
    inputSchema: {
      type: 'object',
      properties: {
        name: str('Folder name'),
        account: ACCOUNT,
        parentId: str('Optional parent folder ID'),
        description: str('Optional description')
      },
      required: ['name']
    }
  },
  {
    name: 'gdrive_personal_upload_file',
    description: 'Upload a file to an OAuth-profile Google Drive from a local path or inline text/base64 content.',
    inputSchema: {
      type: 'object',
      properties: { account: ACCOUNT, ...UPLOAD_PROPS }
    }
  },
  {
    name: 'gdrive_personal_delete_file',
    description: 'Trash (default) or permanently delete a file or folder in an OAuth-profile Google Drive.',
    inputSchema: {
      type: 'object',
      properties: { ...DELETE_PROPS, account: ACCOUNT },
      required: ['fileId']
    }
  }
]

export const PERSONAL_TOOL_NAMES = new Set(personalTools.map((t) => t.name))
