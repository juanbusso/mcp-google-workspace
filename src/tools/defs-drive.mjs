import {
  ACCOUNT_OVERRIDE,
  DELETE_PROPS,
  IMPERSONATE,
  SHARE_ON_CREATE_PROPS,
  UPLOAD_PROPS,
  bool,
  num,
  str,
  strArray
} from './fragments.mjs'

const VALUES_MATRIX = { type: 'array', items: { type: 'array' }, description: '2D array of values (rows × columns)' }

// Workspace Drive (service account / DWD), Apps Script and Google Sheets.
export const driveTools = [
  {
    name: 'gdrive_create_folder',
    description: 'Create a folder in Workspace Google Drive (optionally inside a Shared Drive folder). Auto-shares with GOOGLE_AUTO_SHARE_DOMAINS when configured.',
    inputSchema: {
      type: 'object',
      properties: {
        name: str('Folder name'),
        parentId: str('Optional parent folder ID'),
        description: str('Optional description'),
        impersonateUser: IMPERSONATE,
        ...SHARE_ON_CREATE_PROPS
      },
      required: ['name']
    }
  },
  {
    name: 'gdrive_upload_file',
    description: 'Upload a file to Workspace Google Drive from a local path or inline text/base64 content. Auto-shares with GOOGLE_AUTO_SHARE_DOMAINS when configured.',
    inputSchema: {
      type: 'object',
      properties: { ...UPLOAD_PROPS, impersonateUser: IMPERSONATE, ...SHARE_ON_CREATE_PROPS }
    }
  },
  {
    name: 'gdrive_share_file',
    description: 'Share a Drive file or folder with emails and/or a domain. Without emails or domain it shares with GOOGLE_AUTO_SHARE_DOMAINS.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: str('File or folder ID'),
        emails: strArray('Emails to grant access to (a comma-separated string is also accepted)'),
        domain: str('Domain to share with (e.g. example.com)'),
        role: str('reader | commenter | writer (default writer)'),
        impersonateUser: IMPERSONATE,
        sendNotificationEmail: bool('Send a notification email to recipients (default false)')
      },
      required: ['fileId']
    }
  },
  {
    name: 'gdrive_list_shared_drives',
    description: 'List Shared Drives the account can access.',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: num('Maximum drives (default 50)'),
        pageToken: str('Next-page token'),
        impersonateUser: IMPERSONATE
      }
    }
  },
  {
    name: 'gdrive_search_modified_files',
    description: 'Search recently modified files across My Drive and Shared Drives (optionally impersonating any domain user).',
    inputSchema: {
      type: 'object',
      properties: {
        days: num('Days back (default 30)'),
        name: str('Optional name filter (contains)'),
        q: str('Optional raw Drive query appended with AND'),
        impersonateUser: IMPERSONATE,
        sharedDriveId: str('Restrict to a Shared Drive'),
        mimeType: str('MIME type filter'),
        pageSize: num('Maximum results (default 50)'),
        pageToken: str('Next-page token')
      }
    }
  },
  {
    name: 'gdrive_get_file_metadata',
    description: 'Get full metadata of a Workspace Drive file by ID.',
    inputSchema: {
      type: 'object',
      properties: { fileId: str('Drive file ID'), impersonateUser: IMPERSONATE },
      required: ['fileId']
    }
  },
  {
    name: 'gdrive_read_file_content',
    description: 'Read a Workspace Drive file (Docs as text, Sheets as CSV, other files raw).',
    inputSchema: {
      type: 'object',
      properties: { fileId: str('Drive file ID'), impersonateUser: IMPERSONATE },
      required: ['fileId']
    }
  },
  {
    name: 'gdrive_delete_file',
    description: 'Trash (default) or permanently delete a Workspace Drive file or folder.',
    inputSchema: {
      type: 'object',
      properties: { ...DELETE_PROPS, impersonateUser: IMPERSONATE },
      required: ['fileId']
    }
  },
  {
    name: 'gdrive_read_apps_script',
    description: 'Read the source files (.gs / .html) of a Google Apps Script project.',
    inputSchema: {
      type: 'object',
      properties: { scriptId: str('Apps Script project ID'), impersonateUser: IMPERSONATE },
      required: ['scriptId']
    }
  },
  {
    name: 'gsheets_read_data',
    description: 'Read a cell range from a Google Sheets spreadsheet.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: str('Spreadsheet ID'),
        range: str('A1 range (e.g. "Sheet1!A1:Z50" or "A:Z")'),
        valueRenderOption: str('"FORMATTED_VALUE" (default), "UNFORMATTED_VALUE" or "FORMULA"'),
        impersonateUser: IMPERSONATE,
        account: ACCOUNT_OVERRIDE
      },
      required: ['spreadsheetId', 'range']
    }
  },
  {
    name: 'gsheets_write_data',
    description: 'Write values to a Google Sheets range. Refuses to overwrite formulas / ARRAYFORMULA spill ranges and re-reads the result, returning an error if the write did not land.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: str('Spreadsheet ID'),
        range: str('A1 range to write (e.g. "Sheet1!A1:B2")'),
        values: VALUES_MATRIX,
        valueInputOption: str('"USER_ENTERED" (default) or "RAW"'),
        allowFormulaOverwrite: bool('Allow overwriting formula cells or rows reached by an ARRAYFORMULA (default false)'),
        impersonateUser: IMPERSONATE,
        account: ACCOUNT_OVERRIDE
      },
      required: ['spreadsheetId', 'range', 'values']
    }
  },
  {
    name: 'gsheets_append_data',
    description: 'Append rows after the last row of a table/range in Google Sheets, then re-read them to verify.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: str('Spreadsheet ID'),
        range: str('Range or sheet name (e.g. "Sheet1!A:Z")'),
        values: VALUES_MATRIX,
        valueInputOption: str('"USER_ENTERED" (default) or "RAW"'),
        impersonateUser: IMPERSONATE,
        account: ACCOUNT_OVERRIDE
      },
      required: ['spreadsheetId', 'range', 'values']
    }
  },
  {
    name: 'gsheets_get_spreadsheet',
    description: 'Get spreadsheet metadata (title, locale, time zone, sheets with IDs and sizes).',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: str('Spreadsheet ID'),
        impersonateUser: IMPERSONATE,
        account: ACCOUNT_OVERRIDE
      },
      required: ['spreadsheetId']
    }
  }
]
