//go:build integration
// +build integration

package integration

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The activity log is written by the broadcaster tap (activity.NewEventTap), which
// inserts rows from a goroutine after the HTTP response is already on the wire. It
// is also the only place the Go EntityType/Action strings meet the real
// warehouse.activity_{entity,action}_enum: a value the enum rejects fails at INSERT
// and the tap logs-and-drops it, so no unit test and no HTTP status can catch the
// mismatch. These tests exercise the real router against a real Postgres.

type activityRow struct {
	UserID     *uuid.UUID `json:"user_id,omitempty"`
	Action     string     `json:"action"`
	EntityType string     `json:"entity_type"`
	EntityID   uuid.UUID  `json:"entity_id"`
	EntityName string     `json:"entity_name"`
}

// awaitActivity polls GET /activity until at least one row matches, or fails. The
// tap writes asynchronously, so absence at t=0 proves nothing.
func awaitActivity(t *testing.T, ts *TestServer, workspaceID uuid.UUID, match func(activityRow) bool) activityRow {
	t.Helper()

	deadline := time.Now().Add(5 * time.Second)
	var seen []activityRow
	for time.Now().Before(deadline) {
		resp := ts.Get(fmt.Sprintf("/workspaces/%s/activity", workspaceID))
		RequireStatus(t, resp, http.StatusOK)
		body := ParseResponse[struct {
			Items []activityRow `json:"items"`
		}](t, resp)

		seen = body.Items
		for _, row := range seen {
			if match(row) {
				return row
			}
		}
		time.Sleep(50 * time.Millisecond)
	}

	t.Fatalf("no matching activity row after 5s; saw %d row(s): %+v", len(seen), seen)
	return activityRow{}
}

// requireCreated accepts either success code: the entity handlers are inconsistent
// (items/locations return 200, categories 201), and which one is irrelevant here.
func requireCreated(t *testing.T, resp *http.Response) {
	t.Helper()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		RequireStatus(t, resp, http.StatusOK) // fails with the body dumped
	}
	resp.Body.Close()
}

func newOwnedWorkspace(t *testing.T, ts *TestServer, prefix string) uuid.UUID {
	t.Helper()

	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        prefix + " Workspace",
		"slug":        prefix + "-ws-" + uuid.New().String()[:8],
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	return ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp).ID
}

