# mcp-google-workspace

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI assistants (Claude Desktop, Claude Code, Antigravity, Cursor, …) access to Google Workspace and Google accounts:

- **Gmail**: search, read, send (HTML, CC/BCC, threads, attachments), drafts, filters, forwarding
- **Calendar**: list, create and delete events
- **Drive**: search, read, upload, create folders, share, delete, Shared Drives
- **Sheets**: read, write (formula-safe, verified), append, metadata
- **Workspace admin**: Google Groups, Drive audit logs
- **Apps Script**: read project source
- **Google Cloud DNS**: list, create and delete records
- **Google Tag Manager**: accounts, containers, workspaces, tags, versions, publish

Two authentication modes can be used at the same time:

| Mode | Used by | Typical use |
| --- | --- | --- |
| **Service account + domain-wide delegation** | Workspace tools (`gmail_*`, `calendar_*`, `gdrive_*`, `gsheets_*`, `workspace_*`, `admin_*`) | Act as any user of your Workspace domain |
| **OAuth2 user profiles** | `gmail_personal_*`, `gdrive_personal_*`, `gmail_get_profile`, `gmail_manage_*` (and any tool with `account`) | Consumer Gmail or any single Google account; multiple accounts supported |

If no service account is configured, Workspace tools fall back to the `default` OAuth profile.

## Requirements

- Node.js **20.12+**
- A Google Cloud project with the APIs you need enabled: Gmail, Google Calendar, Google Drive, Google Sheets, Admin SDK, Apps Script, Cloud DNS, Tag Manager

## Install

```bash
git clone <this-repo-url> mcp-google-workspace
cd mcp-google-workspace
npm install
cp .env.example .env   # optional; you can also pass env vars from the MCP client
```

## Setup

### Option A — OAuth2 (user accounts)

1. Google Cloud Console → **APIs & Services → OAuth consent screen**: configure it (add yourself as a test user while the app is in *Testing*).
2. **Credentials → Create credentials → OAuth client ID → Desktop app**. Download the JSON and save it as `credentials.json` (or point `GOOGLE_CREDENTIALS_PATH` to it).
3. Authorize the default profile:

   ```bash
   npm run auth
   ```

   Open the printed URL, grant access, and tokens are written to `tokens.json` (`GOOGLE_TOKENS_PATH`).

4. Optional extra accounts:

   ```bash
   # .env
   GOOGLE_PERSONAL_TOKENS_PATH=./tokens_personal.json
   GOOGLE_PERSONAL_EMAIL=you@gmail.com
   ```

   ```bash
   npm run auth -- --profile personal
   ```

   For more than two accounts use `GOOGLE_PROFILES_JSON`:

   ```bash
   GOOGLE_PROFILES_JSON={"work":{"tokensPath":"./tokens_work.json","email":"me@example.com"}}
   npm run auth -- --profile work
   ```

   Tools accept the profile name **or** its email in the `account` argument.

`npm run auth` requests Drive, Sheets, Gmail (incl. settings), Calendar and Apps Script scopes. Add `--all-scopes` to also request Admin SDK, Tag Manager and Cloud DNS scopes (needed only if you use those tools via OAuth).

### Option B — Service account with domain-wide delegation (Workspace)

1. Google Cloud Console → **IAM & Admin → Service accounts → Create**. Create a JSON key and save it as `service_account.json` (or set `GOOGLE_SERVICE_ACCOUNT_PATH`).
2. Copy the service account's **Client ID** (numeric).
3. Workspace Admin console → **Security → Access and data control → API controls → Manage domain-wide delegation → Add new**, paste the Client ID and these scopes:

   ```
   https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/script.projects.readonly,https://www.googleapis.com/auth/script.processes,https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.compose,https://www.googleapis.com/auth/gmail.modify,https://www.googleapis.com/auth/gmail.settings.basic,https://www.googleapis.com/auth/gmail.settings.sharing,https://www.googleapis.com/auth/admin.directory.group.readonly,https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/admin.reports.audit.readonly
   ```

4. Set the mailbox to act as by default:

   ```bash
   GOOGLE_IMPERSONATED_USER=assistant@example.com
   ```

   Every Workspace tool also accepts `impersonateUser` (calendar tools: `userEmail`). Groups and audit-log tools need an admin user.

5. Google Groups cannot be impersonated. To read or send as a group address, map it to a real member mailbox:

   ```bash
   GOOGLE_GROUP_SUBJECT_MAP={"sales@example.com":"assistant@example.com"}
   ```

