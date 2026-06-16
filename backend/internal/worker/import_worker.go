package worker

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/borrower"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/container"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/importjob"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/movement"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queue"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/utils/csvparser"
)

const (
	msgFailedToCountRows            = "Failed to count rows: %v"
	msgNameIsRequired               = "name is required"
	msgFailedToLoadExistingLocation = "failed to load existing locations: %v"
)

type ImportWorker struct {
	queue       *queue.Queue
	importRepo  importjob.Repository
	broadcaster *events.Broadcaster
	dbPool      *pgxpool.Pool
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
	}
}

// Start runs the dequeue/process loop until ctx is cancelled. Cancellation is
// a drain signal: the loop stops dequeuing new jobs, but an in-flight job is
// finished with a context detached from the shutdown cancellation, so a
// deploy mid-import does not abort the import half-written. Start returns
// only after any in-flight job has completed — callers wanting a bounded
// shutdown should wait on Start's return with their own timeout.
func (w *ImportWorker) Start(ctx context.Context) error {
	// Re-enqueue any jobs a previous worker crash left on the in-flight list.
	if recovered, err := w.queue.RecoverInFlight(ctx); err != nil {
		log.Printf("Error recovering in-flight jobs: %v", err)
	} else if recovered > 0 {
		log.Printf("Recovered %d in-flight job(s) from previous run", recovered)
	}

	for {
		select {
		case <-ctx.Done():
			log.Println("Context cancelled, stopping worker...")
			return nil

		default:
			// Dequeue job with timeout
			job, err := w.queue.Dequeue(ctx, 5*time.Second)
			if err != nil {
				if ctx.Err() != nil {
					// Shutdown raced the blocking dequeue — not an error.
					log.Println("Context cancelled, stopping worker...")
					return nil
				}
				log.Printf("Error dequeuing job: %v", err)
				time.Sleep(1 * time.Second)
				continue
			}

			if job == nil {
				// No job available, continue
				continue
			}

			// Process with a context that survives shutdown cancellation so
			// an in-flight import drains instead of being killed mid-write.
			procCtx := context.WithoutCancel(ctx)

			if err := w.processJob(procCtx, job); err != nil {
				log.Printf("Error processing job %s: %v", job.ID, err)
				dead, failErr := w.queue.Fail(procCtx, job.ID, err.Error())
				if failErr != nil {
					log.Printf("Error marking job as failed: %v", failErr)
				}
				if dead {
					// Retries exhausted: the queue job is dead-lettered; make
					// sure the import job row reflects the terminal failure.
					w.markImportJobFailed(procCtx, job, err.Error())
				}
			} else {
				if err := w.queue.Complete(procCtx, job.ID); err != nil {
					log.Printf("Error completing job: %v", err)
				}
			}
		}
	}
}

