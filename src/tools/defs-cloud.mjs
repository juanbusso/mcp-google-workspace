import { num, str, strArray } from './fragments.mjs'

const DNS_TARGET = {
  project: str('GCP project ID (default: GCP_DNS_PROJECT)'),
  managedZone: str('Cloud DNS managed zone name (default: GCP_DNS_MANAGED_ZONE)')
}

// Google Cloud DNS and Google Tag Manager.
export const cloudTools = [
  {
    name: 'gcp_dns_list_records',
    description: 'List record sets of a Google Cloud DNS managed zone.',
    inputSchema: {
      type: 'object',
      properties: {
        ...DNS_TARGET,
        name: str('Optional exact record name filter (e.g. "api.example.com.")'),
        type: str('Optional record type filter (e.g. "A", "CNAME", "TXT", "MX")')
      }
    }
  },
  {
    name: 'gcp_dns_create_record',
    description: 'Add a record set (A, CNAME, TXT, MX, …) to a Google Cloud DNS managed zone.',
    inputSchema: {
      type: 'object',
      properties: {
        ...DNS_TARGET,
        name: str('Record name; a trailing dot is added if missing (e.g. "sub.example.com.")'),
        type: str('Record type (e.g. "A", "CNAME", "TXT", "MX")'),
        ttl: num('TTL in seconds (default 300)'),
        rrdatas: strArray('Record data (e.g. ["192.0.2.1"] for A, ["target.example.com."] for CNAME)')
      },
      required: ['name', 'type', 'rrdatas']
    }
  },
  {
    name: 'gcp_dns_delete_record',
    description: 'Delete a record set from a Google Cloud DNS managed zone.',
    inputSchema: {
      type: 'object',
      properties: {
        ...DNS_TARGET,
        name: str('Exact record name (e.g. "sub.example.com.")'),
        type: str('Record type (e.g. "A", "CNAME", "TXT")')
      },
      required: ['name', 'type']
    }
  },
  {
    name: 'gtm_list_accounts',
    description: 'List accessible Google Tag Manager accounts.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'gtm_list_containers',
    description: 'List containers of a GTM account.',
    inputSchema: {
      type: 'object',
      properties: { accountId: str('GTM account ID') },
      required: ['accountId']
    }
  },
  {
    name: 'gtm_list_workspaces',
    description: 'List workspaces of a GTM container.',
    inputSchema: {
      type: 'object',
      properties: { accountId: str('GTM account ID'), containerId: str('GTM container ID') },
      required: ['accountId', 'containerId']
    }
  },
  {
    name: 'gtm_list_tags',
    description: 'List tags in a GTM workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: str('GTM account ID'),
        containerId: str('GTM container ID'),
        workspaceId: str('GTM workspace ID (see gtm_list_workspaces)')
      },
      required: ['accountId', 'containerId', 'workspaceId']
    }
  },
  {
    name: 'gtm_get_tag',
    description: 'Get the full definition of a GTM tag.',
    inputSchema: {
      type: 'object',
      properties: { path: str('Tag resource path (e.g. "accounts/123/containers/456/workspaces/7/tags/8")') },
      required: ['path']
    }
  },
  {
    name: 'gtm_update_tag',
    description: 'Update a GTM tag (pause, unpause, change parameters). Send the full tag body.',
    inputSchema: {
      type: 'object',
      properties: {
        path: str('Tag resource path'),
        tag: { type: 'object', description: 'Full tag object' }
      },
      required: ['path', 'tag']
    }
  },
  {
    name: 'gtm_create_version',
    description: 'Create a container version from a GTM workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: str('GTM account ID'),
        containerId: str('GTM container ID'),
        workspaceId: str('GTM workspace ID'),
        name: str('Version name'),
        notes: str('Version notes')
      },
      required: ['accountId', 'containerId', 'workspaceId', 'name']
    }
  },
  {
    name: 'gtm_publish_version',
    description: 'Publish a GTM container version, making it live.',
    inputSchema: {
      type: 'object',
      properties: { path: str('Version resource path (e.g. "accounts/123/containers/456/versions/9")') },
      required: ['path']
    }
  }
]