**Tag Manager:** the service account is used directly (no impersonation); add its email as a user in GTM.
**Cloud DNS:** uses `GCP_DNS_KEY_FILE`, else the service account, else the default OAuth tokens, else Application Default Credentials. The identity needs the *DNS Administrator* role.

## Configuration reference

All variables are optional. Relative paths resolve against the package directory. A `.env` file next to `package.json` is loaded automatically; variables set by the MCP client take precedence.

| Variable | Default | Description |
| --- | --- | --- |
| `GOOGLE_CREDENTIALS_PATH` | `./credentials.json` | OAuth client JSON (Desktop app) |
| `GOOGLE_TOKENS_PATH` | `./tokens.json` | Tokens of the `default` profile |
| `GOOGLE_OAUTH_EMAIL` | — | Email of the `default` profile (From header, `account` matching) |
| `GOOGLE_PERSONAL_TOKENS_PATH` | — | Enables the `personal` profile |
| `GOOGLE_PERSONAL_EMAIL` | — | Email of the `personal` profile |
| `GOOGLE_PERSONAL_CREDENTIALS_PATH` | `GOOGLE_CREDENTIALS_PATH` | OAuth client for the `personal` profile |
| `GOOGLE_PROFILES_JSON` | — | Extra profiles: `{"name":{"tokensPath":"…","credentialsPath":"…","email":"…"}}` |
| `GOOGLE_DEFAULT_PROFILE` | `personal` if set, else `default` | Profile used when `account` is omitted |
| `GOOGLE_OAUTH_PORT` | `3005` | Local port for the `npm run auth` callback |
| `GOOGLE_SERVICE_ACCOUNT_PATH` | `./service_account.json` | Service account key (enables domain-wide delegation) |
| `GOOGLE_IMPERSONATED_USER` | — | Default impersonated mailbox |
| `GOOGLE_GROUP_SUBJECT_MAP` | — | JSON map of group address → member mailbox to impersonate |
| `GOOGLE_ALLOWED_INTERNAL_DOMAINS` | — | Comma list. If set, impersonation and Drive sharing are limited to these domains |
| `GOOGLE_AUTO_SHARE_DOMAINS` | — | Comma list. New Drive items outside Shared Drives are shared (writer) with these domains; also the default for `gdrive_share_file` |
| `GCP_DNS_KEY_FILE` | — | Key file for Cloud DNS |
| `GCP_DNS_PROJECT` / `GCP_DNS_MANAGED_ZONE` | — | Defaults for the `gcp_dns_*` tools |

