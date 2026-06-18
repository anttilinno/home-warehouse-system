package maintenance

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
	routeMaintenanceByID        = "/maintenance/{id}"
	msgScheduleNotFound         = "maintenance schedule not found"
)

// RegisterRoutes registers maintenance schedule routes on the workspace tree.
// Each handler is a package factory func (see below) so this stays a flat list
// of registrations rather than a single god-function of inline closures.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	huma.Get(api, "/maintenance", listSchedules(svc))
	huma.Get(api, "/maintenance/due", listDueSchedules(svc))
	huma.Get(api, routeMaintenanceByID, getSchedule(svc))
	huma.Post(api, "/maintenance", createSchedule(svc, broadcaster))
	huma.Patch(api, routeMaintenanceByID, updateSchedule(svc, broadcaster))
	huma.Post(api, "/maintenance/{id}/complete", completeSchedule(svc, broadcaster))
	huma.Delete(api, routeMaintenanceByID, deleteSchedule(svc, broadcaster))
	huma.Get(api, "/inventory/{inventory_id}/maintenance", listInventorySchedules(svc))
}

// listSchedules lists schedules in the workspace (optionally only those due soon).
func listSchedules(svc ServiceInterface) func(context.Context, *ListSchedulesInput) (*ListSchedulesOutput, error) {
	return func(ctx context.Context, input *ListSchedulesInput) (*ListSchedulesOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		schedules, total, err := svc.List(ctx, workspaceID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list maintenance schedules")
		}

		items := make([]ScheduleResponse, len(schedules))
		for i, s := range schedules {
			items[i] = toScheduleResponse(s)
		}

		return &ListSchedulesOutput{
			Body: ScheduleListResponse{Items: items, Total: total},
		}, nil
	}
}

// listDueSchedules returns due/overdue schedules for the dashboard widget.
func listDueSchedules(svc ServiceInterface) func(context.Context, *ListDueInput) (*ListDueOutput, error) {
	return func(ctx context.Context, input *ListDueInput) (*ListDueOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		due, err := svc.ListDue(ctx, workspaceID, input.Days)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list due maintenance")
		}

		now := time.Now()
		items := make([]DueScheduleResponse, len(due))
		for i, d := range due {
			items[i] = DueScheduleResponse{
				ScheduleResponse: toScheduleResponse(d.Schedule),
				ItemID:           d.ItemID,
				ItemName:         d.ItemName,
				IsOverdue:        d.Schedule.IsOverdue(now),
			}
		}

		return &ListDueOutput{
			Body: DueScheduleListResponse{Items: items, Total: len(items)},
		}, nil
	}
}

// getSchedule returns a single schedule by ID.
func getSchedule(svc ServiceInterface) func(context.Context, *GetScheduleInput) (*GetScheduleOutput, error) {
	return func(ctx context.Context, input *GetScheduleInput) (*GetScheduleOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		schedule, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil {
			if errors.Is(err, ErrScheduleNotFound) || errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound(msgScheduleNotFound)
			}
			return nil, huma.Error500InternalServerError("failed to get maintenance schedule")
		}

		return &GetScheduleOutput{Body: toScheduleResponse(schedule)}, nil
	}
}

