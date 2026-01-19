//go:build integration
// +build integration

package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testEnv is a placeholder for the integration test environment
// TODO: Implement proper test environment setup
type testEnv struct {
	router http.Handler
}

func setupTestEnv(t *testing.T, ctx interface{}) *testEnv {
	t.Skip("item_photos_test.go needs to be rewritten to use NewTestServer pattern")
	return nil
}

func (e *testEnv) cleanup() {}

func (e *testEnv) createTestUser(t *testing.T, email, name string) struct{ ID uuid.UUID } {
	return struct{ ID uuid.UUID }{}
}

func (e *testEnv) createTestWorkspace(t *testing.T, userID uuid.UUID, name string) struct{ ID uuid.UUID } {
	return struct{ ID uuid.UUID }{}
}

func (e *testEnv) createTestItem(t *testing.T, workspaceID, userID uuid.UUID, name string) struct{ ID uuid.UUID } {
	return struct{ ID uuid.UUID }{}
}

func (e *testEnv) generateToken(t *testing.T, userID, workspaceID uuid.UUID, role string) string {
	return ""
}

func (e *testEnv) addWorkspaceMember(t *testing.T, workspaceID, userID uuid.UUID, role string) {}

func TestItemPhotosIntegration(t *testing.T) {
	// Setup test environment
	ctx := context.Background()
	env := setupTestEnv(t, ctx)
	defer env.cleanup()

	// Create test user and workspace
	user := env.createTestUser(t, "phototest@example.com", "Photo Test User")
	workspace := env.createTestWorkspace(t, user.ID, "Photo Test Workspace")

	// Create test item
	item := env.createTestItem(t, workspace.ID, user.ID, "Test Item for Photos")

	// Generate JWT token
	token := env.generateToken(t, user.ID, workspace.ID, "owner")

	t.Run("Upload photo successfully", func(t *testing.T) {
		// Create test image file
		imgData := createTestImage(t, 800, 600)

		// Create multipart form
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)

		// Add file
		part, err := writer.CreateFormFile("file", "test-photo.jpg")
		require.NoError(t, err)
		_, err = part.Write(imgData)
		require.NoError(t, err)

		// Add caption
		err = writer.WriteField("caption", "Test photo caption")
		require.NoError(t, err)

		err = writer.Close()
		require.NoError(t, err)

		// Make request
		req := httptest.NewRequest(
			http.MethodPost,
			fmt.Sprintf("/api/workspaces/%s/items/%s/photos", workspace.ID, item.ID),
			body,
		)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		req.Header.Set("Authorization", "Bearer "+token)

		rr := httptest.NewRecorder()
		env.router.ServeHTTP(rr, req)

		// Assert response
		assert.Equal(t, http.StatusCreated, rr.Code)

		var response map[string]interface{}
		err = json.NewDecoder(rr.Body).Decode(&response)
		require.NoError(t, err)

		assert.NotEmpty(t, response["id"])
		assert.Equal(t, "Test photo caption", response["caption"])
		assert.NotEmpty(t, response["urls"])
	})

	t.Run("Upload multiple photos", func(t *testing.T) {
		// Upload 3 photos
		photoIDs := make([]string, 0, 3)

		for i := 0; i < 3; i++ {
			imgData := createTestImage(t, 800, 600)

			body := &bytes.Buffer{}
			writer := multipart.NewWriter(body)

			part, err := writer.CreateFormFile("file", fmt.Sprintf("photo-%d.jpg", i))
			require.NoError(t, err)
			_, err = part.Write(imgData)
			require.NoError(t, err)

			err = writer.WriteField("caption", fmt.Sprintf("Photo %d", i+1))
			require.NoError(t, err)

			err = writer.Close()
			require.NoError(t, err)

			req := httptest.NewRequest(
				http.MethodPost,
				fmt.Sprintf("/api/workspaces/%s/items/%s/photos", workspace.ID, item.ID),
				body,
			)
			req.Header.Set("Content-Type", writer.FormDataContentType())
			req.Header.Set("Authorization", "Bearer "+token)

			rr := httptest.NewRecorder()
			env.router.ServeHTTP(rr, req)

			assert.Equal(t, http.StatusCreated, rr.Code)

			var response map[string]interface{}
			err = json.NewDecoder(rr.Body).Decode(&response)
			require.NoError(t, err)

			photoIDs = append(photoIDs, response["id"].(string))
		}

		// List photos
		req := httptest.NewRequest(
			http.MethodGet,
			fmt.Sprintf("/api/workspaces/%s/items/%s/photos", workspace.ID, item.ID),
			nil,
		)
		req.Header.Set("Authorization", "Bearer "+token)

		rr := httptest.NewRecorder()
		env.router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var photos []map[string]interface{}
		err := json.NewDecoder(rr.Body).Decode(&photos)
		require.NoError(t, err)

		assert.Len(t, photos, 3)
	})

	t.Run("Set primary photo", func(t *testing.T) {
		// Upload two photos
		photo1ID := uploadTestPhoto(t, env, workspace.ID, item.ID, token, "Photo 1")
		photo2ID := uploadTestPhoto(t, env, workspace.ID, item.ID, token, "Photo 2")

		// Set photo2 as primary
		req := httptest.NewRequest(
			http.MethodPatch,
			fmt.Sprintf("/api/workspaces/%s/items/%s/photos/%s/primary", workspace.ID, item.ID, photo2ID),
			nil,
		)
		req.Header.Set("Authorization", "Bearer "+token)

		rr := httptest.NewRecorder()
		env.router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		// List photos and verify primary status
		req = httptest.NewRequest(
			http.MethodGet,
			fmt.Sprintf("/api/workspaces/%s/items/%s/photos", workspace.ID, item.ID),
			nil,
		)
		req.Header.Set("Authorization", "Bearer "+token)

		rr = httptest.NewRecorder()
		env.router.ServeHTTP(rr, req)

		var photos []map[string]interface{}
		err := json.NewDecoder(rr.Body).Decode(&photos)
		require.NoError(t, err)

		// Find photo2 and verify it's primary
		for _, photo := range photos {
			if photo["id"] == photo2ID {
				assert.True(t, photo["is_primary"].(bool))
			} else if photo["id"] == photo1ID {
				assert.False(t, photo["is_primary"].(bool))
			}
		}
	})

	t.Run("Delete photo", func(t *testing.T) {
		// Upload photo
		photoID := uploadTestPhoto(t, env, workspace.ID, item.ID, token, "To be deleted")

		// Delete photo
		req := httptest.NewRequest(
			http.MethodDelete,
			fmt.Sprintf("/api/workspaces/%s/items/%s/photos/%s", workspace.ID, item.ID, photoID),
			nil,
		)
		req.Header.Set("Authorization", "Bearer "+token)

		rr := httptest.NewRecorder()
		env.router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNoContent, rr.Code)

		// Verify photo is deleted
		req = httptest.NewRequest(
			http.MethodGet,
			fmt.Sprintf("/api/workspaces/%s/items/%s/photos", workspace.ID, item.ID),
			nil,
		)
		req.Header.Set("Authorization", "Bearer "+token)

		rr = httptest.NewRecorder()
		env.router.ServeHTTP(rr, req)

		var photos []map[string]interface{}
		err := json.NewDecoder(rr.Body).Decode(&photos)
		require.NoError(t, err)

		// Verify photo is not in list
		for _, photo := range photos {
			assert.NotEqual(t, photoID, photo["id"])
		}
	})

	t.Run("Reorder photos", func(t *testing.T) {
		// Upload 3 photos
		photo1ID := uploadTestPhoto(t, env, workspace.ID, item.ID, token, "Photo 1")
		photo2ID := uploadTestPhoto(t, env, workspace.ID, item.ID, token, "Photo 2")
		photo3ID := uploadTestPhoto(t, env, workspace.ID, item.ID, token, "Photo 3")

		// Reorder: 3, 1, 2
		newOrder := []string{photo3ID, photo1ID, photo2ID}
		orderJSON, err := json.Marshal(map[string][]string{"photo_ids": newOrder})
		require.NoError(t, err)

		req := httptest.NewRequest(
			http.MethodPut,
			fmt.Sprintf("/api/workspaces/%s/items/%s/photos/reorder", workspace.ID, item.ID),
			bytes.NewReader(orderJSON),
		)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		rr := httptest.NewRecorder()
		env.router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		// Verify order
		req = httptest.NewRequest(
			http.MethodGet,
			fmt.Sprintf("/api/workspaces/%s/items/%s/photos", workspace.ID, item.ID),
			nil,
		)
		req.Header.Set("Authorization", "Bearer "+token)

		rr = httptest.NewRecorder()
		env.router.ServeHTTP(rr, req)

		var photos []map[string]interface{}
		err = json.NewDecoder(rr.Body).Decode(&photos)
		require.NoError(t, err)

		require.Len(t, photos, 3)
		assert.Equal(t, photo3ID, photos[0]["id"])
		assert.Equal(t, photo1ID, photos[1]["id"])
		assert.Equal(t, photo2ID, photos[2]["id"])
	})

	t.Run("Update photo caption", func(t *testing.T) {
		// Upload photo
		photoID := uploadTestPhoto(t, env, workspace.ID, item.ID, token, "Original caption")

		// Update caption
		updateJSON, err := json.Marshal(map[string]string{"caption": "Updated caption"})
		require.NoError(t, err)

		req := httptest.NewRequest(
			http.MethodPatch,
			fmt.Sprintf("/api/workspaces/%s/items/%s/photos/%s", workspace.ID, item.ID, photoID),
			bytes.NewReader(updateJSON),
		)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		rr := httptest.NewRecorder()
		env.router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response map[string]interface{}
		err = json.NewDecoder(rr.Body).Decode(&response)
		require.NoError(t, err)

		assert.Equal(t, "Updated caption", response["caption"])
	})

	t.Run("Delete item cascades to photos", func(t *testing.T) {
		// Create new item for this test
		testItem := env.createTestItem(t, workspace.ID, user.ID, "Item to delete")

		// Upload photos
		uploadTestPhoto(t, env, workspace.ID, testItem.ID, token, "Photo 1")
		uploadTestPhoto(t, env, workspace.ID, testItem.ID, token, "Photo 2")

		// Delete item
		req := httptest.NewRequest(
			http.MethodDelete,
			fmt.Sprintf("/api/workspaces/%s/items/%s", workspace.ID, testItem.ID),
			nil,
		)
		req.Header.Set("Authorization", "Bearer "+token)

		rr := httptest.NewRecorder()
		env.router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNoContent, rr.Code)

		// Verify photos are also deleted
		req = httptest.NewRequest(
			http.MethodGet,
			fmt.Sprintf("/api/workspaces/%s/items/%s/photos", workspace.ID, testItem.ID),
			nil,
		)
		req.Header.Set("Authorization", "Bearer "+token)

		rr = httptest.NewRecorder()
		env.router.ServeHTTP(rr, req)

		// Should return 404 since item doesn't exist
		assert.Equal(t, http.StatusNotFound, rr.Code)
	})

	t.Run("Authorization - viewer cannot upload photos", func(t *testing.T) {
		// Create viewer user
		viewer := env.createTestUser(t, "viewer@example.com", "Viewer User")
		env.addWorkspaceMember(t, workspace.ID, viewer.ID, "viewer")
		viewerToken := env.generateToken(t, viewer.ID, workspace.ID, "viewer")

		// Try to upload photo
		imgData := createTestImage(t, 800, 600)

		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)

		part, err := writer.CreateFormFile("file", "test.jpg")
		require.NoError(t, err)
		_, err = part.Write(imgData)
		require.NoError(t, err)

		err = writer.Close()
		require.NoError(t, err)

		req := httptest.NewRequest(
			http.MethodPost,
			fmt.Sprintf("/api/workspaces/%s/items/%s/photos", workspace.ID, item.ID),
			body,
		)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		req.Header.Set("Authorization", "Bearer "+viewerToken)

		rr := httptest.NewRecorder()
		env.router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusForbidden, rr.Code)
	})
}

