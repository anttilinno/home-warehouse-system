package worker

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/importjob"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queue"
	"github.com/antti/home-warehouse/go-backend/internal/utils/csvparser"
)

type ImportWorker struct {
	queue       *queue.Queue
	importRepo  importjob.Repository
	broadcaster *events.Broadcaster
	dbPool      *pgxpool.Pool
	isRunning   bool
}

func NewImportWorker(
	queue *queue.Queue,
	importRepo importjob.Repository,
	broadcaster *events.Broadcaster,
	dbPool *pgxpool.Pool,
) *ImportWorker {
	return &ImportWorker{
		queue:       queue,
		importRepo:  importRepo,
		broadcaster: broadcaster,
		dbPool:      dbPool,
		isRunning:   false,
	}
}

func (w *ImportWorker) Start(ctx context.Context) error {
	w.isRunning = true

	for w.isRunning {
		select {
		case <-ctx.Done():
			log.Println("Context cancelled, stopping worker...")
			w.isRunning = false
			return nil

		default:
			// Dequeue job with timeout
			job, err := w.queue.Dequeue(ctx, 5*time.Second)
			if err != nil {
				log.Printf("Error dequeuing job: %v", err)
				time.Sleep(1 * time.Second)
				continue
			}

			if job == nil {
				// No job available, continue
				continue
			}

			// Process job
			if err := w.processJob(ctx, job); err != nil {
				log.Printf("Error processing job %s: %v", job.ID, err)
				if failErr := w.queue.Fail(ctx, job.ID, err.Error()); failErr != nil {
					log.Printf("Error marking job as failed: %v", failErr)
				}
			} else {
				if err := w.queue.Complete(ctx, job.ID); err != nil {
					log.Printf("Error completing job: %v", err)
				}
			}
		}
	}

	return nil
}

func (w *ImportWorker) processJob(ctx context.Context, job *queue.Job) error {
	log.Printf("Processing job %s of type %s", job.ID, job.Type)

	// Get import job ID from payload
	importJobIDStr, ok := job.Payload["import_job_id"].(string)
	if !ok {
		return fmt.Errorf("missing import_job_id in payload")
	}

	importJobID, err := uuid.Parse(importJobIDStr)
	if err != nil {
		return fmt.Errorf("invalid import_job_id: %w", err)
	}

	workspaceIDStr, ok := job.Payload["workspace_id"].(string)
	if !ok {
		return fmt.Errorf("missing workspace_id in payload")
	}

	workspaceID, err := uuid.Parse(workspaceIDStr)
	if err != nil {
		return fmt.Errorf("invalid workspace_id: %w", err)
	}

	// Fetch import job
	importJob, err := w.importRepo.FindJobByID(ctx, importJobID, workspaceID)
	if err != nil {
		return fmt.Errorf("failed to fetch import job: %w", err)
	}

	// Process based on entity type
	switch importJob.EntityType() {
	case importjob.EntityTypeItems:
		return w.processItemImport(ctx, importJob)
	case importjob.EntityTypeInventory:
		return fmt.Errorf("inventory import not yet implemented")
	default:
		return fmt.Errorf("unsupported entity type: %s", importJob.EntityType())
	}
}

func (w *ImportWorker) processItemImport(ctx context.Context, job *importjob.ImportJob) error {
	// Parse CSV
	parser := csvparser.NewCSVParser(job.FilePath())

	// Count total rows
	totalRows, err := parser.CountRows()
	if err != nil {
		job.Fail(fmt.Sprintf("Failed to count rows: %v", err))
		w.importRepo.SaveJob(ctx, job)
		return err
	}

	// Start job
	job.Start(totalRows)
	if err := w.importRepo.SaveJob(ctx, job); err != nil {
		return err
	}

	// Publish progress event
	w.publishProgress(job, 0)

	// Initialize repositories
	itemRepo := postgres.NewItemRepository(w.dbPool)
	itemService := item.NewService(itemRepo)

	// Process rows
	processedRows := 0
	successCount := 0
	errorCount := 0

	err = parser.ParseStream(func(rowNum int, row map[string]string) error {
		// Map CSV fields to item
		name := row["name"]
		if name == "" {
			// Save error
			importError, _ := importjob.NewImportError(
				job.ID(),
				rowNum,
				strPtr("name"),
				"name is required",
				stringMapToAnyMap(row),
			)
			w.importRepo.SaveError(ctx, importError)
			errorCount++
		} else {
			// Create item
			_, err := itemService.Create(ctx, item.CreateInput{
				WorkspaceID:  job.WorkspaceID(),
				Name:         name,
				SKU:          strPtrFromMap(row, "sku"),
				Description:  strPtrFromMap(row, "description"),
				Brand:        strPtrFromMap(row, "brand"),
				Model:        strPtrFromMap(row, "model"),
				Manufacturer: strPtrFromMap(row, "manufacturer"),
			})

			if err != nil {
				// Save error
				importError, _ := importjob.NewImportError(
					job.ID(),
					rowNum,
					nil,
					err.Error(),
					stringMapToAnyMap(row),
				)
				w.importRepo.SaveError(ctx, importError)
				errorCount++
			} else {
				successCount++
			}
		}

		processedRows++

		// Update progress every 10 rows
		if processedRows%10 == 0 {
			job.UpdateProgress(processedRows, successCount, errorCount)
			w.importRepo.SaveJob(ctx, job)
			w.publishProgress(job, (processedRows*100)/totalRows)
		}

		return nil
	})

	if err != nil {
		job.Fail(err.Error())
	} else {
		job.UpdateProgress(processedRows, successCount, errorCount)
		job.Complete()
	}

	// Save final state
	if err := w.importRepo.SaveJob(ctx, job); err != nil {
		return err
	}

	// Publish final progress
	w.publishProgress(job, 100)

	return nil
}

func (w *ImportWorker) publishProgress(job *importjob.ImportJob, progressPercent int) {
	if w.broadcaster != nil {
		w.broadcaster.Publish(job.WorkspaceID(), events.Event{
			Type:       "import.progress",
			EntityID:   job.ID().String(),
			EntityType: "import_job",
			UserID:     job.UserID(),
			Data: map[string]any{
				"id":             job.ID(),
				"status":         job.Status(),
				"progress":       progressPercent,
				"processed_rows": job.ProcessedRows(),
				"success_count":  job.SuccessCount(),
				"error_count":    job.ErrorCount(),
				"total_rows":     job.TotalRows(),
			},
		})
	}
}

// Helper functions
func strPtr(s string) *string {
	return &s
}

func strPtrFromMap(m map[string]string, key string) *string {
	if val, ok := m[key]; ok && val != "" {
		return &val
	}
	return nil
}

func stringMapToAnyMap(m map[string]string) map[string]any {
	result := make(map[string]any)
	for k, v := range m {
		result[k] = v
	}
	return result
}