// createSchedule creates a maintenance schedule.
func createSchedule(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *CreateScheduleInput) (*CreateScheduleOutput, error) {
	return func(ctx context.Context, input *CreateScheduleInput) (*CreateScheduleOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		schedule, err := svc.Create(ctx, CreateInput{
			WorkspaceID:  workspaceID,
			InventoryID:  input.Body.InventoryID,
			Title:        input.Body.Title,
			Notes:        input.Body.Notes,
			IntervalDays: input.Body.IntervalDays,
			NextDue:      input.Body.NextDue,
		})
		if err != nil {
			if errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound("inventory not found")
			}
			if errors.Is(err, ErrInvalidTitle) || errors.Is(err, ErrInvalidInterval) || errors.Is(err, ErrInvalidNextDue) {
				return nil, huma.Error400BadRequest(err.Error())
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		publishEvent(ctx, broadcaster, workspaceID, "maintenance.created", schedule)

		return &CreateScheduleOutput{Body: toScheduleResponse(schedule)}, nil
	}
}

// updateSchedule updates a maintenance schedule.
func updateSchedule(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *UpdateScheduleInput) (*UpdateScheduleOutput, error) {
	return func(ctx context.Context, input *UpdateScheduleInput) (*UpdateScheduleOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		schedule, err := svc.Update(ctx, input.ID, workspaceID, UpdateInput{
			Title:        input.Body.Title,
			Notes:        input.Body.Notes,
			IntervalDays: input.Body.IntervalDays,
			NextDue:      input.Body.NextDue,
			IsActive:     input.Body.IsActive,
		})
		if err != nil {
			if errors.Is(err, ErrScheduleNotFound) || errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound(msgScheduleNotFound)
			}
			if errors.Is(err, ErrInvalidTitle) || errors.Is(err, ErrInvalidInterval) || errors.Is(err, ErrInvalidNextDue) {
				return nil, huma.Error400BadRequest(err.Error())
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		publishEvent(ctx, broadcaster, workspaceID, "maintenance.updated", schedule)

		return &UpdateScheduleOutput{Body: toScheduleResponse(schedule)}, nil
	}
}

// completeSchedule records a completion: repair log + last_completed_at +
// next_due advance, in one transaction.
func completeSchedule(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *CompleteScheduleInput) (*CompleteScheduleOutput, error) {
	return func(ctx context.Context, input *CompleteScheduleInput) (*CompleteScheduleOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		schedule, err := svc.Complete(ctx, input.ID, workspaceID, input.Body.Notes)
		if err != nil {
			if errors.Is(err, ErrScheduleNotFound) || errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound(msgScheduleNotFound)
			}
			if errors.Is(err, ErrScheduleInactive) {
				return nil, huma.Error400BadRequest("cannot complete an inactive maintenance schedule")
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		publishEvent(ctx, broadcaster, workspaceID, "maintenance.completed", schedule)

		return &CompleteScheduleOutput{Body: toScheduleResponse(schedule)}, nil
	}
}

// deleteSchedule deletes a maintenance schedule.
func deleteSchedule(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetScheduleInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetScheduleInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		scheduleID := input.ID
		if err := svc.Delete(ctx, input.ID, workspaceID); err != nil {
			if errors.Is(err, ErrScheduleNotFound) || errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound(msgScheduleNotFound)
			}
			return nil, huma.Error500InternalServerError("failed to delete maintenance schedule")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "maintenance.deleted",
				EntityID:   scheduleID.String(),
				EntityType: "maintenance",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        scheduleID,
					"user_name": userName,
				},
			})
		}

		return nil, nil
	}
}

// listInventorySchedules lists schedules for an inventory entry (item detail page).
func listInventorySchedules(svc ServiceInterface) func(context.Context, *ListInventorySchedulesInput) (*ListSchedulesOutput, error) {
	return func(ctx context.Context, input *ListInventorySchedulesInput) (*ListSchedulesOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		schedules, err := svc.ListByInventory(ctx, workspaceID, input.InventoryID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list maintenance schedules")
		}

		items := make([]ScheduleResponse, len(schedules))
		for i, s := range schedules {
			items[i] = toScheduleResponse(s)
		}

		return &ListSchedulesOutput{
			Body: ScheduleListResponse{Items: items, Total: len(items)},
		}, nil
	}
}

func publishEvent(ctx context.Context, broadcaster *events.Broadcaster, workspaceID uuid.UUID, eventType string, schedule *Schedule) {
	authUser, _ := appMiddleware.GetAuthUser(ctx)
	if broadcaster == nil || authUser == nil {
		return
	}
	userName := appMiddleware.GetUserDisplayName(ctx)
	broadcaster.Publish(workspaceID, events.Event{
		Type:       eventType,
		EntityID:   schedule.ID().String(),
		EntityType: "maintenance",
		UserID:     authUser.ID,
		Data: map[string]any{
			"id":           schedule.ID(),
			"inventory_id": schedule.InventoryID(),
			"next_due":     schedule.NextDue().Format("2006-01-02"),
			"user_name":    userName,
		},
	})
}

