import type { FlowDefinition } from './types';
import { CONTROLPLANE_NODES } from './types';

export const registration: FlowDefinition = {
  title: 'Server Registration',
  nodes: CONTROLPLANE_NODES,
  steps: [
    {
      from: 'k8sapi', to: 'controller', label: 'MCPServerRegistration created', type: 'request',
      detail: {
        summary: 'A user creates an MCPServerRegistration resource. The controller is watching for these events.',
        technical: 'apiVersion: mcp.kuadrant.io/v1alpha1\nkind: MCPServerRegistration\nmetadata:\n  name: my-server\nspec:\n  serverRef:\n    kind: HTTPRoute\n    name: my-server-route',
      },
    },
    {
      from: 'controller', to: 'k8sapi', label: 'resolve HTTPRoute', type: 'request',
      detail: {
        summary: 'Controller looks up the referenced HTTPRoute to discover the backend service.',
        technical: 'GET HTTPRoute "my-server-route"\n\nController checks backendRef:\n  kind: Service -> internal\n    URL: name.ns.svc.cluster.local\n  kind: Hostname -> external\n    URL: built from hostname directly',
      },
    },
    {
      from: 'k8sapi', to: 'controller', label: 'HTTPRoute details', type: 'response',
      detail: {
        summary: 'K8s API returns the HTTPRoute with backend references.',
        technical: 'HTTPRoute resolved:\n  backendRef:\n    kind: Service\n    name: my-mcp-server\n    namespace: default\n    port: 8080\n\nResolved URL:\n  http://my-mcp-server.default.svc.cluster.local:8080/mcp',
      },
    },
    {
      from: 'controller', to: 'secret', label: 'write config Secret', type: 'request',
      detail: {
        summary: 'Controller assembles the full gateway configuration and writes it to a Kubernetes Secret.',
        technical: 'Secret contains:\n  - List of all registered servers\n  - Backend URLs\n  - Auth credentials per server\n  - Server prefixes for tool naming\n\nSecret has label:\n  mcp.kuadrant.io/secret: "true"',
      },
    },
    {
      from: 'secret', to: 'broker', label: 'config update', type: 'internal',
      detail: {
        summary: 'Broker detects the config Secret change and connects to the newly registered MCP server.',
        technical: 'Broker watches the config Secret.\nOn change:\n  1. Parse new server list\n  2. Connect to new servers\n  3. Send initialize to each\n  4. Fetch tools/list from each\n  5. Build aggregated tool list',
      },
    },
    {
      from: 'secret', to: 'router', label: 'config update', type: 'internal',
      detail: {
        summary: 'Router also picks up the config change to learn about the new server routing details.',
        technical: 'Router watches the config Secret.\nOn change:\n  1. Parse new server list\n  2. Update routing table\n  3. Map server prefixes to\n     authority headers',
      },
    },
    {
      from: 'broker', to: 'server1', label: 'initialize + tools/list', type: 'request',
      detail: {
        summary: 'Broker connects to the new MCP server, initializes a session, and fetches its tool list.',
        technical: 'Broker acts as MCP client:\n  1. POST /mcp initialize\n  2. Verify protocolVersion\n  3. Check capabilities\n  4. POST /mcp tools/list\n  5. Prefix tools with server name\n  6. Add to aggregated list',
      },
    },
    {
      from: 'controller', to: 'k8sapi', label: 'update status', type: 'response',
      detail: {
        summary: 'Controller updates the MCPServerRegistration status to reflect the server is now registered and available.',
        technical: 'status:\n  conditions:\n    - type: Accepted\n      status: "True"\n    - type: Ready\n      status: "True"\n  serverAddress:\n    http://my-mcp-server.default...',
      },
    },
  ],
};
