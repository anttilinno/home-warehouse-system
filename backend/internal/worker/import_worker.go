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

func (w *ImportWorker) processLocationImport(ctx context.Context, job *importjob.ImportJob) error {
	parser := csvparser.NewCSVParser(job.FilePath())

	totalRows, err := parser.CountRows()
	if err != nil {
		job.Fail(fmt.Sprintf("Failed to count rows: %v", err))
		w.importRepo.SaveJob(ctx, job)
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
	existingLocations, _, _ := locationRepo.FindByWorkspace(ctx, job.WorkspaceID(), shared.Pagination{Page: 1, PageSize: 10000})
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
			importError, _ := importjob.NewImportError(job.ID(), rowNum, strPtr("name"), "name is required", stringMapToAnyMap(row))
			w.importRepo.SaveError(ctx, importError)
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
				importError, _ := importjob.NewImportError(job.ID(), rowNum, nil, err.Error(), stringMapToAnyMap(row))
				w.importRepo.SaveError(ctx, importError)
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

	w.importRepo.SaveJob(ctx, job)
	w.publishProgress(job, 100)
	return nil
}

func (w *ImportWorker) processContainerImport(ctx context.Context, job *importjob.ImportJob) error {
	parser := csvparser.NewCSVParser(job.FilePath())

	totalRows, err := parser.CountRows()
	if err != nil {
		job.Fail(fmt.Sprintf("Failed to count rows: %v", err))
		w.importRepo.SaveJob(ctx, job)
		return err
	}

	job.Start(totalRows)
	if err := w.importRepo.SaveJob(ctx, job); err != nil {
		return err
	}
	w.publishProgress(job, 0)

	locationRepo := postgres.NewLocationRepository(w.dbPool)
	containerRepo := postgres.NewContainerRepository(w.dbPool)
	containerService := container.NewService(containerRepo)

	// Build location cache for lookups
	existingLocations, _, _ := locationRepo.FindByWorkspace(ctx, job.WorkspaceID(), shared.Pagination{Page: 1, PageSize: 10000})
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
			importError, _ := importjob.NewImportError(job.ID(), rowNum, strPtr("name"), "name is required", stringMapToAnyMap(row))
			w.importRepo.SaveError(ctx, importError)
			errorCount++
		} else if locationRef == "" {
			importError, _ := importjob.NewImportError(job.ID(), rowNum, strPtr("location"), "location is required", stringMapToAnyMap(row))
			w.importRepo.SaveError(ctx, importError)
			errorCount++
		} else {
			loc, ok := locationCache[strings.ToLower(locationRef)]
			if !ok {
				importError, _ := importjob.NewImportError(job.ID(), rowNum, strPtr("location"), fmt.Sprintf("location '%s' not found", locationRef), stringMapToAnyMap(row))
				w.importRepo.SaveError(ctx, importError)
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
					importError, _ := importjob.NewImportError(job.ID(), rowNum, nil, err.Error(), stringMapToAnyMap(row))
					w.importRepo.SaveError(ctx, importError)
					errorCount++
				} else {
					successCount++
				}
			}
		}

		processedRows++
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

	w.importRepo.SaveJob(ctx, job)
	w.publishProgress(job, 100)
	return nil
}

