package label

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
)

// RegisterRoutes registers label routes.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	// List labels
	huma.Get(api, "/labels", func(ctx context.Context, input *struct{}) (*ListLabelsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
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
	})

	// Get label by ID
	huma.Get(api, "/labels/{id}", func(ctx context.Context, input *GetLabelInput) (*GetLabelOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		label, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil || label == nil {
			return nil, huma.Error404NotFound("label not found")
		}

		return &GetLabelOutput{
			Body: toLabelResponse(label),
		}, nil
	})

	// Create label
	huma.Post(api, "/labels", func(ctx context.Context, input *CreateLabelInput) (*CreateLabelOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		label, err := svc.Create(ctx, CreateInput{
			WorkspaceID: workspaceID,
			Name:        input.Body.Name,
			Color:       input.Body.Color,
			Description: input.Body.Description,
		})
		if err != nil {
			if err == ErrNameTaken {
				return nil, huma.Error400BadRequest("label name already exists")
			}
			return nil, huma.Error400BadRequest(err.Error())
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
					"id":   label.ID(),
					"name": label.Name(),
					"user_name": userName,
				},
			})
		}

		return &CreateLabelOutput{
			Body: toLabelResponse(label),
		}, nil
	})

	// Update label
	huma.Patch(api, "/labels/{id}", func(ctx context.Context, input *UpdateLabelInput) (*UpdateLabelOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
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
			if err == ErrNameTaken {
				return nil, huma.Error400BadRequest("label name already exists")
			}
			return nil, huma.Error400BadRequest(err.Error())
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
					"id":   label.ID(),
					"name": label.Name(),
					"user_name": userName,
				},
			})
		}

		return &UpdateLabelOutput{
			Body: toLabelResponse(label),
		}, nil
	})

	// Archive label
	huma.Post(api, "/labels/{id}/archive", func(ctx context.Context, input *GetLabelInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.Archive(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish event (treat archive as delete event)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "label.deleted",
				EntityID:   input.ID.String(),
				EntityType: "label",
				UserID:     authUser.ID,
			Data: map[string]any{
				"user_name": userName,
			},
			})
		}

		return nil, nil
	})

	// Restore label
	huma.Post(api, "/labels/{id}/restore", func(ctx context.Context, input *GetLabelInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.Restore(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish event (treat restore as create event)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "label.created",
				EntityID:   input.ID.String(),
				EntityType: "label",
				UserID:     authUser.ID,
				Data: map[string]any{
					"user_name": userName,
				},
			})
		}

		return nil, nil
	})

	// Delete label
	huma.Delete(api, "/labels/{id}", func(ctx context.Context, input *GetLabelInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.Delete(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "label.deleted",
				EntityID:   input.ID.String(),
				EntityType: "label",
				UserID:     authUser.ID,
			Data: map[string]any{
				"user_name": userName,
			},
			})
		}

		return nil, nil
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
