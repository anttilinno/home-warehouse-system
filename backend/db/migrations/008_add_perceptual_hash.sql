-- migrate:up

-- Add perceptual hash column for duplicate photo detection
-- Uses dHash (difference hash) - a 64-bit integer for fast similarity comparison
ALTER TABLE warehouse.item_photos
ADD COLUMN perceptual_hash BIGINT;

-- Index for efficient hash lookups (only for photos with hashes)
CREATE INDEX idx_item_photos_perceptual_hash
ON warehouse.item_photos(perceptual_hash)
WHERE perceptual_hash IS NOT NULL;

-- Combined index for duplicate detection within a workspace
CREATE INDEX idx_item_photos_workspace_hash
ON warehouse.item_photos(workspace_id, perceptual_hash)
WHERE perceptual_hash IS NOT NULL;

COMMENT ON COLUMN warehouse.item_photos.perceptual_hash IS
'64-bit difference hash (dHash) for duplicate detection. Similar images have similar hashes with small Hamming distance.';

-- migrate:down

DROP INDEX IF EXISTS warehouse.idx_item_photos_workspace_hash;
DROP INDEX IF EXISTS warehouse.idx_item_photos_perceptual_hash;

ALTER TABLE warehouse.item_photos
DROP COLUMN IF EXISTS perceptual_hash;