func (w *ImportWorker) processCategoryImport(ctx context.Context, job *importjob.ImportJob) error {
	parser := csvparser.NewCSVParser(job.FilePath())

	totalRows, err := parser.CountRows()
	if err != nil {
		job.Fail(fmt.Sprintf("Failed to count rows: %v", err))
		w.importRepo.SaveJob(ctx, job)
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
	existingCategories, _ := categoryRepo.FindByWorkspace(ctx, job.WorkspaceID())
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
			importError, _ := importjob.NewImportError(job.ID(), rowNum, strPtr("name"), "name is required", stringMapToAnyMap(row))
			w.importRepo.SaveError(ctx, importError)
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
				importError, _ := importjob.NewImportError(job.ID(), rowNum, nil, err.Error(), stringMapToAnyMap(row))
				w.importRepo.SaveError(ctx, importError)
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

	w.importRepo.SaveJob(ctx, job)
	w.publishProgress(job, 100)
	return nil
}

func (w *ImportWorker) processBorrowerImport(ctx context.Context, job *importjob.ImportJob) error {
	parser := csvparser.NewCSVParser(job.FilePath())

	totalRows, err := parser.CountRows()
	if err != nil {
		job.Fail(fmt.Sprintf("Failed to count rows: %v", err))
		w.importRepo.SaveJob(ctx, job)
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
			importError, _ := importjob.NewImportError(job.ID(), rowNum, strPtr("name"), "name is required", stringMapToAnyMap(row))
			w.importRepo.SaveError(ctx, importError)
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
				importError, _ := importjob.NewImportError(job.ID(), rowNum, nil, err.Error(), stringMapToAnyMap(row))
				w.importRepo.SaveError(ctx, importError)
				errorCount++
			} else {
				successCount++
			}
		}

		processedRows++
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

	w.importRepo.SaveJob(ctx, job)
	w.publishProgress(job, 100)
	return nil
}

func (w *ImportWorker) processInventoryImport(ctx context.Context, job *importjob.ImportJob) error {
	parser := csvparser.NewCSVParser(job.FilePath())

	totalRows, err := parser.CountRows()
	if err != nil {
		job.Fail(fmt.Sprintf("Failed to count rows: %v", err))
		w.importRepo.SaveJob(ctx, job)
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
	inventoryService := inventory.NewService(inventoryRepo, movementService)

	// Build caches for lookups
	existingItems, _, _ := itemRepo.FindByWorkspace(ctx, job.WorkspaceID(), shared.Pagination{Page: 1, PageSize: 10000})
	itemCache := make(map[string]*item.Item)
	for _, itm := range existingItems {
		itemCache[strings.ToLower(itm.Name())] = itm
		itemCache[strings.ToLower(itm.SKU())] = itm
		if itm.ShortCode() != "" {
			itemCache[strings.ToLower(itm.ShortCode())] = itm
		}
	}

	existingLocations, _, _ := locationRepo.FindByWorkspace(ctx, job.WorkspaceID(), shared.Pagination{Page: 1, PageSize: 10000})
	locationCache := make(map[string]*location.Location)
	for _, loc := range existingLocations {
		locationCache[strings.ToLower(loc.Name())] = loc
		locationCache[strings.ToLower(loc.ShortCode())] = loc
	}

	existingContainers, _, _ := containerRepo.FindByWorkspace(ctx, job.WorkspaceID(), shared.Pagination{Page: 1, PageSize: 10000})
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
			importError, _ := importjob.NewImportError(job.ID(), rowNum, strPtr("item"), "item is required", stringMapToAnyMap(row))
			w.importRepo.SaveError(ctx, importError)
			errorCount++
		} else if locationRef == "" {
			importError, _ := importjob.NewImportError(job.ID(), rowNum, strPtr("location"), "location is required", stringMapToAnyMap(row))
			w.importRepo.SaveError(ctx, importError)
			errorCount++
		} else {
			itm, itemOk := itemCache[strings.ToLower(itemRef)]
			loc, locOk := locationCache[strings.ToLower(locationRef)]

			if !itemOk {
				importError, _ := importjob.NewImportError(job.ID(), rowNum, strPtr("item"), fmt.Sprintf("item '%s' not found", itemRef), stringMapToAnyMap(row))
				w.importRepo.SaveError(ctx, importError)
				errorCount++
			} else if !locOk {
				importError, _ := importjob.NewImportError(job.ID(), rowNum, strPtr("location"), fmt.Sprintf("location '%s' not found", locationRef), stringMapToAnyMap(row))
				w.importRepo.SaveError(ctx, importError)
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
					importError, _ := importjob.NewImportError(job.ID(), rowNum, nil, err.Error(), stringMapToAnyMap(row))
					w.importRepo.SaveError(ctx, importError)
					errorCount++
				} else {
					successCount++
				}
			}
		}

		processedRows++
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

	w.importRepo.SaveJob(ctx, job)
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
