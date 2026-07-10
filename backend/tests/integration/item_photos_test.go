//go:build integration
// +build integration

package integration

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Item photo coverage against the real router. Upload is a chi (non-Huma)
// multipart route backed by real storage + pure-Go image processing
// (disintegration/imaging, no external binary), so it is exercised end to end
// here rather than in a handler unit test. The rest (set-primary, caption,
// reorder, delete, FK cascade) are the Huma routes plus the ON DELETE CASCADE the
// item_photos -> items foreign key promises.
//
// Replaces the pre-v3 stub whose whole testEnv was unimplemented (every helper
// returned zero values behind a t.Skip). The viewer-cannot-upload case it also
// stubbed now lives in viewer_readonly_test.go, which covers every mutating role.

// jpegBytes returns a small but genuinely decodable JPEG. The upload service
// validates and reads dimensions via the image processor, so a fake header (what
// the old stub used) would be rejected.
func jpegBytes(t *testing.T) []byte {
	t.Helper()
	// Processor enforces a 100x100 minimum, so keep it above that.
	const dim = 120
	img := image.NewRGBA(image.Rect(0, 0, dim, dim))
	for y := 0; y < dim; y++ {
		for x := 0; x < dim; x++ {
			img.Set(x, y, color.RGBA{R: 200, G: 100, B: 50, A: 255})
		}
	}
	var buf bytes.Buffer
	require.NoError(t, jpeg.Encode(&buf, img, nil))
	return buf.Bytes()
}

// uploadPhoto posts a multipart photo to an item and returns the created photo.
// The part's Content-Type is set explicitly: the handler validates the file's
// declared MIME type, and multipart's default (application/octet-stream) would be
// rejected.
func uploadPhoto(t *testing.T, ts *TestServer, wsID, itemID uuid.UUID, caption string) PhotoResponse {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	hdr := make(textproto.MIMEHeader)
	hdr.Set("Content-Disposition", `form-data; name="photo"; filename="test.jpg"`)
	hdr.Set("Content-Type", "image/jpeg")
	part, err := writer.CreatePart(hdr)
	require.NoError(t, err)
	_, err = part.Write(jpegBytes(t))
	require.NoError(t, err)

	if caption != "" {
		require.NoError(t, writer.WriteField("caption", caption))
	}
	require.NoError(t, writer.Close())

	resp := ts.PostRaw(fmt.Sprintf("/workspaces/%s/items/%s/photos", wsID, itemID), body, writer.FormDataContentType())
	if resp.StatusCode != http.StatusCreated {
		buf := new(bytes.Buffer)
		_, _ = buf.ReadFrom(resp.Body)
		resp.Body.Close()
		t.Fatalf("upload: expected 201, got %d: %s", resp.StatusCode, buf.String())
	}
	return ParseResponse[PhotoResponse](t, resp)
}

// PhotoResponse mirrors the handler's response shape (the fields these tests read).
type PhotoResponse struct {
	ID           uuid.UUID `json:"id"`
	ItemID       uuid.UUID `json:"item_id"`
	DisplayOrder int32     `json:"display_order"`
	IsPrimary    bool      `json:"is_primary"`
	Caption      *string   `json:"caption"`
	URL          string    `json:"url"`
}

type photoList struct {
	Items []PhotoResponse `json:"items"`
}

