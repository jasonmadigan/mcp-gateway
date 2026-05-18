# Flow Visualiser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive animated SPA that visualises MCP Gateway request flows, living at `docs/flow-visualiser.html`.

**Architecture:** Single self-contained HTML file with inline CSS and JS. D3.js v7 loaded from CDN handles SVG path generation and animated transitions. Flow data is a JS object at the top of the script block. Components are fixed-position SVG rounded rects; arrows animate between them using `stroke-dashoffset` transitions.

**Tech Stack:** HTML5, CSS3 (custom properties, media queries), vanilla JS, D3.js v7 (CDN), SVG.

---

## File Structure

Single file: `docs/flow-visualiser.html`

Internal structure (top to bottom within the file):
1. `<!DOCTYPE html>` + `<head>` with inline `<style>` (CSS custom properties, layout, theme, responsive)
2. `<body>` with HTML structure (header, tabs, canvas container, controls, detail panel)
3. `<script src="https://d3js.org/d3.v7.min.js">` (CDN)
4. `<script>` with:
   - Flow data object (all 5 flows with steps)
   - Component definitions (positions, colours, labels)
   - Layout definitions (data-plane layout, control-plane layout)
   - Rendering engine (D3 SVG drawing)
   - Animation engine (playback state machine)
   - UI controllers (tabs, controls, detail panel, theme toggle)

---

### Task 1: HTML Shell + CSS Theme System

**Files:**
- Create: `docs/flow-visualiser.html`

This task creates the page skeleton with the four-zone layout, dark/light theme toggle, and all CSS custom properties. No JS yet — just static HTML and CSS that looks right.

- [ ] **Step 1: Create the HTML file with head, meta, and CSS custom properties**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MCP Gateway — Request Flow</title>
<style>
:root {
  /* dark theme (default) */
  --bg-primary: #0f0f1a;
  --bg-secondary: #1a1a2e;
  --bg-tertiary: #16213e;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --text-muted: #666;
  --border: #2a2a3e;
  --border-active: #4a4a6e;

  /* component colours */
  --c-client: #4fc3f7;
  --c-gateway: #ab47bc;
  --c-router: #66bb6a;
  --c-broker: #ffa726;
  --c-auth: #ef5350;
  --c-cache: #78909c;
  --c-server: #26c6da;
  --c-authserver: #ffd54f;
  --c-controller: #ffee58;

  /* arrow colours */
  --arrow-response: #78909c;
  --arrow-reject: #ef5350;

  /* animation */
  --step-duration: 1500ms;

  /* layout */
  --header-height: 56px;
  --tab-height: 44px;
  --controls-width: 320px;
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #eeeeee;
  --text-primary: #1a1a1a;
  --text-secondary: #555;
  --text-muted: #999;
  --border: #ddd;
  --border-active: #aaa;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  overflow-x: hidden;
}
</style>
</head>
<body data-theme="dark">
</body>
</html>
```

- [ ] **Step 2: Add the four-zone HTML structure**

Inside `<body>`, add:

```html
<!-- header -->
<header class="header">
  <div class="header-title">
    <h1>MCP Gateway <span class="header-subtitle">Request Flow</span></h1>
  </div>
  <div class="header-actions">
    <button class="theme-toggle" id="themeToggle" aria-label="Toggle theme"></button>
    <a href="https://github.com/kuadrant/mcp-gateway" class="header-link" target="_blank" rel="noopener">GitHub</a>
  </div>
</header>

<!-- flow tabs -->
<nav class="tabs" id="flowTabs">
  <button class="tab active" data-flow="initialize">Initialize</button>
  <button class="tab" data-flow="tools-list">Tools/List</button>
  <button class="tab" data-flow="tools-call">Tools/Call</button>
  <button class="tab" data-flow="auth">Auth (OAuth)</button>
  <button class="tab" data-flow="registration">Server Registration</button>
</nav>

<!-- main content area -->
<div class="main">
  <!-- svg canvas -->
  <div class="canvas-container" id="canvasContainer">
    <svg id="canvas"></svg>
  </div>

  <!-- controls + detail panel -->
  <aside class="sidebar" id="sidebar">
    <!-- playback controls -->
    <div class="controls">
      <div class="controls-row">
        <button class="ctrl-btn" id="btnPlay" aria-label="Play">&#9654;</button>
        <button class="ctrl-btn" id="btnRestart" aria-label="Restart">&#8634;</button>
        <button class="ctrl-btn" id="btnSpeed">1x</button>
        <button class="ctrl-btn" id="btnLoop" aria-label="Loop">&#8635;</button>
      </div>
    </div>

    <!-- step list -->
    <div class="step-list" id="stepList">
      <h3 class="step-list-title">Steps</h3>
      <ol id="stepListItems"></ol>
    </div>

    <!-- detail panel -->
    <div class="detail-panel" id="detailPanel">
      <h3 class="detail-title" id="detailTitle"></h3>
      <p class="detail-summary" id="detailSummary"></p>
      <details class="detail-technical">
        <summary>Technical Detail</summary>
        <pre class="detail-code" id="detailCode"></pre>
      </details>
    </div>
  </aside>
</div>

<!-- mobile notice -->
<div class="mobile-notice" id="mobileNotice">
  <p>Open this page on a desktop for the full interactive experience.</p>
</div>
```

- [ ] **Step 3: Add layout and component CSS**

Add to the `<style>` block:

```css
/* header */
.header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}
.header-title h1 {
  font-size: 18px;
  font-weight: 600;
}
.header-subtitle {
  font-weight: 400;
  color: var(--text-secondary);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.theme-toggle {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 16px;
}
[data-theme="dark"] .theme-toggle::after { content: "☀"; }
[data-theme="light"] .theme-toggle::after { content: "☾"; }
.header-link {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
}
.header-link:hover { color: var(--text-primary); }

/* tabs */
.tabs {
  height: var(--tab-height);
  display: flex;
  gap: 0;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}
.tab {
  padding: 0 20px;
  height: 100%;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}
.tab:hover { color: var(--text-primary); }
.tab.active {
  color: var(--text-primary);
  border-bottom-color: var(--c-client);
}

/* main layout */
.main {
  display: flex;
  height: calc(100vh - var(--header-height) - var(--tab-height));
}
.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}
#canvas {
  width: 100%;
  height: 100%;
}

