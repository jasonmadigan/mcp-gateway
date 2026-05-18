import type { FlowDefinition } from './types';
import { DATAPLANE_NODES } from './types';

export const initialize: FlowDefinition = {
  title: 'Initialize',
  nodes: DATAPLANE_NODES,
  steps: [
    {
      from: 'client', to: 'envoy', label: 'POST /mcp init', type: 'request',
      detail: {
        summary: 'Client sends an initialize request to the Envoy proxy.',
        technical: 'POST /mcp\nContent-Type: application/json\n\n{\n  "jsonrpc": "2.0",\n  "method": "initialize",\n  "params": {\n    "protocolVersion": "2025-03-26",\n    "capabilities": {},\n    "clientInfo": { "name": "my-client", "version": "1.0" }\n  },\n  "id": 1\n}',
      },
    },
    {
      from: 'envoy', to: 'router', label: 'ext_proc', type: 'request',
      detail: {
        summary: 'Envoy calls the Router via ext_proc gRPC to inspect the request and set routing headers.',
        technical: 'Envoy ext_proc ProcessingRequest\nPhase: request_headers + request_body\n\nRouter parses the JSON-RPC body to\ndetermine method type (initialize).',
      },
    },
    {
      from: 'router', to: 'envoy', label: 'set headers', type: 'response',
      detail: {
        summary: 'Router identifies this as an initialize request. No authority override needed - the Broker is the default backend for /mcp.',
        technical: 'ext_proc response sets:\n  x-mcp-method: initialize\n\nNo :authority override.\nEnvoy routes to default backend (Broker).',
      },
    },
    {
      from: 'envoy', to: 'broker', label: 'route to Broker', type: 'request',
      detail: {
        summary: 'Envoy routes the request to the Broker, which is the default backend for the /mcp endpoint.',
        technical: 'Envoy routing decision:\n  No :authority override from Router\n  Default backend for /mcp = Broker\n\nBroker receives the initialize request.',
      },
    },
    {
      from: 'broker', to: 'client', label: 'init response + mcp-session-id', type: 'response',
      detail: {
        summary: 'Broker responds with server capabilities and a gateway session ID. The client must include this in all subsequent requests.',
        technical: 'HTTP 200\nmcp-session-id: <gateway-session-id>\n\n{\n  "jsonrpc": "2.0",\n  "result": {\n    "protocolVersion": "2025-03-26",\n    "capabilities": {\n      "tools": { "listChanged": true }\n    },\n    "serverInfo": {\n      "name": "mcp-gateway",\n      "version": "0.6.0"\n    }\n  },\n  "id": 1\n}',
      },
    },
  ],
};
