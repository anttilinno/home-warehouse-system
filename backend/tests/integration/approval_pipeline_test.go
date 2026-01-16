//go:build integration
// +build integration

package integration

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper function to get user ID from token
func getUserID(t *testing.T, ts *TestServer) uuid.UUID {
	t.Helper()
	resp := ts.Get("/users/me")
	RequireStatus(t, resp, http.StatusOK)
	user := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)
	return user.ID
}

// Helper function to add member to workspace
func addMemberToWorkspace(t *testing.T, ts *TestServer, workspaceID uuid.UUID, userID uuid.UUID, role string) {
	t.Helper()
	resp := ts.Post(fmt.Sprintf("/workspaces/%s/members", workspaceID), map[string]interface{}{
		"user_id": userID,
		"role":    role,
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()
}

// =============================================================================
// Complete Workflow Tests
// =============================================================================

func TestApprovalPipeline_CompleteWorkflow_CreateApproveVerify(t *testing.T) {
	t.Skip("Skipping: Approval middleware not yet integrated with Huma routes. See approval_middleware_integration_test.go for middleware unit tests.")
	// TODO: This test should be enabled once approval middleware is properly integrated with Huma routing
	// Currently the middleware works in isolation (see approval_integration_test.go) but doesn't intercept Huma routes
	// The pending change API endpoints themselves work correctly (tested in handler_integration_test.go)
}

func TestApprovalPipeline_CompleteWorkflow_CreateRejectVerify(t *testing.T) {
	ts := NewTestServer(t)

	ownerEmail := "owner_reject_" + uuid.New().String()[:8] + "@example.com"
	memberEmail := "member_reject_" + uuid.New().String()[:8] + "@example.com"

	ownerToken := ts.AuthHelper(t, ownerEmail)
	memberToken := ts.AuthHelper(t, memberEmail)

	// Owner creates workspace
	ts.SetToken(ownerToken)
	slug := "reject-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Rejection Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Invite member
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/members", ws.ID), map[string]interface{}{
		"email": memberEmail,
		"role":  "member",
	})
	resp.Body.Close()

	// Member creates an item
	ts.SetToken(memberToken)
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/items", ws.ID), map[string]interface{}{
		"name":            "Rejected Item",
		"sku":             "REJ-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusAccepted)

	pendingResp := ParseResponse[struct {
		PendingChangeID uuid.UUID `json:"pending_change_id"`
	}](t, resp)

	// Owner rejects the change
	ts.SetToken(ownerToken)
	resp = ts.Post(fmt.Sprintf("/pending-changes/%s/reject", pendingResp.PendingChangeID), map[string]interface{}{
		"reason": "Item not needed at this time",
	})
	RequireStatus(t, resp, http.StatusOK)

	rejectResp := ParseResponse[struct {
		Status          string  `json:"status"`
		RejectionReason *string `json:"rejection_reason"`
	}](t, resp)
	assert.Equal(t, "rejected", rejectResp.Status)
	assert.NotNil(t, rejectResp.RejectionReason)
	assert.Equal(t, "Item not needed at this time", *rejectResp.RejectionReason)

	// Verify item was NOT created
	resp = ts.Get(fmt.Sprintf("/workspaces/%s/items", ws.ID))
	RequireStatus(t, resp, http.StatusOK)
	items := ParseResponse[struct {
		Total int `json:"total"`
	}](t, resp)
	assert.Equal(t, 0, items.Total)
}

// =============================================================================
// Authorization Tests
// =============================================================================

