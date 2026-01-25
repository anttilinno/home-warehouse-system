package repairlog

import (
	"context"
	"errors"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// RegisterRoutes registers repair log routes.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	// List all repair logs in workspace
	huma.Get(api, "/repairs", func(ctx context.Context, input *ListRepairLogsInput) (*ListRepairLogsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}

		var repairs []*RepairLog
		var total int
		var err error

		// If status filter is provided, use ListByStatus
		if input.Status != nil {
			repairs, err = svc.ListByStatus(ctx, workspaceID, RepairStatus(*input.Status), pagination)
			if err != nil {
				return nil, huma.Error500InternalServerError("failed to list repair logs")
			}
			total = len(repairs) // Status filter doesn't return total count
		} else {
			repairs, total, err = svc.ListByWorkspace(ctx, workspaceID, pagination)
			if err != nil {
				return nil, huma.Error500InternalServerError("failed to list repair logs")
			}
		}

		items := make([]RepairLogResponse, len(repairs))
		for i, r := range repairs {
			items[i] = toRepairLogResponse(r)
		}

		return &ListRepairLogsOutput{
			Body: RepairLogListResponse{
				Items: items,
				Total: total,
			},
		}, nil
	})

	// Get repair log by ID
	huma.Get(api, "/repairs/{id}", func(ctx context.Context, input *GetRepairLogInput) (*GetRepairLogOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		repairLog, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil {
			if errors.Is(err, ErrRepairLogNotFound) || errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound("repair log not found")
			}
			return nil, huma.Error500InternalServerError("failed to get repair log")
		}

		return &GetRepairLogOutput{
			Body: toRepairLogResponse(repairLog),
		}, nil
	})

	// Create repair log
	huma.Post(api, "/repairs", func(ctx context.Context, input *CreateRepairLogInput) (*CreateRepairLogOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		repairLog, err := svc.Create(ctx, CreateInput{
			WorkspaceID:     workspaceID,
			InventoryID:     input.Body.InventoryID,
			Description:     input.Body.Description,
			RepairDate:      input.Body.RepairDate,
			Cost:            input.Body.Cost,
			CurrencyCode:    input.Body.CurrencyCode,
			ServiceProvider: input.Body.ServiceProvider,
			Notes:           input.Body.Notes,
		})
		if err != nil {
			if errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound("inventory not found")
			}
			if errors.Is(err, ErrInvalidDescription) {
				return nil, huma.Error400BadRequest("description is required")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish SSE event
		authUser, _ := appMiddleware.GetAuthUser(ctx)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "repairlog.created",
				EntityID:   repairLog.ID().String(),
				EntityType: "repairlog",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":           repairLog.ID(),
					"inventory_id": repairLog.InventoryID(),
					"status":       repairLog.Status(),
					"user_name":    userName,
				},
			})
		}

		return &CreateRepairLogOutput{
			Body: toRepairLogResponse(repairLog),
		}, nil
	})

	// Update repair log
	huma.Patch(api, "/repairs/{id}", func(ctx context.Context, input *UpdateRepairLogInput) (*UpdateRepairLogOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		repairLog, err := svc.Update(ctx, input.ID, workspaceID, UpdateInput{
			Description:     input.Body.Description,
			RepairDate:      input.Body.RepairDate,
			Cost:            input.Body.Cost,
			CurrencyCode:    input.Body.CurrencyCode,
			ServiceProvider: input.Body.ServiceProvider,
			Notes:           input.Body.Notes,
		})
		if err != nil {
			if errors.Is(err, ErrRepairLogNotFound) || errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound("repair log not found")
			}
			if errors.Is(err, ErrRepairAlreadyCompleted) {
				return nil, huma.Error400BadRequest("cannot update completed repair")
			}
			if errors.Is(err, ErrInvalidDescription) {
				return nil, huma.Error400BadRequest("description is required")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish SSE event
		authUser, _ := appMiddleware.GetAuthUser(ctx)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "repairlog.updated",
				EntityID:   repairLog.ID().String(),
				EntityType: "repairlog",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        repairLog.ID(),
					"status":    repairLog.Status(),
					"user_name": userName,
				},
			})
		}

		return &UpdateRepairLogOutput{
			Body: toRepairLogResponse(repairLog),
		}, nil
	})

	// Start repair (transition from PENDING to IN_PROGRESS)
	huma.Post(api, "/repairs/{id}/start", func(ctx context.Context, input *StartRepairInput) (*StartRepairOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		repairLog, err := svc.StartRepair(ctx, input.ID, workspaceID)
		if err != nil {
			if errors.Is(err, ErrRepairLogNotFound) || errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound("repair log not found")
			}
			if errors.Is(err, ErrInvalidStatusTransition) {
				return nil, huma.Error400BadRequest("can only start repair from pending status")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish SSE event
		authUser, _ := appMiddleware.GetAuthUser(ctx)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "repairlog.started",
				EntityID:   repairLog.ID().String(),
				EntityType: "repairlog",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        repairLog.ID(),
					"status":    repairLog.Status(),
					"user_name": userName,
				},
			})
		}

		return &StartRepairOutput{
			Body: toRepairLogResponse(repairLog),
		}, nil
	})

	// Complete repair (transition from IN_PROGRESS to COMPLETED)
	huma.Post(api, "/repairs/{id}/complete", func(ctx context.Context, input *CompleteRepairInput) (*CompleteRepairOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		repairLog, err := svc.Complete(ctx, input.ID, workspaceID, input.Body.NewCondition)
		if err != nil {
			if errors.Is(err, ErrRepairLogNotFound) || errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound("repair log not found")
			}
			if errors.Is(err, ErrInvalidStatusTransition) {
				return nil, huma.Error400BadRequest("can only complete repair from in_progress status")
			}
			if errors.Is(err, ErrRepairAlreadyCompleted) {
				return nil, huma.Error400BadRequest("repair has already been completed")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish SSE event
		authUser, _ := appMiddleware.GetAuthUser(ctx)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			eventData := map[string]any{
				"id":        repairLog.ID(),
				"status":    repairLog.Status(),
				"user_name": userName,
			}
			if repairLog.NewCondition() != nil {
				eventData["new_condition"] = *repairLog.NewCondition()
			}
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "repairlog.completed",
				EntityID:   repairLog.ID().String(),
				EntityType: "repairlog",
				UserID:     authUser.ID,
				Data:       eventData,
			})
		}

		return &CompleteRepairOutput{
			Body: toRepairLogResponse(repairLog),
		}, nil
	})

	// Delete repair log
	huma.Delete(api, "/repairs/{id}", func(ctx context.Context, input *DeleteRepairLogInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		// Get the repair log ID before deletion for SSE event
		repairLogID := input.ID

		if err := svc.Delete(ctx, input.ID, workspaceID); err != nil {
			if errors.Is(err, ErrRepairLogNotFound) || errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound("repair log not found")
			}
			return nil, huma.Error500InternalServerError("failed to delete repair log")
		}

		// Publish SSE event
		authUser, _ := appMiddleware.GetAuthUser(ctx)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "repairlog.deleted",
				EntityID:   repairLogID.String(),
				EntityType: "repairlog",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        repairLogID,
					"user_name": userName,
				},
			})
		}

		return nil, nil
	})

	// List repairs for inventory
	huma.Get(api, "/inventory/{inventory_id}/repairs", func(ctx context.Context, input *ListInventoryRepairsInput) (*ListRepairLogsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		repairs, err := svc.ListByInventory(ctx, workspaceID, input.InventoryID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list repairs")
		}

		items := make([]RepairLogResponse, len(repairs))
		for i, r := range repairs {
			items[i] = toRepairLogResponse(r)
		}

		return &ListRepairLogsOutput{
			Body: RepairLogListResponse{
				Items: items,
				Total: len(repairs),
			},
		}, nil
	})
}

