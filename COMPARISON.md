# sdk-migration-minimal vs sdk-migration (#1218)

Fresh implementation of #1111 (mark3labs/mcp-go v0.55.1 to modelcontextprotocol/go-sdk
v1.7.0-pre.1) on branch `sdk-migration-minimal`, base 963b9dae, optimising for minimal
diff vs main with byte-identical outward behaviour.

## Diffstat (git diff --stat vs main @ 963b9dae)

| branch | files | insertions | deletions | net |
|-|-|-|-|-|
| sdk-migration-minimal (this) | 61 | +5364 | -1683 | +3681 |
| sdk-migration (#1218) | 72 | +6549 | -1852 | +4697 |

~18% fewer insertions, 11 fewer files. Production code only (excluding *_test.go and
tests/): 26 files +2925/-835 vs 30 files +3101/-949. Both totals include the ported
compat/resurrection wire tests (+1100 lines across four files), which are shared
verified-parity assets; the reduction is concentrated in production shape and skipped
non-parity test suites.

## Structural comparison

Converged (same approach; the knowledge ledger's verified mechanisms are the only ones
that work, so convergence here is expected):

- boundary compat layer (`internal/broker/http_compat.go`) wrapping the SDK streamable
  handler: error/status/framing parity, batch pre-reject, Accept/protocol-version
  normalisation, list-result rewrites, SSE prelude strip. Ported as the verified encoding
  of main's wire bytes; rewriting it differently only risks parity.
- SDK-native session resurrection (`session_resurrection.go`): sniff the pod-local-table
  404, re-Connect with `StreamableServerTransport{SessionID}` + synthesised
  `ServerSessionState`, singleflight, idle timer, session-end cleanup on `Wait()`.
- raw annotation hints tee (`upstream/hints.go`): round-tripper interception of upstream
  tools/list bytes; the SDK has no raw hook.
- gateway server wrapper (`gateway_server.go`): local tool/prompt index (SDK has no public
  ListTools) + targeted tools/list_changed via sending middleware + sentinel add/remove.
- per-user upstream session pool with dynamic-header round tripper; hairpin client with
  DisableStandaloneSSE + in-process server/discover short circuit.
- cmd wiring, session/jwt.go, LogSafeSessionID, e2e adaptations (adopted from #1218
  verbatim: they are the surgical type/signature layer, assertions unchanged).

Divergent (where the smaller diff comes from):

- `ToolAnnotations` keeps its interface name and `ToolHints` keeps mark3labs' field names
  (`ReadOnlyHint` etc), so `internal/mcp-router/request_handlers.go` changes 1 line
  (`GetSessionId()` becomes `ID()`) instead of 48; no `annotationHintsHeader` helper.
- no `upstream/types.go`: GatewayTool/GatewayPrompt live beside the interfaces they serve
  in `manager.go`; result helpers are two package-private funcs in `discovery.go`; the
  noop handlers stay inline closures as on main.
- `OnConfigChange` keeps main's single-function shape (stop-under-lock exactly as main
  behaved) instead of the three-phase deregister/stop/start split, saving about 90 lines.
- one-file `internal/transport` package instead of four files.
- tracing middleware lives in `tracing.go` (where the span tracker it replaces lived)
  rather than growing `broker.go`.
- skipped oracle additions with no parity role: broker+router benchmark_test (+213),
  config_change_test (+119), upstream/status_test (+109), clients_test (+66),
  transport/roundtripper_test (+116). The protocol-drift guard
  (TestExpectedVersionMatchesSDKProposal) was folded into the existing
  protocol_version_test.go instead of a new file.
- tests adapted in place with type swaps where main's tests survive (validate_test,
  filtered handlers, tags, user_specific, manager_test) rather than restructured.

Nothing was needed that #1218 lacks. Its extra breadth (benchmarks, config-change and
status drift suites, OnConfigChange lock hardening) is defensible engineering, but not
required for behaviour parity, which was this experiment's bar.

## Gates

- go build ./... clean; go vet ./... clean
- pinned bin/golangci-lint (v2.4.0): 0 issues
- make test-unit: 15/15 packages ok
- go test -race ./internal/broker/...: ok
- e2e on kind cluster `mcp-gateway`, independently re-verified on a provenance-proven
  rebuild of this branch (image embeds gitSHA=a61bae4f, zero mark3labs refs):
  - make test-e2e-ci (PR gate): 52 passed, 0 failed, 29 skipped (tier-2 skips)
  - make test-e2e-ci-full: 70 passed, 1 failed, 10 skipped (env-gated auth/PAT/openshift).
    The single failure (multi-gateway second-extension spec) was root-caused as a
    readiness-race flake, not an SDK parity break: the go-sdk client maps any 404 to its
    own "session not found" sentinel, and the failing initialize hit Envoy's empty-body
    no-route 404 in the gap between the extension reporting Ready and the route being
    programmed. Zero SDK bytes were client-visible across 927 probe samples; the focused
    spec passed 5/5 re-runs. A retry-defeating test bug compounds it (bare Expect inside
    Eventually(func(_ Gomega)) at tests/e2e/multi_gateway_test.go:201) and pre-exists on
    main.
- tests/servers/* untouched (mark3labs interop canary; exercised by the e2e runs)

## Honest residuals (accepted deltas replicated from #1218, none new)

- duplicate in-flight JSON-RPC ids on one session rejected by the SDK (id-remap costed
  and rejected); e2e raw client uses unique atomic ids.
- select_tools "warning" key on notification-delivery failure can no longer occur (SDK
  dispatches list_changed async, debounced); dead plumbing removed.
- filter_tools_by_tags result payload embeds SDK-marshalled Tool JSON (annotations key
  omitted when absent, where mark3labs always emitted it inside this tool-result text).
- broker to upstream connects now emit a server/discover probe before initialize (SDK
  client behaviour; upstream answers method-not-found and the client falls back).
  Hairpin and user-specific paths short-circuit or pool it away.
- SDK idle session eviction (30m) exists where mark3labs kept no table; invisible on the
  wire because a valid JWT resurrects transparently, but pod-internal memory behaviour
  differs.
- expectedProtocolVersion pinned to "2025-11-25" (SDK proposal, was mark3labs' latest
  "2025-03-26" constant) in /status ProtocolValidation.ExpectedVersion, as on #1218.