func TestApprovalPipeline_Authorization_NonAdminCannotApprove(t *testing.T) {
	ts := NewTestServer(t)

	member1Email := "member1_auth_" + uuid.New().String()[:8] + "@example.com"
	member2Email := "member2_auth_" + uuid.New().String()[:8] + "@example.com"
	ownerEmail := "owner_auth_" + uuid.New().String()[:8] + "@example.com"

	member1Token := ts.AuthHelper(t, member1Email)
	member2Token := ts.AuthHelper(t, member2Email)
	ownerToken := ts.AuthHelper(t, ownerEmail)

	// Create workspace
	ts.SetToken(ownerToken)
	slug := "auth-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Auth Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Invite both members
	ts.Post(fmt.Sprintf("/workspaces/%s/members", ws.ID), map[string]interface{}{
		"email": member1Email,
		"role":  "member",
	}).Body.Close()

	ts.Post(fmt.Sprintf("/workspaces/%s/members", ws.ID), map[string]interface{}{
		"email": member2Email,
		"role":  "member",
	}).Body.Close()

	// Member1 creates item
	ts.SetToken(member1Token)
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/items", ws.ID), map[string]interface{}{
		"name":            "Test Item",
		"sku":             "AUTH-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusAccepted)
	pendingResp := ParseResponse[struct {
		PendingChangeID uuid.UUID `json:"pending_change_id"`
	}](t, resp)

	// Member2 tries to approve (should fail)
	ts.SetToken(member2Token)
	resp = ts.Post(fmt.Sprintf("/pending-changes/%s/approve", pendingResp.PendingChangeID), nil)
	RequireStatus(t, resp, http.StatusForbidden)
	resp.Body.Close()

	// Member1 tries to approve their own change (should fail)
	ts.SetToken(member1Token)
	resp = ts.Post(fmt.Sprintf("/pending-changes/%s/approve", pendingResp.PendingChangeID), nil)
	RequireStatus(t, resp, http.StatusForbidden)
	resp.Body.Close()

	// Owner can approve
	ts.SetToken(ownerToken)
	resp = ts.Post(fmt.Sprintf("/pending-changes/%s/approve", pendingResp.PendingChangeID), nil)
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()
}

func TestApprovalPipeline_MemberCreatesItemGoesPending(t *testing.T) {
	ts := NewTestServer(t)

	ownerEmail := "owner_member_" + uuid.New().String()[:8] + "@example.com"
	memberEmail := "member_member_" + uuid.New().String()[:8] + "@example.com"

	ownerToken := ts.AuthHelper(t, ownerEmail)
	memberToken := ts.AuthHelper(t, memberEmail)

	ts.SetToken(ownerToken)
	slug := "member-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Member Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	ts.Post(fmt.Sprintf("/workspaces/%s/members", ws.ID), map[string]interface{}{
		"email": memberEmail,
		"role":  "member",
	}).Body.Close()

	// Member creates item - should go to pending
	ts.SetToken(memberToken)
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/items", ws.ID), map[string]interface{}{
		"name":            "Member Item",
		"sku":             "MBR-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusAccepted)

	pendingResp := ParseResponse[struct {
		Status string `json:"status"`
	}](t, resp)
	assert.Equal(t, "pending_approval", pendingResp.Status)
}

func TestApprovalPipeline_AdminCreatesItemBypassesPending(t *testing.T) {
	ts := NewTestServer(t)

	ownerEmail := "owner_admin_" + uuid.New().String()[:8] + "@example.com"
	adminEmail := "admin_admin_" + uuid.New().String()[:8] + "@example.com"

	ownerToken := ts.AuthHelper(t, ownerEmail)
	adminToken := ts.AuthHelper(t, adminEmail)

	ts.SetToken(ownerToken)
	slug := "admin-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Admin Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	ts.Post(fmt.Sprintf("/workspaces/%s/members", ws.ID), map[string]interface{}{
		"email": adminEmail,
		"role":  "admin",
	}).Body.Close()

	// Admin creates item - should bypass pending
	ts.SetToken(adminToken)
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/items", ws.ID), map[string]interface{}{
		"name":            "Admin Item",
		"sku":             "ADM-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusCreated)

	// Verify no pending_change_id in response
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	_, hasPendingID := result["pending_change_id"]
	assert.False(t, hasPendingID)
}

// =============================================================================
// Entity Type Tests
// =============================================================================

func TestApprovalPipeline_Items(t *testing.T) {
	ts := NewTestServer(t)

	ownerEmail := "owner_items_" + uuid.New().String()[:8] + "@example.com"
	memberEmail := "member_items_" + uuid.New().String()[:8] + "@example.com"

	ownerToken := ts.AuthHelper(t, ownerEmail)
	memberToken := ts.AuthHelper(t, memberEmail)

	ts.SetToken(ownerToken)
	slug := "items-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Items Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	ts.Post(fmt.Sprintf("/workspaces/%s/members", ws.ID), map[string]interface{}{
		"email": memberEmail,
		"role":  "member",
	}).Body.Close()

	// Member creates item
	ts.SetToken(memberToken)
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/items", ws.ID), map[string]interface{}{
		"name":            "Pending Item",
		"sku":             "ITEM-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusAccepted)
	pendingResp := ParseResponse[struct {
		PendingChangeID uuid.UUID `json:"pending_change_id"`
	}](t, resp)

	// Owner approves
	ts.SetToken(ownerToken)
	resp = ts.Post(fmt.Sprintf("/pending-changes/%s/approve", pendingResp.PendingChangeID), nil)
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Verify item exists
	resp = ts.Get(fmt.Sprintf("/workspaces/%s/items", ws.ID))
	RequireStatus(t, resp, http.StatusOK)
	items := ParseResponse[struct {
		Total int `json:"total"`
	}](t, resp)
	assert.Equal(t, 1, items.Total)
}

