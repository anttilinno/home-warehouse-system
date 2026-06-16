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

const (
	msgWorkspaceContextRequired = "workspace context required"
	routeRepairByID             = "/repairs/{id}"
	msgRepairLogNotFound        = "repair log not found"
)

// RegisterRoutes registers repair log routes.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	huma.Get(api, "/repairs", listRepairLogs(svc))
	huma.Get(api, routeRepairByID, getRepairLog(svc))
	huma.Post(api, "/repairs", createRepairLog(svc, broadcaster))
	huma.Patch(api, routeRepairByID, updateRepairLog(svc, broadcaster))
	huma.Post(api, "/repairs/{id}/start", startRepair(svc, broadcaster))
	huma.Post(api, "/repairs/{id}/complete", completeRepair(svc, broadcaster))
	huma.Delete(api, routeRepairByID, deleteRepairLog(svc, broadcaster))
	huma.Get(api, "/inventory/{inventory_id}/repairs", listInventoryRepairs(svc))
	huma.Get(api, "/inventory/{inventory_id}/repair-cost", getRepairCost(svc))
}

// isRepairNotFound reports whether err is one of the not-found sentinels the
// repair handlers map to a 404.
func isRepairNotFound(err error) bool {
	return errors.Is(err, ErrRepairLogNotFound) || errors.Is(err, shared.ErrNotFound)
}

// publishRepairEvent emits a repair-log SSE event with the standard
// {id, status, user_name} payload, no-op when broadcaster or auth user is
// absent. Callers that need extra payload fields (e.g. create, complete,
// delete) publish inline instead.
func publishRepairEvent(ctx context.Context, broadcaster *events.Broadcaster, workspaceID uuid.UUID, eventType string, r *RepairLog) {
	authUser, _ := appMiddleware.GetAuthUser(ctx)
	if broadcaster == nil || authUser == nil {
		return
	}
	userName := appMiddleware.GetUserDisplayName(ctx)
	broadcaster.Publish(workspaceID, events.Event{
		Type:       eventType,
		EntityID:   r.ID().String(),
		EntityType: "repairlog",
		UserID:     authUser.ID,
		Data: map[string]any{
			"id":        r.ID(),
			"status":    r.Status(),
			"user_name": userName,
		},
	})
}

// listRepairLogs returns the handler for GET /repairs.
func listRepairLogs(svc ServiceInterface) func(context.Context, *ListRepairLogsInput) (*ListRepairLogsOutput, error) {
	return func(ctx context.Context, input *ListRepairLogsInput) (*ListRepairLogsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}

		var repairs []*RepairLog
		var total int
		var err error

		// If status filter is provided, use ListByStatus
		if input.Status != "" {
			repairs, err = svc.ListByStatus(ctx, workspaceID, RepairStatus(input.Status), pagination)
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
	}
}

// getRepairLog returns the handler for GET /repairs/{id}.
func getRepairLog(svc ServiceInterface) func(context.Context, *GetRepairLogInput) (*GetRepairLogOutput, error) {
	return func(ctx context.Context, input *GetRepairLogInput) (*GetRepairLogOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		repairLog, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil {
			if isRepairNotFound(err) {
				return nil, huma.Error404NotFound(msgRepairLogNotFound)
			}
			return nil, huma.Error500InternalServerError("failed to get repair log")
		}

		return &GetRepairLogOutput{
			Body: toRepairLogResponse(repairLog),
		}, nil
	}
}

// createRepairLog returns the handler for POST /repairs.
func createRepairLog(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *CreateRepairLogInput) (*CreateRepairLogOutput, error) {
	return func(ctx context.Context, input *CreateRepairLogInput) (*CreateRepairLogOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
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
			IsWarrantyClaim: input.Body.IsWarrantyClaim,
			ReminderDate:    input.Body.ReminderDate,
		})
		if err != nil {
			if errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound("inventory not found")
			}
			if errors.Is(err, ErrInvalidDescription) {
				return nil, huma.Error400BadRequest("description is required")
			}
			return nil, appMiddleware.MapDomainError(err)
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
	}
}

