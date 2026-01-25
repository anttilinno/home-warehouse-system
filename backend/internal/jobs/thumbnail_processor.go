package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/infra/imageprocessor"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/infra/storage"
)

// ThumbnailPayload contains data for thumbnail generation task.
type ThumbnailPayload struct {
	PhotoID     uuid.UUID `json:"photo_id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	ItemID      uuid.UUID `json:"item_id"`
	StoragePath string    `json:"storage_path"`
}

// NewThumbnailGenerationTask creates a new thumbnail generation task.
func NewThumbnailGenerationTask(photoID, workspaceID, itemID uuid.UUID, storagePath string) *asynq.Task {
	payload, _ := json.Marshal(ThumbnailPayload{
		PhotoID:     photoID,
		WorkspaceID: workspaceID,
		ItemID:      itemID,
		StoragePath: storagePath,
	})
	return asynq.NewTask(TypeThumbnailGeneration, payload,
		asynq.MaxRetry(5),
		asynq.Timeout(5*time.Minute),
		asynq.Queue(QueueDefault),
	)
}

// ThumbnailProcessor handles thumbnail generation tasks.
type ThumbnailProcessor struct {
	pool        *pgxpool.Pool
	processor   imageprocessor.ImageProcessor
	storage     storage.Storage
	broadcaster *events.Broadcaster
	uploadDir   string
}

// NewThumbnailProcessor creates a new thumbnail processor.
func NewThumbnailProcessor(
	pool *pgxpool.Pool,
	processor imageprocessor.ImageProcessor,
	storage storage.Storage,
	broadcaster *events.Broadcaster,
	uploadDir string,
) *ThumbnailProcessor {
	return &ThumbnailProcessor{
		pool:        pool,
		processor:   processor,
		storage:     storage,
		broadcaster: broadcaster,
		uploadDir:   uploadDir,
	}
}

// ProcessTask handles the thumbnail generation task.
func (p *ThumbnailProcessor) ProcessTask(ctx context.Context, t *asynq.Task) error {
	var payload ThumbnailPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	log.Printf("Processing thumbnails for photo %s", payload.PhotoID)

	q := queries.New(p.pool)

	// Update status to processing
	if err := q.UpdateThumbnailStatus(ctx, queries.UpdateThumbnailStatusParams{
		ID:              payload.PhotoID,
		ThumbnailStatus: "processing",
		ThumbnailError:  nil,
	}); err != nil {
		return fmt.Errorf("update status to processing: %w", err)
	}

	// Download original file to temp location
	tempPath := filepath.Join(p.uploadDir, fmt.Sprintf("thumb-src-%s", payload.PhotoID))
	defer os.Remove(tempPath)

	reader, err := p.storage.Get(ctx, payload.StoragePath)
	if err != nil {
		p.handleFailure(ctx, q, payload, fmt.Errorf("get original: %w", err))
		return err
	}
	defer reader.Close()

	tempFile, err := os.Create(tempPath)
	if err != nil {
		p.handleFailure(ctx, q, payload, fmt.Errorf("create temp: %w", err))
		return err
	}
	if _, err := io.Copy(tempFile, reader); err != nil {
		tempFile.Close()
		p.handleFailure(ctx, q, payload, fmt.Errorf("copy to temp: %w", err))
		return err
	}
	tempFile.Close()

	// Generate thumbnails in all sizes
	baseDest := filepath.Join(p.uploadDir, fmt.Sprintf("thumb-%s.webp", payload.PhotoID))
	thumbnails, err := p.processor.GenerateAllThumbnails(ctx, tempPath, baseDest)
	if err != nil {
		p.handleFailure(ctx, q, payload, fmt.Errorf("generate thumbnails: %w", err))
		return err
	}

	// Upload thumbnails to storage
	paths := make(map[imageprocessor.ThumbnailSize]string)
	for size, localPath := range thumbnails {
		defer os.Remove(localPath)

		thumbFile, err := os.Open(localPath)
		if err != nil {
			p.handleFailure(ctx, q, payload, fmt.Errorf("open %s thumbnail: %w", size, err))
			return err
		}

		storagePath, err := p.storage.Save(ctx,
			payload.WorkspaceID.String(),
			payload.ItemID.String(),
			fmt.Sprintf("thumb_%s_%s.webp", size, payload.PhotoID),
			thumbFile,
		)
		thumbFile.Close()
		if err != nil {
			p.handleFailure(ctx, q, payload, fmt.Errorf("save %s thumbnail: %w", size, err))
			return err
		}
		paths[size] = storagePath
	}

	// Update database with thumbnail paths
	var smallPath, mediumPath, largePath *string
	if p, ok := paths[imageprocessor.ThumbnailSizeSmall]; ok {
		smallPath = &p
	}
	if p, ok := paths[imageprocessor.ThumbnailSizeMedium]; ok {
		mediumPath = &p
	}
	if p, ok := paths[imageprocessor.ThumbnailSizeLarge]; ok {
		largePath = &p
	}

	_, err = q.UpdateThumbnailPaths(ctx, queries.UpdateThumbnailPathsParams{
		ID:                  payload.PhotoID,
		ThumbnailSmallPath:  smallPath,
		ThumbnailMediumPath: mediumPath,
		ThumbnailLargePath:  largePath,
	})
	if err != nil {
		p.handleFailure(ctx, q, payload, fmt.Errorf("update paths: %w", err))
		return err
	}

	// Emit SSE event
	p.broadcaster.Publish(payload.WorkspaceID, events.Event{
		Type:       "photo.thumbnail_ready",
		EntityID:   payload.PhotoID.String(),
		EntityType: "item_photo",
		Data: map[string]interface{}{
			"photo_id":             payload.PhotoID.String(),
			"item_id":              payload.ItemID.String(),
			"small_thumbnail_url":  smallPath,
			"medium_thumbnail_url": mediumPath,
			"large_thumbnail_url":  largePath,
		},
	})

	log.Printf("Thumbnails ready for photo %s", payload.PhotoID)
	return nil
}

func (p *ThumbnailProcessor) handleFailure(ctx context.Context, q *queries.Queries, payload ThumbnailPayload, err error) {
	errMsg := err.Error()
	q.UpdateThumbnailStatus(ctx, queries.UpdateThumbnailStatusParams{
		ID:              payload.PhotoID,
		ThumbnailStatus: "failed",
		ThumbnailError:  &errMsg,
	})

	p.broadcaster.Publish(payload.WorkspaceID, events.Event{
		Type:       "photo.thumbnail_failed",
		EntityID:   payload.PhotoID.String(),
		EntityType: "item_photo",
		Data: map[string]interface{}{
			"photo_id": payload.PhotoID.String(),
			"item_id":  payload.ItemID.String(),
			"error":    errMsg,
		},
	})
}
