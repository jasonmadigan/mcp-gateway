import type { FlowDefinition } from './types';
import { DATAPLANE_NODES } from './types';

export const auth: FlowDefinition = {
  title: 'Auth (OAuth)',
  nodes: DATAPLANE_NODES,
  steps: [
    {
      from: 'client', to: 'envoy', label: 'POST /mcp init (no auth)', type: 'request',
      detail: {
        summary: 'Client sends an initialize request without authentication credentials.',
        technical: 'POST /mcp\nContent-Type: application/json\nNo Authorization header\n\n{\n  "jsonrpc": "2.0",\n  "method": "initialize",\n  ...\n}',
      },
    },
    {
      from: 'envoy', to: 'router', label: 'ext_proc', type: 'request',
      detail: {
        summary: 'Envoy calls Router via ext_proc. Router sets method headers.',
        technical: 'Router identifies method: initialize\nSets x-mcp-method header.\nNo :authority override.',
      },
    },
    {
      from: 'envoy', to: 'auth', label: 'WASM filter', type: 'request',
      detail: {
        summary: 'Envoy passes the request through the WASM filter in its HTTP filter chain. The WASM filter calls Authorino to enforce the AuthPolicy.',
        technical: 'Envoy HTTP filter chain:\n  ext_proc (Router) -> WASM filter\n\nWASM filter consults Authorino with\nthe configured AuthPolicy rules.\n\nChecking: JWT presence, validity,\nclaims-based access rules.',
      },
    },
    {
      from: 'auth', to: 'authorino', label: 'evaluate policy', type: 'internal',
      detail: {
        summary: 'WASM delegates to Authorino for policy evaluation.',
        technical: 'Authorino evaluates AuthPolicy:\n  - Authentication: JWT required\n  - No Bearer token found\n  - Result: DENY',
      },
    },
    {
      from: 'authorino', to: 'client', label: '401 WWW-Authenticate', type: 'response',
      detail: {
        summary: 'Authorino rejects the request with a 401 containing a resource metadata URL. This tells the client where to find auth configuration.',
        technical: 'HTTP 401 Unauthorized\n\nWWW-Authenticate: Bearer\n  resource_metadata=\n  "<host>/.well-known/\n  oauth-protected-resource/mcp"',
      },
    },
    {
      from: 'client', to: 'envoy', label: 'GET .well-known/oauth-protected-resource', type: 'request',
      detail: {
        summary: 'Client follows the resource_metadata URL to discover the OAuth configuration.',
        technical: 'GET /.well-known/oauth-protected-resource/mcp\n\nMCP specification defines this\ndiscovery endpoint for OAuth\nprotected resources.',
      },
    },
    {
      from: 'envoy', to: 'broker', label: 'route to Broker', type: 'request',
      detail: {
        summary: 'Envoy routes the well-known request to the Broker, which serves the OAuth resource metadata.',
        technical: 'Broker handles .well-known requests.\nNo auth required for this endpoint\n(it IS the auth discovery mechanism).',
      },
    },
    {
      from: 'broker', to: 'client', label: 'auth metadata', type: 'response',
      detail: {
        summary: 'Broker responds with the OAuth server details so the client knows where to authenticate.',
        technical: '{\n  "resource": "<host>/mcp",\n  "authorization_servers": [\n    "https://auth.example.com/realms/mcp"\n  ],\n  "bearer_methods_supported": ["header"],\n  "scopes_supported": ["openid"]\n}',
      },
    },
    {
      from: 'client', to: 'authserver', label: 'register + authenticate', type: 'request',
      detail: {
        summary: 'Client performs dynamic client registration and authenticates with the OAuth server.',
        technical: 'OAuth 2.0 flow:\n1. Dynamic client registration\n   POST /realms/mcp/clients-registrations\n2. Authorization request\n3. Token exchange\n4. Receive access_token (JWT)',
      },
    },
    {
      from: 'authserver', to: 'client', label: 'access token', type: 'response',
      detail: {
        summary: 'Auth server issues a JWT access token to the client.',
        technical: 'Client now has:\n  Authorization: Bearer <jwt>\n\nJWT contains claims matching\nthe AuthPolicy requirements.',
      },
    },
    {
      from: 'client', to: 'envoy', label: 'POST /mcp init (with Bearer)', type: 'request',
      detail: {
        summary: 'Client retries the initialize request, this time with the Bearer token.',
        technical: 'POST /mcp\nAuthorization: Bearer <jwt>\nContent-Type: application/json\n\n{\n  "jsonrpc": "2.0",\n  "method": "initialize",\n  ...\n}',
      },
    },
    {
      from: 'envoy', to: 'auth', label: 'WASM filter', type: 'request',
      detail: {
        summary: 'WASM filter evaluates auth again. This time the JWT is present and valid.',
        technical: 'Authorino evaluates AuthPolicy:\n  - Authentication: JWT present\n  - JWT valid, not expired\n  - Claims match policy rules\n  - Result: ALLOW',
      },
    },
    {
      from: 'envoy', to: 'broker', label: 'auth OK, route to Broker', type: 'request',
      detail: {
        summary: 'Auth passes. Envoy routes the request to the Broker (default backend for /mcp).',
        technical: 'Envoy routing decision:\n  Auth passed, no :authority override\n  Routes to default backend (Broker)\n\nAuth context headers added by\nAuthorino (e.g. x-authorised-tools).',
      },
    },
    {
      from: 'broker', to: 'client', label: 'init response + session', type: 'response',
      detail: {
        summary: 'Broker responds with capabilities and session ID, same as the unauthenticated flow. Auth is transparent to the MCP protocol.',
        technical: 'HTTP 200\nmcp-session-id: <gateway-session-id>\n\nIdentical to the unauthenticated\ninitialize response. Auth is\ntransparent to the MCP protocol.',
      },
    },
  ],
};