// updateRepairLog returns the handler for PATCH /repairs/{id}.
func updateRepairLog(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *UpdateRepairLogInput) (*UpdateRepairLogOutput, error) {
	return func(ctx context.Context, input *UpdateRepairLogInput) (*UpdateRepairLogOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
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
			if isRepairNotFound(err) {
				return nil, huma.Error404NotFound(msgRepairLogNotFound)
			}
			if errors.Is(err, ErrRepairAlreadyCompleted) {
				return nil, huma.Error400BadRequest("cannot update completed repair")
			}
			if errors.Is(err, ErrInvalidDescription) {
				return nil, huma.Error400BadRequest("description is required")
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		publishRepairEvent(ctx, broadcaster, workspaceID, "repairlog.updated", repairLog)

		return &UpdateRepairLogOutput{
			Body: toRepairLogResponse(repairLog),
		}, nil
	}
}

// startRepair returns the handler for POST /repairs/{id}/start (transition from
// PENDING to IN_PROGRESS).
func startRepair(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *StartRepairInput) (*StartRepairOutput, error) {
	return func(ctx context.Context, input *StartRepairInput) (*StartRepairOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		repairLog, err := svc.StartRepair(ctx, input.ID, workspaceID)
		if err != nil {
			if isRepairNotFound(err) {
				return nil, huma.Error404NotFound(msgRepairLogNotFound)
			}
			if errors.Is(err, ErrInvalidStatusTransition) {
				return nil, huma.Error400BadRequest("can only start repair from pending status")
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		publishRepairEvent(ctx, broadcaster, workspaceID, "repairlog.started", repairLog)

		return &StartRepairOutput{
			Body: toRepairLogResponse(repairLog),
		}, nil
	}
}

// completeRepair returns the handler for POST /repairs/{id}/complete
// (transition from IN_PROGRESS to COMPLETED).
func completeRepair(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *CompleteRepairInput) (*CompleteRepairOutput, error) {
	return func(ctx context.Context, input *CompleteRepairInput) (*CompleteRepairOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		repairLog, err := svc.Complete(ctx, input.ID, workspaceID, input.Body.NewCondition)
		if err != nil {
			if isRepairNotFound(err) {
				return nil, huma.Error404NotFound(msgRepairLogNotFound)
			}
			if errors.Is(err, ErrInvalidStatusTransition) {
				return nil, huma.Error400BadRequest("can only complete repair from in_progress status")
			}
			if errors.Is(err, ErrRepairAlreadyCompleted) {
				return nil, huma.Error400BadRequest("repair has already been completed")
			}
			return nil, appMiddleware.MapDomainError(err)
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
	}
}

// deleteRepairLog returns the handler for DELETE /repairs/{id}.
func deleteRepairLog(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *DeleteRepairLogInput) (*struct{}, error) {
	return func(ctx context.Context, input *DeleteRepairLogInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		// Get the repair log ID before deletion for SSE event
		repairLogID := input.ID

		if err := svc.Delete(ctx, input.ID, workspaceID); err != nil {
			if isRepairNotFound(err) {
				return nil, huma.Error404NotFound(msgRepairLogNotFound)
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
	}
}

// listInventoryRepairs returns the handler for GET /inventory/{inventory_id}/repairs.
func listInventoryRepairs(svc ServiceInterface) func(context.Context, *ListInventoryRepairsInput) (*ListRepairLogsOutput, error) {
	return func(ctx context.Context, input *ListInventoryRepairsInput) (*ListRepairLogsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
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
	}
}

// getRepairCost returns the handler for GET /inventory/{inventory_id}/repair-cost.
func getRepairCost(svc ServiceInterface) func(context.Context, *GetRepairCostInput) (*GetRepairCostOutput, error) {
	return func(ctx context.Context, input *GetRepairCostInput) (*GetRepairCostOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		summaries, err := svc.GetTotalRepairCost(ctx, workspaceID, input.InventoryID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get repair cost")
		}

		items := make([]RepairCostSummaryResponse, len(summaries))
		for i, s := range summaries {
			items[i] = RepairCostSummaryResponse(s)
		}

		return &GetRepairCostOutput{
			Body: RepairCostResponse{Items: items},
		}, nil
	}
}

func toRepairLogResponse(r *RepairLog) RepairLogResponse {
	var repairDate, completedAt, reminderDate *string
	if r.RepairDate() != nil {
		s := r.RepairDate().Format(time.RFC3339)
		repairDate = &s
	}
	if r.CompletedAt() != nil {
		s := r.CompletedAt().Format(time.RFC3339)
		completedAt = &s
	}
	if r.ReminderDate() != nil {
		s := r.ReminderDate().Format(time.RFC3339)
		reminderDate = &s
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
		IsWarrantyClaim: r.IsWarrantyClaim(),
		ReminderDate:    reminderDate,
		ReminderSent:    r.ReminderSent(),
		CreatedAt:       r.CreatedAt(),
		UpdatedAt:       r.UpdatedAt(),
	}
}

// Request/Response types

type ListRepairLogsInput struct {
	Page   int    `query:"page" default:"1" minimum:"1"`
	Limit  int    `query:"limit" default:"50" minimum:"1" maximum:"100"`
	Status string `query:"status" doc:"Filter by status (PENDING, IN_PROGRESS, COMPLETED)"`
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
		IsWarrantyClaim bool       `json:"is_warranty_claim,omitempty" doc:"Whether this repair is covered under warranty"`
		ReminderDate    *time.Time `json:"reminder_date,omitempty" doc:"Date to send reminder for maintenance follow-up"`
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
	IsWarrantyClaim bool      `json:"is_warranty_claim" doc:"Whether this repair is covered under warranty"`
	ReminderDate    *string   `json:"reminder_date,omitempty" doc:"Date to send reminder for maintenance follow-up"`
	ReminderSent    bool      `json:"reminder_sent" doc:"Whether the reminder has been sent"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// Types for repair cost endpoint
type GetRepairCostInput struct {
	InventoryID uuid.UUID `path:"inventory_id"`
}

type GetRepairCostOutput struct {
	Body RepairCostResponse
}

type RepairCostResponse struct {
	Items []RepairCostSummaryResponse `json:"items"`
}

type RepairCostSummaryResponse struct {
	CurrencyCode   *string `json:"currency_code"`
	TotalCostCents int     `json:"total_cost_cents" doc:"Total repair cost in cents"`
	RepairCount    int     `json:"repair_count" doc:"Number of completed repairs"`
}
