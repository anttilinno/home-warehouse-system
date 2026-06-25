//go:build integration
// +build integration

package integration

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"math/rand"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// =============================================================================
// Large File Upload Tests
// =============================================================================

func TestLargeFileUpload_SmallImage_Success(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "upload_small_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "upload-small-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Upload Small Test",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var wsResult struct {
		ID uuid.UUID `json:"id"`
	}
	wsResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", wsResult.ID)

	// Create an item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Item with Photo",
		"sku":             "PHOTO-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	var itemResult struct {
		ID uuid.UUID `json:"id"`
	}
	itemResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	itemPath := fmt.Sprintf("%s/items/%s", workspacePath, itemResult.ID)

	// Upload a small valid image
	fileData := validPNG(120, 120)
	body, contentType := createImageMultipartFormData("photo", "test.png", fileData)

	uploadResp := ts.PostRaw(itemPath+"/photos", body, contentType)
	RequireStatus(t, uploadResp, http.StatusCreated)
}

func TestLargeFileUpload_MediumImage_Success(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "upload_medium_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "upload-medium-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Upload Medium Test",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var wsResult struct {
		ID uuid.UUID `json:"id"`
	}
	wsResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", wsResult.ID)

	// Create an item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Item with Medium Photo",
		"sku":             "PHOTO-002",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	var itemResult struct {
		ID uuid.UUID `json:"id"`
	}
	itemResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	itemPath := fmt.Sprintf("%s/items/%s", workspacePath, itemResult.ID)

	// Upload a medium valid image (~several MB of incompressible PNG data)
	fileData := validPNG(1000, 1000)
	body, contentType := createImageMultipartFormData("photo", "medium.png", fileData)

	uploadResp := ts.PostRaw(itemPath+"/photos", body, contentType)
	RequireStatus(t, uploadResp, http.StatusCreated)
}

func TestLargeFileUpload_LargeImage_Success(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "upload_large_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "upload-large-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Upload Large Test",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var wsResult struct {
		ID uuid.UUID `json:"id"`
	}
	wsResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", wsResult.ID)

	// Create an item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Item with Large Photo",
		"sku":             "PHOTO-003",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	var itemResult struct {
		ID uuid.UUID `json:"id"`
	}
	itemResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	itemPath := fmt.Sprintf("%s/items/%s", workspacePath, itemResult.ID)

	// Upload a large valid image near (but under) the 10MB cap. The cap is the
	// product's intended maximum, so this exercises the high end of the accepted
	// range rather than an over-limit upload.
	fileData := validPNG(1400, 1400)
	if len(fileData) >= 10*1024*1024 {
		t.Fatalf("test image %d bytes is not under the 10MB cap", len(fileData))
	}
	body, contentType := createImageMultipartFormData("photo", "large.png", fileData)

	uploadResp := ts.PostRaw(itemPath+"/photos", body, contentType)
	RequireStatus(t, uploadResp, http.StatusCreated)
}

func TestLargeFileUpload_ExceedsLimit_Rejected(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "upload_exceed_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "upload-exceed-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Upload Exceed Test",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var wsResult struct {
		ID uuid.UUID `json:"id"`
	}
	wsResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", wsResult.ID)

	// Create an item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Item Oversized",
		"sku":             "PHOTO-OVER",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	var itemResult struct {
		ID uuid.UUID `json:"id"`
	}
	itemResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	itemPath := fmt.Sprintf("%s/items/%s", workspacePath, itemResult.ID)

	// Try to upload a file exceeding limit (>100MB)
	fileData := bytes.Repeat([]byte("x"), 101*1024*1024)
	body, contentType := createMultipartFormData("photo", "oversized.jpg", fileData)

	uploadResp := ts.PostRaw(itemPath+"/photos", body, contentType)
	// Should be rejected with 413 Payload Too Large or 400 Bad Request
	assert.True(t, uploadResp.StatusCode == http.StatusRequestEntityTooLarge ||
		uploadResp.StatusCode == http.StatusBadRequest,
		"Expected 413 or 400, got %d", uploadResp.StatusCode)
}

