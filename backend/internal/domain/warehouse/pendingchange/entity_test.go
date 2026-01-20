package pendingchange

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewPendingChange(t *testing.T) {
	workspaceID := uuid.New()
	requesterID := uuid.New()
	payload := json.RawMessage(`{"name": "Test Item"}`)

	t.Run("creates valid pending change for create action", func(t *testing.T) {
		change, err := NewPendingChange(workspaceID, requesterID, "item", nil, ActionCreate, payload)

		require.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, change.ID())
		assert.Equal(t, workspaceID, change.WorkspaceID())
		assert.Equal(t, requesterID, change.RequesterID())
		assert.Equal(t, "item", change.EntityType())
		assert.Nil(t, change.EntityID())
		assert.Equal(t, ActionCreate, change.Action())
		assert.Equal(t, payload, change.Payload())
		assert.Equal(t, StatusPending, change.Status())
		assert.Nil(t, change.ReviewedBy())
		assert.Nil(t, change.ReviewedAt())
		assert.Nil(t, change.RejectionReason())
		assert.WithinDuration(t, time.Now(), change.CreatedAt(), time.Second)
		assert.WithinDuration(t, time.Now(), change.UpdatedAt(), time.Second)
	})

	t.Run("creates valid pending change for update action with entity ID", func(t *testing.T) {
		entityID := uuid.New()
		change, err := NewPendingChange(workspaceID, requesterID, "item", &entityID, ActionUpdate, payload)

		require.NoError(t, err)
		assert.Equal(t, ActionUpdate, change.Action())
		assert.NotNil(t, change.EntityID())
		assert.Equal(t, entityID, *change.EntityID())
	})

	t.Run("creates valid pending change for delete action with entity ID", func(t *testing.T) {
		entityID := uuid.New()
		change, err := NewPendingChange(workspaceID, requesterID, "item", &entityID, ActionDelete, payload)

		require.NoError(t, err)
		assert.Equal(t, ActionDelete, change.Action())
		assert.NotNil(t, change.EntityID())
		assert.Equal(t, entityID, *change.EntityID())
	})

	t.Run("fails with empty workspace ID", func(t *testing.T) {
		change, err := NewPendingChange(uuid.Nil, requesterID, "item", nil, ActionCreate, payload)

		assert.Error(t, err)
		assert.Nil(t, change)
		assert.Contains(t, err.Error(), "workspace_id")
	})

	t.Run("fails with empty requester ID", func(t *testing.T) {
		change, err := NewPendingChange(workspaceID, uuid.Nil, "item", nil, ActionCreate, payload)

		assert.Error(t, err)
		assert.Nil(t, change)
		assert.Contains(t, err.Error(), "requester_id")
	})

	t.Run("fails with empty entity type", func(t *testing.T) {
		change, err := NewPendingChange(workspaceID, requesterID, "", nil, ActionCreate, payload)

		assert.Error(t, err)
		assert.Nil(t, change)
		assert.Contains(t, err.Error(), "entity_type")
	})

	t.Run("fails with invalid action", func(t *testing.T) {
		change, err := NewPendingChange(workspaceID, requesterID, "item", nil, Action("invalid"), payload)

		assert.Error(t, err)
		assert.Nil(t, change)
		assert.Contains(t, err.Error(), "action")
	})

	t.Run("fails with empty payload", func(t *testing.T) {
		change, err := NewPendingChange(workspaceID, requesterID, "item", nil, ActionCreate, json.RawMessage{})

		assert.Error(t, err)
		assert.Nil(t, change)
		assert.Contains(t, err.Error(), "payload")
	})

	t.Run("fails with nil payload", func(t *testing.T) {
		change, err := NewPendingChange(workspaceID, requesterID, "item", nil, ActionCreate, nil)

		assert.Error(t, err)
		assert.Nil(t, change)
		assert.Contains(t, err.Error(), "payload")
	})

	t.Run("creates pending change for all supported entity types", func(t *testing.T) {
		entityTypes := []string{"item", "category", "location", "container", "inventory", "borrower", "loan", "label"}
		for _, entityType := range entityTypes {
			change, err := NewPendingChange(workspaceID, requesterID, entityType, nil, ActionCreate, payload)

			require.NoError(t, err, "failed for entity type: %s", entityType)
			assert.Equal(t, entityType, change.EntityType())
		}
	})
}