func toRepairLogResponse(r *RepairLog) RepairLogResponse {
	var repairDate, completedAt *string
	if r.RepairDate() != nil {
		s := r.RepairDate().Format(time.RFC3339)
		repairDate = &s
	}
	if r.CompletedAt() != nil {
		s := r.CompletedAt().Format(time.RFC3339)
		completedAt = &s
	}

	return RepairLogResponse{
		ID:              r.ID(),
		WorkspaceID:     r.WorkspaceID(),
		InventoryID:     r.InventoryID(),
		Status:          string(r.Status()),
		Description:     r.Description(),
		RepairDate:      repairDate,
		Cost:            r.Cost(),
		CurrencyCode:    r.CurrencyCode(),
		ServiceProvider: r.ServiceProvider(),
		CompletedAt:     completedAt,
		NewCondition:    r.NewCondition(),
		Notes:           r.Notes(),
		CreatedAt:       r.CreatedAt(),
		UpdatedAt:       r.UpdatedAt(),
	}
}

// Request/Response types

type ListRepairLogsInput struct {
	Page   int     `query:"page" default:"1" minimum:"1"`
	Limit  int     `query:"limit" default:"50" minimum:"1" maximum:"100"`
	Status *string `query:"status" doc:"Filter by status (PENDING, IN_PROGRESS, COMPLETED)"`
}

