import type { FlowDefinition } from './types';
import { DATAPLANE_NODES } from './types';

export const toolsList: FlowDefinition = {
  title: 'Tools/List',
  nodes: DATAPLANE_NODES,
  steps: [
    {
      from: 'client', to: 'envoy', label: 'tools/list', type: 'request',
      detail: {
        summary: 'Client requests the aggregated list of tools from all registered MCP servers.',
        technical: 'POST /mcp\nmcp-session-id: <gateway-session-id>\n\n{\n  "jsonrpc": "2.0",\n  "method": "tools/list",\n  "id": 2\n}',
      },
    },
    {
      from: 'envoy', to: 'router', label: 'ext_proc', type: 'request',
      detail: {
        summary: 'Envoy calls the Router via ext_proc to inspect the request.',
        technical: 'Router parses JSON-RPC body.\nmethod: tools/list\n\nSets x-mcp-method header for\ndownstream policy evaluation.',
      },
    },
    {
      from: 'router', to: 'envoy', label: 'set headers', type: 'response',
      detail: {
        summary: 'Router sets the method header. No authority override - tools/list goes to the Broker (default backend).',
        technical: 'ext_proc response sets:\n  x-mcp-method: tools/list\n\nNo :authority override.\nEnvoy routes to default backend (Broker).',
      },
    },
    {
      from: 'envoy', to: 'broker', label: 'route to Broker', type: 'request',
      detail: {
        summary: 'Envoy routes to the Broker. Broker assembles the aggregated tool list from all connected upstream MCP servers.',
        technical: 'Broker aggregates tools from all\nregistered upstream MCP servers.\n\nEach tool is prefixed with the\nserver name: server1_greet, server2_hello\n\nFiltering applied via:\n  - x-authorised-tools header (signed)\n  - x-mcp-virtualserver header (client)',
      },
    },
    {
      from: 'broker', to: 'client', label: 'aggregated tools', type: 'response',
      detail: {
        summary: 'Client receives the combined tool list from all registered MCP servers, with each tool prefixed by its server name.',
        technical: '{\n  "jsonrpc": "2.0",\n  "result": {\n    "tools": [\n      { "name": "server1_greet", ... },\n      { "name": "server1_time", ... },\n      { "name": "server2_hello_world", ... }\n    ]\n  },\n  "id": 2\n}',
      },
    },
  ],
};