func toScheduleResponse(s *Schedule) ScheduleResponse {
	var lastCompletedAt *string
	if s.LastCompletedAt() != nil {
		v := s.LastCompletedAt().Format(time.RFC3339)
		lastCompletedAt = &v
	}

	return ScheduleResponse{
		ID:              s.ID(),
		WorkspaceID:     s.WorkspaceID(),
		InventoryID:     s.InventoryID(),
		Title:           s.Title(),
		Notes:           s.Notes(),
		IntervalDays:    s.IntervalDays(),
		NextDue:         s.NextDue().Format("2006-01-02"),
		LastCompletedAt: lastCompletedAt,
		IsActive:        s.IsActive(),
		CreatedAt:       s.CreatedAt(),
		UpdatedAt:       s.UpdatedAt(),
	}
}

// Request/Response types

type ListSchedulesInput struct {
	Page  int `query:"page" default:"1" minimum:"1"`
	Limit int `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type ListSchedulesOutput struct {
	Body ScheduleListResponse
}

type ScheduleListResponse struct {
	Items []ScheduleResponse `json:"items"`
	Total int                `json:"total"`
}

type ListDueInput struct {
	Days int `query:"days" default:"7" minimum:"0" maximum:"365" doc:"Include schedules due between now and now+days (overdue always included)"`
}

type ListDueOutput struct {
	Body DueScheduleListResponse
}

type DueScheduleListResponse struct {
	Items []DueScheduleResponse `json:"items"`
	Total int                   `json:"total"`
}

type DueScheduleResponse struct {
	ScheduleResponse
	ItemID    uuid.UUID `json:"item_id"`
	ItemName  string    `json:"item_name"`
	IsOverdue bool      `json:"is_overdue"`
}

type GetScheduleInput struct {
	ID uuid.UUID `path:"id"`
}

type GetScheduleOutput struct {
	Body ScheduleResponse
}

type CreateScheduleInput struct {
	Body struct {
		InventoryID  uuid.UUID `json:"inventory_id" doc:"Inventory entry this schedule maintains"`
		Title        string    `json:"title" minLength:"1" maxLength:"200" doc:"Schedule title, e.g. 'Replace HVAC filter'"`
		Notes        *string   `json:"notes,omitempty" doc:"Optional notes"`
		IntervalDays int       `json:"interval_days" minimum:"1" doc:"Cadence in days between occurrences"`
		NextDue      time.Time `json:"next_due" doc:"Date the first/next maintenance is due"`
	}
}

type CreateScheduleOutput struct {
	Body ScheduleResponse
}

type UpdateScheduleInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Title        *string    `json:"title,omitempty" maxLength:"200"`
		Notes        *string    `json:"notes,omitempty"`
		IntervalDays *int       `json:"interval_days,omitempty" minimum:"1"`
		NextDue      *time.Time `json:"next_due,omitempty"`
		IsActive     *bool      `json:"is_active,omitempty"`
	}
}

type UpdateScheduleOutput struct {
	Body ScheduleResponse
}

type CompleteScheduleInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Notes *string `json:"notes,omitempty" doc:"Optional completion note, stored on the repair log"`
	}
}

type CompleteScheduleOutput struct {
	Body ScheduleResponse
}

type ListInventorySchedulesInput struct {
	InventoryID uuid.UUID `path:"inventory_id"`
}

type ScheduleResponse struct {
	ID              uuid.UUID `json:"id"`
	WorkspaceID     uuid.UUID `json:"workspace_id"`
	InventoryID     uuid.UUID `json:"inventory_id"`
	Title           string    `json:"title"`
	Notes           *string   `json:"notes,omitempty"`
	IntervalDays    int       `json:"interval_days"`
	NextDue         string    `json:"next_due" doc:"YYYY-MM-DD"`
	LastCompletedAt *string   `json:"last_completed_at,omitempty"`
	IsActive        bool      `json:"is_active"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}
