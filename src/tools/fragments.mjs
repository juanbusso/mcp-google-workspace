export const str = (description) => ({ type: 'string', description })
export const num = (description) => ({ type: 'number', description })
export const bool = (description) => ({ type: 'boolean', description })
export const strArray = (description) => ({ type: 'array', items: { type: 'string' }, description })

export const IMPERSONATE = str(
  'Workspace user to impersonate via domain-wide delegation (default: GOOGLE_IMPERSONATED_USER). Ignored when no service account is configured.'
)
export const ACCOUNT = str(
  'OAuth profile name or its configured email (see GOOGLE_PROFILES_JSON). Default: GOOGLE_DEFAULT_PROFILE.'
)
export const ACCOUNT_OVERRIDE = str(
  'Optional OAuth profile name/email. When set, the call uses that OAuth account instead of the Workspace service account.'
)

export const ATTACHMENTS = {
  type: 'array',
  description: 'Optional attachments, each from a local "filePath" or inline text "content"',
  items: {
    type: 'object',
    properties: {
      filePath: str('Absolute path of a local file'),
      content: str('Inline text content (used when filePath is not given)'),
      filename: str('File name (optional when filePath is used)'),
      contentType: str('MIME type (e.g. application/pdf)')
    }
  }
}

export const COMPOSE_PROPS = {
  to: str('Recipient email address(es), comma separated'),
  subject: str('Subject'),
  body: str('Plain-text body'),
  htmlBody: str('Optional HTML body'),
  cc: str('CC addresses, comma separated'),
  bcc: str('BCC addresses, comma separated'),
  replyTo: str('Reply-To address'),
  threadId: str('Gmail thread ID to reply within an existing conversation'),
  attachments: ATTACHMENTS
}

export const SEARCH_PROPS = {
  q: str('Gmail search query (e.g. "from:billing@example.com subject:invoice newer_than:7d")'),
  maxResults: num('Maximum messages to return (default 50, max 100)'),
  pageToken: str('Next-page token from a previous search')
}

export const DRAFT_LIST_PROPS = {
  maxResults: num('Maximum drafts to return (default 20, max 100)'),
  pageToken: str('Next-page token')
}

export const UPLOAD_PROPS = {
  name: str('File name in Drive (default: local file name)'),
  filePath: str('Absolute path of the local file to upload'),
  content: str('File content as text or base64 (when filePath is not given)'),
  isBase64: bool('Whether "content" is base64 encoded'),
  mimeType: str('MIME type (e.g. application/pdf, text/csv, image/png)'),
  parentId: str('Optional parent folder ID'),
  description: str('Optional file description')
}

export const SHARE_ON_CREATE_PROPS = {
  private: bool('If true, skip automatic sharing (by default items outside Shared Drives are shared with GOOGLE_AUTO_SHARE_DOMAINS, if configured)'),
  shareWith: strArray('Extra emails to grant access to (a comma-separated string is also accepted)'),
  shareRole: str('Role for automatic permissions: reader | commenter | writer (default writer)')
}

export const DELETE_PROPS = {
  fileId: str('ID of the file or folder'),
  permanent: bool('If true, delete permanently; otherwise move to trash (default false)')
}