func TestPendingChange_Approve(t *testing.T) {
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	payload := json.RawMessage(`{"name": "Test Item"}`)

	t.Run("successfully approves pending change", func(t *testing.T) {
		change, _ := NewPendingChange(workspaceID, requesterID, "item", nil, ActionCreate, payload)
		originalUpdatedAt := change.UpdatedAt()

		time.Sleep(time.Millisecond) // Ensure time difference

		err := change.Approve(reviewerID)

		require.NoError(t, err)
		assert.Equal(t, StatusApproved, change.Status())
		assert.NotNil(t, change.ReviewedBy())
		assert.Equal(t, reviewerID, *change.ReviewedBy())
		assert.NotNil(t, change.ReviewedAt())
		assert.WithinDuration(t, time.Now(), *change.ReviewedAt(), time.Second)
		assert.True(t, change.UpdatedAt().After(originalUpdatedAt))
		assert.Nil(t, change.RejectionReason())
	})

	t.Run("fails to approve already approved change", func(t *testing.T) {
		change, _ := NewPendingChange(workspaceID, requesterID, "item", nil, ActionCreate, payload)
		_ = change.Approve(reviewerID)

		err := change.Approve(uuid.New())

		assert.Error(t, err)
		assert.Equal(t, ErrChangeAlreadyReviewed, err)
	})

	t.Run("fails to approve already rejected change", func(t *testing.T) {
		change, _ := NewPendingChange(workspaceID, requesterID, "item", nil, ActionCreate, payload)
		_ = change.Reject(reviewerID, "Not needed")

		err := change.Approve(uuid.New())

		assert.Error(t, err)
		assert.Equal(t, ErrChangeAlreadyReviewed, err)
	})

	t.Run("fails with nil reviewer ID", func(t *testing.T) {
		change, _ := NewPendingChange(workspaceID, requesterID, "item", nil, ActionCreate, payload)

		err := change.Approve(uuid.Nil)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "reviewer_id")
		assert.Equal(t, StatusPending, change.Status())
	})
}

func TestPendingChange_Reject(t *testing.T) {
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	payload := json.RawMessage(`{"name": "Test Item"}`)

	t.Run("successfully rejects pending change", func(t *testing.T) {
		change, _ := NewPendingChange(workspaceID, requesterID, "item", nil, ActionCreate, payload)
		originalUpdatedAt := change.UpdatedAt()
		reason := "Item already exists"

		time.Sleep(time.Millisecond)

		err := change.Reject(reviewerID, reason)

		require.NoError(t, err)
		assert.Equal(t, StatusRejected, change.Status())
		assert.NotNil(t, change.ReviewedBy())
		assert.Equal(t, reviewerID, *change.ReviewedBy())
		assert.NotNil(t, change.ReviewedAt())
		assert.WithinDuration(t, time.Now(), *change.ReviewedAt(), time.Second)
		assert.NotNil(t, change.RejectionReason())
		assert.Equal(t, reason, *change.RejectionReason())
		assert.True(t, change.UpdatedAt().After(originalUpdatedAt))
	})

	t.Run("fails to reject already approved change", func(t *testing.T) {
		change, _ := NewPendingChange(workspaceID, requesterID, "item", nil, ActionCreate, payload)
		_ = change.Approve(reviewerID)

		err := change.Reject(uuid.New(), "Too late")

		assert.Error(t, err)
		assert.Equal(t, ErrChangeAlreadyReviewed, err)
	})

	t.Run("fails to reject already rejected change", func(t *testing.T) {
		change, _ := NewPendingChange(workspaceID, requesterID, "item", nil, ActionCreate, payload)
		_ = change.Reject(reviewerID, "First rejection")

		err := change.Reject(uuid.New(), "Second rejection")

		assert.Error(t, err)
		assert.Equal(t, ErrChangeAlreadyReviewed, err)
	})

	t.Run("fails with nil reviewer ID", func(t *testing.T) {
		change, _ := NewPendingChange(workspaceID, requesterID, "item", nil, ActionCreate, payload)

		err := change.Reject(uuid.Nil, "Reason")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "reviewer_id")
		assert.Equal(t, StatusPending, change.Status())
	})

	t.Run("fails with empty rejection reason", func(t *testing.T) {
		change, _ := NewPendingChange(workspaceID, requesterID, "item", nil, ActionCreate, payload)

		err := change.Reject(reviewerID, "")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "rejection_reason")
		assert.Equal(t, StatusPending, change.Status())
	})
}

