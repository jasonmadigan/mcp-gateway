package broker

import (
	"net/http"
	"os"
	"strings"

	"github.com/Kuadrant/mcp-gateway/internal/cors"
)

// CORS_* env var names. these alias the shared internal/cors names so the broker,
// router and controller read and write the same keys from a single source.
const (
	envCORSAllowOrigins     = cors.EnvAllowOrigins
	envCORSAllowMethods     = cors.EnvAllowMethods
	envCORSAllowHeaders     = cors.EnvAllowHeaders
	envCORSExposeHeaders    = cors.EnvExposeHeaders
	envCORSAllowCredentials = cors.EnvAllowCredentials
	envCORSMaxAge           = cors.EnvMaxAge
)

// CORS holds the origin allowlist and the header values the broker echoes on
// cross-origin requests. built once from CORS_* env at startup, mirroring the
// OAUTH_* pattern. the controller unions the transport's mandatory
// methods/headers into these before injecting them, so the values are used
// verbatim.
type CORS struct {
	allowOrigins     []string
	allowMethods     string
	allowHeaders     string
	exposeHeaders    string
	maxAge           string
	allowCredentials bool
}

// NewCORSFromEnv reads the CORS_* env vars. an empty CORS_ALLOW_ORIGINS
// disables CORS entirely: no headers are emitted and browser access is refused.
func NewCORSFromEnv() *CORS {
	return &CORS{
		allowOrigins:     cors.SplitList(os.Getenv(envCORSAllowOrigins)),
		allowMethods:     strings.TrimSpace(os.Getenv(envCORSAllowMethods)),
		allowHeaders:     strings.TrimSpace(os.Getenv(envCORSAllowHeaders)),
		exposeHeaders:    strings.TrimSpace(os.Getenv(envCORSExposeHeaders)),
		maxAge:           strings.TrimSpace(os.Getenv(envCORSMaxAge)),
		allowCredentials: os.Getenv(envCORSAllowCredentials) == "true",
	}
}

// enabled reports whether an origin allowlist is configured.
func (c *CORS) enabled() bool {
	return len(c.allowOrigins) > 0
}

// allows reports whether origin matches the allowlist. each entry is an exact
// origin, a bare "*", or a gateway-api wildcard whose single "*" matches any
// run of characters to its left (e.g. https://*.sslip.io).
func (c *CORS) allows(origin string) bool {
	return cors.Match(origin, c.allowOrigins)
}

// Wrap applies the CORS policy to every request reaching the broker mux. it is
// the single place that emits CORS headers; handlers behind it must not set
// their own. requests without an Origin are non-browser clients and pass
// through untouched. a matched origin is echoed back exactly (never "*", so it
// stays valid with credentials); a present-but-disallowed origin is refused
// with 403 so a cross-origin call cannot run a side effect the browser merely
// cannot read. OPTIONS preflights for a matched origin are answered 204 and
// never reach the mux.
func (c *CORS) Wrap(next http.Handler) http.Handler {
	if !c.enabled() {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}
		matched, wildcard := cors.MatchWildcard(origin, c.allowOrigins)
		if !matched {
			// disallowed browser origin: refuse outright so a cross-origin
			// call can't run a side effect the browser merely can't read.
			w.WriteHeader(http.StatusForbidden)
			return
		}
		h := w.Header()
		h.Set("Access-Control-Allow-Origin", origin)
		h.Add("Vary", "Origin")
		if c.allowMethods != "" {
			h.Set("Access-Control-Allow-Methods", c.allowMethods)
		}
		if c.allowHeaders != "" {
			h.Set("Access-Control-Allow-Headers", c.allowHeaders)
		}
		if c.exposeHeaders != "" {
			h.Set("Access-Control-Expose-Headers", c.exposeHeaders)
		}
		if c.maxAge != "" {
			h.Set("Access-Control-Max-Age", c.maxAge)
		}
		// never pair credentials with a wildcard origin: the CORS spec forbids
		// it and browsers reject the response.
		if c.allowCredentials && !wildcard {
			h.Set("Access-Control-Allow-Credentials", "true")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