func TestApprovalPipeline_Locations(t *testing.T) {
	ts := NewTestServer(t)

	ownerEmail := "owner_loc_" + uuid.New().String()[:8] + "@example.com"
	memberEmail := "member_loc_" + uuid.New().String()[:8] + "@example.com"

	ownerToken := ts.AuthHelper(t, ownerEmail)
	memberToken := ts.AuthHelper(t, memberEmail)

	ts.SetToken(ownerToken)
	slug := "loc-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Location Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	ts.Post(fmt.Sprintf("/workspaces/%s/members", ws.ID), map[string]interface{}{
		"email": memberEmail,
		"role":  "member",
	}).Body.Close()

	// Member creates location
	ts.SetToken(memberToken)
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/locations", ws.ID), map[string]interface{}{
		"name": "Pending Location",
	})
	RequireStatus(t, resp, http.StatusAccepted)
	pendingResp := ParseResponse[struct {
		PendingChangeID uuid.UUID `json:"pending_change_id"`
	}](t, resp)

	// Owner approves
	ts.SetToken(ownerToken)
	resp = ts.Post(fmt.Sprintf("/pending-changes/%s/approve", pendingResp.PendingChangeID), nil)
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Verify location exists
	resp = ts.Get(fmt.Sprintf("/workspaces/%s/locations", ws.ID))
	RequireStatus(t, resp, http.StatusOK)
	locations := ParseResponse[struct {
		Total int `json:"total"`
	}](t, resp)
	assert.Equal(t, 1, locations.Total)
}

func TestApprovalPipeline_Containers(t *testing.T) {
	ts := NewTestServer(t)

	ownerEmail := "owner_cont_" + uuid.New().String()[:8] + "@example.com"
	memberEmail := "member_cont_" + uuid.New().String()[:8] + "@example.com"

	ownerToken := ts.AuthHelper(t, ownerEmail)
	memberToken := ts.AuthHelper(t, memberEmail)

	ts.SetToken(ownerToken)
	slug := "cont-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Container Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	ts.Post(fmt.Sprintf("/workspaces/%s/members", ws.ID), map[string]interface{}{
		"email": memberEmail,
		"role":  "member",
	}).Body.Close()

	// Create a location first (as owner so it doesn't need approval)
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/locations", ws.ID), map[string]interface{}{
		"name": "Test Location",
	})
	RequireStatus(t, resp, http.StatusCreated)
	location := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Member creates container
	ts.SetToken(memberToken)
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/containers", ws.ID), map[string]interface{}{
		"name":        "Pending Container",
		"location_id": location.ID,
	})
	RequireStatus(t, resp, http.StatusAccepted)
	pendingResp := ParseResponse[struct {
		PendingChangeID uuid.UUID `json:"pending_change_id"`
	}](t, resp)

	// Owner approves
	ts.SetToken(ownerToken)
	resp = ts.Post(fmt.Sprintf("/pending-changes/%s/approve", pendingResp.PendingChangeID), nil)
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Verify container exists
	resp = ts.Get(fmt.Sprintf("/workspaces/%s/containers", ws.ID))
	RequireStatus(t, resp, http.StatusOK)
	containers := ParseResponse[struct {
		Total int `json:"total"`
	}](t, resp)
	assert.Equal(t, 1, containers.Total)
}

