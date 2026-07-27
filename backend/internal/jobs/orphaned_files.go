package jobs

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/infra/storage"
)

// Deleting an attachment or a location photo drops the LINK row and leaves the
// warehouse.files row — and its bytes on disk — behind. That is deliberate at
// the request path (a delete should not block on storage I/O, and the same file
// row could in principle be linked from more than one place), which makes the
// bytes nobody's responsibility until something sweeps them.
//
// This is that sweep. It is a sweep rather than a refcount because today every
// link table points at a file exactly once: counting would mean a schema change
// and a write-path invariant to maintain, where a periodic scan needs neither
// and is self-correcting if a link is ever deleted out-of-band.

// OrphanedFilesGraceHours is how old a file row must be before the sweep will
// consider it. An upload INSERTs the file row first and its link row second, so
// a sweep racing an in-progress upload would delete a perfectly live file. The
// grace period is what makes that impossible in practice — it must comfortably
// exceed the longest plausible upload, not merely the average one.
const OrphanedFilesGraceHours = 24

// OrphanedFilesBatchSize bounds one run. A sweep that has fallen behind catches
// up over several runs rather than holding a long transaction and a large
// result set in memory.
const OrphanedFilesBatchSize = 500

// Every table that references warehouse.files. Keep in step with the file_id
// foreign keys — a table missing from this list makes the sweep delete files
// that are still linked.
const selectOrphanedFilesSQL = `
SELECT f.id, f.workspace_id, COALESCE(f.storage_key, '')
  FROM warehouse.files f
 WHERE f.created_at < $1
   AND NOT EXISTS (SELECT 1 FROM warehouse.attachments a WHERE a.file_id = f.id)
   AND NOT EXISTS (SELECT 1 FROM warehouse.repair_attachments ra WHERE ra.file_id = f.id)
   AND NOT EXISTS (SELECT 1 FROM warehouse.location_photos lp WHERE lp.file_id = f.id)
 LIMIT $2`

const deleteFileRowSQL = `DELETE FROM warehouse.files WHERE id = $1 AND workspace_id = $2`

// OrphanedFilesProcessor removes warehouse.files rows that no link table points
// at any more, together with their bytes.
type OrphanedFilesProcessor struct {
	pool    *pgxpool.Pool
	storage storage.Storage
	// grace is overridable so a test does not have to fabricate day-old rows.
	grace time.Duration
}

func NewOrphanedFilesProcessor(
	pool *pgxpool.Pool,
	store storage.Storage,
) *OrphanedFilesProcessor {
	return &OrphanedFilesProcessor{
		pool:    pool,
		storage: store,
		grace:   OrphanedFilesGraceHours * time.Hour,
	}
}

type orphanedFile struct {
	id          uuid.UUID
	workspaceID uuid.UUID
	storageKey  string
}

// ProcessTask sweeps one batch of orphaned files.
func (p *OrphanedFilesProcessor) ProcessTask(ctx context.Context, _ *asynq.Task) error {
	cutoff := time.Now().Add(-p.grace)

	rows, err := p.pool.Query(ctx, selectOrphanedFilesSQL, cutoff, OrphanedFilesBatchSize)
	if err != nil {
		return fmt.Errorf("failed to select orphaned files: %w", err)
	}
	orphans := make([]orphanedFile, 0, OrphanedFilesBatchSize)
	for rows.Next() {
		var f orphanedFile
		if err := rows.Scan(&f.id, &f.workspaceID, &f.storageKey); err != nil {
			rows.Close()
			return fmt.Errorf("failed to scan orphaned file: %w", err)
		}
		orphans = append(orphans, f)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return fmt.Errorf("failed to read orphaned files: %w", err)
	}

	if len(orphans) == 0 {
		return nil
	}

	deleted := 0
	for _, f := range orphans {
		// Bytes FIRST, row second. Get it the other way round and a failure
		// between the two strands the bytes with nothing left pointing at
		// them — exactly the leak this job exists to clean up. This order's
		// failure mode is a row that survives to the next run instead.
		if f.storageKey != "" {
			if err := p.storage.Delete(ctx, f.storageKey); err != nil &&
				!errors.Is(err, storage.ErrFileNotFound) {
				// Already-missing bytes are fine — the row still needs to go.
				// Anything else: leave the row so the next run retries.
				log.Printf("orphaned-file sweep: failed to delete bytes %q: %v", f.storageKey, err)
				continue
			}
		}
		if _, err := p.pool.Exec(ctx, deleteFileRowSQL, f.id, f.workspaceID); err != nil {
			log.Printf("orphaned-file sweep: failed to delete file row %s: %v", f.id, err)
			continue
		}
		deleted++
	}

	log.Printf("orphaned-file sweep: removed %d of %d candidate files", deleted, len(orphans))
	return nil
}

// NewCleanupOrphanedFilesTask creates a task to sweep unreferenced files.
func NewCleanupOrphanedFilesTask() *asynq.Task {
	return asynq.NewTask(TypeCleanupOrphanedFiles, nil)
}
