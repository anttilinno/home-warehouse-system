# Import Workflow Manual Testing Checklist

This checklist documents manual testing procedures for the CSV import feature.

## Pre-requisites

- [ ] Backend server running (`mise run dev`)
- [ ] Worker process running (`mise run worker`)
- [ ] Redis running (`mise run dc-up`)
- [ ] PostgreSQL running
- [ ] Test workspace created with at least one user

## Test Environment Setup

1. Note your workspace ID: `________________`
2. Note your auth token (from login): `________________`
3. Base URL: `http://localhost:8000`

## Supported Entity Types

| Entity | Endpoint | Required Fields | Optional Fields |
|--------|----------|-----------------|-----------------|
| items | `/workspaces/{id}/import/items` | name, sku | description, brand, model, manufacturer |
| locations | `/workspaces/{id}/import/locations` | name | parent_location, description, short_code |
| containers | `/workspaces/{id}/import/containers` | name, location | description, capacity, short_code |
| categories | `/workspaces/{id}/import/categories` | name | parent_category, description |
| borrowers | `/workspaces/{id}/import/borrowers` | name | email, phone, notes |
| inventory | `/workspaces/{id}/import/inventory` | item, location, quantity | container, condition, status |

---

## Test 1: Items Import - Happy Path

**Objective:** Verify basic item import works correctly

**CSV Content:**
```csv
name,sku,description,brand
Test Item A,SKU-001,A test item,BrandX
Test Item B,SKU-002,Another test item,BrandY
Test Item C,SKU-003,Third test item,BrandZ
```

**Steps:**
1. [ ] Save CSV to file `test-items.csv`
2. [ ] POST to `/workspaces/{id}/import/items` with form data (file upload)
3. [ ] Verify response is 200 with job ID in response
4. [ ] Check worker logs show "Processing import job..."
5. [ ] Wait for job completion (check `/import-jobs/{jobId}`)
6. [ ] Verify job status is "completed"
7. [ ] Verify success_count = 3, error_count = 0
8. [ ] GET `/items` and verify all 3 items exist

**Result:** [ ] PASS / [ ] FAIL
**Notes:** ________________________________

---

## Test 2: Items Import - Validation Errors

**Objective:** Verify row-level validation errors are captured

**CSV Content:**
```csv
name,sku
,SKU-EMPTY-NAME
Valid Item,SKU-VALID
Another Valid,
```

**Steps:**
1. [ ] Import the CSV
2. [ ] Verify job completes with error_count > 0
3. [ ] Check import_errors for job (GET `/import-jobs/{jobId}/errors`)
4. [ ] Verify error for row 1 (empty name)
5. [ ] Verify error for row 3 (empty SKU)
6. [ ] Verify "Valid Item" was created successfully

**Result:** [ ] PASS / [ ] FAIL
**Notes:** ________________________________

---

## Test 3: Locations Import with Hierarchy

**Objective:** Verify parent-child location relationships

**CSV Content:**
```csv
name,short_code,parent_location
Main Warehouse,MW-1,
Shelf A,SH-A,Main Warehouse
Shelf B,SH-B,Main Warehouse
Bin 1,BN-1,Shelf A
```

**Steps:**
1. [ ] Import locations CSV
2. [ ] Verify job completes successfully
3. [ ] GET `/locations` and check structure:
   - Main Warehouse has no parent
   - Shelf A and Shelf B have parent = Main Warehouse ID
   - Bin 1 has parent = Shelf A ID
4. [ ] Verify breadcrumb API returns correct hierarchy

**Result:** [ ] PASS / [ ] FAIL
**Notes:** ________________________________

---

## Test 4: Inventory Import with References

**Objective:** Verify inventory links to existing items/locations

**Prerequisites:**
- Create items: "Test Product" (SKU: TP-001)
- Create locations: "Storage Room" (short_code: SR-1)

**CSV Content:**
```csv
item,location,quantity,condition,status
TP-001,SR-1,10,NEW,AVAILABLE
TP-001,SR-1,5,GOOD,IN_USE
```

**Steps:**
1. [ ] Create prerequisite items and locations
2. [ ] Import inventory CSV
3. [ ] Verify job completes successfully
4. [ ] GET inventory and verify:
   - Records linked to correct item ID
   - Records linked to correct location ID
   - Quantities match CSV
   - Conditions and statuses match

**Result:** [ ] PASS / [ ] FAIL
**Notes:** ________________________________

---

## Test 5: SSE Progress Events

**Objective:** Verify real-time progress updates during import

