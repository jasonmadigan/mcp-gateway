package broker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

// serve runs a request through the CORS middleware and reports whether the
// wrapped handler was reached.
func serve(c *CORS, method, origin string) (*httptest.ResponseRecorder, bool) {
	reached := false
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		reached = true
		w.WriteHeader(http.StatusOK)
	})
	req := httptest.NewRequestWithContext(context.Background(), method, "/mcp", nil)
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	rec := httptest.NewRecorder()
	c.Wrap(next).ServeHTTP(rec, req)
	return rec, reached
}

func testCORS() *CORS {
	return &CORS{
		allowOrigins:  []string{"https://console.example.com", "https://*.sslip.io"},
		allowMethods:  "GET,POST,DELETE,OPTIONS",
		allowHeaders:  "Content-Type,Mcp-Session-Id",
		exposeHeaders: "Mcp-Session-Id,WWW-Authenticate",
		maxAge:        "600",
	}
}

func TestCORS_ExactOriginMatch(t *testing.T) {
	t.Parallel()
	rec, reached := serve(testCORS(), http.MethodGet, "https://console.example.com")

	require.True(t, reached)
	require.Equal(t, "https://console.example.com", rec.Header().Get("Access-Control-Allow-Origin"))
	require.Equal(t, "Origin", rec.Header().Get("Vary"))
	require.Equal(t, "GET,POST,DELETE,OPTIONS", rec.Header().Get("Access-Control-Allow-Methods"))
	require.Equal(t, "Content-Type,Mcp-Session-Id", rec.Header().Get("Access-Control-Allow-Headers"))
	require.Equal(t, "Mcp-Session-Id,WWW-Authenticate", rec.Header().Get("Access-Control-Expose-Headers"))
	require.Equal(t, "600", rec.Header().Get("Access-Control-Max-Age"))
}

func TestCORS_LeadingWildcardMatch(t *testing.T) {
	t.Parallel()
	// single-label and multi-label subdomains both match greedily to the left
	for _, origin := range []string{"https://foo.sslip.io", "https://a.b.sslip.io"} {
		rec, reached := serve(testCORS(), http.MethodGet, origin)
		require.True(t, reached)
		require.Equal(t, origin, rec.Header().Get("Access-Control-Allow-Origin"))
		require.Equal(t, "Origin", rec.Header().Get("Vary"))
	}
}

func TestCORS_BareWildcardMatchEchoesOrigin(t *testing.T) {
	t.Parallel()
	c := &CORS{allowOrigins: []string{"*"}, allowMethods: "GET"}
	rec, reached := serve(c, http.MethodGet, "https://anything.test")

	require.True(t, reached)
	// echo the specific origin, never the literal "*"
	require.Equal(t, "https://anything.test", rec.Header().Get("Access-Control-Allow-Origin"))
	require.Equal(t, "Origin", rec.Header().Get("Vary"))
}

func TestCORS_NonMatchingOriginForbidden(t *testing.T) {
	t.Parallel()
	rec, reached := serve(testCORS(), http.MethodGet, "https://evil.example.org")

	// a disallowed origin is refused outright, not passed to the mux
	require.Equal(t, http.StatusForbidden, rec.Code)
	require.False(t, reached)
	require.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORS_WildcardDoesNotMatchBareDomain(t *testing.T) {
	t.Parallel()
	rec, reached := serve(testCORS(), http.MethodGet, "https://sslip.io")
	require.Equal(t, http.StatusForbidden, rec.Code)
	require.False(t, reached)
	require.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORS_OptionsReturns204AndStops(t *testing.T) {
	t.Parallel()
	rec, reached := serve(testCORS(), http.MethodOptions, "https://console.example.com")

	require.Equal(t, http.StatusNoContent, rec.Code)
	require.False(t, reached, "preflight must not reach the mux")
	require.Equal(t, "https://console.example.com", rec.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORS_OptionsNonMatchingOriginForbidden(t *testing.T) {
	t.Parallel()
	rec, reached := serve(testCORS(), http.MethodOptions, "https://evil.example.org")

	require.Equal(t, http.StatusForbidden, rec.Code)
	require.False(t, reached)
	require.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORS_NoOriginPassesThrough(t *testing.T) {
	t.Parallel()
	rec, reached := serve(testCORS(), http.MethodGet, "")

	require.True(t, reached)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"))
	require.Empty(t, rec.Header().Get("Vary"))
}

func TestCORS_NoOriginOptionsPassesThrough(t *testing.T) {
	t.Parallel()
	// OPTIONS without an Origin is not a browser preflight; it must not be 204'd
	_, reached := serve(testCORS(), http.MethodOptions, "")
	require.True(t, reached)
}

func TestCORS_CredentialsHeaderOnlyWhenConfigured(t *testing.T) {
	t.Parallel()

	off := testCORS()
	recOff, _ := serve(off, http.MethodGet, "https://console.example.com")
	require.Empty(t, recOff.Header().Get("Access-Control-Allow-Credentials"))

	on := testCORS()
	on.allowCredentials = true
	recOn, _ := serve(on, http.MethodGet, "https://console.example.com")
	require.Equal(t, "true", recOn.Header().Get("Access-Control-Allow-Credentials"))
	// a bare "*" allowlist echoes the specific origin but must NOT emit
	// credentials: the CORS spec forbids pairing them.
	star := &CORS{allowOrigins: []string{"*"}, allowCredentials: true}
	recStar, _ := serve(star, http.MethodGet, "https://console.example.com")
	require.Equal(t, "https://console.example.com", recStar.Header().Get("Access-Control-Allow-Origin"))
	require.Empty(t, recStar.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORS_DisabledWhenAllowlistEmpty(t *testing.T) {
	t.Parallel()
	c := &CORS{} // no origins -> disabled
	require.False(t, c.enabled())

	rec, reached := serve(c, http.MethodGet, "https://console.example.com")
	require.True(t, reached)
	require.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"))
	require.Empty(t, rec.Header().Get("Vary"))

	// preflight is not intercepted when disabled
	recOpt, reachedOpt := serve(c, http.MethodOptions, "https://console.example.com")
	require.True(t, reachedOpt)
	require.Empty(t, recOpt.Header().Get("Access-Control-Allow-Origin"))
}

func TestNewCORSFromEnv(t *testing.T) {
	// env-based, so not parallel
	t.Setenv(envCORSAllowOrigins, " https://console.example.com , https://*.sslip.io ")
	t.Setenv(envCORSAllowMethods, "GET,POST,DELETE,OPTIONS")
	t.Setenv(envCORSAllowHeaders, "Content-Type,Mcp-Session-Id")
	t.Setenv(envCORSExposeHeaders, "Mcp-Session-Id,MCP-Protocol-Version,WWW-Authenticate")
	t.Setenv(envCORSAllowCredentials, "true")
	t.Setenv(envCORSMaxAge, "600")

	c := NewCORSFromEnv()
	require.True(t, c.enabled())
	require.Equal(t, []string{"https://console.example.com", "https://*.sslip.io"}, c.allowOrigins)
	require.True(t, c.allowCredentials)
	require.Equal(t, "600", c.maxAge)
	require.True(t, c.allows("https://foo.sslip.io"))
	require.False(t, c.allows("https://evil.example.org"))
}

func TestNewCORSFromEnv_DisabledWhenUnset(t *testing.T) {
	t.Setenv(envCORSAllowOrigins, "")
	require.False(t, NewCORSFromEnv().enabled())
}
