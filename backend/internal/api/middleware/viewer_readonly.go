package middleware

import (
	"net/http"
)

// roleViewer is the read-only workspace role. Kept as a string literal (rather
// than importing the member domain) to match the convention in ApprovalMiddleware,
// which also compares the context role as a plain string.
const roleViewer = "viewer"

// ViewerReadOnly rejects state-changing requests from viewers, the read-only
// workspace role. It must run AFTER Workspace (which sets the role in context)
// and it deliberately runs BEFORE ApprovalMiddleware: a viewer's write is denied
// outright, never queued as a pending change.
//
// Why this exists: the role model documents viewer as read-only, and
// member.CanEditContent() encodes exactly that (false only for viewer) — but that
// predicate had NO production caller, and ApprovalMiddleware only intercepts the
// "member" role, letting every other role (including viewer) fall straight through
// to the handler. A viewer could therefore create/update/delete any workspace
// content, making the read-only role strictly more privileged than a member (whose
// writes at least require approval). This middleware closes that hole at a single
// chokepoint covering every mutating route under /workspaces/{id} — gated content
// entities AND the sub-resources (photos, attachments, repairs) that approval
// deliberately excludes.
//
// Default-deny: ALL mutating methods are blocked for viewers, with no allowlist.
// A viewer-writable personal-state endpoint (e.g. favorites) would be a deliberate
// future carve-out, made explicit here rather than left as an accidental gap.
func ViewerReadOnly() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := GetRole(r.Context())
			if ok && role == roleViewer && isMutatingMethod(r.Method) {
				http.Error(w, `{"error":"forbidden","message":"viewers have read-only access"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// isMutatingMethod reports whether the HTTP method changes server state. GET,
// HEAD, and OPTIONS are read-only; everything else is treated as a write.
func isMutatingMethod(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return false
	default:
		return true
	}
}
