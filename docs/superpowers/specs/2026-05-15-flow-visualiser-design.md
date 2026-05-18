# MCP Gateway Flow Visualiser

Interactive single-page application that visualises MCP Gateway request flows. Lives in `docs/flow-visualiser.html` and deploys via GitHub Pages.

## Problem

The gateway's request flow involves multiple components (Router, Broker, Gateway, Session Cache, Auth) interacting in non-obvious ways. The existing mermaid sequence diagrams in `docs/design/flows.md` are static and don't convey timing, the hairpin pattern, or the layered auth dance well. New users and integrators need a way to _watch_ these flows play out.

## Reference

Inspired by [AI Gateway Flow Visualiser](https://noyitz.github.io/ai-gateway-docs/ai-gateway-flow.html) — a dark-themed animated flow diagram with playback controls and step navigation.

## Audience

Layered — approachable for new users by default, with drill-down technical detail for developers. The high-level view shows "what happens", the detail panel shows "exactly what headers/payloads/logic".

## Technology

- Single self-contained HTML file (`docs/flow-visualiser.html`)
- D3.js v7 loaded from CDN for SVG path generation, transitions, and animation
- Fixed component positions (no force layout)
- Inline CSS with dark/light theme toggle via `data-theme` attribute
- Flow data defined as a JS object at the top of the script block
- No build step, no other dependencies

## Page Structure

Four zones:

1. **Header** — title ("MCP Gateway Request Flow"), dark/light theme toggle, project link
2. **Flow tabs** — 5 tabs: Initialize, Tools/List, Tools/Call, Auth (OAuth), Server Registration
3. **Main canvas** — SVG area with fixed-position component nodes and animated arrows
4. **Controls + Detail panel** — playback controls, clickable step list, and expandable detail panel

## Component Layout

Left-to-right flow matching the existing sequence diagram direction:

```
┌──────────┐    ┌──────────────────────────────────────┐    ┌──────────┐
│          │    │           Gateway (Envoy)             │    │          │
│   MCP    │───>│  ┌────────┐  ┌──────┐  ┌──────────┐ │───>│   MCP    │
│  Client  │    │  │ Router │  │ WASM │  │ Authorino│ │    │  Server  │
│          │<───│  │ext_proc│  │      │  │          │ │<───│          │
│          │    │  └────┬───┘  └──────┘  └──────────┘ │    └──────────┘
└──────────┘    │       │                              │
                │  ┌────v───┐                          │
                │  │ Broker │                          │
                │  │ (HTTP) │                          │
                │  └────┬───┘                          │
                │       │                              │
                │  ┌────v────────┐                     │
                │  │Session Cache│                     │
                │  └─────────────┘                     │
                └──────────────────────────────────────┘
```

The Server Registration flow uses a different layout with Controller, K8s API, and Config Secret replacing the data-plane components.

## Component Colour Coding

Each component has a distinct accent colour used for its border, label, and glow:

| Component | Colour | Hex | Role |
|-|-|-|-|
| MCP Client | Blue | #4fc3f7 | Initiator |
| Gateway (Envoy) | Purple | #ab47bc | Proxy layer |
| Router (ext_proc) | Green | #66bb6a | Request parsing/routing |
| Broker | Orange | #ffa726 | Aggregation |
| Auth (WASM/Authorino) | Red | #ef5350 | Gatekeeper |
| Session Cache | Grey | #78909c | Storage |
| MCP Server | Teal | #26c6da | Destination |
| AuthServer | Amber | #ffd54f | External OAuth/OIDC provider (auth flow only) |
| Controller / K8s API | Yellow | #ffee58 | Control plane (registration only) |

## Arrow Styles

- **Request**: solid line, coloured by source component
- **Response**: dashed line, grey
- **Auth rejection**: solid red (#ef5350)

## Animation Model

Each flow is an ordered array of step objects:

```js
{
  from: "client",
  to: "gateway",
  label: "POST /mcp init",
  type: "request",        // request | response | internal
  detail: {
    summary: "Client sends initialize request to the gateway.",
    technical: `Headers:\n  Content-Type: application/json\n\nBody:\n  {"jsonrpc":"2.0","method":"initialize",...}`
  }
}
```

Step playback sequence:
1. **from** component highlights (glow + slight scale to 1.02x)
2. Animated arrow draws from **from** to **to** (SVG path with `stroke-dashoffset` via D3 transition)
3. **to** component highlights
4. Label appears near the arrow midpoint
5. Step list sidebar highlights current step
6. After delay (governed by speed), next step fires
7. Inactive components dim to 50% opacity

### Playback Controls

- Play/Pause toggle
- Speed: 1x (1.5s/step), 2x (0.75s/step), 3x (0.5s/step)
- Restart
- Loop toggle
- Clickable step list — clicking a step jumps to it and pauses

## Detail Panel

Right side of the canvas (or below on narrow viewports). Shows for the active step:

- **Step title** — e.g. "Router sets routing headers"
- **Summary** — plain English, one sentence
- **Technical detail** (expandable) — headers, JSON-RPC snippets, internal logic. Examples:
  - Headers being set (`x-mcp-tool`, `authority`, `x-mcp-method`)
  - Body modifications (prefix stripping)
  - Session cache operations
  - Auth challenge/response content (`WWW-Authenticate`, `.well-known` response)

Collapses to step title only on small viewports, expandable on tap.

## The Five Flows

### 1. Initialize (~5 steps)

Client -> Gateway -> Router (set headers) -> Broker -> response with `mcp-session-id`. Linear flow, default tab.

Source: `flows.md` "Initialize" diagram.

### 2. Tools/List (~5 steps)

Client -> Gateway -> Router (set headers) -> Broker -> aggregated tools response. Detail panel explains filtering via signed `x-authorised-tools` header and `x-mcp-virtualserver` headers.

Source: `flows.md` "Aggregated Tools/List" diagram.

### 3. Tools/Call (~10-12 steps)

The most complex data-plane flow. Includes the lazy-init hairpin:

Client -> Gateway -> Router -> Session Cache lookup -> cache miss -> hairpin initialize through Gateway -> MCP Server responds -> store session in cache -> Router sets authority/headers/strips prefix -> Gateway routes to MCP Server -> response to Client.

The hairpin arrow path curves visually to show re-entry through the Gateway. This is the signature visual of the whole visualiser.

Source: `flows.md` "Tools/Call" diagram.

### 4. Auth - Full OAuth (~12-14 steps)

The full authentication dance including the 401 challenge:

Client -> Gateway -> Router -> WASM -> Authorino -> 401 WWW-Authenticate -> Client fetches `.well-known/oauth-protected-resource` -> Broker responds with auth metadata -> Client registers + authenticates with AuthServer -> retry with Bearer token -> WASM -> Authorino OK -> through to MCP Server.

Auth rejection arrows use red colour. Successful retry path uses green.

Source: `flows.md` "MCP Server Tool Call with Auth (Full auth flow)" diagram.

### 5. Server Registration (~6-8 steps)

Control-plane flow with different component layout:

Controller watches MCPServerRegistration CRD -> discovers HTTPRoute backends -> resolves internal/external service URLs -> writes config Secret -> Broker/Router pick up new config.

The SVG canvas swaps to a control-plane layout (Controller, K8s API, Config Secret) when this tab is selected.

Source: `docs/design/overview.md` controller responsibilities + `docs/design/backend-mcp-management.md`.

## Dark/Light Theme

- Dark theme default: `#0f0f1a` background, light text, component glows
- Light theme: white background, dark text, component borders instead of glows
- Toggle via sun/moon icon in header
- Implemented with `data-theme="dark|light"` on `<body>`, CSS custom properties for all colours

## Responsive Behaviour

- Desktop (>1024px): canvas left, detail panel right
- Tablet (768-1024px): canvas full width, detail panel below
- Mobile (<768px): simplified view with step list only, no canvas animation. Message suggesting desktop for full experience (matching the reference's approach)

## Future Considerations (not in v1)

- Notifications flow
- Rate limiting flow
- Editable flow data (load custom flows from JSON)
- Embed in docs.kuadrant.io via iframe
- Virtual server filtering flow