// markImportJobFailed best-effort marks the import job referenced by a
// dead-lettered queue job as failed, so the UI does not show it pending
// forever after retries are exhausted.
func (w *ImportWorker) markImportJobFailed(ctx context.Context, job *queue.Job, reason string) {
	importJobIDStr, _ := job.Payload["import_job_id"].(string)
	workspaceIDStr, _ := job.Payload["workspace_id"].(string)
	importJobID, err1 := uuid.Parse(importJobIDStr)
	workspaceID, err2 := uuid.Parse(workspaceIDStr)
	if err1 != nil || err2 != nil {
		log.Printf("Cannot mark import job failed for dead-lettered queue job %s: bad payload", job.ID)
		return
	}

	importJob, err := w.importRepo.FindJobByID(ctx, importJobID, workspaceID)
	if err != nil {
		log.Printf("Cannot mark import job %s failed: %v", importJobID, err)
		return
	}
	if importJob.Status() == importjob.StatusCompleted || importJob.Status() == importjob.StatusFailed {
		return // already terminal
	}
	importJob.Fail(fmt.Sprintf("import abandoned after max retries: %s", reason))
	w.saveJob(ctx, importJob)
	w.publishProgress(importJob, 100)
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
	case importjob.EntityTypeLocations:
		return w.processLocationImport(ctx, importJob)
	case importjob.EntityTypeContainers:
		return w.processContainerImport(ctx, importJob)
	case importjob.EntityTypeCategories:
		return w.processCategoryImport(ctx, importJob)
	case importjob.EntityTypeBorrowers:
		return w.processBorrowerImport(ctx, importJob)
	case importjob.EntityTypeInventory:
		return w.processInventoryImport(ctx, importJob)
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
		job.Fail(fmt.Sprintf(msgFailedToCountRows, err))
		w.saveJob(ctx, job)
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
	categoryRepo := postgres.NewCategoryRepository(w.dbPool)
	itemService := item.NewService(itemRepo, categoryRepo)

	// Process rows
	processedRows := 0
	successCount := 0
	errorCount := 0

	err = parser.ParseStream(func(rowNum int, row map[string]string) error {
		// Map CSV fields to item
		name := row["name"]
		if name == "" {
			w.saveRowError(ctx, job.ID(), rowNum, strPtr("name"), msgNameIsRequired, row)
			errorCount++
		} else {
			// Get or generate SKU
			sku := row["sku"]
			if sku == "" {
				// Generate a SKU based on name
				nameLen := len(name)
				if nameLen > 10 {
					nameLen = 10
				}
				sku = fmt.Sprintf("AUTO-%s-%d", name[:nameLen], time.Now().Unix())
			}

			// Create item
			_, err := itemService.Create(ctx, item.CreateInput{
				WorkspaceID:  job.WorkspaceID(),
				Name:         name,
				SKU:          sku,
				Description:  strPtrFromMap(row, "description"),
				Brand:        strPtrFromMap(row, "brand"),
				Model:        strPtrFromMap(row, "model"),
				Manufacturer: strPtrFromMap(row, "manufacturer"),
			})

			if err != nil {
				w.saveRowError(ctx, job.ID(), rowNum, nil, err.Error(), row)
				errorCount++
			} else {
				successCount++
			}
		}

		processedRows++

		// Update progress every 10 rows
		if processedRows%10 == 0 {
			job.UpdateProgress(processedRows, successCount, errorCount)
			w.saveJob(ctx, job)
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

func (w *ImportWorker) processLocationImport(ctx context.Context, job *importjob.ImportJob) error {
	parser := csvparser.NewCSVParser(job.FilePath())

	totalRows, err := parser.CountRows()
	if err != nil {
		job.Fail(fmt.Sprintf(msgFailedToCountRows, err))
		w.saveJob(ctx, job)
		return err
	}

	job.Start(totalRows)
	if err := w.importRepo.SaveJob(ctx, job); err != nil {
		return err
	}
	w.publishProgress(job, 0)

	locationRepo := postgres.NewLocationRepository(w.dbPool)
	locationService := location.NewService(locationRepo)

	// Build a cache of existing locations for parent lookups
	existingLocations, err := findAllPages(ctx, func(ctx context.Context, p shared.Pagination) ([]*location.Location, int, error) {
		return locationRepo.FindByWorkspace(ctx, job.WorkspaceID(), p)
	})
	if err != nil {
		return w.failJob(ctx, job, fmt.Sprintf(msgFailedToLoadExistingLocation, err))
	}
	locationCache := make(map[string]*location.Location)
	for _, loc := range existingLocations {
		locationCache[strings.ToLower(loc.Name())] = loc
		locationCache[strings.ToLower(loc.ShortCode())] = loc
	}

	processedRows := 0
	successCount := 0
	errorCount := 0

	err = parser.ParseStream(func(rowNum int, row map[string]string) error {
		name := row["name"]
		if name == "" {
			w.saveRowError(ctx, job.ID(), rowNum, strPtr("name"), msgNameIsRequired, row)
			errorCount++
		} else {
			var parentLocation *uuid.UUID
			if parentRef := row["parent_location"]; parentRef != "" {
				if parent, ok := locationCache[strings.ToLower(parentRef)]; ok {
					id := parent.ID()
					parentLocation = &id
				}
			}

			newLoc, err := locationService.Create(ctx, location.CreateInput{
				WorkspaceID:    job.WorkspaceID(),
				Name:           name,
				ParentLocation: parentLocation,
				Description:    strPtrFromMap(row, "description"),
				ShortCode:      row["short_code"],
			})

			if err != nil {
				w.saveRowError(ctx, job.ID(), rowNum, nil, err.Error(), row)
				errorCount++
			} else {
				// Add to cache for potential parent references
				locationCache[strings.ToLower(newLoc.Name())] = newLoc
				locationCache[strings.ToLower(newLoc.ShortCode())] = newLoc
				successCount++
			}
		}

		processedRows++
		if processedRows%10 == 0 {
			job.UpdateProgress(processedRows, successCount, errorCount)
			w.saveJob(ctx, job)
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

	w.saveJob(ctx, job)
	w.publishProgress(job, 100)
	return nil
}

func (w *ImportWorker) processContainerImport(ctx context.Context, job *importjob.ImportJob) error {
	parser := csvparser.NewCSVParser(job.FilePath())

	totalRows, err := parser.CountRows()
	if err != nil {
		job.Fail(fmt.Sprintf(msgFailedToCountRows, err))
		w.saveJob(ctx, job)
		return err
	}

	job.Start(totalRows)
	if err := w.importRepo.SaveJob(ctx, job); err != nil {
		return err
	}
	w.publishProgress(job, 0)

	locationRepo := postgres.NewLocationRepository(w.dbPool)
	containerRepo := postgres.NewContainerRepository(w.dbPool)
	containerService := container.NewService(containerRepo, locationRepo)

	// Build location cache for lookups
	existingLocations, err := findAllPages(ctx, func(ctx context.Context, p shared.Pagination) ([]*location.Location, int, error) {
		return locationRepo.FindByWorkspace(ctx, job.WorkspaceID(), p)
	})
	if err != nil {
		return w.failJob(ctx, job, fmt.Sprintf(msgFailedToLoadExistingLocation, err))
	}
	locationCache := make(map[string]*location.Location)
	for _, loc := range existingLocations {
		locationCache[strings.ToLower(loc.Name())] = loc
		locationCache[strings.ToLower(loc.ShortCode())] = loc
	}

	processedRows := 0
	successCount := 0
	errorCount := 0

	err = parser.ParseStream(func(rowNum int, row map[string]string) error {
		name := row["name"]
		locationRef := row["location"]

		if name == "" {
			w.saveRowError(ctx, job.ID(), rowNum, strPtr("name"), msgNameIsRequired, row)
			errorCount++
		} else if locationRef == "" {
			w.saveRowError(ctx, job.ID(), rowNum, strPtr("location"), "location is required", row)
			errorCount++
		} else {
			loc, ok := locationCache[strings.ToLower(locationRef)]
			if !ok {
				w.saveRowError(ctx, job.ID(), rowNum, strPtr("location"), fmt.Sprintf("location '%s' not found", locationRef), row)
				errorCount++
			} else {
				_, err := containerService.Create(ctx, container.CreateInput{
					WorkspaceID: job.WorkspaceID(),
					LocationID:  loc.ID(),
					Name:        name,
					Description: strPtrFromMap(row, "description"),
					Capacity:    strPtrFromMap(row, "capacity"),
					ShortCode:   row["short_code"],
				})

				if err != nil {
					w.saveRowError(ctx, job.ID(), rowNum, nil, err.Error(), row)
					errorCount++
				} else {
					successCount++
				}
			}
		}

		processedRows++
		if processedRows%10 == 0 {
			job.UpdateProgress(processedRows, successCount, errorCount)
			w.saveJob(ctx, job)
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

	w.saveJob(ctx, job)
	w.publishProgress(job, 100)
	return nil
}

func (w *ImportWorker) processCategoryImport(ctx context.Context, job *importjob.ImportJob) error {
	parser := csvparser.NewCSVParser(job.FilePath())

	totalRows, err := parser.CountRows()
	if err != nil {
		job.Fail(fmt.Sprintf(msgFailedToCountRows, err))
		w.saveJob(ctx, job)
		return err
	}

	job.Start(totalRows)
	if err := w.importRepo.SaveJob(ctx, job); err != nil {
		return err
	}
	w.publishProgress(job, 0)

	categoryRepo := postgres.NewCategoryRepository(w.dbPool)
	categoryService := category.NewService(categoryRepo)

	// Build category cache for parent lookups
	existingCategories, err := categoryRepo.FindByWorkspace(ctx, job.WorkspaceID())
	if err != nil {
		return w.failJob(ctx, job, fmt.Sprintf("failed to load existing categories: %v", err))
	}
	categoryCache := make(map[string]*category.Category)
	for _, cat := range existingCategories {
		categoryCache[strings.ToLower(cat.Name())] = cat
	}

	processedRows := 0
	successCount := 0
	errorCount := 0

	err = parser.ParseStream(func(rowNum int, row map[string]string) error {
		name := row["name"]
		if name == "" {
			w.saveRowError(ctx, job.ID(), rowNum, strPtr("name"), msgNameIsRequired, row)
			errorCount++
		} else {
			var parentCategoryID *uuid.UUID
			if parentRef := row["parent_category"]; parentRef != "" {
				if parent, ok := categoryCache[strings.ToLower(parentRef)]; ok {
					id := parent.ID()
					parentCategoryID = &id
				}
			}

			newCat, err := categoryService.Create(ctx, category.CreateInput{
				WorkspaceID:      job.WorkspaceID(),
				Name:             name,
				ParentCategoryID: parentCategoryID,
				Description:      strPtrFromMap(row, "description"),
			})

			if err != nil {
				w.saveRowError(ctx, job.ID(), rowNum, nil, err.Error(), row)
				errorCount++
			} else {
				// Add to cache for potential parent references
				categoryCache[strings.ToLower(newCat.Name())] = newCat
				successCount++
			}
		}

		processedRows++
		if processedRows%10 == 0 {
			job.UpdateProgress(processedRows, successCount, errorCount)
			w.saveJob(ctx, job)
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

	w.saveJob(ctx, job)
	w.publishProgress(job, 100)
	return nil
}

func (w *ImportWorker) processBorrowerImport(ctx context.Context, job *importjob.ImportJob) error {
	parser := csvparser.NewCSVParser(job.FilePath())

	totalRows, err := parser.CountRows()
	if err != nil {
		job.Fail(fmt.Sprintf(msgFailedToCountRows, err))
		w.saveJob(ctx, job)
		return err
	}

	job.Start(totalRows)
	if err := w.importRepo.SaveJob(ctx, job); err != nil {
		return err
	}
	w.publishProgress(job, 0)

	borrowerRepo := postgres.NewBorrowerRepository(w.dbPool)
	borrowerService := borrower.NewService(borrowerRepo)

	processedRows := 0
	successCount := 0
	errorCount := 0

	err = parser.ParseStream(func(rowNum int, row map[string]string) error {
		name := row["name"]
		if name == "" {
			w.saveRowError(ctx, job.ID(), rowNum, strPtr("name"), msgNameIsRequired, row)
			errorCount++
		} else {
			_, err := borrowerService.Create(ctx, borrower.CreateInput{
				WorkspaceID: job.WorkspaceID(),
				Name:        name,
				Email:       strPtrFromMap(row, "email"),
				Phone:       strPtrFromMap(row, "phone"),
				Notes:       strPtrFromMap(row, "notes"),
			})

			if err != nil {
				w.saveRowError(ctx, job.ID(), rowNum, nil, err.Error(), row)
				errorCount++
			} else {
				successCount++
			}
		}

		processedRows++
		if processedRows%10 == 0 {
			job.UpdateProgress(processedRows, successCount, errorCount)
			w.saveJob(ctx, job)
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

	w.saveJob(ctx, job)
	w.publishProgress(job, 100)
	return nil
}

func (w *ImportWorker) processInventoryImport(ctx context.Context, job *importjob.ImportJob) error {
	parser := csvparser.NewCSVParser(job.FilePath())

	totalRows, err := parser.CountRows()
	if err != nil {
		job.Fail(fmt.Sprintf(msgFailedToCountRows, err))
		w.saveJob(ctx, job)
		return err
	}

	job.Start(totalRows)
	if err := w.importRepo.SaveJob(ctx, job); err != nil {
		return err
	}
	w.publishProgress(job, 0)

	itemRepo := postgres.NewItemRepository(w.dbPool)
	locationRepo := postgres.NewLocationRepository(w.dbPool)
	containerRepo := postgres.NewContainerRepository(w.dbPool)
	inventoryRepo := postgres.NewInventoryRepository(w.dbPool)
	movementRepo := postgres.NewMovementRepository(w.dbPool)
	movementService := movement.NewService(movementRepo)
	inventoryService := inventory.NewService(inventoryRepo, movementService, itemRepo, locationRepo, containerRepo)

	// Build caches for lookups
	existingItems, err := findAllPages(ctx, func(ctx context.Context, p shared.Pagination) ([]*item.Item, int, error) {
		return itemRepo.FindByWorkspace(ctx, job.WorkspaceID(), p)
	})
	if err != nil {
		return w.failJob(ctx, job, fmt.Sprintf("failed to load existing items: %v", err))
	}
	itemCache := make(map[string]*item.Item)
	for _, itm := range existingItems {
		itemCache[strings.ToLower(itm.Name())] = itm
		itemCache[strings.ToLower(itm.SKU())] = itm
		if itm.ShortCode() != "" {
			itemCache[strings.ToLower(itm.ShortCode())] = itm
		}
	}

	existingLocations, err := findAllPages(ctx, func(ctx context.Context, p shared.Pagination) ([]*location.Location, int, error) {
		return locationRepo.FindByWorkspace(ctx, job.WorkspaceID(), p)
	})
	if err != nil {
		return w.failJob(ctx, job, fmt.Sprintf(msgFailedToLoadExistingLocation, err))
	}
	locationCache := make(map[string]*location.Location)
	for _, loc := range existingLocations {
		locationCache[strings.ToLower(loc.Name())] = loc
		locationCache[strings.ToLower(loc.ShortCode())] = loc
	}

	existingContainers, err := findAllPages(ctx, func(ctx context.Context, p shared.Pagination) ([]*container.Container, int, error) {
		return containerRepo.FindByWorkspace(ctx, job.WorkspaceID(), p)
	})
	if err != nil {
		return w.failJob(ctx, job, fmt.Sprintf("failed to load existing containers: %v", err))
	}
	containerCache := make(map[string]*container.Container)
	for _, cont := range existingContainers {
		containerCache[strings.ToLower(cont.Name())] = cont
		containerCache[strings.ToLower(cont.ShortCode())] = cont
	}

	processedRows := 0
	successCount := 0
	errorCount := 0

	err = parser.ParseStream(func(rowNum int, row map[string]string) error {
		itemRef := row["item"]
		locationRef := row["location"]
		quantityStr := row["quantity"]

		if itemRef == "" {
			w.saveRowError(ctx, job.ID(), rowNum, strPtr("item"), "item is required", row)
			errorCount++
		} else if locationRef == "" {
			w.saveRowError(ctx, job.ID(), rowNum, strPtr("location"), "location is required", row)
			errorCount++
		} else {
			itm, itemOk := itemCache[strings.ToLower(itemRef)]
			loc, locOk := locationCache[strings.ToLower(locationRef)]

			if !itemOk {
				w.saveRowError(ctx, job.ID(), rowNum, strPtr("item"), fmt.Sprintf("item '%s' not found", itemRef), row)
				errorCount++
			} else if !locOk {
				w.saveRowError(ctx, job.ID(), rowNum, strPtr("location"), fmt.Sprintf("location '%s' not found", locationRef), row)
				errorCount++
			} else {
				quantity := 1
				if quantityStr != "" {
					if q, err := strconv.Atoi(quantityStr); err == nil && q > 0 {
						quantity = q
					}
				}

				var containerID *uuid.UUID
				if containerRef := row["container"]; containerRef != "" {
					if cont, ok := containerCache[strings.ToLower(containerRef)]; ok {
						id := cont.ID()
						containerID = &id
					}
				}

				condition := inventory.ConditionGood
				if condStr := strings.ToUpper(row["condition"]); condStr != "" {
					cond := inventory.Condition(condStr)
					if cond.IsValid() {
						condition = cond
					}
				}

				status := inventory.StatusAvailable
				if statusStr := strings.ToUpper(row["status"]); statusStr != "" {
					st := inventory.Status(statusStr)
					if st.IsValid() {
						status = st
					}
				}

				var purchasePrice *int
				if priceStr := row["purchase_price"]; priceStr != "" {
					if price, err := strconv.Atoi(priceStr); err == nil {
						purchasePrice = &price
					}
				}

				var dateAcquired *time.Time
				if dateStr := row["date_acquired"]; dateStr != "" {
					if t, err := time.Parse("2006-01-02", dateStr); err == nil {
						dateAcquired = &t
					}
				}

				_, err := inventoryService.Create(ctx, inventory.CreateInput{
					WorkspaceID:   job.WorkspaceID(),
					ItemID:        itm.ID(),
					LocationID:    loc.ID(),
					ContainerID:   containerID,
					Quantity:      quantity,
					Condition:     condition,
					Status:        status,
					DateAcquired:  dateAcquired,
					PurchasePrice: purchasePrice,
					CurrencyCode:  strPtrFromMap(row, "currency_code"),
					Notes:         strPtrFromMap(row, "notes"),
				})

				if err != nil {
					w.saveRowError(ctx, job.ID(), rowNum, nil, err.Error(), row)
					errorCount++
				} else {
					successCount++
				}
			}
		}

		processedRows++
		if processedRows%10 == 0 {
			job.UpdateProgress(processedRows, successCount, errorCount)
			w.saveJob(ctx, job)
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

	w.saveJob(ctx, job)
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

// saveJob persists import-job state, logging persistence failures instead of
// silently dropping them. Progress saves are best-effort by design (the next
// save typically supersedes), but failures must be visible in the logs.
func (w *ImportWorker) saveJob(ctx context.Context, job *importjob.ImportJob) {
	if err := w.importRepo.SaveJob(ctx, job); err != nil {
		log.Printf("Error saving import job %s: %v", job.ID(), err)
	}
}

// saveRowError records a per-row import error, logging (rather than ignoring)
// construction or persistence failures.
func (w *ImportWorker) saveRowError(ctx context.Context, jobID uuid.UUID, rowNum int, field *string, msg string, row map[string]string) {
	importError, err := importjob.NewImportError(jobID, rowNum, field, msg, stringMapToAnyMap(row))
	if err != nil {
		log.Printf("Error building import row error (job %s row %d): %v", jobID, rowNum, err)
		return
	}
	if err := w.importRepo.SaveError(ctx, importError); err != nil {
		log.Printf("Error saving import row error (job %s row %d): %v", jobID, rowNum, err)
	}
}

// failJob marks the import job failed, persists it, notifies subscribers, and
// returns the failure as an error for the queue-level retry path. Used when a
// job-level precondition (e.g. a lookup-cache load) fails — proceeding with an
// empty cache would mis-report every row as "not found".
func (w *ImportWorker) failJob(ctx context.Context, job *importjob.ImportJob, msg string) error {
	job.Fail(msg)
	w.saveJob(ctx, job)
	w.publishProgress(job, 100)
	return fmt.Errorf("%s", msg)
}

// findAllPages exhaustively pages through a FindByWorkspace-style lookup using
// the shared pagination clamp (MaxPageSize per round trip). The import worker
// uses it to build lookup caches: a single capped page would silently truncate
// caches in workspaces with more than shared.MaxPageSize rows (the bug behind
// spurious "location not found" errors on large imports).
func findAllPages[T any](ctx context.Context, find func(context.Context, shared.Pagination) ([]T, int, error)) ([]T, error) {
	var all []T
	for page := 1; ; page++ {
		p := shared.Pagination{Page: page, PageSize: shared.MaxPageSize}
		batch, _, err := find(ctx, p)
		if err != nil {
			return nil, err
		}
		all = append(all, batch...)
		if len(batch) < p.Limit() {
			return all, nil
		}
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