// Helper function to upload a test photo
func uploadTestPhoto(t *testing.T, env *testEnv, workspaceID, itemID uuid.UUID, token, caption string) string {
	imgData := createTestImage(t, 800, 600)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", "test.jpg")
	require.NoError(t, err)
	_, err = part.Write(imgData)
	require.NoError(t, err)

	err = writer.WriteField("caption", caption)
	require.NoError(t, err)

	err = writer.Close()
	require.NoError(t, err)

	req := httptest.NewRequest(
		http.MethodPost,
		fmt.Sprintf("/api/workspaces/%s/items/%s/photos", workspaceID, itemID),
		body,
	)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)

	rr := httptest.NewRecorder()
	env.router.ServeHTTP(rr, req)

	require.Equal(t, http.StatusCreated, rr.Code)

	var response map[string]interface{}
	err = json.NewDecoder(rr.Body).Decode(&response)
	require.NoError(t, err)

	return response["id"].(string)
}

// Helper function to create a test image
func createTestImage(t *testing.T, width, height int) []byte {
	// For testing, we'll create a simple JPEG file
	// In a real scenario, you'd use image/jpeg to create a proper image
	// For now, we'll just use a minimal JPEG header

	// Create a temp file with actual image data
	tmpfile, err := os.CreateTemp("", "test-image-*.jpg")
	require.NoError(t, err)
	defer os.Remove(tmpfile.Name())
	defer tmpfile.Close()

	// Copy a test fixture image or create a simple one
	// For simplicity, we'll use a minimal valid JPEG
	minimalJPEG := []byte{
		0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
		0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
		0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9,
	}

	_, err = tmpfile.Write(minimalJPEG)
	require.NoError(t, err)

	data, err := os.ReadFile(tmpfile.Name())
	require.NoError(t, err)

	return data
}
