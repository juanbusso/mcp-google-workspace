import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Optional .env next to package.json. Variables already set by the MCP client win.
const ENV_FILE = path.join(ROOT_DIR, '.env')
if (fs.existsSync(ENV_FILE) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(ENV_FILE)
}

function env(name) {
  return String(process.env[name] ?? '').trim()
}

// Relative paths are resolved against the package directory (MCP clients spawn
// the server from unpredictable working directories). Supports "~/".
export function resolvePath(value) {
  if (!value) return null
  const expanded = value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : value
  return path.isAbsolute(expanded) ? expanded : path.resolve(ROOT_DIR, expanded)
}

function parseList(value) {
  return value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

function parseJsonEnv(name) {
  const raw = env(name)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new Error(`Invalid JSON in ${name}: ${err.message}`)
  }
}

function lowerKeys(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj || {})) out[k.toLowerCase().trim()] = String(v).toLowerCase().trim()
  return out
}

export const CREDENTIALS_PATH = resolvePath(env('GOOGLE_CREDENTIALS_PATH') || './credentials.json')
export const TOKENS_PATH = resolvePath(env('GOOGLE_TOKENS_PATH') || './tokens.json')
export const SERVICE_ACCOUNT_PATH = resolvePath(env('GOOGLE_SERVICE_ACCOUNT_PATH') || './service_account.json')
export const IMPERSONATED_USER = env('GOOGLE_IMPERSONATED_USER').toLowerCase() || null
export const ALLOWED_INTERNAL_DOMAINS = parseList(env('GOOGLE_ALLOWED_INTERNAL_DOMAINS'))
export const AUTO_SHARE_DOMAINS = parseList(env('GOOGLE_AUTO_SHARE_DOMAINS'))
// Google Groups cannot be a domain-wide delegation subject; map them to a real mailbox.
export const GROUP_SUBJECT_MAP = lowerKeys(parseJsonEnv('GOOGLE_GROUP_SUBJECT_MAP'))
export const OAUTH_PORT = Number(env('GOOGLE_OAUTH_PORT') || 3005)

export const DNS_CONFIG = {
  keyFile: resolvePath(env('GCP_DNS_KEY_FILE')),
  project: env('GCP_DNS_PROJECT') || null,
  managedZone: env('GCP_DNS_MANAGED_ZONE') || null
}

function buildProfiles() {
  const profiles = new Map()
  profiles.set('default', {
    name: 'default',
    credentialsPath: CREDENTIALS_PATH,
    tokensPath: TOKENS_PATH,
    email: env('GOOGLE_OAUTH_EMAIL').toLowerCase() || null
  })

  const personalTokens = env('GOOGLE_PERSONAL_TOKENS_PATH')
  if (personalTokens) {
    profiles.set('personal', {
      name: 'personal',
      credentialsPath: resolvePath(env('GOOGLE_PERSONAL_CREDENTIALS_PATH')) || CREDENTIALS_PATH,
      tokensPath: resolvePath(personalTokens),
      email: env('GOOGLE_PERSONAL_EMAIL').toLowerCase() || null
    })
  }

  for (const [rawName, cfg] of Object.entries(parseJsonEnv('GOOGLE_PROFILES_JSON') || {})) {
    const name = rawName.toLowerCase().trim()
    if (!cfg || typeof cfg !== 'object' || !cfg.tokensPath) {
      throw new Error(`GOOGLE_PROFILES_JSON: profile "${rawName}" must define "tokensPath"`)
    }
    profiles.set(name, {
      name,
      credentialsPath: resolvePath(cfg.credentialsPath) || CREDENTIALS_PATH,
      tokensPath: resolvePath(cfg.tokensPath),
      email: cfg.email ? String(cfg.email).toLowerCase().trim() : null
    })
  }
  return profiles
}

export const PROFILES = buildProfiles()
export const DEFAULT_PROFILE = env('GOOGLE_DEFAULT_PROFILE').toLowerCase() || (PROFILES.has('personal') ? 'personal' : 'default')

export function describeProfiles() {
  return [...PROFILES.values()].map((p) => (p.email ? `${p.name} (${p.email})` : p.name)).join(', ')
}

// Accepts a profile name or the email configured for it.
export function resolveProfile(account) {
  const key = String(account || DEFAULT_PROFILE).toLowerCase().trim()
  const profile = PROFILES.get(key) || [...PROFILES.values()].find((p) => p.email === key)
  if (!profile) {
    throw new Error(`Unknown account/profile "${key}". Configured profiles: ${describeProfiles()}`)
  }
  return profile
}

export function hasAnyOAuthTokens() {
  return [...PROFILES.values()].some((p) => fs.existsSync(p.tokensPath))
}

function domainOf(email) {
  const at = email.lastIndexOf('@')
  return at >= 0 ? email.slice(at + 1).toLowerCase() : ''
}

export function assertInternalSubject(email) {
  if (!ALLOWED_INTERNAL_DOMAINS.length) return
  if (!ALLOWED_INTERNAL_DOMAINS.includes(domainOf(email))) {
    throw new Error(
      `Impersonation of "${email}" blocked: GOOGLE_ALLOWED_INTERNAL_DOMAINS only allows ${ALLOWED_INTERNAL_DOMAINS.join(', ')}.`
    )
  }
}

export function assertInternalShareTargets(emails, domains) {
  if (!ALLOWED_INTERNAL_DOMAINS.length) return
  const blocked = [
    ...emails.filter((e) => !ALLOWED_INTERNAL_DOMAINS.includes(domainOf(e))),
    ...domains.filter((d) => !ALLOWED_INTERNAL_DOMAINS.includes(d.toLowerCase()))
  ]
  if (blocked.length) {
    throw new Error(
      `Sharing blocked for ${blocked.join(', ')}: GOOGLE_ALLOWED_INTERNAL_DOMAINS only allows ${ALLOWED_INTERNAL_DOMAINS.join(', ')}.`
    )
  }
}
