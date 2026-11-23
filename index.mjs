#!/usr/bin/env node
import dns from 'node:dns'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { hasAnyOAuthTokens } from './src/config.mjs'
import { cloudHandlers } from './src/handlers/cloud.mjs'
import { driveHandlers } from './src/handlers/drive.mjs'
import { personalHandlers } from './src/handlers/personal.mjs'
import { workspaceHandlers } from './src/handlers/workspace.mjs'
import { cloudTools } from './src/tools/defs-cloud.mjs'
import { driveTools } from './src/tools/defs-drive.mjs'
import { PERSONAL_TOOL_NAMES, personalTools } from './src/tools/defs-personal.mjs'
import { workspaceTools } from './src/tools/defs-workspace.mjs'

// Some hosts advertise broken IPv6 routes to googleapis.com.
dns.setDefaultResultOrder('ipv4first')

const SERVER_VERSION = '1.0.0'

const TOOLS = [...workspaceTools, ...personalTools, ...driveTools, ...cloudTools]
const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]))
const HANDLERS = { ...workspaceHandlers, ...personalHandlers, ...driveHandlers, ...cloudHandlers }

for (const tool of TOOLS) {
  if (typeof HANDLERS[tool.name] !== 'function') throw new Error(`Tool "${tool.name}" has no handler`)
}

function missingRequired(tool, args) {
  return (tool.inputSchema.required || []).filter((key) => {
    const value = args?.[key]
    return value === undefined || value === null || value === ''
  })
}

const server = new Server(
  { name: 'mcp-google-workspace', version: SERVER_VERSION },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  // OAuth-profile tools are only exposed when at least one tokens file exists.
  const tools = hasAnyOAuthTokens() ? TOOLS : TOOLS.filter((t) => !PERSONAL_TOOL_NAMES.has(t.name))
  return { tools }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params
  try {
    const tool = TOOLS_BY_NAME.get(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)
    const missing = missingRequired(tool, args)
    if (missing.length) throw new Error(`Missing required argument(s): ${missing.join(', ')}`)
    return await HANDLERS[name](args)
  } catch (err) {
    console.error(`[mcp-google-workspace] ${name} failed:`, err)
    return {
      isError: true,
      content: [{ type: 'text', text: `Error running ${name}: ${err.message}` }]
    }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
console.error(`mcp-google-workspace v${SERVER_VERSION} running on stdio (${TOOLS.length} tools)`)