type ListRepairLogsOutput struct {
	Body RepairLogListResponse
}

type RepairLogListResponse struct {
	Items []RepairLogResponse `json:"items"`
	Total int                 `json:"total"`
}

type GetRepairLogInput struct {
	ID uuid.UUID `path:"id"`
}

type GetRepairLogOutput struct {
	Body RepairLogResponse
}

type CreateRepairLogInput struct {
	Body struct {
		InventoryID     uuid.UUID  `json:"inventory_id" doc:"ID of the inventory item being repaired"`
		Description     string     `json:"description" minLength:"1" doc:"Description of the repair"`
		RepairDate      *time.Time `json:"repair_date,omitempty" doc:"Scheduled or actual repair date"`
		Cost            *int       `json:"cost,omitempty" doc:"Repair cost in cents"`
		CurrencyCode    *string    `json:"currency_code,omitempty" doc:"Currency code (e.g., USD, EUR)"`
		ServiceProvider *string    `json:"service_provider,omitempty" doc:"Name of the service provider"`
		Notes           *string    `json:"notes,omitempty" doc:"Additional notes"`
	}
}

type CreateRepairLogOutput struct {
	Body RepairLogResponse
}

type UpdateRepairLogInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Description     *string    `json:"description,omitempty" doc:"Description of the repair"`
		RepairDate      *time.Time `json:"repair_date,omitempty" doc:"Scheduled or actual repair date"`
		Cost            *int       `json:"cost,omitempty" doc:"Repair cost in cents"`
		CurrencyCode    *string    `json:"currency_code,omitempty" doc:"Currency code (e.g., USD, EUR)"`
		ServiceProvider *string    `json:"service_provider,omitempty" doc:"Name of the service provider"`
		Notes           *string    `json:"notes,omitempty" doc:"Additional notes"`
	}
}

type UpdateRepairLogOutput struct {
	Body RepairLogResponse
}

type StartRepairInput struct {
	ID uuid.UUID `path:"id"`
}

type StartRepairOutput struct {
	Body RepairLogResponse
}

type CompleteRepairInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		NewCondition *string `json:"new_condition,omitempty" doc:"New condition to set on inventory (NEW, EXCELLENT, GOOD, FAIR, POOR, DAMAGED, FOR_REPAIR)"`
	}
}

type CompleteRepairOutput struct {
	Body RepairLogResponse
}

type DeleteRepairLogInput struct {
	ID uuid.UUID `path:"id"`
}

type ListInventoryRepairsInput struct {
	InventoryID uuid.UUID `path:"inventory_id"`
}

type RepairLogResponse struct {
	ID              uuid.UUID `json:"id"`
	WorkspaceID     uuid.UUID `json:"workspace_id"`
	InventoryID     uuid.UUID `json:"inventory_id"`
	Status          string    `json:"status"`
	Description     string    `json:"description"`
	RepairDate      *string   `json:"repair_date,omitempty"`
	Cost            *int      `json:"cost,omitempty"`
	CurrencyCode    *string   `json:"currency_code,omitempty"`
	ServiceProvider *string   `json:"service_provider,omitempty"`
	CompletedAt     *string   `json:"completed_at,omitempty"`
	NewCondition    *string   `json:"new_condition,omitempty"`
	Notes           *string   `json:"notes,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}
