import type { FlowDefinition } from './types';
import { DATAPLANE_NODES } from './types';

export const toolsCall: FlowDefinition = {
  title: 'Tools/Call',
  nodes: DATAPLANE_NODES,
  steps: [
    {
      from: 'client', to: 'envoy', label: 'tools/call server1_greet', type: 'request',
      detail: {
        summary: 'Client calls a specific tool using its prefixed name.',
        technical: 'POST /mcp\nmcp-session-id: <gateway-session-id>\n\n{\n  "jsonrpc": "2.0",\n  "method": "tools/call",\n  "params": {\n    "name": "server1_greet",\n    "arguments": { "name": "world" }\n  },\n  "id": 3\n}',
      },
    },
    {
      from: 'envoy', to: 'router', label: 'ext_proc', type: 'request',
      detail: {
        summary: 'Envoy calls the Router via ext_proc. Router parses the JSON-RPC body and extracts the server prefix.',
        technical: 'Router parses JSON-RPC body:\n  method: tools/call\n  tool: server1_greet\n\nExtracts server prefix "server1"\nto determine target backend.',
      },
    },
    {
      from: 'router', to: 'cache', label: 'lookup session', type: 'internal',
      detail: {
        summary: 'Router checks the session cache for an existing backend session with this MCP server.',
        technical: 'Cache key:\n  gateway-session-id + server-name\n\nLookup: GET session for\n  (gateway-sid, "server1")\n\nResult: MISS (no backend session yet)',
      },
    },
    {
      from: 'router', to: 'envoy', label: 'hairpin: init request', type: 'request',
      detail: {
        summary: 'No backend session exists. Router creates an internal HTTP client that sends an initialize request back through Envoy. This hairpin ensures auth policies on the server\'s HTTPRoute are enforced.',
        technical: 'Router calls InitForClient() which\ncreates an HTTP client targeting:\n  http://MCPGatewayInternalHostname/mcp\n\nHeaders set:\n  mcp-init-host: server1.<host>\n  x-api-key: <router-api-key>\n\nThis request re-enters Envoy and\ngoes through ext_proc again.',
      },
    },
    {
      from: 'envoy', to: 'server1', label: 'initialize', type: 'request',
      detail: {
        summary: 'Envoy routes the hairpinned initialize to Server 1. The Router processes it again via ext_proc, sees the mcp-init-host header, and sets :authority to the target server.',
        technical: 'Hairpin ext_proc processing:\n  Router sees mcp-init-host header\n  Unsets mcp-init-host\n  Sets :authority to server1.<host>\n\nEnvoy routes to Server 1 via\nits HTTPRoute.\n\nPOST /mcp\n  {"jsonrpc":"2.0","method":"initialize",...}',
      },
    },
    {
      from: 'server1', to: 'router', label: 'init OK + backend session', type: 'response',
      detail: {
        summary: 'Server 1 responds with capabilities and a backend session ID. The Router\'s internal HTTP client receives this response.',
        technical: 'HTTP 200\nmcp-session-id: <backend-session-id>\n\nResponse received by the internal\nHTTP client in the Router.\n\nBackend confirms protocol version\nand capabilities.',
      },
    },
    {
      from: 'router', to: 'cache', label: 'store session', type: 'internal',
      detail: {
        summary: 'Router stores the backend session ID, keyed by the gateway session and server name.',
        technical: 'Cache STORE:\n  key: (gateway-sid, "server1")\n  value: <backend-session-id>\n\nFuture tools/call requests to server1\nwill find this session and skip\nthe hairpin initialize.',
      },
    },
    {
      from: 'router', to: 'envoy', label: 'set :authority + headers', type: 'response',
      detail: {
        summary: 'Router returns the ext_proc response for the original tools/call. Sets :authority to route directly to Server 1, bypassing the Broker entirely.',
        technical: 'ext_proc response sets:\n  :authority: server1.<host>\n  :path: /mcp\n  mcp-session-id: <backend-session-id>\n  x-mcp-tool: greet\n  x-mcp-method: tools/call\n\nBody modified:\n  "server1_greet" -> "greet"\n  (prefix stripped)\n\nBroker is NOT involved in tools/call.',
      },
    },
    {
      from: 'envoy', to: 'server1', label: 'tools/call greet', type: 'request',
      detail: {
        summary: 'Envoy routes the tools/call directly to Server 1 based on the :authority header. The Broker is completely bypassed.',
        technical: 'Envoy routing decision:\n  :authority = server1.<host>\n  Routes to Server 1 HTTPRoute\n\nPOST /mcp\nmcp-session-id: <backend-session-id>\n\n{\n  "jsonrpc": "2.0",\n  "method": "tools/call",\n  "params": {\n    "name": "greet",\n    "arguments": { "name": "world" }\n  },\n  "id": 3\n}',
      },
    },
    {
      from: 'server1', to: 'client', label: 'tool result', type: 'response',
      detail: {
        summary: 'Server 1 executes the tool and returns the result to the client via Envoy.',
        technical: '{\n  "jsonrpc": "2.0",\n  "result": {\n    "content": [\n      {\n        "type": "text",\n        "text": "Hello, world!"\n      }\n    ]\n  },\n  "id": 3\n}',
      },
    },
  ],
};