func TestPendingChange_StatusHelpers(t *testing.T) {
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	payload := json.RawMessage(`{"name": "Test Item"}`)

	t.Run("IsPending returns true for new change", func(t *testing.T) {
		change, _ := NewPendingChange(workspaceID, requesterID, "item", nil, ActionCreate, payload)

		assert.True(t, change.IsPending())
		assert.False(t, change.IsApproved())
		assert.False(t, change.IsRejected())
	})

	t.Run("IsApproved returns true after approval", func(t *testing.T) {
		change, _ := NewPendingChange(workspaceID, requesterID, "item", nil, ActionCreate, payload)
		_ = change.Approve(reviewerID)

		assert.False(t, change.IsPending())
		assert.True(t, change.IsApproved())
		assert.False(t, change.IsRejected())
	})

	t.Run("IsRejected returns true after rejection", func(t *testing.T) {
		change, _ := NewPendingChange(workspaceID, requesterID, "item", nil, ActionCreate, payload)
		_ = change.Reject(reviewerID, "Not needed")

		assert.False(t, change.IsPending())
		assert.False(t, change.IsApproved())
		assert.True(t, change.IsRejected())
	})
}

func TestReconstruct(t *testing.T) {
	t.Run("reconstructs pending change from stored data", func(t *testing.T) {
		id := uuid.New()
		workspaceID := uuid.New()
		requesterID := uuid.New()
		entityID := uuid.New()
		reviewerID := uuid.New()
		reason := "Duplicate entry"
		payload := json.RawMessage(`{"name": "Test"}`)
		createdAt := time.Now().Add(-24 * time.Hour)
		updatedAt := time.Now().Add(-12 * time.Hour)
		reviewedAt := time.Now().Add(-12 * time.Hour)

		change := Reconstruct(
			id, workspaceID, requesterID, "item", &entityID,
			ActionUpdate, payload, StatusRejected, &reviewerID,
			&reviewedAt, &reason, createdAt, updatedAt,
		)

		assert.Equal(t, id, change.ID())
		assert.Equal(t, workspaceID, change.WorkspaceID())
		assert.Equal(t, requesterID, change.RequesterID())
		assert.Equal(t, "item", change.EntityType())
		assert.NotNil(t, change.EntityID())
		assert.Equal(t, entityID, *change.EntityID())
		assert.Equal(t, ActionUpdate, change.Action())
		assert.Equal(t, payload, change.Payload())
		assert.Equal(t, StatusRejected, change.Status())
		assert.NotNil(t, change.ReviewedBy())
		assert.Equal(t, reviewerID, *change.ReviewedBy())
		assert.NotNil(t, change.ReviewedAt())
		assert.Equal(t, reviewedAt, *change.ReviewedAt())
		assert.NotNil(t, change.RejectionReason())
		assert.Equal(t, reason, *change.RejectionReason())
		assert.Equal(t, createdAt, change.CreatedAt())
		assert.Equal(t, updatedAt, change.UpdatedAt())
	})

	t.Run("reconstructs pending change without optional fields", func(t *testing.T) {
		id := uuid.New()
		workspaceID := uuid.New()
		requesterID := uuid.New()
		payload := json.RawMessage(`{"name": "Test"}`)
		createdAt := time.Now()
		updatedAt := time.Now()

		change := Reconstruct(
			id, workspaceID, requesterID, "category", nil,
			ActionCreate, payload, StatusPending, nil, nil, nil,
			createdAt, updatedAt,
		)

		assert.Equal(t, id, change.ID())
		assert.Nil(t, change.EntityID())
		assert.Equal(t, StatusPending, change.Status())
		assert.Nil(t, change.ReviewedBy())
		assert.Nil(t, change.ReviewedAt())
		assert.Nil(t, change.RejectionReason())
	})
}

