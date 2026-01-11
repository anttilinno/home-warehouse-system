//go:build integration
// +build integration

package integration

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// =============================================================================
// OpenAPI Documentation Tests
// =============================================================================

func TestOpenAPIEndpoint(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Get("/openapi.json")
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	resp.Body.Close()

	// Verify it's valid JSON
	var openAPI map[string]interface{}
	err = json.Unmarshal(body, &openAPI)
	require.NoError(t, err)

	// Verify OpenAPI version
	openapi, ok := openAPI["openapi"].(string)
	require.True(t, ok)
	assert.True(t, strings.HasPrefix(openapi, "3."))

	// Verify info section
	info, ok := openAPI["info"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "Home Warehouse API", info["title"])
	assert.Equal(t, "1.0.0", info["version"])

	// Verify paths exist
	paths, ok := openAPI["paths"].(map[string]interface{})
	require.True(t, ok)
	assert.Greater(t, len(paths), 0)

	// Verify some key endpoints exist
	_, hasHealth := paths["/health"]
	assert.True(t, hasHealth, "should have /health endpoint")

	_, hasAuthRegister := paths["/auth/register"]
	assert.True(t, hasAuthRegister, "should have /auth/register endpoint")

	_, hasAuthLogin := paths["/auth/login"]
	assert.True(t, hasAuthLogin, "should have /auth/login endpoint")
}

func TestDocsEndpoint(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Get("/docs")
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	resp.Body.Close()

	// Should return HTML
	contentType := resp.Header.Get("Content-Type")
	assert.True(t, strings.Contains(contentType, "text/html"), "should return HTML content")

	// Should contain the OpenAPI reference
	bodyStr := string(body)
	assert.True(t, strings.Contains(bodyStr, "openapi"), "should reference OpenAPI spec")
}

func TestRedocEndpoint(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Get("/redoc")
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	resp.Body.Close()

	// Should return HTML
	contentType := resp.Header.Get("Content-Type")
	assert.True(t, strings.Contains(contentType, "text/html"), "should return HTML content")

	// Should contain Redoc reference
	bodyStr := string(body)
	assert.True(t, strings.Contains(bodyStr, "redoc"), "should contain Redoc")
	assert.True(t, strings.Contains(bodyStr, "/openapi.json"), "should reference OpenAPI spec")
}

func TestOpenAPIContainsAllEndpoints(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Get("/openapi.json")
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	resp.Body.Close()

	var openAPI map[string]interface{}
	err = json.Unmarshal(body, &openAPI)
	require.NoError(t, err)

	paths, ok := openAPI["paths"].(map[string]interface{})
	require.True(t, ok)

	// List of expected endpoint patterns (not exhaustive)
	expectedEndpoints := []string{
		"/health",
		"/auth/register",
		"/auth/login",
		"/auth/refresh",
		"/users/me",
		"/workspaces",
		"/barcode/{barcode}",
	}

	for _, endpoint := range expectedEndpoints {
		_, exists := paths[endpoint]
		assert.True(t, exists, "should have endpoint: %s", endpoint)
	}
}

func TestOpenAPISchemas(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Get("/openapi.json")
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	resp.Body.Close()

	var openAPI map[string]interface{}
	err = json.Unmarshal(body, &openAPI)
	require.NoError(t, err)

	// Verify components/schemas exist
	components, ok := openAPI["components"].(map[string]interface{})
	if ok {
		schemas, ok := components["schemas"].(map[string]interface{})
		if ok {
			// Should have some schemas defined
			assert.Greater(t, len(schemas), 0, "should have schemas defined")
		}
	}
}
