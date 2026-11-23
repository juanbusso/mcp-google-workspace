import { google } from 'googleapis'
import { DNS_CONFIG } from '../config.mjs'
import { getDnsAuth, getGtmAuth } from '../google-auth.mjs'
import { json } from './respond.mjs'

function dnsTarget(args) {
  const project = args?.project || DNS_CONFIG.project
  const managedZone = args?.managedZone || DNS_CONFIG.managedZone
  if (!project || !managedZone) {
    throw new Error('Cloud DNS needs "project" and "managedZone" (or GCP_DNS_PROJECT / GCP_DNS_MANAGED_ZONE).')
  }
  return { dns: google.dns({ version: 'v1', auth: getDnsAuth() }), project, managedZone }
}

function fqdn(name) {
  return name.endsWith('.') ? name : `${name}.`
}

function gtmClient() {
  return google.tagmanager({ version: 'v2', auth: getGtmAuth() })
}

export const cloudHandlers = {
  async gcp_dns_list_records(args) {
    const { dns, project, managedZone } = dnsTarget(args)
    const params = { project, managedZone }
    if (args?.name) params.name = fqdn(args.name)
    if (args?.type) params.type = args.type
    const res = await dns.resourceRecordSets.list(params)
    return json(res.data.rrsets || [])
  },

  async gcp_dns_create_record(args) {
    const { dns, project, managedZone } = dnsTarget(args)
    const res = await dns.changes.create({
      project,
      managedZone,
      requestBody: {
        additions: [{ name: fqdn(args.name), type: args.type, ttl: args.ttl || 300, rrdatas: args.rrdatas }]
      }
    })
    return json(res.data)
  },

  async gcp_dns_delete_record(args) {
    const { dns, project, managedZone } = dnsTarget(args)
    const recordName = fqdn(args.name)
    const listRes = await dns.resourceRecordSets.list({ project, managedZone, name: recordName, type: args.type })
    const existing = (listRes.data.rrsets || [])[0]
    if (!existing) throw new Error(`DNS record ${recordName} (${args.type}) not found in zone ${managedZone}.`)
    const res = await dns.changes.create({ project, managedZone, requestBody: { deletions: [existing] } })
    return json(res.data)
  },

  async gtm_list_accounts() {
    const res = await gtmClient().accounts.list()
    return json(res.data.account || [])
  },

  async gtm_list_containers(args) {
    const res = await gtmClient().accounts.containers.list({ parent: `accounts/${args.accountId}` })
    return json(res.data.container || [])
  },

  async gtm_list_workspaces(args) {
    const res = await gtmClient().accounts.containers.workspaces.list({
      parent: `accounts/${args.accountId}/containers/${args.containerId}`
    })
    return json(res.data.workspace || [])
  },

  async gtm_list_tags(args) {
    const res = await gtmClient().accounts.containers.workspaces.tags.list({
      parent: `accounts/${args.accountId}/containers/${args.containerId}/workspaces/${args.workspaceId}`
    })
    return json(res.data.tag || [])
  },

  async gtm_get_tag(args) {
    const res = await gtmClient().accounts.containers.workspaces.tags.get({ path: args.path })
    return json(res.data)
  },

  async gtm_update_tag(args) {
    const res = await gtmClient().accounts.containers.workspaces.tags.update({ path: args.path, requestBody: args.tag })
    return json(res.data)
  },

  async gtm_create_version(args) {
    const res = await gtmClient().accounts.containers.workspaces.create_version({
      path: `accounts/${args.accountId}/containers/${args.containerId}/workspaces/${args.workspaceId}`,
      requestBody: { name: args.name, notes: args.notes || '' }
    })
    return json(res.data.containerVersion)
  },

  async gtm_publish_version(args) {
    const res = await gtmClient().accounts.containers.versions.publish({ path: args.path })
    return json(res.data)
  }
}