/* sidebar */
.sidebar {
  width: var(--controls-width);
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* controls */
.controls {
  padding: 12px;
  border-bottom: 1px solid var(--border);
}
.controls-row {
  display: flex;
  gap: 8px;
}
.ctrl-btn {
  flex: 1;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
}
.ctrl-btn:hover { border-color: var(--border-active); }
.ctrl-btn.active {
  background: var(--c-client);
  color: #000;
  border-color: var(--c-client);
}

/* step list */
.step-list {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  flex: 1;
  overflow-y: auto;
}
.step-list-title {
  font-size: 12px;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}
#stepListItems {
  list-style: none;
  padding: 0;
}
#stepListItems li {
  padding: 6px 8px;
  font-size: 13px;
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 2px;
}
#stepListItems li:hover { background: var(--bg-tertiary); }
#stepListItems li.active {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-left: 2px solid var(--c-client);
}

/* detail panel */
.detail-panel {
  padding: 12px;
}
.detail-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}
.detail-summary {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
}
.detail-technical summary {
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  margin-bottom: 8px;
}
.detail-code {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  white-space: pre;
}

/* mobile notice */
.mobile-notice {
  display: none;
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary);
}

/* responsive */
@media (max-width: 1024px) {
  .main { flex-direction: column; }
  .sidebar {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--border);
    max-height: 40vh;
  }
}
@media (max-width: 768px) {
  .canvas-container { display: none; }
  .mobile-notice { display: block; }
  .sidebar { max-height: none; }
}
```

- [ ] **Step 4: Add the theme toggle JS**

Add before `</body>`:

```html
<script>
document.getElementById('themeToggle').addEventListener('click', function() {
  var body = document.body;
  var next = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  body.setAttribute('data-theme', next);
  localStorage.setItem('flow-vis-theme', next);
});
(function() {
  var saved = localStorage.getItem('flow-vis-theme');
  if (saved) document.body.setAttribute('data-theme', saved);
})();
</script>
```

- [ ] **Step 5: Open in browser and verify**

Open `docs/flow-visualiser.html` directly in a browser (no server needed). Verify:
- Dark theme renders with `#0f0f1a` background
- Theme toggle switches to light and persists on reload
- Four zones visible: header, tabs, empty canvas, sidebar with controls
- Responsive: at <768px canvas hides, mobile notice shows
- Tab highlighting works (active state on Initialize)

- [ ] **Step 6: Commit**

```bash
git add docs/flow-visualiser.html
git commit -s -m "feat: add flow visualiser HTML shell with theme system"
```

---

### Task 2: Component Definitions + SVG Rendering

**Files:**
- Modify: `docs/flow-visualiser.html`

This task defines the component data model (IDs, positions, colours, labels) for both layouts (data-plane and control-plane) and uses D3 to render them as SVG rounded rects with labels.

- [ ] **Step 1: Add D3 CDN script tag**

Add before the inline `<script>` tag:

```html
<script src="https://d3js.org/d3.v7.min.js"></script>
```

- [ ] **Step 2: Define component data for both layouts**

At the top of the inline `<script>` block (after the theme toggle code, start a new `<script>` block), define the component registry and layouts. Positions are in a 1000x600 coordinate space that scales to the SVG viewBox.

```js
var COMPONENTS = {
  client:     { label: 'MCP Client',         colour: '#4fc3f7', short: 'Client' },
  gateway:    { label: 'Gateway (Envoy)',     colour: '#ab47bc', short: 'Gateway' },
  router:     { label: 'Router (ext_proc)',   colour: '#66bb6a', short: 'Router' },
  broker:     { label: 'Broker',             colour: '#ffa726', short: 'Broker' },
  auth:       { label: 'Auth (WASM)',        colour: '#ef5350', short: 'Auth' },
  authorino:  { label: 'Authorino',          colour: '#ef5350', short: 'Authorino' },
  cache:      { label: 'Session Cache',      colour: '#78909c', short: 'Cache' },
  server:     { label: 'MCP Server',         colour: '#26c6da', short: 'Server' },
  authserver: { label: 'Auth Server',        colour: '#ffd54f', short: 'AuthServer' },
  controller: { label: 'Controller',         colour: '#ffee58', short: 'Controller' },
  k8sapi:     { label: 'K8s API',            colour: '#ffee58', short: 'K8s API' },
  secret:     { label: 'Config Secret',      colour: '#78909c', short: 'Secret' },
};

var LAYOUTS = {
  dataplane: {
    viewBox: '0 0 1000 600',
    nodes: [
      { id: 'client',    x: 50,  y: 200, w: 120, h: 80 },
      { id: 'gateway',   x: 250, y: 100, w: 500, h: 400, isContainer: true },
      { id: 'router',    x: 300, y: 150, w: 120, h: 60 },
      { id: 'auth',      x: 470, y: 150, w: 100, h: 60 },
      { id: 'authorino', x: 610, y: 150, w: 110, h: 60 },
      { id: 'broker',    x: 350, y: 280, w: 120, h: 60 },
      { id: 'cache',     x: 340, y: 400, w: 140, h: 50 },
      { id: 'server',    x: 830, y: 200, w: 120, h: 80 },
      { id: 'authserver',x: 830, y: 400, w: 120, h: 60 },
    ],
  },
  controlplane: {
    viewBox: '0 0 1000 500',
    nodes: [
      { id: 'controller', x: 100, y: 200, w: 140, h: 70 },
      { id: 'k8sapi',     x: 350, y: 120, w: 130, h: 60 },
      { id: 'secret',     x: 350, y: 320, w: 140, h: 60 },
      { id: 'broker',     x: 620, y: 200, w: 120, h: 60 },
      { id: 'router',     x: 620, y: 340, w: 120, h: 60 },
      { id: 'server',     x: 860, y: 200, w: 120, h: 70 },
    ],
  },
};
```

- [ ] **Step 3: Write the renderLayout function**

This draws SVG rects and labels for a given layout using D3.