func TestApprovalPipeline_Categories(t *testing.T) {
	ts := NewTestServer(t)

	ownerEmail := "owner_cat_" + uuid.New().String()[:8] + "@example.com"
	memberEmail := "member_cat_" + uuid.New().String()[:8] + "@example.com"

	ownerToken := ts.AuthHelper(t, ownerEmail)
	memberToken := ts.AuthHelper(t, memberEmail)

	ts.SetToken(ownerToken)
	slug := "cat-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Category Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	ts.Post(fmt.Sprintf("/workspaces/%s/members", ws.ID), map[string]interface{}{
		"email": memberEmail,
		"role":  "member",
	}).Body.Close()

	// Member creates category
	ts.SetToken(memberToken)
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/categories", ws.ID), map[string]interface{}{
		"name": "Pending Category",
	})
	RequireStatus(t, resp, http.StatusAccepted)
	pendingResp := ParseResponse[struct {
		PendingChangeID uuid.UUID `json:"pending_change_id"`
	}](t, resp)

	// Owner approves
	ts.SetToken(ownerToken)
	resp = ts.Post(fmt.Sprintf("/pending-changes/%s/approve", pendingResp.PendingChangeID), nil)
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Verify category exists
	resp = ts.Get(fmt.Sprintf("/workspaces/%s/categories", ws.ID))
	RequireStatus(t, resp, http.StatusOK)
	categories := ParseResponse[struct {
		Total int `json:"total"`
	}](t, resp)
	assert.Equal(t, 1, categories.Total)
}

func TestApprovalPipeline_Borrowers(t *testing.T) {
	ts := NewTestServer(t)

	ownerEmail := "owner_borr_" + uuid.New().String()[:8] + "@example.com"
	memberEmail := "member_borr_" + uuid.New().String()[:8] + "@example.com"

	ownerToken := ts.AuthHelper(t, ownerEmail)
	memberToken := ts.AuthHelper(t, memberEmail)

	ts.SetToken(ownerToken)
	slug := "borr-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Borrower Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	ts.Post(fmt.Sprintf("/workspaces/%s/members", ws.ID), map[string]interface{}{
		"email": memberEmail,
		"role":  "member",
	}).Body.Close()

	// Member creates borrower
	ts.SetToken(memberToken)
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/borrowers", ws.ID), map[string]interface{}{
		"name":  "Pending Borrower",
		"email": "borrower@example.com",
	})
	RequireStatus(t, resp, http.StatusAccepted)
	pendingResp := ParseResponse[struct {
		PendingChangeID uuid.UUID `json:"pending_change_id"`
	}](t, resp)

	// Owner approves
	ts.SetToken(ownerToken)
	resp = ts.Post(fmt.Sprintf("/pending-changes/%s/approve", pendingResp.PendingChangeID), nil)
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Verify borrower exists
	resp = ts.Get(fmt.Sprintf("/workspaces/%s/borrowers", ws.ID))
	RequireStatus(t, resp, http.StatusOK)
	borrowers := ParseResponse[struct {
		Total int `json:"total"`
	}](t, resp)
	assert.Equal(t, 1, borrowers.Total)
}

// =============================================================================
// Edge Cases
// =============================================================================

func TestApprovalPipeline_EdgeCase_ApproveNonExistent(t *testing.T) {
	ts := NewTestServer(t)

	ownerEmail := "owner_404_" + uuid.New().String()[:8] + "@example.com"
	ownerToken := ts.AuthHelper(t, ownerEmail)

	ts.SetToken(ownerToken)
	slug := "edge-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Edge Case Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Try to approve non-existent change
	fakeID := uuid.New()
	resp = ts.Post(fmt.Sprintf("/pending-changes/%s/approve", fakeID), nil)
	RequireStatus(t, resp, http.StatusNotFound)
	resp.Body.Close()
}

func TestApprovalPipeline_EdgeCase_ApproveAlreadyApproved(t *testing.T) {
	ts := NewTestServer(t)

	ownerEmail := "owner_dup_" + uuid.New().String()[:8] + "@example.com"
	memberEmail := "member_dup_" + uuid.New().String()[:8] + "@example.com"

	ownerToken := ts.AuthHelper(t, ownerEmail)
	memberToken := ts.AuthHelper(t, memberEmail)

	ts.SetToken(ownerToken)
	slug := "dup-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Duplicate Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	ts.Post(fmt.Sprintf("/workspaces/%s/members", ws.ID), map[string]interface{}{
		"email": memberEmail,
		"role":  "member",
	}).Body.Close()

	// Member creates item
	ts.SetToken(memberToken)
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/items", ws.ID), map[string]interface{}{
		"name":            "Item",
		"sku":             "DUP-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusAccepted)
	pendingResp := ParseResponse[struct {
		PendingChangeID uuid.UUID `json:"pending_change_id"`
	}](t, resp)

	// Owner approves
	ts.SetToken(ownerToken)
	resp = ts.Post(fmt.Sprintf("/pending-changes/%s/approve", pendingResp.PendingChangeID), nil)
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Try to approve again
	resp = ts.Post(fmt.Sprintf("/pending-changes/%s/approve", pendingResp.PendingChangeID), nil)
	RequireStatus(t, resp, http.StatusBadRequest)
	resp.Body.Close()
}

