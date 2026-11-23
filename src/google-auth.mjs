import fs from 'node:fs'
import { google } from 'googleapis'
import {
  DNS_CONFIG,
  GROUP_SUBJECT_MAP,
  IMPERSONATED_USER,
  OAUTH_PORT,
  SERVICE_ACCOUNT_PATH,
  TOKENS_PATH,
  assertInternalSubject,
  resolveProfile
} from './config.mjs'

const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/script.projects.readonly',
  'https://www.googleapis.com/auth/script.processes',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/admin.reports.audit.readonly'
]

const GTM_SCOPES = [
  'https://www.googleapis.com/auth/tagmanager.edit.containers',
  'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
  'https://www.googleapis.com/auth/tagmanager.publish',
  'https://www.googleapis.com/auth/tagmanager.readonly'
]

const DNS_SCOPES = ['https://www.googleapis.com/auth/ndev.clouddns.readwrite']

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch (err) {
    throw new Error(`Could not read ${label} at ${filePath}: ${err.message}`)
  }
}

function loadServiceAccount() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) return null
  return readJson(SERVICE_ACCOUNT_PATH, 'service account key')
}

export function loadOAuthClientKeys(credentialsPath) {
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`OAuth client file not found at ${credentialsPath} (set GOOGLE_CREDENTIALS_PATH).`)
  }
  const credentials = readJson(credentialsPath, 'OAuth client')
  const keys = credentials.installed || credentials.web
  if (!keys?.client_id) {
    throw new Error(`${credentialsPath} is not an OAuth client file (expected an "installed" or "web" section).`)
  }
  return keys
}

// OAuth2 user account selected by profile name or email (see GOOGLE_PROFILES_JSON).
export function getProfileAuth(account) {
  const profile = resolveProfile(account)
  const keys = loadOAuthClientKeys(profile.credentialsPath)
  if (!fs.existsSync(profile.tokensPath)) {
    throw new Error(
      `No OAuth tokens for profile "${profile.name}" at ${profile.tokensPath}. Run: npm run auth -- --profile ${profile.name}`
    )
  }
  const auth = new google.auth.OAuth2(
    keys.client_id,
    keys.client_secret,
    keys.redirect_uris?.[0] || `http://localhost:${OAUTH_PORT}/oauth2callback`
  )
  auth.setCredentials(readJson(profile.tokensPath, 'OAuth tokens'))
  return { auth, user: profile.email }
}

function resolveSubject(requested) {
  const subject = String(requested || IMPERSONATED_USER || '').toLowerCase().trim()
  if (!subject) return { subject: null, actingAs: null }
  const actingAs = GROUP_SUBJECT_MAP[subject] || subject
  assertInternalSubject(subject)
  if (actingAs !== subject) assertInternalSubject(actingAs)
  return { subject, actingAs }
}

// Workspace access: service account + domain-wide delegation when service_account.json
// exists, otherwise the "default" OAuth profile (impersonation is not possible then).
// `user` is the mailbox the call acts for (used as From / createdBy), or null if unknown.
export function getWorkspaceAuth(requestedSubject) {
  const serviceAccount = loadServiceAccount()
  if (!serviceAccount) return getProfileAuth('default')

  const { subject, actingAs } = resolveSubject(requestedSubject)
  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: WORKSPACE_SCOPES,
    subject: actingAs || undefined
  })
  return { auth, user: subject }
}

export function getGtmAuth() {
  const serviceAccount = loadServiceAccount()
  if (!serviceAccount) return getProfileAuth('default').auth
  return new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: GTM_SCOPES
  })
}

// GCP_DNS_KEY_FILE → service account → default OAuth tokens → Application Default Credentials.
export function getDnsAuth() {
  if (DNS_CONFIG.keyFile) {
    if (!fs.existsSync(DNS_CONFIG.keyFile)) throw new Error(`GCP_DNS_KEY_FILE not found: ${DNS_CONFIG.keyFile}`)
    return new google.auth.GoogleAuth({ keyFile: DNS_CONFIG.keyFile, scopes: DNS_SCOPES })
  }
  if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    return new google.auth.GoogleAuth({ keyFile: SERVICE_ACCOUNT_PATH, scopes: DNS_SCOPES })
  }
  if (fs.existsSync(TOKENS_PATH)) return getProfileAuth('default').auth
  return new google.auth.GoogleAuth({ scopes: DNS_SCOPES })
}

// Tools accepting both `account` (OAuth profile) and `impersonateUser` (Workspace).
export function getAccountOrWorkspaceAuth(args) {
  if (args?.account) return getProfileAuth(args.account)
  return getWorkspaceAuth(args?.impersonateUser || args?.userEmail)
}