## MCP client configuration

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-google-workspace/index.mjs"],
      "env": {
        "GOOGLE_IMPERSONATED_USER": "assistant@example.com",
        "GOOGLE_ALLOWED_INTERNAL_DOMAINS": "example.com"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add google-workspace \
  --env GOOGLE_IMPERSONATED_USER=assistant@example.com \
  -- node /absolute/path/to/mcp-google-workspace/index.mjs
```

### Antigravity

Agent panel → **⋯ → MCP Servers → Manage MCP Servers → View raw config**, then add to `mcp_config.json`:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-google-workspace/index.mjs"],
      "env": {
        "GOOGLE_PERSONAL_TOKENS_PATH": "/absolute/path/to/tokens_personal.json",
        "GOOGLE_PERSONAL_EMAIL": "you@gmail.com"
      }
    }
  }
}
```

Any other MCP client that launches stdio servers works the same way (`node index.mjs`).

## Tools

### Calendar
| Tool | Description |
| --- | --- |
| `calendar_list_events` | Upcoming events of a user's primary calendar (`userEmail`, `days`, `maxResults`) |
| `calendar_create_event` | Create an event (`summary`, `startISO`, `endISO`, `attendees`, `description`) |
| `calendar_delete_event` | Delete an event by `eventId` |

Calendar tools impersonate `userEmail`; pass `account` instead to use an OAuth profile.

### Workspace admin
| Tool | Description |
| --- | --- |
| `workspace_list_groups` | List the domain's Google Groups |
| `admin_get_drive_audit_logs` | Drive audit events (view/edit/download/…) filtered by `days`, `eventName`, `userEmail` |

### Gmail (Workspace, service account)
| Tool | Description |
| --- | --- |
| `gmail_search_messages` | Gmail query search with headers + snippet, paginated |
| `gmail_get_message_body` | Full message by ID |
| `gmail_send_message` | Send (text/HTML, CC, BCC, Reply-To, `threadId`, attachments) |
| `gmail_create_draft` / `gmail_list_drafts` / `gmail_send_draft` / `gmail_delete_draft` | Draft management |

### Gmail (OAuth profiles)
| Tool | Description |
| --- | --- |
| `gmail_personal_search_messages` | Search a profile's mailbox |
| `gmail_personal_get_message_body` | Full message by ID |
| `gmail_personal_send_message` | Send from a profile |
| `gmail_personal_create_draft` / `_list_drafts` / `_send_draft` / `_delete_draft` | Draft management |
| `gmail_get_profile` | Address, message/thread totals, historyId |
| `gmail_manage_forwarding` | `list`, `add_address`, `delete_address`, `get_auto_forwarding`, `set_auto_forwarding` |
| `gmail_manage_filters` | `list`, `create`, `delete` |

### Drive (Workspace, service account)
| Tool | Description |
| --- | --- |
| `gdrive_search_modified_files` | Recently modified files (`days`, `name`, `mimeType`, `q`, `sharedDriveId`), paginated |
| `gdrive_get_file_metadata` | Full metadata |
| `gdrive_read_file_content` | Docs → text, Sheets → CSV, other files raw |
| `gdrive_create_folder` | Create a folder (auto-share, `shareWith`, `private`) |
| `gdrive_upload_file` | Upload from `filePath` or `content` (text/base64) |
| `gdrive_share_file` | Share with `emails` and/or `domain` |
| `gdrive_delete_file` | Trash or permanently delete |
| `gdrive_list_shared_drives` | List Shared Drives |
| `gdrive_read_apps_script` | Read Apps Script project source |

### Drive (OAuth profiles)
`gdrive_personal_search_files`, `gdrive_personal_get_file_metadata`, `gdrive_personal_read_file_content`, `gdrive_personal_create_folder`, `gdrive_personal_upload_file`, `gdrive_personal_delete_file` — same behavior, scoped to the chosen `account`.

OAuth-profile tools are hidden from the tool list until at least one OAuth tokens file exists.

### Sheets
| Tool | Description |
| --- | --- |
| `gsheets_read_data` | Read a range |
| `gsheets_write_data` | Write a range. Blocks overwriting formulas or ARRAYFORMULA spill rows unless `allowFormulaOverwrite: true`, then re-reads to verify |
| `gsheets_append_data` | Append rows and verify them |
| `gsheets_get_spreadsheet` | Title, locale, time zone and sheet list |

Sheets tools use the service account (`impersonateUser`) or an OAuth profile (`account`).

### Google Cloud DNS
`gcp_dns_list_records`, `gcp_dns_create_record`, `gcp_dns_delete_record` — `project` / `managedZone` per call or via `GCP_DNS_PROJECT` / `GCP_DNS_MANAGED_ZONE`.

### Google Tag Manager
`gtm_list_accounts`, `gtm_list_containers`, `gtm_list_workspaces`, `gtm_list_tags`, `gtm_get_tag`, `gtm_update_tag`, `gtm_create_version`, `gtm_publish_version`.

## Security notes

- `credentials*.json`, `token*.json`, `service_account*.json`, `client_secret*.json` and `.env` are git-ignored. Never commit them.
- Domain-wide delegation lets the service account act as **any** user in your domain. Grant only the scopes you need and set `GOOGLE_ALLOWED_INTERNAL_DOMAINS` to limit impersonation and Drive sharing.
- Tools that accept `filePath` (attachments, uploads) read local files with the server's permissions. Run the server under an account with appropriate file access.
- Sending email, sharing files, deleting files, changing DNS and publishing GTM versions are real, outward-facing actions. Configure your MCP client to require confirmation for them.

## Development

```bash
npm run check   # syntax-check every module
npm start       # run over stdio
```

Layout:

```
index.mjs              MCP server entry: tool registry + dispatch
auth.mjs               OAuth2 consent CLI (npm run auth)
src/config.mjs         env vars, profiles, domain guard
src/google-auth.mjs    OAuth / service-account / DNS / GTM clients
src/tools/             tool schemas
src/handlers/          tool implementations
src/*-helpers.mjs      Gmail, Drive and MIME helpers; sheets-guard.mjs
```

## License

MIT
