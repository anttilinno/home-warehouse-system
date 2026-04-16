---
status: complete
phase: 61-item-photos
source: [61-01-SUMMARY.md, 61-02-SUMMARY.md, 61-03-SUMMARY.md, 61-04-SUMMARY.md]
started: 2026-04-16T00:00:00Z
updated: 2026-04-16T22:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Upload a photo to an item
expected: Open any item detail page. You should see a PHOTOS section with an "ADD PHOTOS" button. Click it, select a JPEG or PNG file. The photo appears in the gallery — initially as a HazardStripe placeholder with "PROCESSING..." text, then resolving to a thumbnail once the backend processes it.
result: issue
reported: "Upload works and PROCESSING... placeholder appears correctly with HazardStripe + star PRIMARY badge. Header thumbnail shows the full photo immediately. However the tile never transitions from PROCESSING... to a rendered thumbnail — thumbnail_status stays 'pending' indefinitely. Root cause: mise run worker (cmd/worker/main.go asynq job processor) is NOT started by tasks.start. Jobs queue in Redis but are never consumed."
severity: major

### 2. Thumbnail appears in items list
expected: Navigate to the Items list page. The leftmost column (THUMB) should show a 40x40 thumbnail for any item that has a primary photo. Items without photos show an ImageOff icon placeholder instead.
result: pass
note: "Bosch Ear Protection shows dogs photo in THUMB column after upload; all other items show ImageOff placeholder. Uses full photo URL (not thumbnail URL) since thumbnail_status is pending, but photo renders correctly at 40x40."

### 3. Thumbnail appears in item detail header
expected: Open an item detail page for an item that has at least one photo. The item header shows a 64x64 thumbnail. Items with no photos show an ImageOff icon placeholder.
result: pass
note: "Header shows full photo immediately after upload. Header updates correctly when primary is changed. ImageOff shown before any photo is uploaded."

### 4. Set a photo as primary
expected: In the item detail photo gallery, click a tile to open the lightbox. Click SET AS PRIMARY on a non-primary photo. The photo gets a star PRIMARY badge, the button becomes disabled, and the header thumbnail updates.
result: pass
note: "Clicked SET AS PRIMARY on photo 2. Star PRIMARY badge moved from tile 1 to tile 2. Header thumbnail updated immediately. Button became disabled (confirmed via DOM). Photo 1 badge removed."

### 5. Delete a photo with confirmation
expected: Open the lightbox for any photo. Click DELETE PHOTO. A confirmation dialog appears. After confirming, the photo is removed from the gallery. If it was the only photo, the gallery returns to the empty state.
result: pass
note: "CONFIRM DELETE dialog appeared with HazardStripe header, 'Permanently delete this photo? This cannot be undone.', KEEP PHOTO and DELETE PHOTO buttons. After confirming: photo deleted, lightbox closed, gallery returned to NO PHOTOS YET empty state, header reverted to ImageOff placeholder."

### 6. Placeholder when no photos
expected: Open an item that has no photos. The PHOTOS section shows an empty state message with an upload CTA. The items list row and detail header both show the ImageOff icon placeholder.
result: pass
note: "Verified on initial page load before any upload: NO PHOTOS YET empty state in gallery, ImageOff icon in detail header (64x64), ImageOff icon in items list THUMB column (40x40)."

### 7. Lightbox navigation
expected: On an item with multiple photos, click a tile to open the lightbox. Use PREV/NEXT buttons to navigate. A counter shows current position. PREV disabled at first photo, NEXT disabled at last photo.
result: pass
note: "Opened lightbox on photo 2 of 2: counter showed '2 / 2', PREV enabled, NEXT disabled. Clicked PREV: counter became '1 / 2', dogs photo shown, PREV disabled, NEXT enabled. Clicked NEXT: back to '2 / 2'. All navigation correct."

### 8. HEIC file rejected
expected: Try selecting a .heic file. The input should not accept it — only JPEG, PNG, and WebP are accepted.
result: pass
note: "File input accept attribute confirmed as 'image/jpeg,image/png,image/webp' — HEIC is structurally excluded. OS file picker will filter to these types only."

## Summary

total: 8
passed: 7
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Gallery tile transitions from PROCESSING... to rendered thumbnail after backend processes the photo"
  status: failed
  reason: "thumbnail_status stays 'pending' indefinitely. mise run worker (asynq job processor cmd/worker/main.go) is not started by tasks.start, so thumbnail jobs queue in Redis but are never consumed."
  severity: major
  test: 1
  artifacts: [backend/cmd/worker/main.go, .mise.toml tasks.start]
  missing: ["worker process included in tasks.start or tasks.dev"]