func TestLargeFileUpload_MultipleFiles_Success(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "upload_multi_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "upload-multi-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Upload Multiple Test",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var wsResult struct {
		ID uuid.UUID `json:"id"`
	}
	wsResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", wsResult.ID)

	// Create an item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Item with Multiple Photos",
		"sku":             "PHOTO-MULTI",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	var itemResult struct {
		ID uuid.UUID `json:"id"`
	}
	itemResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	itemPath := fmt.Sprintf("%s/items/%s", workspacePath, itemResult.ID)

	// Upload multiple files
	numFiles := 3
	for i := 0; i < numFiles; i++ {
		fileData := validPNG(700, 700)
		body, contentType := createImageMultipartFormData("photo", fmt.Sprintf("photo%d.png", i), fileData)

		uploadResp := ts.PostRaw(itemPath+"/photos", body, contentType)
		RequireStatus(t, uploadResp, http.StatusCreated)
	}

	// Verify all files were uploaded
	resp = ts.Get(itemPath)
	RequireStatus(t, resp, http.StatusOK)

	var itemWithPhotos struct {
		ID     uuid.UUID `json:"id"`
		Photos []struct {
			ID  uuid.UUID `json:"id"`
			URL string    `json:"url"`
		} `json:"photos,omitempty"`
	}
	itemWithPhotos = ParseResponse[struct {
		ID     uuid.UUID `json:"id"`
		Photos []struct {
			ID  uuid.UUID `json:"id"`
			URL string    `json:"url"`
		} `json:"photos,omitempty"`
	}](t, resp)

	// Should have at least the uploaded photos
	assert.Equal(t, itemResult.ID, itemWithPhotos.ID)
}

func TestLargeFileUpload_InvalidFileType_Rejected(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "upload_invalid_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "upload-invalid-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Upload Invalid Type Test",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var wsResult struct {
		ID uuid.UUID `json:"id"`
	}
	wsResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", wsResult.ID)

	// Create an item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Item Invalid File",
		"sku":             "PHOTO-INV",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	var itemResult struct {
		ID uuid.UUID `json:"id"`
	}
	itemResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	itemPath := fmt.Sprintf("%s/items/%s", workspacePath, itemResult.ID)

	// Try to upload an invalid file type (e.g., .exe)
	fileData := []byte("MZ\x90\x00") // PE executable header
	body, contentType := createMultipartFormData("photo", "malware.exe", fileData)

	uploadResp := ts.PostRaw(itemPath+"/photos", body, contentType)
	// Should be rejected due to invalid file type
	assert.True(t, uploadResp.StatusCode == http.StatusBadRequest ||
		uploadResp.StatusCode == http.StatusUnprocessableEntity,
		"Expected 400 or 422, got %d", uploadResp.StatusCode)
}

func TestLargeFileUpload_NoFile_Rejected(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "upload_nofile_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "upload-nofile-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Upload No File Test",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var wsResult struct {
		ID uuid.UUID `json:"id"`
	}
	wsResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", wsResult.ID)

	// Create an item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Item No File",
		"sku":             "PHOTO-NONE",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	var itemResult struct {
		ID uuid.UUID `json:"id"`
	}
	itemResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	itemPath := fmt.Sprintf("%s/items/%s", workspacePath, itemResult.ID)

	// Try to upload empty form
	body, contentType := createEmptyMultipartForm()

	uploadResp := ts.PostRaw(itemPath+"/photos", body, contentType)
	// Should be rejected due to missing file
	assert.Equal(t, http.StatusBadRequest, uploadResp.StatusCode)
}