```js
var svg = d3.select('#canvas');
var currentLayout = null;

function renderLayout(layoutName) {
  var layout = LAYOUTS[layoutName];
  currentLayout = layout;

  svg.attr('viewBox', layout.viewBox);
  svg.selectAll('*').remove();

  // defs for glow filter
  var defs = svg.append('defs');
  layout.nodes.forEach(function(node) {
    var comp = COMPONENTS[node.id];
    var filter = defs.append('filter')
      .attr('id', 'glow-' + node.id)
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '6')
      .attr('result', 'blur');
    filter.append('feFlood')
      .attr('flood-color', comp.colour)
      .attr('flood-opacity', '0.4');
    filter.append('feComposite')
      .attr('in2', 'blur')
      .attr('operator', 'in');
    var merge = filter.append('feMerge');
    merge.append('feMergeNode');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');
  });

  // arrow marker def
  defs.append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', '10').attr('refY', '5')
    .attr('markerWidth', '8').attr('markerHeight', '8')
    .attr('orient', 'auto-start-reverse')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', 'var(--text-muted)');

  // draw nodes
  var groups = svg.selectAll('g.node')
    .data(layout.nodes)
    .enter()
    .append('g')
    .attr('class', function(d) { return 'node node-' + d.id; })
    .attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });

  groups.append('rect')
    .attr('width', function(d) { return d.w; })
    .attr('height', function(d) { return d.h; })
    .attr('rx', 8)
    .attr('fill', function(d) { return d.isContainer ? 'none' : 'var(--bg-secondary)'; })
    .attr('stroke', function(d) { return COMPONENTS[d.id].colour; })
    .attr('stroke-width', function(d) { return d.isContainer ? 1 : 2; })
    .attr('stroke-dasharray', function(d) { return d.isContainer ? '6,3' : 'none'; })
    .attr('opacity', 1);

  groups.filter(function(d) { return !d.isContainer; })
    .append('text')
    .attr('x', function(d) { return d.w / 2; })
    .attr('y', function(d) { return d.h / 2; })
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('fill', function(d) { return COMPONENTS[d.id].colour; })
    .attr('font-size', '13px')
    .attr('font-weight', '600')
    .text(function(d) { return COMPONENTS[d.id].short; });

  groups.filter(function(d) { return d.isContainer; })
    .append('text')
    .attr('x', function(d) { return d.w / 2; })
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .attr('fill', function(d) { return COMPONENTS[d.id].colour; })
    .attr('font-size', '12px')
    .attr('opacity', 0.7)
    .text(function(d) { return COMPONENTS[d.id].label; });
}

renderLayout('dataplane');
```

- [ ] **Step 4: Open in browser and verify**

Open `docs/flow-visualiser.html`. Verify:
- SVG renders with all data-plane components in the left-to-right layout
- Gateway is a dashed container rect, other components are solid
- Each component has its accent colour on the border and label
- Components are visible and don't overlap

- [ ] **Step 5: Commit**

```bash
git add docs/flow-visualiser.html
git commit -s -m "feat: add component definitions and SVG rendering with D3"
```

---

### Task 3: Flow Data — All Five Flows

**Files:**
- Modify: `docs/flow-visualiser.html`

This task defines the step data for all five flows. Each step has `from`, `to`, `label`, `type`, and `detail` fields. This is the content that drives everything else.

- [ ] **Step 1: Define the FLOWS object**

Add after the LAYOUTS definition:

```js
var FLOWS = {
  'initialize': {
    layout: 'dataplane',
    title: 'Initialize',
    steps: [
      {
        from: 'client', to: 'gateway',
        label: 'POST /mcp init', type: 'request',
        detail: {
          summary: 'Client sends an initialize request to the gateway endpoint.',
          technical: 'POST /mcp\nContent-Type: application/json\n\n{\n  "jsonrpc": "2.0",\n  "method": "initialize",\n  "params": {\n    "protocolVersion": "2025-03-26",\n    "capabilities": {},\n    "clientInfo": { "name": "my-client", "version": "1.0" }\n  },\n  "id": 1\n}'
        }
      },
      {
        from: 'gateway', to: 'router',
        label: 'ext_proc request', type: 'request',
        detail: {
          summary: 'Gateway sends the request to the Router via the ext_proc gRPC interface for inspection.',
          technical: 'Envoy ext_proc ProcessingRequest\nPhase: request_headers + request_body\n\nRouter parses the JSON-RPC body to determine\nmethod type (initialize) and sets routing headers.'
        }
      },
      {
        from: 'router', to: 'gateway',
        label: 'set headers', type: 'response',
        detail: {
          summary: 'Router identifies this as an initialize request and sets headers. No routing change needed — the Broker is the default backend for /mcp.',
          technical: 'Headers set:\n  x-mcp-method: initialize\n\nNo authority override needed.\nBroker is the default backend for /mcp.'
        }
      },
      {
        from: 'gateway', to: 'broker',
        label: 'POST /mcp init', type: 'request',
        detail: {
          summary: 'Gateway forwards the initialize request to the Broker, which is the default backend for the /mcp endpoint.',
          technical: 'Broker is configured as the default\nbackend for the /mcp route.\n\nNo special routing required for\ninitialize requests.'
        }
      },
      {
        from: 'broker', to: 'client',
        label: 'init response + mcp-session-id', type: 'response',
        detail: {
          summary: 'Broker responds with server capabilities and a session ID. The client must include this session ID in all subsequent requests.',
          technical: 'HTTP 200\nmcp-session-id: <gateway-session-id>\n\n{\n  "jsonrpc": "2.0",\n  "result": {\n    "protocolVersion": "2025-03-26",\n    "capabilities": {\n      "tools": { "listChanged": true }\n    },\n    "serverInfo": {\n      "name": "mcp-gateway",\n      "version": "0.6.0"\n    }\n  },\n  "id": 1\n}'
        }
      },
    ]
  },

  'tools-list': {
    layout: 'dataplane',
    title: 'Tools/List',
    steps: [
      {
        from: 'client', to: 'gateway',
        label: 'tools/list', type: 'request',
        detail: {
          summary: 'Client requests the aggregated list of tools from all registered MCP servers.',
          technical: 'POST /mcp\nmcp-session-id: <gateway-session-id>\n\n{\n  "jsonrpc": "2.0",\n  "method": "tools/list",\n  "id": 2\n}'
        }
      },
      {
        from: 'gateway', to: 'router',
        label: 'ext_proc request', type: 'request',
        detail: {
          summary: 'Gateway sends the request through the Router for header setting.',
          technical: 'Router parses JSON-RPC body.\nmethod: tools/list\n\nSets x-mcp-method header for\ndownstream policy evaluation.'
        }
      },
      {
        from: 'router', to: 'gateway',
        label: 'set headers', type: 'response',
        detail: {
          summary: 'Router sets the method header. tools/list goes to the Broker (default backend).',
          technical: 'Headers set:\n  x-mcp-method: tools/list\n\nNo authority override.\nBroker handles aggregation.'
        }
      },
      {
        from: 'gateway', to: 'broker',
        label: 'tools/list', type: 'request',
        detail: {
          summary: 'Broker receives the tools/list request and assembles the aggregated tool list from all connected upstream MCP servers.',
          technical: 'Broker aggregates tools from all\nregistered upstream MCP servers.\n\nEach tool name is prefixed with the\nserver name: server1_greet, server2_hello\n\nFiltering applied via:\n  - x-authorised-tools header (signed)\n  - x-mcp-virtualserver header (client)'
        }
      },
      {
        from: 'broker', to: 'client',
        label: 'aggregated tools response', type: 'response',
        detail: {
          summary: 'Client receives the combined tool list from all registered MCP servers, with each tool prefixed by its server name.',
          technical: '{\n  "jsonrpc": "2.0",\n  "result": {\n    "tools": [\n      { "name": "server1_greet", ... },\n      { "name": "server1_time", ... },\n      { "name": "server2_hello_world", ... }\n    ]\n  },\n  "id": 2\n}'
        }
      },
    ]
  },

  'tools-call': {
    layout: 'dataplane',
    title: 'Tools/Call',
    steps: [
      {
        from: 'client', to: 'gateway',
        label: 'tools/call server1_greet', type: 'request',
        detail: {
          summary: 'Client calls a specific tool using its prefixed name.',
          technical: 'POST /mcp\nmcp-session-id: <gateway-session-id>\n\n{\n  "jsonrpc": "2.0",\n  "method": "tools/call",\n  "params": {\n    "name": "server1_greet",\n    "arguments": { "name": "world" }\n  },\n  "id": 3\n}'
        }
      },
      {
        from: 'gateway', to: 'router',
        label: 'ext_proc request', type: 'request',
        detail: {
          summary: 'Router receives the tools/call request and begins processing.',
          technical: 'Router parses JSON-RPC body:\n  method: tools/call\n  tool: server1_greet\n\nExtracts server prefix "server1"\nto determine target backend.'
        }
      },
      {
        from: 'router', to: 'cache',
        label: 'lookup session', type: 'internal',
        detail: {
          summary: 'Router checks the session cache for an existing backend session with this MCP server.',
          technical: 'Cache key:\n  gateway-session-id + server-name\n\nLookup: GET session for\n  (gateway-sid, "server1")\n\nResult: MISS (no backend session yet)'
        }
      },
      {
        from: 'router', to: 'gateway',
        label: 'hairpin: initialize', type: 'request',
        detail: {
          summary: 'No backend session exists. Router sends an initialize request back through the Gateway to the target MCP server. This "hairpin" ensures auth policies are applied to the init.',
          technical: 'Lazy initialization pattern:\nRouter sends initialize back through\nthe Gateway (not directly to the server)\nso that any auth policies on the\nserver\'s HTTPRoute are enforced.\n\nHeaders:\n  authority: server1.<host>\n  x-mcp-method: initialize'
        }
      },
      {
        from: 'gateway', to: 'server',
        label: 'initialize', type: 'request',
        detail: {
          summary: 'Gateway routes the hairpinned initialize to the target MCP server based on the authority header.',
          technical: 'POST /mcp\n\n{\n  "jsonrpc": "2.0",\n  "method": "initialize",\n  "params": {\n    "protocolVersion": "2025-03-26",\n    "clientInfo": {\n      "name": "mcp-gateway",\n      "version": "0.6.0"\n    }\n  },\n  "id": 1\n}'
        }
      },
      {
        from: 'server', to: 'router',
        label: 'init OK + backend session', type: 'response',
        detail: {
          summary: 'MCP server responds with its capabilities and a backend session ID.',
          technical: 'HTTP 200\nmcp-session-id: <backend-session-id>\n\nBackend confirms protocol version\nand capabilities. This session ID\nis specific to this backend server.'
        }
      },
      {
        from: 'router', to: 'cache',
        label: 'store backend session', type: 'internal',
        detail: {
          summary: 'Router stores the backend session ID, keyed by the gateway session and server name.',
          technical: 'Cache STORE:\n  key: (gateway-sid, "server1")\n  value: <backend-session-id>\n\nFuture tools/call requests to server1\nwill find this session and skip\nthe hairpin initialize.'
        }
      },
      {
        from: 'router', to: 'gateway',
        label: 'set authority + headers', type: 'response',
        detail: {
          summary: 'Router sets routing headers to direct the original tools/call to the correct backend server.',
          technical: 'Headers set:\n  authority: server1.<host>\n  mcp-session-id: <backend-session-id>\n  x-mcp-tool: greet\n  x-mcp-method: tools/call\n\nBody modified:\n  "server1_greet" -> "greet"\n  (prefix stripped)'
        }
      },
      {
        from: 'gateway', to: 'server',
        label: 'tools/call greet', type: 'request',
        detail: {
          summary: 'Gateway routes the tools/call to the target MCP server with the correct backend session ID and stripped tool name.',
          technical: 'POST /mcp\nmcp-session-id: <backend-session-id>\n\n{\n  "jsonrpc": "2.0",\n  "method": "tools/call",\n  "params": {\n    "name": "greet",\n    "arguments": { "name": "world" }\n  },\n  "id": 3\n}'
        }
      },
      {
        from: 'server', to: 'client',
        label: 'tool result', type: 'response',
        detail: {
          summary: 'MCP server executes the tool and returns the result to the client via the gateway.',
          technical: '{\n  "jsonrpc": "2.0",\n  "result": {\n    "content": [\n      {\n        "type": "text",\n        "text": "Hello, world!"\n      }\n    ]\n  },\n  "id": 3\n}'
        }
      },
    ]
  },

  'auth': {
    layout: 'dataplane',
    title: 'Auth (OAuth)',
    steps: [
      {
        from: 'client', to: 'gateway',
        label: 'POST /mcp init', type: 'request',
        detail: {
          summary: 'Client sends an initialize request without authentication credentials.',
          technical: 'POST /mcp\nContent-Type: application/json\nNo Authorization header\n\n{\n  "jsonrpc": "2.0",\n  "method": "initialize",\n  ...\n}'
        }
      },
      {
        from: 'gateway', to: 'router',
        label: 'ext_proc', type: 'request',
        detail: {
          summary: 'Router processes the request and sets method headers.',
          technical: 'Router identifies method: initialize\nSets x-mcp-method header.\nNo routing change needed.'
        }
      },
      {
        from: 'gateway', to: 'auth',
        label: 'apply auth policy', type: 'request',
        detail: {
          summary: 'Gateway passes the request through the WASM filter which calls Authorino to enforce the AuthPolicy.',
          technical: 'WASM filter intercepts request.\nConsults Authorino with the\nconfigured AuthPolicy rules.\n\nChecking: JWT presence, validity,\nclaims-based access rules.'
        }
      },
      {
        from: 'auth', to: 'authorino',
        label: 'evaluate policy', type: 'internal',
        detail: {
          summary: 'WASM delegates to Authorino for policy evaluation.',
          technical: 'Authorino evaluates AuthPolicy:\n  - Authentication: JWT required\n  - No Bearer token found\n  - Result: DENY'
        }
      },
      {
        from: 'authorino', to: 'client',
        label: '401 WWW-Authenticate', type: 'response',
        detail: {
          summary: 'Authorino rejects the request with a 401 containing resource metadata URL. This tells the client where to find auth configuration.',
          technical: 'HTTP 401 Unauthorized\n\nWWW-Authenticate: Bearer\n  resource_metadata=\n  "<host>/.well-known/\n  oauth-protected-resource/mcp"'
        }
      },
      {
        from: 'client', to: 'gateway',
        label: 'GET .well-known/oauth-protected-resource', type: 'request',
        detail: {
          summary: 'Client follows the resource_metadata URL to discover the OAuth configuration.',
          technical: 'GET /.well-known/oauth-protected-resource/mcp\n\nMCP specification defines this\ndiscovery endpoint for OAuth\nprotected resources.'
        }
      },
      {
        from: 'gateway', to: 'broker',
        label: '.well-known request', type: 'request',
        detail: {
          summary: 'Gateway routes the well-known request to the Broker, which serves the OAuth resource metadata.',
          technical: 'Broker handles .well-known requests.\nNo auth required for this endpoint\n(it IS the auth discovery mechanism).'
        }
      },
      {
        from: 'broker', to: 'client',
        label: 'auth metadata response', type: 'response',
        detail: {
          summary: 'Broker responds with the OAuth server details so the client knows where to authenticate.',
          technical: '{\n  "resource": "<host>/mcp",\n  "authorization_servers": [\n    "https://auth.example.com/realms/mcp"\n  ],\n  "bearer_methods_supported": ["header"],\n  "scopes_supported": ["openid"]\n}'
        }
      },
      {
        from: 'client', to: 'authserver',
        label: 'register + authenticate', type: 'request',
        detail: {
          summary: 'Client performs dynamic client registration and authenticates with the OAuth server.',
          technical: 'OAuth 2.0 flow:\n1. Dynamic client registration\n   POST /realms/mcp/clients-registrations\n2. Authorization request\n3. Token exchange\n4. Receive access_token (JWT)'
        }
      },
      {
        from: 'authserver', to: 'client',
        label: 'access token', type: 'response',
        detail: {
          summary: 'Auth server issues a JWT access token to the client.',
          technical: 'Client now has:\n  Authorization: Bearer <jwt>\n\nJWT contains claims matching\nthe AuthPolicy requirements.'
        }
      },
      {
        from: 'client', to: 'gateway',
        label: 'POST /mcp init (with Bearer)', type: 'request',
        detail: {
          summary: 'Client retries the initialize request, this time with the Bearer token.',
          technical: 'POST /mcp\nAuthorization: Bearer <jwt>\nContent-Type: application/json\n\n{\n  "jsonrpc": "2.0",\n  "method": "initialize",\n  ...\n}'
        }
      },
      {
        from: 'gateway', to: 'auth',
        label: 'apply auth policy', type: 'request',
        detail: {
          summary: 'WASM filter passes the request to Authorino again, this time with the Bearer token.',
          technical: 'Authorino evaluates AuthPolicy:\n  - Authentication: JWT present\n  - JWT valid, not expired\n  - Claims match policy rules\n  - Result: ALLOW'
        }
      },
      {
        from: 'auth', to: 'broker',
        label: 'auth OK, forward to Broker', type: 'request',
        detail: {
          summary: 'Auth passes. Gateway forwards the request to the Broker.',
          technical: 'Request continues to Broker\nwith auth context headers added\nby Authorino (e.g. x-authorised-tools).'
        }
      },
      {
        from: 'broker', to: 'client',
        label: 'init response + session', type: 'response',
        detail: {
          summary: 'Broker responds with capabilities and session ID, same as the unauthenticated initialize flow.',
          technical: 'HTTP 200\nmcp-session-id: <gateway-session-id>\n\nIdentical to the unauthenticated\ninitialize response. Auth is\ntransparent to the MCP protocol.'
        }
      },
    ]
  },

  'registration': {
    layout: 'controlplane',
    title: 'Server Registration',
    steps: [
      {
        from: 'k8sapi', to: 'controller',
        label: 'MCPServerRegistration created', type: 'request',
        detail: {
          summary: 'A user creates an MCPServerRegistration resource. The controller is watching for these events.',
          technical: 'apiVersion: mcp.kuadrant.io/v1alpha1\nkind: MCPServerRegistration\nmetadata:\n  name: my-server\nspec:\n  serverRef:\n    kind: HTTPRoute\n    name: my-server-route'
        }
      },
      {
        from: 'controller', to: 'k8sapi',
        label: 'resolve HTTPRoute', type: 'request',
        detail: {
          summary: 'Controller looks up the referenced HTTPRoute to discover the backend service.',
          technical: 'GET HTTPRoute "my-server-route"\n\nController checks backendRef:\n  kind: Service -> internal\n    URL: name.ns.svc.cluster.local\n  kind: Hostname -> external\n    URL: built from hostname directly'
        }
      },
      {
        from: 'k8sapi', to: 'controller',
        label: 'HTTPRoute details', type: 'response',
        detail: {
          summary: 'K8s API returns the HTTPRoute with backend references.',
          technical: 'HTTPRoute resolved:\n  backendRef:\n    kind: Service\n    name: my-mcp-server\n    namespace: default\n    port: 8080\n\nResolved URL:\n  http://my-mcp-server.default.svc.cluster.local:8080/mcp'
        }
      },
      {
        from: 'controller', to: 'secret',
        label: 'write config Secret', type: 'request',
        detail: {
          summary: 'Controller assembles the full gateway configuration and writes it to a Kubernetes Secret.',
          technical: 'Secret contains:\n  - List of all registered servers\n  - Backend URLs\n  - Auth credentials per server\n  - Server prefixes for tool naming\n\nSecret has label:\n  mcp.kuadrant.io/secret: "true"'
        }
      },
      {
        from: 'secret', to: 'broker',
        label: 'config update', type: 'internal',
        detail: {
          summary: 'Broker detects the config Secret change and connects to the newly registered MCP server.',
          technical: 'Broker watches the config Secret.\nOn change:\n  1. Parse new server list\n  2. Connect to new servers\n  3. Send initialize to each\n  4. Fetch tools/list from each\n  5. Build aggregated tool list'
        }
      },
      {
        from: 'secret', to: 'router',
        label: 'config update', type: 'internal',
        detail: {
          summary: 'Router also picks up the config change to learn about the new server\'s routing details.',
          technical: 'Router watches the config Secret.\nOn change:\n  1. Parse new server list\n  2. Update routing table\n  3. Map server prefixes to\n     authority headers'
        }
      },
      {
        from: 'broker', to: 'server',
        label: 'initialize + tools/list', type: 'request',
        detail: {
          summary: 'Broker connects to the new MCP server, initializes a session, and fetches its tool list.',
          technical: 'Broker acts as MCP client:\n  1. POST /mcp initialize\n  2. Verify protocolVersion\n  3. Check capabilities\n  4. POST /mcp tools/list\n  5. Prefix tools with server name\n  6. Add to aggregated list'
        }
      },
      {
        from: 'controller', to: 'k8sapi',
        label: 'update status', type: 'response',
        detail: {
          summary: 'Controller updates the MCPServerRegistration status to reflect the server is now registered and available.',
          technical: 'status:\n  conditions:\n    - type: Accepted\n      status: "True"\n    - type: Ready\n      status: "True"\n  serverAddress:\n    http://my-mcp-server.default...'
        }
      },
    ]
  },
};
```

