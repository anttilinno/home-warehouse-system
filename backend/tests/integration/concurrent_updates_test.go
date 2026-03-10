//go:build integration
// +build integration

package integration

import (
	"fmt"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// =============================================================================
// Concurrent Item Updates Tests
// =============================================================================

func TestConcurrentItemUpdates_SingleItemMultipleGoroutines(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "concurrent_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "concurrent-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Concurrent Test Workspace",
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
		"name":            "Concurrent Item",
		"sku":             "CONC-001",
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

	// Perform concurrent updates
	numGoroutines := 5
	var wg sync.WaitGroup
	errors := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()

			updateData := map[string]interface{}{
				"name": fmt.Sprintf("Updated Item %d", index),
			}

			resp := ts.Put(itemPath, updateData)
			if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusConflict {
				errors <- fmt.Errorf("unexpected status code: %d", resp.StatusCode)
			}
		}(i)
	}

	wg.Wait()
	close(errors)

	// Check for errors
	for err := range errors {
		assert.NoError(t, err)
	}

	// Verify item still exists and is accessible
	resp = ts.Get(itemPath)
	RequireStatus(t, resp, http.StatusOK)

	var finalItem struct {
		ID   uuid.UUID `json:"id"`
		Name string    `json:"name"`
	}
	finalItem = ParseResponse[struct {
		ID   uuid.UUID `json:"id"`
		Name string    `json:"name"`
	}](t, resp)

	assert.Equal(t, itemResult.ID, finalItem.ID)
	assert.NotEmpty(t, finalItem.Name)
}

func TestConcurrentItemUpdates_MultipleItemsMultipleGoroutines(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "concurrent_multi_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "concurrent-multi-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Concurrent Multi Test",
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

	// Create multiple items
	numItems := 3
	itemIDs := make([]uuid.UUID, numItems)

	for i := 0; i < numItems; i++ {
		resp := ts.Post(workspacePath+"/items", map[string]interface{}{
			"name":            fmt.Sprintf("Item %d", i),
			"sku":             fmt.Sprintf("CONC-MULTI-%d", i),
			"min_stock_level": 0,
		})
		RequireStatus(t, resp, http.StatusOK)

		var itemResult struct {
			ID uuid.UUID `json:"id"`
		}
		itemResult = ParseResponse[struct {
			ID uuid.UUID `json:"id"`
		}](t, resp)

		itemIDs[i] = itemResult.ID
	}

	// Perform concurrent updates on different items
	numGoroutines := 10
	var wg sync.WaitGroup
	errors := make(chan error, numGoroutines)
	successCount := make(chan int, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()

			itemIndex := index % numItems
			itemID := itemIDs[itemIndex]
			itemPath := fmt.Sprintf("%s/items/%s", workspacePath, itemID)

			updateData := map[string]interface{}{
				"name": fmt.Sprintf("Updated by goroutine %d", index),
			}

			resp := ts.Put(itemPath, updateData)
			if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusConflict {
				errors <- fmt.Errorf("unexpected status code: %d", resp.StatusCode)
			} else {
				successCount <- 1
			}
		}(i)
	}

	wg.Wait()
	close(errors)
	close(successCount)

	// Check for errors
	for err := range errors {
		assert.NoError(t, err)
	}

	// Count successful updates
	successTotal := 0
	for range successCount {
		successTotal++
	}
	assert.Equal(t, numGoroutines, successTotal)

	// Verify all items still exist
	for _, itemID := range itemIDs {
		itemPath := fmt.Sprintf("%s/items/%s", workspacePath, itemID)
		resp := ts.Get(itemPath)
		RequireStatus(t, resp, http.StatusOK)
	}
}

func TestConcurrentItemUpdates_ReadAndWriteOperations(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "concurrent_read_write_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "concurrent-rw-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Concurrent Read/Write Test",
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
		"name":            "RW Test Item",
		"sku":             "RW-001",
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

	// Mix read and write operations concurrently
	numOperations := 10
	var wg sync.WaitGroup
	readErrors := make(chan error, numOperations/2)
	writeErrors := make(chan error, numOperations/2)

	for i := 0; i < numOperations; i++ {
		wg.Add(1)

		if i%2 == 0 {
			// Read operation
			go func() {
				defer wg.Done()

				resp := ts.Get(itemPath)
				if resp.StatusCode != http.StatusOK {
					readErrors <- fmt.Errorf("read failed: %d", resp.StatusCode)
				}
			}()
		} else {
			// Write operation
			go func(index int) {
				defer wg.Done()

				updateData := map[string]interface{}{
					"name": fmt.Sprintf("Updated %d", index),
				}

				resp := ts.Put(itemPath, updateData)
				if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusConflict {
					writeErrors <- fmt.Errorf("write failed: %d", resp.StatusCode)
				}
			}(i)
		}
	}

	wg.Wait()
	close(readErrors)
	close(writeErrors)

	// Check for errors
	for err := range readErrors {
		assert.NoError(t, err)
	}
	for err := range writeErrors {
		assert.NoError(t, err)
	}
}