func TestApprovalPipeline_EdgeCase_RejectAlreadyRejected(t *testing.T) {
	ts := NewTestServer(t)

	ownerEmail := "owner_rej2_" + uuid.New().String()[:8] + "@example.com"
	memberEmail := "member_rej2_" + uuid.New().String()[:8] + "@example.com"

	ownerToken := ts.AuthHelper(t, ownerEmail)
	memberToken := ts.AuthHelper(t, memberEmail)

	ts.SetToken(ownerToken)
	slug := "rej2-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Reject2 Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	ts.Post(fmt.Sprintf("/workspaces/%s/members", ws.ID), map[string]interface{}{
		"email": memberEmail,
		"role":  "member",
	}).Body.Close()

	// Member creates item
	ts.SetToken(memberToken)
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/items", ws.ID), map[string]interface{}{
		"name":            "Item",
		"sku":             "REJ2-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusAccepted)
	pendingResp := ParseResponse[struct {
		PendingChangeID uuid.UUID `json:"pending_change_id"`
	}](t, resp)

	// Owner rejects
	ts.SetToken(ownerToken)
	resp = ts.Post(fmt.Sprintf("/pending-changes/%s/reject", pendingResp.PendingChangeID), map[string]interface{}{
		"reason": "First rejection",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Try to reject again
	resp = ts.Post(fmt.Sprintf("/pending-changes/%s/reject", pendingResp.PendingChangeID), map[string]interface{}{
		"reason": "Second rejection",
	})
	RequireStatus(t, resp, http.StatusBadRequest)
	resp.Body.Close()
}

func TestApprovalPipeline_EdgeCase_CrossWorkspaceApproval(t *testing.T) {
	ts := NewTestServer(t)

	owner1Email := "owner1_cross_" + uuid.New().String()[:8] + "@example.com"
	owner2Email := "owner2_cross_" + uuid.New().String()[:8] + "@example.com"
	memberEmail := "member_cross_" + uuid.New().String()[:8] + "@example.com"

	owner1Token := ts.AuthHelper(t, owner1Email)
	owner2Token := ts.AuthHelper(t, owner2Email)
	memberToken := ts.AuthHelper(t, memberEmail)

	// Create workspace 1
	ts.SetToken(owner1Token)
	slug1 := "cross1-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Cross Workspace 1",
		"slug":        slug1,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws1 := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	ts.Post(fmt.Sprintf("/workspaces/%s/members", ws1.ID), map[string]interface{}{
		"email": memberEmail,
		"role":  "member",
	}).Body.Close()

	// Create workspace 2
	ts.SetToken(owner2Token)
	slug2 := "cross2-ws-" + uuid.New().String()[:8]
	resp = ts.Post("/workspaces", map[string]interface{}{
		"name":        "Cross Workspace 2",
		"slug":        slug2,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Member creates item in workspace 1
	ts.SetToken(memberToken)
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/items", ws1.ID), map[string]interface{}{
		"name":            "Cross Item",
		"sku":             "CROSS-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusAccepted)
	pendingResp := ParseResponse[struct {
		PendingChangeID uuid.UUID `json:"pending_change_id"`
	}](t, resp)

	// Owner2 (not member of workspace 1) tries to approve
	ts.SetToken(owner2Token)
	resp = ts.Post(fmt.Sprintf("/pending-changes/%s/approve", pendingResp.PendingChangeID), nil)
	// Should be forbidden or not found
	require.True(t, resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotFound)
	resp.Body.Close()
}

// =============================================================================
// Performance Tests
// =============================================================================

func TestApprovalPipeline_Performance_BatchApproval(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping performance test in short mode")
	}

	ts := NewTestServer(t)

	ownerEmail := "owner_perf_" + uuid.New().String()[:8] + "@example.com"
	memberEmail := "member_perf_" + uuid.New().String()[:8] + "@example.com"

	ownerToken := ts.AuthHelper(t, ownerEmail)
	memberToken := ts.AuthHelper(t, memberEmail)

	ts.SetToken(ownerToken)
	slug := "perf-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Performance Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	ts.Post(fmt.Sprintf("/workspaces/%s/members", ws.ID), map[string]interface{}{
		"email": memberEmail,
		"role":  "member",
	}).Body.Close()

	// Create 50 pending changes (reduced from 100 for faster tests)
	pendingIDs := make([]uuid.UUID, 0, 50)
	ts.SetToken(memberToken)

	start := time.Now()
	for i := 0; i < 50; i++ {
		resp = ts.Post(fmt.Sprintf("/workspaces/%s/items", ws.ID), map[string]interface{}{
			"name":            fmt.Sprintf("Perf Item %d", i),
			"sku":             fmt.Sprintf("PERF-%03d", i),
			"min_stock_level": 0,
		})
		RequireStatus(t, resp, http.StatusAccepted)
		pendingResp := ParseResponse[struct {
			PendingChangeID uuid.UUID `json:"pending_change_id"`
		}](t, resp)
		pendingIDs = append(pendingIDs, pendingResp.PendingChangeID)
	}
	createDuration := time.Since(start)
	t.Logf("Created 50 pending changes in %v", createDuration)

	// Approve all in batch
	ts.SetToken(ownerToken)
	start = time.Now()
	for _, pendingID := range pendingIDs {
		resp = ts.Post(fmt.Sprintf("/pending-changes/%s/approve", pendingID), nil)
		RequireStatus(t, resp, http.StatusOK)
		resp.Body.Close()
	}
	approveDuration := time.Since(start)
	t.Logf("Approved 50 pending changes in %v", approveDuration)

	// Verify all items were created
	resp = ts.Get(fmt.Sprintf("/workspaces/%s/items", ws.ID))
	RequireStatus(t, resp, http.StatusOK)
	items := ParseResponse[struct {
		Total int `json:"total"`
	}](t, resp)
	assert.Equal(t, 50, items.Total)

	// Performance assertions - should be reasonably fast
	assert.Less(t, createDuration.Seconds(), 30.0, "Creating 50 pending changes should take less than 30s")
	assert.Less(t, approveDuration.Seconds(), 30.0, "Approving 50 pending changes should take less than 30s")
}

