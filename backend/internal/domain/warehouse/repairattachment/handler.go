package repairattachment

import (
	"context"
	"errors"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/attachment"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

const msgWorkspaceContextRequired = "workspace context required"

// RegisterRoutes registers repair attachment routes under /repairs/{repairLogId}/attachments.
// Each handler is a package factory func (see below) so this stays a flat list
// of registrations rather than a single god-function of inline closures.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	// List attachments for a repair log
	huma.Get(api, "/repairs/{repairLogId}/attachments", listAttachments(svc))
	// Link existing file to repair as attachment
	huma.Post(api, "/repairs/{repairLogId}/attachments", createAttachment(svc, broadcaster))
	// Unlink attachment from repair
	huma.Delete(api, "/repairs/{repairLogId}/attachments/{attachmentId}", deleteAttachment(svc, broadcaster))
}

// listAttachments lists attachments for a repair log.
func listAttachments(svc ServiceInterface) func(context.Context, *ListAttachmentsInput) (*ListAttachmentsOutput, error) {
	return func(ctx context.Context, input *ListAttachmentsInput) (*ListAttachmentsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		attachments, err := svc.ListByRepairLog(ctx, input.RepairLogID, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list attachments")
		}

		items := make([]RepairAttachmentResponse, len(attachments))
		for i, a := range attachments {
			items[i] = toAttachmentWithFileResponse(a)
		}

		return &ListAttachmentsOutput{
			Body: RepairAttachmentListResponse{
				Items: items,
				Total: len(items),
			},
		}, nil
	}
}

// createAttachment links an existing file to a repair as an attachment.
func createAttachment(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *CreateAttachmentInput) (*CreateAttachmentOutput, error) {
	return func(ctx context.Context, input *CreateAttachmentInput) (*CreateAttachmentOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		// Validate attachment type
		attachType := attachment.AttachmentType(input.Body.AttachmentType)
		if !attachType.IsValid() {
			return nil, huma.Error400BadRequest("invalid attachment type. Valid types: PHOTO, MANUAL, RECEIPT, WARRANTY, OTHER")
		}

		ra, err := svc.Create(ctx, input.RepairLogID, workspaceID, input.Body.FileID, attachType, input.Body.Title)
		if err != nil {
			if errors.Is(err, ErrFileNotFound) {
				return nil, huma.Error404NotFound("file not found")
			}
			if errors.Is(err, ErrFileBelongsToDifferentWorkspace) {
				return nil, huma.Error400BadRequest("file does not belong to this workspace")
			}
			if errors.Is(err, shared.ErrInvalidInput) {
				return nil, appMiddleware.MapDomainError(err)
			}
			return nil, huma.Error500InternalServerError("failed to create attachment")
		}

		// Publish SSE event
		publishEvent(ctx, broadcaster, workspaceID, "repairattachment.created", ra.ID().String(), map[string]any{
			"id":            ra.ID(),
			"repair_log_id": ra.RepairLogID(),
			"file_id":       ra.FileID(),
		})

		return &CreateAttachmentOutput{
			Body: toAttachmentResponse(ra),
		}, nil
	}
}

// deleteAttachment unlinks an attachment from a repair.
func deleteAttachment(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *DeleteAttachmentInput) (*struct{}, error) {
	return func(ctx context.Context, input *DeleteAttachmentInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		attachmentID := input.AttachmentID

		if err := svc.Delete(ctx, attachmentID, workspaceID); err != nil {
			if errors.Is(err, ErrRepairAttachmentNotFound) {
				return nil, huma.Error404NotFound("attachment not found")
			}
			return nil, huma.Error500InternalServerError("failed to delete attachment")
		}

		// Publish SSE event
		publishEvent(ctx, broadcaster, workspaceID, "repairattachment.deleted", attachmentID.String(), map[string]any{
			"id":            attachmentID,
			"repair_log_id": input.RepairLogID,
		})

		return nil, nil
	}
}

// publishEvent broadcasts a repairattachment SSE event, injecting the actor's
// display name into data. It no-ops when there is no broadcaster or auth user.
func publishEvent(ctx context.Context, broadcaster *events.Broadcaster, workspaceID uuid.UUID, eventType, entityID string, data map[string]any) {
	authUser, _ := appMiddleware.GetAuthUser(ctx)
	if broadcaster == nil || authUser == nil {
		return
	}
	data["user_name"] = appMiddleware.GetUserDisplayName(ctx)
	broadcaster.Publish(workspaceID, events.Event{
		Type:       eventType,
		EntityID:   entityID,
		EntityType: "repairattachment",
		UserID:     authUser.ID,
		Data:       data,
	})
}

func toAttachmentResponse(a *RepairAttachment) RepairAttachmentResponse {
	return RepairAttachmentResponse{
		ID:             a.ID(),
		RepairLogID:    a.RepairLogID(),
		WorkspaceID:    a.WorkspaceID(),
		FileID:         a.FileID(),
		AttachmentType: string(a.AttachmentType()),
		Title:          a.Title(),
		CreatedAt:      a.CreatedAt(),
		UpdatedAt:      a.UpdatedAt(),
	}
}

func toAttachmentWithFileResponse(a *RepairAttachmentWithFile) RepairAttachmentResponse {
	return RepairAttachmentResponse{
		ID:             a.ID(),
		RepairLogID:    a.RepairLogID(),
		WorkspaceID:    a.WorkspaceID(),
		FileID:         a.FileID(),
		AttachmentType: string(a.AttachmentType()),
		Title:          a.Title(),
		FileName:       &a.FileName,
		FileMimeType:   a.FileMimeType,
		FileSizeBytes:  a.FileSizeBytes,
		FileStorageKey: a.FileStorageKey,
		CreatedAt:      a.CreatedAt(),
		UpdatedAt:      a.UpdatedAt(),
	}
}

// Request/Response types

type ListAttachmentsInput struct {
	RepairLogID uuid.UUID `path:"repairLogId"`
}

type ListAttachmentsOutput struct {
	Body RepairAttachmentListResponse
}

type RepairAttachmentListResponse struct {
	Items []RepairAttachmentResponse `json:"items"`
	Total int                        `json:"total"`
}

type CreateAttachmentInput struct {
	RepairLogID uuid.UUID `path:"repairLogId"`
	Body        struct {
		FileID         uuid.UUID `json:"file_id" doc:"ID of the existing file to attach"`
		AttachmentType string    `json:"attachment_type" doc:"Type of attachment: PHOTO, MANUAL, RECEIPT, WARRANTY, OTHER"`
		Title          *string   `json:"title,omitempty" doc:"Optional title for the attachment"`
	}
}

type CreateAttachmentOutput struct {
	Body RepairAttachmentResponse
}

type DeleteAttachmentInput struct {
	RepairLogID  uuid.UUID `path:"repairLogId"`
	AttachmentID uuid.UUID `path:"attachmentId"`
}

type RepairAttachmentResponse struct {
	ID             uuid.UUID `json:"id"`
	RepairLogID    uuid.UUID `json:"repair_log_id"`
	WorkspaceID    uuid.UUID `json:"workspace_id"`
	FileID         uuid.UUID `json:"file_id"`
	AttachmentType string    `json:"attachment_type"`
	Title          *string   `json:"title,omitempty"`
	FileName       *string   `json:"file_name,omitempty"`
	FileMimeType   *string   `json:"file_mime_type,omitempty"`
	FileSizeBytes  *int64    `json:"file_size_bytes,omitempty"`
	FileStorageKey *string   `json:"file_storage_key,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