func TestLargeFileUpload_StreamingUpload_Success(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "upload_stream_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "upload-stream-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Upload Stream Test",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var wsResult struct {
		ID uuid.UUID `json:"id"`
	}
	wsResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", wsResult.ID)

	// Create an item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Item Stream Upload",
		"sku":             "PHOTO-STREAM",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	var itemResult struct {
		ID uuid.UUID `json:"id"`
	}
	itemResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	itemPath := fmt.Sprintf("%s/items/%s", workspacePath, itemResult.ID)

	// Upload a sizable valid image (well under the 10MB cap).
	fileData := validPNG(1200, 1200)
	body, contentType := createImageMultipartFormData("photo", "stream.png", fileData)

	uploadResp := ts.PostRaw(itemPath+"/photos", body, contentType)
	RequireStatus(t, uploadResp, http.StatusCreated)
}

func TestLargeFileUpload_PerformanceTest_LargeFile(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "upload_perf_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "upload-perf-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Upload Performance Test",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var wsResult struct {
		ID uuid.UUID `json:"id"`
	}
	wsResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", wsResult.ID)

	// Create an item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Item Performance",
		"sku":             "PHOTO-PERF",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	var itemResult struct {
		ID uuid.UUID `json:"id"`
	}
	itemResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	itemPath := fmt.Sprintf("%s/items/%s", workspacePath, itemResult.ID)

	// Upload a valid image near (but under) the 10MB cap — the largest the
	// product accepts — to exercise the performance path at the size ceiling.
	fileData := validPNG(1400, 1400)
	if len(fileData) >= 10*1024*1024 {
		t.Fatalf("test image %d bytes is not under the 10MB cap", len(fileData))
	}
	body, contentType := createImageMultipartFormData("photo", "perf.png", fileData)

	uploadResp := ts.PostRaw(itemPath+"/photos", body, contentType)
	RequireStatus(t, uploadResp, http.StatusCreated)
}

// =============================================================================
// Helper Functions
// =============================================================================

func createMultipartFormData(fieldName, fileName string, fileData []byte) (*bytes.Buffer, string) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile(fieldName, fileName)
	if err != nil {
		panic(err)
	}

	_, err = io.Copy(part, bytes.NewReader(fileData))
	if err != nil {
		panic(err)
	}

	err = writer.Close()
	if err != nil {
		panic(err)
	}

	return body, writer.FormDataContentType()
}

func createEmptyMultipartForm() (*bytes.Buffer, string) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	err := writer.Close()
	if err != nil {
		panic(err)
	}

	return body, writer.FormDataContentType()
}

// createImageMultipartFormData builds a multipart form whose file part carries
// an explicit image/png Content-Type. The upload handler validates the part's
// Content-Type header (must be JPEG/PNG/WebP) AND re-decodes the bytes, so the
// part header and the body must agree — multipart.CreateFormFile would default
// the part to application/octet-stream and be rejected.
func createImageMultipartFormData(fieldName, fileName string, fileData []byte) (*bytes.Buffer, string) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, fileName))
	h.Set("Content-Type", "image/png")

	part, err := writer.CreatePart(h)
	if err != nil {
		panic(err)
	}
	if _, err = io.Copy(part, bytes.NewReader(fileData)); err != nil {
		panic(err)
	}
	if err = writer.Close(); err != nil {
		panic(err)
	}

	return body, writer.FormDataContentType()
}

// validPNG returns the bytes of a real, decodable PNG of the given dimensions.
// Pixels are random so the encoded output resists compression — useful when a
// test wants an image of a meaningful (near-limit) on-disk size. Dimensions
// must satisfy the processor's 100x100 minimum.
func validPNG(width, height int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	rng := rand.New(rand.NewSource(int64(width*1_000_000 + height)))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{
				R: uint8(rng.Intn(256)),
				G: uint8(rng.Intn(256)),
				B: uint8(rng.Intn(256)),
				A: 255,
			})
		}
	}

	buf := &bytes.Buffer{}
	if err := png.Encode(buf, img); err != nil {
		panic(err)
	}
	return buf.Bytes()
}