func TestParseAction(t *testing.T) {
	t.Run("parses create action", func(t *testing.T) {
		action, err := ParseAction("create")

		require.NoError(t, err)
		assert.Equal(t, ActionCreate, action)
	})

	t.Run("parses update action", func(t *testing.T) {
		action, err := ParseAction("update")

		require.NoError(t, err)
		assert.Equal(t, ActionUpdate, action)
	})

	t.Run("parses delete action", func(t *testing.T) {
		action, err := ParseAction("delete")

		require.NoError(t, err)
		assert.Equal(t, ActionDelete, action)
	})

	t.Run("fails for invalid action", func(t *testing.T) {
		action, err := ParseAction("invalid")

		assert.Error(t, err)
		assert.Empty(t, action)
		assert.Contains(t, err.Error(), "action")
	})

	t.Run("fails for empty string", func(t *testing.T) {
		action, err := ParseAction("")

		assert.Error(t, err)
		assert.Empty(t, action)
	})
}

func TestParseStatus(t *testing.T) {
	t.Run("parses pending status", func(t *testing.T) {
		status, err := ParseStatus("pending")

		require.NoError(t, err)
		assert.Equal(t, StatusPending, status)
	})

	t.Run("parses approved status", func(t *testing.T) {
		status, err := ParseStatus("approved")

		require.NoError(t, err)
		assert.Equal(t, StatusApproved, status)
	})

	t.Run("parses rejected status", func(t *testing.T) {
		status, err := ParseStatus("rejected")

		require.NoError(t, err)
		assert.Equal(t, StatusRejected, status)
	})

	t.Run("fails for invalid status", func(t *testing.T) {
		status, err := ParseStatus("invalid")

		assert.Error(t, err)
		assert.Empty(t, status)
		assert.Contains(t, err.Error(), "status")
	})

	t.Run("fails for empty string", func(t *testing.T) {
		status, err := ParseStatus("")

		assert.Error(t, err)
		assert.Empty(t, status)
	})
}

func TestIsValidAction(t *testing.T) {
	t.Run("returns true for valid actions", func(t *testing.T) {
		assert.True(t, isValidAction(ActionCreate))
		assert.True(t, isValidAction(ActionUpdate))
		assert.True(t, isValidAction(ActionDelete))
	})

	t.Run("returns false for invalid actions", func(t *testing.T) {
		assert.False(t, isValidAction(Action("invalid")))
		assert.False(t, isValidAction(Action("")))
		assert.False(t, isValidAction(Action("CREATE"))) // case sensitive
	})
}

func TestIsValidStatus(t *testing.T) {
	t.Run("returns true for valid statuses", func(t *testing.T) {
		assert.True(t, isValidStatus(StatusPending))
		assert.True(t, isValidStatus(StatusApproved))
		assert.True(t, isValidStatus(StatusRejected))
	})

	t.Run("returns false for invalid statuses", func(t *testing.T) {
		assert.False(t, isValidStatus(Status("invalid")))
		assert.False(t, isValidStatus(Status("")))
		assert.False(t, isValidStatus(Status("PENDING"))) // case sensitive
	})
}