- [ ] **Step 2: Verify the data compiles**

Open `docs/flow-visualiser.html` in a browser. Open dev tools console. Type `FLOWS` and verify the object is defined with all 5 keys, each containing a `steps` array. Check there are no syntax errors in the console.

- [ ] **Step 3: Commit**

```bash
git add docs/flow-visualiser.html
git commit -s -m "feat: add flow step data for all five scenarios"
```

---

### Task 4: Tab Switching + Layout Swapping

**Files:**
- Modify: `docs/flow-visualiser.html`

Wire up tab clicks to switch between flows and swap the SVG layout (dataplane vs controlplane).

- [ ] **Step 1: Add the tab switching and step list rendering logic**

```js
var currentFlow = null;
var currentStepIndex = -1;

function switchFlow(flowId) {
  currentFlow = FLOWS[flowId];
  currentStepIndex = -1;

  // update tab active state
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.getAttribute('data-flow') === flowId);
  });

  // render the correct layout
  renderLayout(currentFlow.layout);

  // populate step list
  var list = document.getElementById('stepListItems');
  list.innerHTML = '';
  currentFlow.steps.forEach(function(step, i) {
    var li = document.createElement('li');
    li.textContent = (i + 1) + '. ' + step.label;
    li.addEventListener('click', function() {
      jumpToStep(i);
    });
    list.appendChild(li);
  });

  // clear detail panel
  updateDetailPanel(null);

  // reset playback
  stopPlayback();
}

function updateDetailPanel(step) {
  var title = document.getElementById('detailTitle');
  var summary = document.getElementById('detailSummary');
  var code = document.getElementById('detailCode');
  var details = document.querySelector('.detail-technical');

  if (!step) {
    title.textContent = 'Select a step';
    summary.textContent = 'Click play or select a step from the list above.';
    code.textContent = '';
    details.removeAttribute('open');
    return;
  }

  title.textContent = step.label;
  summary.textContent = step.detail.summary;
  code.textContent = step.detail.technical;
}

// tab click handlers
document.getElementById('flowTabs').addEventListener('click', function(e) {
  var tab = e.target.closest('.tab');
  if (!tab) return;
  switchFlow(tab.getAttribute('data-flow'));
});

// initial load
switchFlow('initialize');
```

