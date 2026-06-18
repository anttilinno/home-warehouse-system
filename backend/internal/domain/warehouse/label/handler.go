package label

import (
	"context"
	"errors"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
)

const (
	msgWorkspaceContextRequired = "workspace context required"
	routeLabelByID              = "/labels/{id}"
)

// RegisterRoutes registers label routes. Each handler is a package factory func
// (see below) so this stays a flat list of registrations rather than a single
// god-function of inline closures.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	huma.Get(api, "/labels", listLabels(svc))
	huma.Get(api, routeLabelByID, getLabel(svc))
	huma.Post(api, "/labels", createLabel(svc, broadcaster))
	huma.Patch(api, routeLabelByID, updateLabel(svc, broadcaster))
	huma.Post(api, "/labels/{id}/archive", archiveLabel(svc, broadcaster))
	huma.Post(api, "/labels/{id}/restore", restoreLabel(svc, broadcaster))
	huma.Delete(api, routeLabelByID, deleteLabel(svc, broadcaster))
}

// listLabels lists labels in the workspace.
func listLabels(svc ServiceInterface) func(context.Context, *struct{}) (*ListLabelsOutput, error) {
	return func(ctx context.Context, input *struct{}) (*ListLabelsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		labels, err := svc.ListByWorkspace(ctx, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list labels")
		}

		items := make([]LabelResponse, len(labels))
		for i, label := range labels {
			items[i] = toLabelResponse(label)
		}

		return &ListLabelsOutput{
			Body: LabelListResponse{Items: items},
		}, nil
	}
}

// getLabel returns a single label by ID.
func getLabel(svc ServiceInterface) func(context.Context, *GetLabelInput) (*GetLabelOutput, error) {
	return func(ctx context.Context, input *GetLabelInput) (*GetLabelOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		label, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil || label == nil {
			return nil, huma.Error404NotFound("label not found")
		}

		return &GetLabelOutput{
			Body: toLabelResponse(label),
		}, nil
	}
}

// createLabel creates a label.
func createLabel(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *CreateLabelInput) (*CreateLabelOutput, error) {
	return func(ctx context.Context, input *CreateLabelInput) (*CreateLabelOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		label, err := svc.Create(ctx, CreateInput{
			WorkspaceID: workspaceID,
			Name:        input.Body.Name,
			Color:       input.Body.Color,
			Description: input.Body.Description,
		})
		if err != nil {
			if errors.Is(err, ErrNameTaken) {
				return nil, huma.Error400BadRequest("label name already exists")
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "label.created",
				EntityID:   label.ID().String(),
				EntityType: "label",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        label.ID(),
					"name":      label.Name(),
					"user_name": userName,
				},
			})
		}

		return &CreateLabelOutput{
			Body: toLabelResponse(label),
		}, nil
	}
}

// updateLabel updates a label.
func updateLabel(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *UpdateLabelInput) (*UpdateLabelOutput, error) {
	return func(ctx context.Context, input *UpdateLabelInput) (*UpdateLabelOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		// Get current label to use its name if not provided in update
		currentLabel, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error404NotFound("label not found")
		}

		name := currentLabel.Name()
		if input.Body.Name != nil {
			name = *input.Body.Name
		}

		label, err := svc.Update(ctx, input.ID, workspaceID, UpdateInput{
			Name:        name,
			Color:       input.Body.Color,
			Description: input.Body.Description,
		})
		if err != nil {
			if errors.Is(err, ErrNameTaken) {
				return nil, huma.Error400BadRequest("label name already exists")
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "label.updated",
				EntityID:   label.ID().String(),
				EntityType: "label",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        label.ID(),
					"name":      label.Name(),
					"user_name": userName,
				},
			})
		}

		return &UpdateLabelOutput{
			Body: toLabelResponse(label),
		}, nil
	}
}

// archiveLabel archives a label (treated as a delete event).
func archiveLabel(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetLabelInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetLabelInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.Archive(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event (treat archive as delete event)
		publishLifecycleEvent(ctx, broadcaster, workspaceID, authUser, "label.deleted", input.ID)

		return nil, nil
	}
}

// restoreLabel restores an archived label (treated as a create event).
func restoreLabel(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetLabelInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetLabelInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.Restore(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event (treat restore as create event)
		publishLifecycleEvent(ctx, broadcaster, workspaceID, authUser, "label.created", input.ID)

		return nil, nil
	}
}

// deleteLabel deletes a label.
func deleteLabel(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetLabelInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetLabelInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.Delete(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		publishLifecycleEvent(ctx, broadcaster, workspaceID, authUser, "label.deleted", input.ID)

		return nil, nil
	}
}

// publishLifecycleEvent publishes an archive/restore/delete lifecycle event for a
// label, carrying only the label ID and acting user's display name.
func publishLifecycleEvent(ctx context.Context, broadcaster *events.Broadcaster, workspaceID uuid.UUID, authUser *appMiddleware.AuthUser, eventType string, labelID uuid.UUID) {
	if broadcaster == nil || authUser == nil {
		return
	}
	userName := appMiddleware.GetUserDisplayName(ctx)
	broadcaster.Publish(workspaceID, events.Event{
		Type:       eventType,
		EntityID:   labelID.String(),
		EntityType: "label",
		UserID:     authUser.ID,
		Data: map[string]any{
			"user_name": userName,
		},
	})
}

func toLabelResponse(l *Label) LabelResponse {
	return LabelResponse{
		ID:          l.ID(),
		WorkspaceID: l.WorkspaceID(),
		Name:        l.Name(),
		Color:       l.Color(),
		Description: l.Description(),
		IsArchived:  l.IsArchived(),
		CreatedAt:   l.CreatedAt(),
		UpdatedAt:   l.UpdatedAt(),
	}
}

// Request/Response types

type GetLabelInput struct {
	ID uuid.UUID `path:"id"`
}

type ListLabelsOutput struct {
	Body LabelListResponse
}

type LabelListResponse struct {
	Items []LabelResponse `json:"items"`
}

type GetLabelOutput struct {
	Body LabelResponse
}

type CreateLabelInput struct {
	Body struct {
		Name        string  `json:"name" minLength:"1" maxLength:"255" doc:"Label name"`
		Color       *string `json:"color,omitempty" pattern:"^#[0-9A-Fa-f]{6}$" doc:"Hex color code (e.g., #FF5733)"`
		Description *string `json:"description,omitempty" doc:"Label description"`
	}
}

type CreateLabelOutput struct {
	Body LabelResponse
}

type UpdateLabelInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Name        *string `json:"name,omitempty" minLength:"1" maxLength:"255" doc:"Label name"`
		Color       *string `json:"color,omitempty" pattern:"^#[0-9A-Fa-f]{6}$" doc:"Hex color code (e.g., #FF5733)"`
		Description *string `json:"description,omitempty" doc:"Label description"`
	}
}

type UpdateLabelOutput struct {
	Body LabelResponse
}

type LabelResponse struct {
	ID          uuid.UUID `json:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	Name        string    `json:"name"`
	Color       *string   `json:"color,omitempty"`
	Description *string   `json:"description,omitempty"`
	IsArchived  bool      `json:"is_archived"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
