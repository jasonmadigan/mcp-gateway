// Package cors holds the origin-matching logic shared by the broker's inbound
// CORS middleware and the router's response-phase CORS injection, so both agree
// on what the allowlist means.
package cors

import (
	"os"
	"strings"
)

// CORS_* env var names the controller injects and the broker reads back.
const (
	EnvAllowOrigins     = "CORS_ALLOW_ORIGINS"
	EnvAllowMethods     = "CORS_ALLOW_METHODS"
	EnvAllowHeaders     = "CORS_ALLOW_HEADERS"
	EnvExposeHeaders    = "CORS_EXPOSE_HEADERS"
	EnvAllowCredentials = "CORS_ALLOW_CREDENTIALS" // #nosec G101 -- env var name, not a credential
	EnvMaxAge           = "CORS_MAX_AGE"
)

// MatchWildcard reports whether origin is permitted by patterns and, when it is,
// whether the matching pattern was a wildcard (bare "*" or one containing "*").
// each pattern is an exact origin, a bare "*", or a gateway-api wildcard whose
// single "*" matches any run of characters to its left (e.g. https://*.sslip.io).
// callers drop Access-Control-Allow-Credentials on a wildcard match: the CORS
// spec forbids credentials with a wildcard origin.
func MatchWildcard(origin string, patterns []string) (matched, wildcard bool) {
	for _, pattern := range patterns {
		if pattern == "*" {
			return true, true
		}
		if pre, post, found := strings.Cut(pattern, "*"); found {
			if len(origin) >= len(pre)+len(post) && strings.HasPrefix(origin, pre) && strings.HasSuffix(origin, post) {
				return true, true
			}
			continue
		}
		if origin == pattern {
			return true, false
		}
	}
	return false, false
}

// Match reports whether origin is permitted by patterns. see MatchWildcard for
// pattern semantics.
func Match(origin string, patterns []string) bool {
	matched, _ := MatchWildcard(origin, patterns)
	return matched
}

// Policy is the origin allowlist plus the header values echoed on cross-origin
// requests, built from the CORS_* env the controller injects.
type Policy struct {
	AllowOrigins     []string
	ExposeHeaders    string
	AllowCredentials bool
}

// FromEnv reads the CORS_* env. an empty CORS_ALLOW_ORIGINS disables CORS.
func FromEnv() *Policy {
	return &Policy{
		AllowOrigins:     SplitList(os.Getenv(EnvAllowOrigins)),
		ExposeHeaders:    strings.TrimSpace(os.Getenv(EnvExposeHeaders)),
		AllowCredentials: os.Getenv(EnvAllowCredentials) == "true",
	}
}

// Enabled reports whether an origin allowlist is configured.
func (p *Policy) Enabled() bool { return p != nil && len(p.AllowOrigins) > 0 }

// Allows reports whether origin matches the policy's allowlist.
func (p *Policy) Allows(origin string) bool {
	return p != nil && Match(origin, p.AllowOrigins)
}

// AllowsWildcard reports whether origin is allowed and whether the matching
// pattern was a wildcard. callers drop credentials on a wildcard match.
func (p *Policy) AllowsWildcard(origin string) (matched, wildcard bool) {
	if p == nil {
		return false, false
	}
	return MatchWildcard(origin, p.AllowOrigins)
}

// SplitList splits a comma-separated env value, trimming whitespace and dropping
// empty entries.
func SplitList(v string) []string {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}