**Setup:** Prepare large CSV (50+ rows of items)

**Steps:**
1. [ ] Connect to SSE endpoint: `/workspaces/{id}/events`
2. [ ] Start import of large CSV in another terminal/tab
3. [ ] Observe SSE events in connected client
4. [ ] Verify `import.progress` events received
5. [ ] Verify progress percentage increases (0% -> 25% -> 50% -> 75% -> 100%)
6. [ ] Verify final event shows status = "completed"

**Result:** [ ] PASS / [ ] FAIL
**Notes:** ________________________________

---

## Test 6: Export-Import Round Trip

**Objective:** Verify data integrity through export/import cycle

**Steps:**
1. [ ] Create 5 items manually with various data
2. [ ] Export items: GET `/workspaces/{id}/export/items?format=csv`
3. [ ] Save exported CSV
4. [ ] Delete the 5 items
5. [ ] Import the exported CSV
6. [ ] Verify all 5 items restored with matching data
7. [ ] Compare field values (names, SKUs, etc.)

**Result:** [ ] PASS / [ ] FAIL
**Notes:** ________________________________

---

## Test 7: Error Handling

**Objective:** Verify appropriate error responses

### 7a: Invalid entity type
- [ ] POST to `/workspaces/{id}/import/invalid_entity`
- [ ] Verify 400 Bad Request with clear error message

### 7b: Malformed CSV
- [ ] Upload file with invalid CSV syntax (mismatched quotes)
- [ ] Verify job fails with parsing error

### 7c: Duplicate SKUs
- [ ] Import items with duplicate SKUs
- [ ] Verify first succeeds, duplicate fails with constraint error

### 7d: Missing required fields
- [ ] Import categories without name field
- [ ] Verify validation error in import_errors table

**Result:** [ ] PASS / [ ] FAIL
**Notes:** ________________________________

---

## Test 8: Concurrent Imports

**Objective:** Verify system handles multiple concurrent imports

**Steps:**
1. [ ] Start import of items CSV
2. [ ] Immediately start import of locations CSV
3. [ ] Verify both jobs complete successfully
4. [ ] Verify no data corruption or race conditions

**Result:** [ ] PASS / [ ] FAIL
**Notes:** ________________________________

---

## Summary

| Test | Status | Notes |
|------|--------|-------|
| 1. Items Happy Path | | |
| 2. Validation Errors | | |
| 3. Location Hierarchy | | |
| 4. Inventory References | | |
| 5. SSE Progress | | |
| 6. Export-Import Round Trip | | |
| 7. Error Handling | | |
| 8. Concurrent Imports | | |

**Tested By:** ________________
**Date:** ________________
**Overall Result:** [ ] ALL PASS / [ ] SOME FAILURES

---

## Appendix: API Reference

### Import Endpoint
```
POST /workspaces/{workspace_id}/import/{entity_type}
Content-Type: multipart/form-data

Form fields:
- file: CSV file
```

### Import Job Status
```
GET /import-jobs/{job_id}

Response:
{
  "id": "uuid",
  "status": "pending|processing|completed|failed",
  "entity_type": "items",
  "total_rows": 100,
  "processed_rows": 100,
  "success_count": 95,
  "error_count": 5,
  "progress": 100,
  "created_at": "timestamp",
  "completed_at": "timestamp"
}
```

### Import Errors
```
GET /import-jobs/{job_id}/errors

Response:
{
  "errors": [
    {
      "row_number": 5,
      "error": "name is required",
      "data": {"sku": "SKU-005"}
    }
  ]
}
```

### SSE Event Format
```
event: import.progress
data: {
  "job_id": "uuid",
  "entity_type": "items",
  "status": "processing",
  "progress": 50,
  "processed_rows": 25,
  "total_rows": 50,
  "success_count": 23,
  "error_count": 2
}
```

## Appendix: cURL Examples

### Start Import
```bash
curl -X POST "http://localhost:8000/workspaces/{workspace_id}/import/items" \
  -H "Authorization: Bearer {token}" \
  -F "file=@test-items.csv"
```

### Check Job Status
```bash
curl "http://localhost:8000/import-jobs/{job_id}" \
  -H "Authorization: Bearer {token}"
```

### Get Import Errors
```bash
curl "http://localhost:8000/import-jobs/{job_id}/errors" \
  -H "Authorization: Bearer {token}"
```

### Connect to SSE
```bash
curl -N "http://localhost:8000/workspaces/{workspace_id}/events" \
  -H "Authorization: Bearer {token}" \
  -H "Accept: text/event-stream"
```
