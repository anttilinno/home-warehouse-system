//go:build integration
// +build integration

package integration

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// =============================================================================
// Cross-Tenant IDOR (direct object reference) Tests
// =============================================================================
// cross_workspace_fk_test.go proves that workspace B cannot *inject* a foreign
// FK when creating resources. These tests prove the complementary boundary:
// user B cannot directly READ, UPDATE, or DELETE workspace A's resources by
// their object IDs. This re-verifies the previously reported cross-tenant
// attachment/photo IDOR and locks the regression down.
//
// Two attack vectors per resource:
//   Vector 1 — foreign workspace path: token2 hits /workspaces/{WS1}/...
//              (a workspace token2 is not a member of). The Workspace
//              membership middleware must reject this (403/404).
//   Vector 2 — id confusion: token2 hits /workspaces/{WS2}/<res>/{ws1ID}
//              (its OWN workspace path, but a resource ID owned by WS1). The
//              by-id repository query must be workspace-scoped, yielding 404 —
//              not 200 with WS1's data.

// idorResource describes a get-by-id resource route under a workspace and the
// WS1-owned id an attacker in WS2 will try to reach.
type idorResource struct {
	name    string
	segment string    // path segment, e.g. "items"
	ws1ID   uuid.UUID // a WS1-owned resource id
}

func TestCrossTenantIDOR_DirectObjectAccess(t *testing.T) {
	f := setupCrossWorkspaceFixture(t)

	resources := []idorResource{
		{"item", "items", f.ws1ItemID},
		{"inventory", "inventory", f.ws1InventoryID},
		{"location", "locations", f.ws1LocationID},
		{"category", "categories", f.ws1CategoryID},
		{"borrower", "borrowers", f.ws1BorrowerID},
	}

	// Attacker is user 2 (member of WS2 only) for every probe below.
	f.ts.SetToken(f.token2)

	for _, r := range resources {
		r := r

		// --- Vector 1: foreign workspace path (not a member of WS1) ---
		t.Run(r.name+"/foreign-ws-path/GET", func(t *testing.T) {
			path := fmt.Sprintf("%s/%s/%s", f.workspace1Path, r.segment, r.ws1ID)
			resp := f.ts.Get(path)
			assertDenied(t, resp, "GET "+path)
		})
		t.Run(r.name+"/foreign-ws-path/list", func(t *testing.T) {
			path := fmt.Sprintf("%s/%s", f.workspace1Path, r.segment)
			resp := f.ts.Get(path)
			assertDenied(t, resp, "GET "+path)
		})
		t.Run(r.name+"/foreign-ws-path/DELETE", func(t *testing.T) {
			path := fmt.Sprintf("%s/%s/%s", f.workspace1Path, r.segment, r.ws1ID)
			resp := f.ts.Delete(path)
			assertDenied(t, resp, "DELETE "+path)
		})

		// --- Vector 2: own workspace path, foreign resource id ---
		// Reaching WS1's id through WS2's (authorized) path must NOT leak WS1's
		// data: the by-id query must filter on workspace_id, not id alone, so the
		// caller gets a non-2xx. (Some handlers return 500 instead of the ideal
		// 404 on not-found — an error-mapping bug tracked separately in the audit
		// report; it is not an IDOR because no data crosses the tenant boundary.)
		t.Run(r.name+"/id-confusion/GET", func(t *testing.T) {
			path := fmt.Sprintf("%s/%s/%s", f.workspace2Path, r.segment, r.ws1ID)
			resp := f.ts.Get(path)
			assert.GreaterOrEqualf(t, resp.StatusCode, 400,
				"GET %s (WS1 id via WS2 path) must not return WS1 data, got %d — by-id query not workspace-scoped (IDOR)",
				path, resp.StatusCode)
			resp.Body.Close()
		})
		t.Run(r.name+"/id-confusion/DELETE", func(t *testing.T) {
			path := fmt.Sprintf("%s/%s/%s", f.workspace2Path, r.segment, r.ws1ID)
			resp := f.ts.Delete(path)
			// 404 (not found in WS2) or 4xx is acceptable; a 2xx means WS1's row
			// was deleted through WS2's path — a cross-tenant write IDOR.
			assertDenied(t, resp, "DELETE "+path)
		})
	}
}

// assertDenied requires a 4xx (forbidden/not-found/unauthorized). Any 2xx/3xx
// means the cross-tenant access succeeded.
func assertDenied(t *testing.T, resp *http.Response, what string) {
	t.Helper()
	assert.Truef(t, resp.StatusCode >= 400 && resp.StatusCode < 500,
		"%s by a non-member must be denied with 4xx, got %d (cross-tenant access leaked)",
		what, resp.StatusCode)
	resp.Body.Close()
}