- [ ] **Step 2: Open in browser and verify**

- Click each tab: layout should swap (registration uses controlplane, others use dataplane)
- Step list populates with the correct steps for each flow
- Clicking a step in the list shows its detail in the panel
- Tab active state updates correctly

- [ ] **Step 3: Commit**

```bash
git add docs/flow-visualiser.html
git commit -s -m "feat: add tab switching with layout swap and step list"
```

---

### Task 5: Arrow Drawing + Step Highlighting

**Files:**
- Modify: `docs/flow-visualiser.html`

This is the core visual — drawing animated arrows between components and highlighting active nodes. Uses D3 transitions on SVG paths.

- [ ] **Step 1: Add helper to get node centre coordinates**

```js
function getNodePort(layout, nodeId, side) {
  var node = layout.nodes.find(function(n) { return n.id === nodeId; });
  if (!node) return { x: 0, y: 0 };

  var cx = node.x + node.w / 2;
  var cy = node.y + node.h / 2;

  if (side === 'right') return { x: node.x + node.w, y: cy };
  if (side === 'left')  return { x: node.x, y: cy };
  if (side === 'top')   return { x: cx, y: node.y };
  if (side === 'bottom') return { x: cx, y: node.y + node.h };
  return { x: cx, y: cy };
}

function getArrowEndpoints(layout, fromId, toId) {
  var fromNode = layout.nodes.find(function(n) { return n.id === fromId; });
  var toNode = layout.nodes.find(function(n) { return n.id === toId; });
  if (!fromNode || !toNode) return null;

  var fromCx = fromNode.x + fromNode.w / 2;
  var toCx = toNode.x + toNode.w / 2;
  var fromCy = fromNode.y + fromNode.h / 2;
  var toCy = toNode.y + toNode.h / 2;

  var fromSide, toSide;
  var dx = toCx - fromCx;
  var dy = toCy - fromCy;

  if (Math.abs(dx) > Math.abs(dy)) {
    fromSide = dx > 0 ? 'right' : 'left';
    toSide = dx > 0 ? 'left' : 'right';
  } else {
    fromSide = dy > 0 ? 'bottom' : 'top';
    toSide = dy > 0 ? 'top' : 'bottom';
  }

  return {
    from: getNodePort(layout, fromId, fromSide),
    to: getNodePort(layout, toId, toSide)
  };
}
```

