# Breaking Change: Browser CORS now requires spec.cors

## What changed
Cross-origin browser access is no longer granted implicitly. Three previously
unconditional behaviours have been removed:

- The OAuth discovery endpoint (`/.well-known/oauth-protected-resource`) and the
  `/status` endpoint no longer emit a hardcoded `Access-Control-Allow-Origin: *`
  (which was also incorrectly paired with `Access-Control-Allow-Credentials: true`).
- The blanket `OPTIONS /mcp` handler that answered every preflight with `200` has
  been removed.

CORS is now driven entirely by `spec.cors` on the `MCPGatewayExtension`. When
`spec.cors` is unset, the gateway emits no CORS headers and cross-origin browser
requests are refused. A matched origin is echoed back exactly (never `*`), and a
wildcard origin never carries credentials.

## Migration Steps
If browser-based clients call this gateway cross-origin, set `spec.cors` with the
origins you want to allow. The MCP Streamable HTTP transport headers and methods
are always included, so you only list your own origins:

```yaml
apiVersion: mcp.kuadrant.io/v1
kind: MCPGatewayExtension
metadata:
  name: mcp-gateway
spec:
  cors:
    allowOrigins:
      - https://console.example.com
```

`allowOrigins` is required when `spec.cors` is set; an empty list is rejected at
admission. `allowCredentials: true` cannot be combined with a wildcard (`*` or a
value containing `*`) in `allowOrigins`.
