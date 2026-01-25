-- migrate:up

-- Add thumbnail processing columns to item_photos table for async thumbnail generation
ALTER TABLE warehouse.item_photos
ADD COLUMN thumbnail_status VARCHAR(20) NOT NULL DEFAULT 'pending',
ADD COLUMN thumbnail_small_path VARCHAR(500),
ADD COLUMN thumbnail_medium_path VARCHAR(500),
ADD COLUMN thumbnail_large_path VARCHAR(500),
ADD COLUMN thumbnail_attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN thumbnail_error TEXT;

-- Add enum constraint for thumbnail status
ALTER TABLE warehouse.item_photos
ADD CONSTRAINT item_photos_thumbnail_status_check
CHECK (thumbnail_status IN ('pending', 'processing', 'complete', 'failed'));

-- Partial index for efficient job queue lookups
-- Only indexes photos that need processing
CREATE INDEX idx_item_photos_thumbnail_pending
ON warehouse.item_photos(thumbnail_status)
WHERE thumbnail_status IN ('pending', 'processing');

-- Migrate existing photos: set status to 'complete' and copy thumbnail_path to medium
-- for photos that already have thumbnails generated
UPDATE warehouse.item_photos
SET thumbnail_status = 'complete',
    thumbnail_medium_path = thumbnail_path
WHERE thumbnail_path IS NOT NULL AND thumbnail_path != '';

-- Add column comments
COMMENT ON COLUMN warehouse.item_photos.thumbnail_status IS
'Thumbnail generation status: pending (not started), processing (in queue), complete (ready), failed (max retries exceeded)';

COMMENT ON COLUMN warehouse.item_photos.thumbnail_small_path IS
'Path to 150px thumbnail (used for lists/grids)';

COMMENT ON COLUMN warehouse.item_photos.thumbnail_medium_path IS
'Path to 400px thumbnail (used for detail views)';

COMMENT ON COLUMN warehouse.item_photos.thumbnail_large_path IS
'Path to 800px thumbnail (used for lightbox/preview)';

COMMENT ON COLUMN warehouse.item_photos.thumbnail_attempts IS
'Number of thumbnail generation attempts (max 5 before marked failed)';

COMMENT ON COLUMN warehouse.item_photos.thumbnail_error IS
'Last error message if thumbnail generation failed';

-- migrate:down

-- Drop the index first
DROP INDEX IF EXISTS warehouse.idx_item_photos_thumbnail_pending;

-- Drop the constraint
ALTER TABLE warehouse.item_photos
DROP CONSTRAINT IF EXISTS item_photos_thumbnail_status_check;

-- Drop the new columns
ALTER TABLE warehouse.item_photos
DROP COLUMN IF EXISTS thumbnail_status,
DROP COLUMN IF EXISTS thumbnail_small_path,
DROP COLUMN IF EXISTS thumbnail_medium_path,
DROP COLUMN IF EXISTS thumbnail_large_path,
DROP COLUMN IF EXISTS thumbnail_attempts,
DROP COLUMN IF EXISTS thumbnail_error;