// TestActivityLog_DirectWriteIsAudited covers the plain admin path: a handler
// publishes item.created, the tap turns it into a CREATE/ITEM row. Before the tap
// existed, warehouse.activity_log was never written at all.
func TestActivityLog_DirectWriteIsAudited(t *testing.T) {
	ts := NewTestServer(t)

	ownerEmail := "owner_activity_" + uuid.New().String()[:8] + "@example.com"
	ts.SetToken(ts.AuthHelper(t, ownerEmail))
	ownerID := getUserID(t, ts)
	wsID := newOwnedWorkspace(t, ts, "activity")

	resp := ts.Post(fmt.Sprintf("/workspaces/%s/items", wsID), map[string]interface{}{
		"name":            "Cordless Drill",
		"sku":             "DRILL-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)
	created := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	row := awaitActivity(t, ts, wsID, func(r activityRow) bool {
		return r.EntityID == created.ID
	})

	assert.Equal(t, "CREATE", row.Action)
	assert.Equal(t, "ITEM", row.EntityType)
	assert.Equal(t, "Cordless Drill", row.EntityName)
	if assert.NotNil(t, row.UserID, "actor must be attributed") {
		assert.Equal(t, ownerID, *row.UserID)
	}
}

// TestActivityLog_ApprovedChangeIsAudited is the automated form of the two-browser
// check: a member's create goes pending, an admin approves it, and the approval
// publishes the entity event. The audit row can only exist if that event fired —
// the tap is driven exclusively by Broadcaster.Publish — so this asserts both the
// SSE gap and the activity gap at once, and attributes the row to the reviewer.
func TestActivityLog_ApprovedChangeIsAudited(t *testing.T) {
	ts := NewTestServer(t)

	ownerEmail := "owner_approve_activity_" + uuid.New().String()[:8] + "@example.com"
	memberEmail := "member_approve_activity_" + uuid.New().String()[:8] + "@example.com"

	ownerToken := ts.AuthHelper(t, ownerEmail)
	memberToken := ts.AuthHelper(t, memberEmail)

	ts.SetToken(ownerToken)
	ownerID := getUserID(t, ts)
	wsID := newOwnedWorkspace(t, ts, "approve-activity")

	ts.Post(fmt.Sprintf("/workspaces/%s/members", wsID), map[string]interface{}{
		"email": memberEmail,
		"role":  "member",
	}).Body.Close()

	// Member's write is intercepted: 202 + a pending change, no entity yet.
	ts.SetToken(memberToken)
	resp := ts.Post(fmt.Sprintf("/workspaces/%s/items", wsID), map[string]interface{}{
		"name":            "Pending Drill",
		"sku":             "PEND-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusAccepted)
	pending := ParseResponse[struct {
		PendingChangeID uuid.UUID `json:"pending_change_id"`
	}](t, resp)

	// Owner approves; the apply publishes item.created, which the tap audits.
	ts.SetToken(ownerToken)
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/pending-changes/%s/approve", wsID, pending.PendingChangeID), nil)
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// The approved item's real ID — the applier surfaces it, so the row must name it.
	resp = ts.Get(fmt.Sprintf("/workspaces/%s/items", wsID))
	RequireStatus(t, resp, http.StatusOK)
	items := ParseResponse[struct {
		Items []struct {
			ID uuid.UUID `json:"id"`
		} `json:"items"`
	}](t, resp)
	require.Len(t, items.Items, 1, "approval must have created exactly one item")
	itemID := items.Items[0].ID

	row := awaitActivity(t, ts, wsID, func(r activityRow) bool {
		return r.EntityType == "ITEM" && r.EntityID == itemID
	})

	assert.Equal(t, "CREATE", row.Action)
	assert.NotEqual(t, uuid.Nil, row.EntityID, "row must carry the applied entity's ID, not uuid.Nil")
	if assert.NotNil(t, row.UserID) {
		assert.Equal(t, ownerID, *row.UserID, "the reviewer is the actor at apply time")
	}

	// pendingchange.approved is deliberately off the tap's allowlist: the approval
	// must leave exactly one audit row, not one per event it published.
	resp = ts.Get(fmt.Sprintf("/workspaces/%s/activity", wsID))
	RequireStatus(t, resp, http.StatusOK)
	all := ParseResponse[struct {
		Items []activityRow `json:"items"`
	}](t, resp)
	assert.Len(t, all.Items, 1, "approved change must not double-log")
}

// TestActivityLog_EnumCoverage drives one real mutation per audited entity type so a
// value the DB enum rejects surfaces here rather than as a silently dropped row in
// production. Enum drift (a new Go EntityType, a renamed action) fails this test.
func TestActivityLog_EnumCoverage(t *testing.T) {
	ts := NewTestServer(t)

	ts.SetToken(ts.AuthHelper(t, "owner_enum_"+uuid.New().String()[:8]+"@example.com"))
	wsID := newOwnedWorkspace(t, ts, "enum")

	// Each mutation publishes an event whose entity type is on the tap's allowlist.
	locResp := ts.Post(fmt.Sprintf("/workspaces/%s/locations", wsID), map[string]interface{}{"name": "Garage"})
	RequireStatus(t, locResp, http.StatusOK)
	locID := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, locResp).ID

	requireCreated(t, ts.Post(fmt.Sprintf("/workspaces/%s/categories", wsID), map[string]interface{}{"name": "Tools"}))

	requireCreated(t, ts.Post(fmt.Sprintf("/workspaces/%s/containers", wsID), map[string]interface{}{
		"name": "Bin A", "location_id": locID,
	}))

	requireCreated(t, ts.Post(fmt.Sprintf("/workspaces/%s/borrowers", wsID), map[string]interface{}{"name": "Alice"}))

	requireCreated(t, ts.Post(fmt.Sprintf("/workspaces/%s/labels", wsID), map[string]interface{}{"name": "Fragile"}))

	for _, entityType := range []string{"LOCATION", "CATEGORY", "CONTAINER", "BORROWER", "LABEL"} {
		row := awaitActivity(t, ts, wsID, func(r activityRow) bool {
			return r.EntityType == entityType
		})
		assert.Equal(t, "CREATE", row.Action, "%s should log a CREATE", entityType)
	}
}