// photoFixture spins up an owner-authenticated workspace with one item, into a
// server whose photo storage points at test temp dirs (never the repo tree).
func photoFixture(t *testing.T) (*TestServer, uuid.UUID, uuid.UUID) {
	t.Helper()

	// getUploadDir/getPhotoStorageDir read these at router construction.
	t.Setenv("PHOTO_UPLOAD_DIR", t.TempDir())
	t.Setenv("PHOTO_STORAGE_DIR", t.TempDir())

	ts := NewTestServer(t)
	ts.SetToken(ts.AuthHelper(t, "owner_photo_"+uuid.New().String()[:8]+"@example.com"))
	wsID := newOwnedWorkspace(t, ts, "photo")

	resp := ts.Post(fmt.Sprintf("/workspaces/%s/items", wsID), map[string]interface{}{
		"name": "Photographed Item", "sku": "PHO-" + uuid.New().String()[:6], "min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)
	itemID := ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp).ID

	return ts, wsID, itemID
}

func listPhotos(t *testing.T, ts *TestServer, wsID, itemID uuid.UUID) []PhotoResponse {
	t.Helper()
	resp := ts.Get(fmt.Sprintf("/workspaces/%s/items/%s/photos/list", wsID, itemID))
	RequireStatus(t, resp, http.StatusOK)
	return ParseResponse[photoList](t, resp).Items
}

func TestItemPhotos_UploadReturnsCreated(t *testing.T) {
	ts, wsID, itemID := photoFixture(t)

	photo := uploadPhoto(t, ts, wsID, itemID, "a caption")

	assert.NotEqual(t, uuid.Nil, photo.ID)
	assert.Equal(t, itemID, photo.ItemID)
	assert.NotEmpty(t, photo.URL)
	if assert.NotNil(t, photo.Caption) {
		assert.Equal(t, "a caption", *photo.Caption)
	}
	// The first photo of an item is its primary by default.
	assert.True(t, photo.IsPrimary, "first uploaded photo should be primary")

	require.Len(t, listPhotos(t, ts, wsID, itemID), 1)
}

func TestItemPhotos_SetPrimaryIsExclusive(t *testing.T) {
	ts, wsID, itemID := photoFixture(t)

	first := uploadPhoto(t, ts, wsID, itemID, "")
	second := uploadPhoto(t, ts, wsID, itemID, "")
	require.True(t, first.IsPrimary)
	require.False(t, second.IsPrimary)

	resp := ts.Put(fmt.Sprintf("/workspaces/%s/photos/%s/primary", wsID, second.ID), nil)
	RequireStatus(t, resp, http.StatusNoContent)
	resp.Body.Close()

	// Primary must move to the second photo and leave exactly one primary.
	primaries := map[uuid.UUID]bool{}
	for _, p := range listPhotos(t, ts, wsID, itemID) {
		primaries[p.ID] = p.IsPrimary
	}
	assert.False(t, primaries[first.ID], "old primary must be cleared")
	assert.True(t, primaries[second.ID], "new primary must be set")
}

func TestItemPhotos_UpdateCaption(t *testing.T) {
	ts, wsID, itemID := photoFixture(t)
	photo := uploadPhoto(t, ts, wsID, itemID, "before")

	newCaption := "after"
	resp := ts.Put(fmt.Sprintf("/workspaces/%s/photos/%s/caption", wsID, photo.ID), map[string]interface{}{
		"caption": newCaption,
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	got := listPhotos(t, ts, wsID, itemID)
	require.Len(t, got, 1)
	if assert.NotNil(t, got[0].Caption) {
		assert.Equal(t, "after", *got[0].Caption)
	}
}

func TestItemPhotos_Reorder(t *testing.T) {
	ts, wsID, itemID := photoFixture(t)
	first := uploadPhoto(t, ts, wsID, itemID, "")
	second := uploadPhoto(t, ts, wsID, itemID, "")

	// Put the second photo first.
	resp := ts.Put(fmt.Sprintf("/workspaces/%s/items/%s/photos/order", wsID, itemID), map[string]interface{}{
		"photo_ids": []uuid.UUID{second.ID, first.ID},
	})
	RequireStatus(t, resp, http.StatusNoContent)
	resp.Body.Close()

	order := map[uuid.UUID]int32{}
	for _, p := range listPhotos(t, ts, wsID, itemID) {
		order[p.ID] = p.DisplayOrder
	}
	assert.Less(t, order[second.ID], order[first.ID], "reordered photo should sort first")
}

func TestItemPhotos_Delete(t *testing.T) {
	ts, wsID, itemID := photoFixture(t)
	keep := uploadPhoto(t, ts, wsID, itemID, "")
	drop := uploadPhoto(t, ts, wsID, itemID, "")

	resp := ts.Delete(fmt.Sprintf("/workspaces/%s/photos/%s", wsID, drop.ID))
	RequireStatus(t, resp, http.StatusNoContent)
	resp.Body.Close()

	got := listPhotos(t, ts, wsID, itemID)
	require.Len(t, got, 1)
	assert.Equal(t, keep.ID, got[0].ID)
}

// TestItemPhotos_DeleteItemCascades pins the item_photos -> items ON DELETE CASCADE
// FK: deleting the parent item must remove its photo rows, not orphan them. The
// row absence is asserted straight against the DB rather than via GET /photos/{id},
// which currently maps not-found to 500 (a separate handler bug, out of scope here).
func TestItemPhotos_DeleteItemCascades(t *testing.T) {
	ts, wsID, itemID := photoFixture(t)
	photo := uploadPhoto(t, ts, wsID, itemID, "")

	var before int
	require.NoError(t, ts.Pool.QueryRow(t.Context(),
		`SELECT count(*) FROM warehouse.item_photos WHERE id = $1`, photo.ID).Scan(&before))
	require.Equal(t, 1, before, "photo row should exist before the item is deleted")

	resp := ts.Delete(fmt.Sprintf("/workspaces/%s/items/%s", wsID, itemID))
	RequireStatus(t, resp, http.StatusNoContent)
	resp.Body.Close()

	var after int
	require.NoError(t, ts.Pool.QueryRow(t.Context(),
		`SELECT count(*) FROM warehouse.item_photos WHERE id = $1`, photo.ID).Scan(&after))
	assert.Equal(t, 0, after, "deleting the item must cascade-delete its photo rows")
}