- [ ] **Step 2: Add the showStep function with arrow animation**

```js
function showStep(index) {
  if (!currentFlow || index < 0 || index >= currentFlow.steps.length) return;

  currentStepIndex = index;
  var step = currentFlow.steps[index];
  var layout = LAYOUTS[currentFlow.layout];

  // clear previous arrows
  svg.selectAll('.arrow-group').remove();

  // dim all nodes
  svg.selectAll('g.node').each(function(d) {
    var group = d3.select(this);
    group.select('rect')
      .transition().duration(300)
      .attr('opacity', 0.3);
    group.select('text')
      .transition().duration(300)
      .attr('opacity', 0.3);
  });

  // highlight from and to nodes
  [step.from, step.to].forEach(function(nodeId) {
    var group = svg.select('.node-' + nodeId);
    group.select('rect')
      .transition().duration(300)
      .attr('opacity', 1)
      .attr('filter', 'url(#glow-' + nodeId + ')');
    group.select('text')
      .transition().duration(300)
      .attr('opacity', 1);
  });

  // draw arrow
  var endpoints = getArrowEndpoints(layout, step.from, step.to);
  if (endpoints) {
    var arrowColour;
    if (step.type === 'response' && step.label.indexOf('401') !== -1) {
      arrowColour = 'var(--arrow-reject)';
    } else if (step.type === 'response') {
      arrowColour = 'var(--arrow-response)';
    } else if (step.type === 'internal') {
      arrowColour = COMPONENTS[step.from].colour;
    } else {
      arrowColour = COMPONENTS[step.from].colour;
    }

    var midX = (endpoints.from.x + endpoints.to.x) / 2;
    var midY = (endpoints.from.y + endpoints.to.y) / 2;
    var dx = endpoints.to.x - endpoints.from.x;
    var dy = endpoints.to.y - endpoints.from.y;
    // slight curve offset perpendicular to the line
    var len = Math.sqrt(dx * dx + dy * dy);
    var offsetX = -(dy / len) * 20;
    var offsetY = (dx / len) * 20;

    var pathData = 'M ' + endpoints.from.x + ' ' + endpoints.from.y +
      ' Q ' + (midX + offsetX) + ' ' + (midY + offsetY) +
      ' ' + endpoints.to.x + ' ' + endpoints.to.y;

    var arrowGroup = svg.append('g').attr('class', 'arrow-group');

    var path = arrowGroup.append('path')
      .attr('d', pathData)
      .attr('fill', 'none')
      .attr('stroke', arrowColour)
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', step.type === 'response' ? '8,5' : 'none')
      .attr('marker-end', 'url(#arrowhead)');

    // animate: stroke-dashoffset from total length to 0
    var totalLength = path.node().getTotalLength();
    path
      .attr('stroke-dasharray', step.type === 'response' ? totalLength + ' ' + totalLength : totalLength + ' ' + totalLength)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(600)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', 0)
      .on('end', function() {
        if (step.type === 'response') {
          d3.select(this).attr('stroke-dasharray', '8,5');
        } else {
          d3.select(this).attr('stroke-dasharray', 'none');
        }
      });

    // label at midpoint
    arrowGroup.append('text')
      .attr('x', midX + offsetX)
      .attr('y', midY + offsetY - 10)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-primary)')
      .attr('font-size', '11px')
      .attr('opacity', 0)
      .text(step.label)
      .transition()
      .delay(300)
      .duration(300)
      .attr('opacity', 1);
  }

  // update step list highlight
  var items = document.querySelectorAll('#stepListItems li');
  items.forEach(function(li, i) {
    li.classList.toggle('active', i === index);
  });
  // scroll active step into view
  var activeItem = document.querySelector('#stepListItems li.active');
  if (activeItem) activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  // update detail panel
  updateDetailPanel(step);
}

function jumpToStep(index) {
  stopPlayback();
  showStep(index);
}
```

- [ ] **Step 3: Open in browser and verify**

- Click steps in the step list: arrows should animate between the correct components
- Active components glow, inactive ones dim
- Arrow labels appear near the midpoint
- Response arrows are dashed, request arrows are solid
- Detail panel updates with the step content

- [ ] **Step 4: Commit**

```bash
git add docs/flow-visualiser.html
git commit -s -m "feat: add arrow animation and step highlighting with D3"
```

---

### Task 6: Playback Engine

**Files:**
- Modify: `docs/flow-visualiser.html`

Wire up the play/pause/speed/loop/restart controls to drive step-by-step animation.

- [ ] **Step 1: Add playback state and controls**