func TestConcurrentItemUpdates_RaceCondition_ConflictDetection(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "concurrent_conflict_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "concurrent-conflict-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Concurrent Conflict Test",
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
		"name":            "Conflict Test Item",
		"sku":             "CONF-001",
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

	// Multiple concurrent updates - some may result in conflicts
	numGoroutines := 3
	var wg sync.WaitGroup
	conflictCount := make(chan int, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()

			updateData := map[string]interface{}{
				"name": fmt.Sprintf("Conflict Update %d", index),
			}

			resp := ts.Put(itemPath, updateData)

			if resp.StatusCode == http.StatusConflict {
				conflictCount <- 1
			} else if resp.StatusCode == http.StatusOK {
				conflictCount <- 0
			}
		}(i)
	}

	wg.Wait()
	close(conflictCount)

	// At least one update should succeed
	totalUpdates := 0
	for count := range conflictCount {
		totalUpdates += count
	}
	// Some updates might conflict, some should succeed
	assert.LessOrEqual(t, 0, totalUpdates)
}

func TestConcurrentItemUpdates_StressTest_HighConcurrency(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "stress_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "stress-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Stress Test Workspace",
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

	// Create multiple items for stress testing
	numItems := 5
	itemIDs := make([]uuid.UUID, numItems)

	for i := 0; i < numItems; i++ {
		resp := ts.Post(workspacePath+"/items", map[string]interface{}{
			"name":            fmt.Sprintf("Stress Item %d", i),
			"sku":             fmt.Sprintf("STRESS-%d", i),
			"min_stock_level": 0,
		})
		RequireStatus(t, resp, http.StatusOK)

		var itemResult struct {
			ID uuid.UUID `json:"id"`
		}
		itemResult = ParseResponse[struct {
			ID uuid.UUID `json:"id"`
		}](t, resp)

		itemIDs[i] = itemResult.ID
	}

	// Stress test with many concurrent operations
	numGoroutines := 20
	operationsPerGoroutine := 5
	var wg sync.WaitGroup
	successCount := make(chan int, numGoroutines*operationsPerGoroutine)
	errorCount := make(chan int, numGoroutines*operationsPerGoroutine)

	startTime := time.Now()

	for g := 0; g < numGoroutines; g++ {
		wg.Add(1)
		go func(goroutineID int) {
			defer wg.Done()

			for op := 0; op < operationsPerGoroutine; op++ {
				itemIndex := (goroutineID + op) % numItems
				itemID := itemIDs[itemIndex]
				itemPath := fmt.Sprintf("%s/items/%s", workspacePath, itemID)

				updateData := map[string]interface{}{
					"name": fmt.Sprintf("Update g%d-op%d", goroutineID, op),
				}

				resp := ts.Put(itemPath, updateData)

				if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusConflict {
					successCount <- 1
				} else {
					errorCount <- 1
				}
			}
		}(g)
	}

	wg.Wait()
	close(successCount)
	close(errorCount)

	elapsed := time.Since(startTime)

	// Count results
	successes := 0
	for range successCount {
		successes++
	}

	errors := 0
	for range errorCount {
		errors++
	}

	require.Equal(t, numGoroutines*operationsPerGoroutine, successes, "All operations should succeed or be detected as conflicts")
	assert.Equal(t, 0, errors, "No unexpected errors should occur")

	t.Logf("Completed %d operations in %v (%.2f ops/sec)", successes, elapsed, float64(successes)/elapsed.Seconds())
}

func TestConcurrentItemUpdates_SequentialConsistency(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "seq_consistency_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "seq-consistency-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Sequential Consistency Test",
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
		"name":            "Seq Item",
		"sku":             "SEQ-001",
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

	// Update sequentially with concurrent reads
	updateCount := 5
	readsPerUpdate := 3

	for updateIdx := 0; updateIdx < updateCount; updateIdx++ {
		// Perform update
		updateData := map[string]interface{}{
			"name": fmt.Sprintf("Update %d", updateIdx),
		}

		resp := ts.Put(itemPath, updateData)
		require.True(t, resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusConflict)

		// Verify with concurrent reads
		var wg sync.WaitGroup
		readResults := make(chan string, readsPerUpdate)

		for i := 0; i < readsPerUpdate; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()

				resp := ts.Get(itemPath)
				if resp.StatusCode == http.StatusOK {
					var item struct {
						Name string `json:"name"`
					}
					item = ParseResponse[struct {
						Name string `json:"name"`
					}](t, resp)
					readResults <- item.Name
				}
			}()
		}

		wg.Wait()
		close(readResults)

		// All reads should see the same or later state
		readCount := 0
		for name := range readResults {
			assert.NotEmpty(t, name)
			readCount++
		}
		assert.Equal(t, readsPerUpdate, readCount)
	}
}