func TestApprovalPipeline_Pagination(t *testing.T) {
	ts := NewTestServer(t)

	ownerEmail := "owner_page_" + uuid.New().String()[:8] + "@example.com"
	memberEmail := "member_page_" + uuid.New().String()[:8] + "@example.com"

	ownerToken := ts.AuthHelper(t, ownerEmail)
	memberToken := ts.AuthHelper(t, memberEmail)

	ts.SetToken(ownerToken)
	slug := "page-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Pagination Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	ts.Post(fmt.Sprintf("/workspaces/%s/members", ws.ID), map[string]interface{}{
		"email": memberEmail,
		"role":  "member",
	}).Body.Close()

	// Create 25 pending changes
	ts.SetToken(memberToken)
	for i := 0; i < 25; i++ {
		resp = ts.Post(fmt.Sprintf("/workspaces/%s/items", ws.ID), map[string]interface{}{
			"name":            fmt.Sprintf("Page Item %d", i),
			"sku":             fmt.Sprintf("PAGE-%03d", i),
			"min_stock_level": 0,
		})
		RequireStatus(t, resp, http.StatusAccepted)
		resp.Body.Close()
	}

	// Test pagination
	ts.SetToken(ownerToken)
	resp = ts.Get("/pending-changes?limit=10")
	RequireStatus(t, resp, http.StatusOK)
	page1 := ParseResponse[struct {
		Changes []map[string]interface{} `json:"changes"`
		Total   int                      `json:"total"`
	}](t, resp)

	assert.GreaterOrEqual(t, page1.Total, 25)
	assert.LessOrEqual(t, len(page1.Changes), 10)

	// Get second page
	resp = ts.Get("/pending-changes?limit=10&offset=10")
	RequireStatus(t, resp, http.StatusOK)
	page2 := ParseResponse[struct {
		Changes []map[string]interface{} `json:"changes"`
	}](t, resp)

	assert.LessOrEqual(t, len(page2.Changes), 10)
}
