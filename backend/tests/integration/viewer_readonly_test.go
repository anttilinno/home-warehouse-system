//go:build integration
// +build integration

package integration

import (
	"bytes"
	"fmt"
	"mime/multipart"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A viewer is the read-only workspace role. Before ViewerReadOnly, the approval
// middleware only intercepted "member", so a viewer's writes fell through to the
// handler and applied directly — making viewer strictly MORE privileged than
// member (whose writes require approval). These tests pin the closed hole end to
// end against the real router, and keep the member/admin paths as controls so the
// fix can't over-block them.

// viewerWorkspace creates a workspace owned by a fresh owner and adds a viewer,
// returning the workspace id and a token authenticated as the viewer.
func viewerWorkspace(t *testing.T, ts *TestServer) (uuid.UUID, string) {
	t.Helper()

	viewerEmail := "viewer_ro_" + uuid.New().String()[:8] + "@example.com"
	ownerToken := ts.AuthHelper(t, "owner_ro_"+uuid.New().String()[:8]+"@example.com")
	viewerToken := ts.AuthHelper(t, viewerEmail)

	ts.SetToken(ownerToken)
	wsID := newOwnedWorkspace(t, ts, "viewer-ro")
	ts.Post(fmt.Sprintf("/workspaces/%s/members", wsID), map[string]interface{}{
		"email": viewerEmail,
		"role":  "viewer",
	}).Body.Close()

	ts.SetToken(viewerToken)
	return wsID, viewerToken
}

func TestViewerReadOnly_CannotCreateGatedEntity(t *testing.T) {
	ts := NewTestServer(t)
	wsID, _ := viewerWorkspace(t, ts)

	resp := ts.Post(fmt.Sprintf("/workspaces/%s/items", wsID), map[string]interface{}{
		"name": "Viewer Item", "sku": "VRO-001", "min_stock_level": 0,
	})
	defer resp.Body.Close()
	// 403 before the handler runs: not applied, and not queued as a pending change.
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestViewerReadOnly_CannotMutateAcrossMethods(t *testing.T) {
	ts := NewTestServer(t)
	wsID, _ := viewerWorkspace(t, ts)

	someID := uuid.New()
	cases := []struct {
		method string
		path   string
	}{
		{http.MethodPost, fmt.Sprintf("/workspaces/%s/categories", wsID)},
		{http.MethodPatch, fmt.Sprintf("/workspaces/%s/items/%s", wsID, someID)},
		{http.MethodDelete, fmt.Sprintf("/workspaces/%s/locations/%s", wsID, someID)},
	}
	for _, c := range cases {
		t.Run(c.method+" "+c.path, func(t *testing.T) {
			resp := ts.Request(c.method, c.path, map[string]interface{}{"name": "x"})
			defer resp.Body.Close()
			assert.Equal(t, http.StatusForbidden, resp.StatusCode,
				"viewer %s must be forbidden before reaching the handler", c.method)
		})
	}
}

// The photo upload is a non-Huma multipart sub-resource that approval deliberately
// excludes — exactly the kind of route the old per-role handler checks missed. The
// single-chokepoint middleware must cover it too.
func TestViewerReadOnly_CannotUploadPhoto(t *testing.T) {
	ts := NewTestServer(t)
	wsID, _ := viewerWorkspace(t, ts)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("photo", "x.jpg")
	require.NoError(t, err)
	_, _ = part.Write([]byte{0xFF, 0xD8, 0xFF, 0xD9})
	require.NoError(t, writer.Close())

	// itemID is irrelevant: the viewer must be stopped before the handler runs.
	resp := ts.PostRaw(
		fmt.Sprintf("/workspaces/%s/items/%s/photos", wsID, uuid.New()),
		body, writer.FormDataContentType(),
	)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestViewerReadOnly_CanStillRead(t *testing.T) {
	ts := NewTestServer(t)
	wsID, _ := viewerWorkspace(t, ts)

	// A GET must pass — the fix blocks writes, not reads.
	resp := ts.Get(fmt.Sprintf("/workspaces/%s/items", wsID))
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

// Controls: the fix must not touch the member (pending) or admin (direct) paths.
func TestViewerReadOnly_DoesNotAffectMemberOrAdmin(t *testing.T) {
	ts := NewTestServer(t)

	memberEmail := "member_ctl_" + uuid.New().String()[:8] + "@example.com"
	ownerToken := ts.AuthHelper(t, "owner_ctl_"+uuid.New().String()[:8]+"@example.com")
	memberToken := ts.AuthHelper(t, memberEmail)

	ts.SetToken(ownerToken)
	wsID := newOwnedWorkspace(t, ts, "ctl")
	ts.Post(fmt.Sprintf("/workspaces/%s/members", wsID), map[string]interface{}{
		"email": memberEmail, "role": "member",
	}).Body.Close()

	// Owner (admin-equivalent) write applies directly.
	resp := ts.Post(fmt.Sprintf("/workspaces/%s/items", wsID), map[string]interface{}{
		"name": "Owner Item", "sku": "CTL-OWN", "min_stock_level": 0,
	})
	require.Equal(t, http.StatusOK, resp.StatusCode)
	resp.Body.Close()

	// Member write is queued, not forbidden.
	ts.SetToken(memberToken)
	resp = ts.Post(fmt.Sprintf("/workspaces/%s/items", wsID), map[string]interface{}{
		"name": "Member Item", "sku": "CTL-MEM", "min_stock_level": 0,
	})
	defer resp.Body.Close()
	assert.Equal(t, http.StatusAccepted, resp.StatusCode, "member write must still go pending, not be blocked")
}