```js
var playbackTimer = null;
var isPlaying = false;
var speedMultiplier = 1;
var isLooping = false;

function getStepDuration() {
  return 1500 / speedMultiplier;
}

function startPlayback() {
  if (!currentFlow) return;
  isPlaying = true;
  document.getElementById('btnPlay').innerHTML = '&#9646;&#9646;';
  document.getElementById('btnPlay').classList.add('active');

  if (currentStepIndex < 0 || currentStepIndex >= currentFlow.steps.length - 1) {
    currentStepIndex = -1;
  }
  advanceStep();
}

function stopPlayback() {
  isPlaying = false;
  if (playbackTimer) {
    clearTimeout(playbackTimer);
    playbackTimer = null;
  }
  document.getElementById('btnPlay').innerHTML = '&#9654;';
  document.getElementById('btnPlay').classList.remove('active');
}

function advanceStep() {
  if (!isPlaying || !currentFlow) return;

  var nextIndex = currentStepIndex + 1;
  if (nextIndex >= currentFlow.steps.length) {
    if (isLooping) {
      nextIndex = 0;
    } else {
      stopPlayback();
      return;
    }
  }

  showStep(nextIndex);
  playbackTimer = setTimeout(advanceStep, getStepDuration());
}

// play/pause
document.getElementById('btnPlay').addEventListener('click', function() {
  if (isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
});

// restart
document.getElementById('btnRestart').addEventListener('click', function() {
  stopPlayback();
  currentStepIndex = -1;
  svg.selectAll('.arrow-group').remove();
  svg.selectAll('g.node rect').attr('opacity', 1).attr('filter', null);
  svg.selectAll('g.node text').attr('opacity', 1);
  document.querySelectorAll('#stepListItems li').forEach(function(li) {
    li.classList.remove('active');
  });
  updateDetailPanel(null);
});

// speed
document.getElementById('btnSpeed').addEventListener('click', function() {
  if (speedMultiplier === 1) speedMultiplier = 2;
  else if (speedMultiplier === 2) speedMultiplier = 3;
  else speedMultiplier = 1;
  this.textContent = speedMultiplier + 'x';
});

// loop
document.getElementById('btnLoop').addEventListener('click', function() {
  isLooping = !isLooping;
  this.classList.toggle('active', isLooping);
});
```

- [ ] **Step 2: Open in browser and verify**

- Click play: steps advance automatically at ~1.5s intervals
- Click pause: animation stops on current step
- Speed button cycles 1x -> 2x -> 3x -> 1x
- Loop button toggles: when active, animation restarts from step 1 after last step
- Restart clears all arrows and highlights
- Clicking a step in the list while playing pauses playback

- [ ] **Step 3: Commit**

```bash
git add docs/flow-visualiser.html
git commit -s -m "feat: add playback engine with speed, loop, and restart controls"
```

---

### Task 7: Polish + Responsive + Final Verification

**Files:**
- Modify: `docs/flow-visualiser.html`

Final pass: keyboard shortcuts, arrowhead colour matching, SVG viewBox resize handling, and responsive layout verification.

- [ ] **Step 1: Add keyboard shortcuts**

```js
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch(e.key) {
    case ' ':
      e.preventDefault();
      if (isPlaying) stopPlayback();
      else startPlayback();
      break;
    case 'ArrowRight':
      e.preventDefault();
      stopPlayback();
      if (currentFlow && currentStepIndex < currentFlow.steps.length - 1) {
        showStep(currentStepIndex + 1);
      }
      break;
    case 'ArrowLeft':
      e.preventDefault();
      stopPlayback();
      if (currentStepIndex > 0) {
        showStep(currentStepIndex - 1);
      }
      break;
    case 'r':
      document.getElementById('btnRestart').click();
      break;
  }
});
```

- [ ] **Step 2: Add a legend below the header**

Add after the tabs nav, before `<div class="main">`:

```html
<div class="legend" id="legend"></div>
```

CSS:

```css
.legend {
  display: flex;
  gap: 16px;
  padding: 6px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  font-size: 11px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  color: var(--text-secondary);
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
```

JS to populate (add after `switchFlow` is defined):

```js
function updateLegend(layout) {
  var container = document.getElementById('legend');
  container.innerHTML = '';
  var layoutData = LAYOUTS[layout];
  layoutData.nodes.forEach(function(node) {
    if (node.isContainer) return;
    var comp = COMPONENTS[node.id];
    var item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = '<span class="legend-dot" style="background:' + comp.colour + '"></span>' + comp.short;
    container.appendChild(item);
  });
}
```

Call `updateLegend(currentFlow.layout)` at the end of `switchFlow`.

- [ ] **Step 3: Update main layout height to account for legend**

Update the `.main` CSS:

```css
.main {
  display: flex;
  height: calc(100vh - var(--header-height) - var(--tab-height) - 30px);
}
```

- [ ] **Step 4: Full verification in browser**

Open `docs/flow-visualiser.html` and test:

1. **Initialize flow**: play through all 5 steps, verify arrows and detail
2. **Tools/List flow**: play through, verify aggregation detail
3. **Tools/Call flow**: play through, verify the hairpin (steps 3-7) draws correctly with the curved arrow path
4. **Auth flow**: verify 401 arrow is red/distinct, OAuth dance steps are clear
5. **Server Registration**: verify layout swaps to controlplane, different components appear
6. **Theme toggle**: switch to light, verify all elements readable, switch back
7. **Keyboard**: space plays/pauses, left/right arrows navigate steps, r restarts
8. **Speed**: cycle through 1x/2x/3x, verify animation speeds up
9. **Loop**: enable loop, verify it restarts after last step
10. **Responsive**: narrow browser to <768px, verify mobile notice appears and canvas hides
11. **Legend**: verify it shows the correct components for each flow tab
12. **Console**: no JS errors

- [ ] **Step 5: Commit**

```bash
git add docs/flow-visualiser.html
git commit -s -m "feat: add keyboard shortcuts, legend, and responsive polish"
```

---

### Task 8: Gitignore + Cleanup

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add .superpowers to gitignore**

Check if `.superpowers/` is already in `.gitignore`. If not, add it:

```
# brainstorming companion
.superpowers/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -s -m "chore: add .superpowers to gitignore"
```
