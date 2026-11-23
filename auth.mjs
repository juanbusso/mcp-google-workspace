#!/usr/bin/env node
// Interactive OAuth2 consent flow. Stores tokens for a profile (default: "default").
//
//   npm run auth                         # → GOOGLE_TOKENS_PATH (./tokens.json)
//   npm run auth -- --profile personal   # → GOOGLE_PERSONAL_TOKENS_PATH
//   npm run auth -- --profile work --all-scopes
//
// Profiles are defined in .env (see .env.example).
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { google } from 'googleapis'
import { OAUTH_PORT, PROFILES, describeProfiles } from './src/config.mjs'
import { loadOAuthClientKeys } from './src/google-auth.mjs'

const CORE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/script.projects.readonly'
]

// Admin / GTM / Cloud DNS scopes: only useful for Workspace admins or GCP projects.
const EXTENDED_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
  'https://www.googleapis.com/auth/admin.reports.audit.readonly',
  'https://www.googleapis.com/auth/tagmanager.edit.containers',
  'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
  'https://www.googleapis.com/auth/tagmanager.publish',
  'https://www.googleapis.com/auth/tagmanager.readonly',
  'https://www.googleapis.com/auth/ndev.clouddns.readwrite'
]

function parseArgs(argv) {
  const opts = { profile: 'default', allScopes: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile') opts.profile = String(argv[++i] || '').toLowerCase()
    else if (argv[i] === '--all-scopes') opts.allScopes = true
    else throw new Error(`Unknown argument: ${argv[i]}`)
  }
  return opts
}

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

async function authenticate() {
  const opts = parseArgs(process.argv.slice(2))
  const profile = PROFILES.get(opts.profile)
  if (!profile) {
    fail(`profile "${opts.profile}" is not configured. Available: ${describeProfiles()}. ` +
      'Define it with GOOGLE_PERSONAL_TOKENS_PATH or GOOGLE_PROFILES_JSON.')
  }

  const keys = loadOAuthClientKeys(profile.credentialsPath)
  const redirectUri = `http://localhost:${OAUTH_PORT}/oauth2callback`
  const oauth2Client = new google.auth.OAuth2(keys.client_id, keys.client_secret, redirectUri)
  const scope = opts.allScopes ? [...CORE_SCOPES, ...EXTENDED_SCOPES] : CORE_SCOPES

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope,
    ...(profile.email ? { login_hint: profile.email } : {})
  })

  console.log(`\nAuthorizing profile "${profile.name}"${profile.email ? ` (${profile.email})` : ''}.`)
  console.log('Open this URL in your browser and grant access:\n')
  console.log(authUrl)
  console.log('')

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, redirectUri)
    if (url.pathname !== '/oauth2callback') {
      res.writeHead(404).end()
      return
    }
    const error = url.searchParams.get('error')
    const code = url.searchParams.get('code')
    if (error || !code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' }).end(`Authorization failed: ${error || 'missing code'}`)
      server.close()
      fail(`authorization failed: ${error || 'missing code'}`)
    }

    try {
      const { tokens } = await oauth2Client.getToken(code)
      fs.mkdirSync(path.dirname(profile.tokensPath), { recursive: true })
      fs.writeFileSync(profile.tokensPath, JSON.stringify(tokens, null, 2), { mode: 0o600 })
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<h1>Authorized profile "${profile.name}"</h1><p>You can close this window.</p>`)
      server.close()
      console.log(`✅ Tokens saved to ${profile.tokensPath}`)
      if (!tokens.refresh_token) {
        console.warn('⚠️  No refresh_token returned. Revoke the app at https://myaccount.google.com/permissions and run again.')
      }
      process.exit(0)
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' }).end(`Token exchange failed: ${err.message}`)
      server.close()
      fail(`token exchange failed: ${err.message}`)
    }
  })

  server.listen(OAUTH_PORT, () => {
    console.log(`Waiting for the OAuth callback on ${redirectUri} ...`)
  })
}

authenticate().catch((err) => fail(err.message))
