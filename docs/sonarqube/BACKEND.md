# SonarQube Analysis Report — Home Warehouse System Backend

> SonarQube Community v26.6 (sonar-go analyzer) · project key `hw-backend` · sources `backend/` (Go) · generated 2026-06-16 · ephemeral local server

**Quality Gate: ✅ OK**

## 1. Summary Metrics

| Metric | Value |
|---|---|
| Bugs | 1 |
| Vulnerabilities | 0 |
| Code Smells | 300 |
| Security Hotspots | 2 |
| Coverage | 0.0% (no coverage report imported) |
| Duplicated Lines Density | 5.3% |
| Duplicated Blocks | 132 |
| Lines of Code (ncloc) | 39,383 |
| Total Lines | 51,153 |
| Files | 276 |
| Functions | 1,939 |
| Cyclomatic Complexity | 6,164 |
| Cognitive Complexity | 5,940 |
| Comment Lines Density | 10.8% |
| Technical Debt (sqale_index) | 4,791 min ≈ 79h 51m (~10 working days @ 8h) |

### Ratings

| Rating | Grade |
|---|---|
| Reliability (`reliability_rating`) | C (3.0) |
| Security (`security_rating`) | A (1.0) |
| Security Review (`security_review_rating`) | E (5.0) |
| Maintainability (`sqale_rating`) | A (1.0) |

## 2. Issues by Severity & Type

Total issues: **301**

### By Severity

| Severity | Count |
|---|---|
| BLOCKER | 0 |
| CRITICAL | 203 |
| MAJOR | 90 |
| MINOR | 0 |
| INFO | 8 |

### By Type

| Type | Count |
|---|---|
| CODE_SMELL | 300 |
| BUG | 1 |
| VULNERABILITY | 0 |

## 3. Top Rules by Count

Only 6 distinct rules fired across all 301 issues.

| Rank | Rule | Count | Description (inferred) |
|---|---|---|---|
| 1 | `go:S1192` | 111 | String literal duplicated ≥3 times — extract a named constant |
| 2 | `go:S3776` | 92 | Function cognitive complexity exceeds the allowed 15 — refactor |
| 3 | `go:S4144` | 50 | Two methods have identical implementations — consolidate |
| 4 | `go:S107` | 39 | Function has more than 7 parameters — too many params |
| 5 | `go:S1135` | 8 | Unresolved `TODO` comment — complete the associated task |
| 6 | `go:S3923` | 1 | All branches of a conditional are identical — remove/edit |

## 4. Top Files by Issue Count

Top 15 files by aggregated issue count (`hw-backend:` prefix stripped):

| Rank | File | Issues |
|---|---|---|
| 1 | `internal/domain/auth/user/handler.go` | 14 |
| 2 | `internal/worker/import_worker.go` | 9 |
| 2 | `internal/domain/batch/service.go` | 9 |
| 4 | `internal/domain/warehouse/pendingchange/service.go` | 8 |
| 5 | `internal/domain/warehouse/loan/handler.go` | 7 |
| 5 | `internal/domain/warehouse/itemphoto/handler.go` | 7 |
| 7 | `internal/domain/warehouse/pendingchange/handler.go` | 6 |
| 7 | `internal/domain/warehouse/inventory/handler.go` | 6 |
| 9 | `internal/domain/warehouse/item/handler_test.go` | 5 |
| 9 | `internal/domain/warehouse/attachment/handler.go` | 5 |
| 9 | `internal/domain/importexport/workspace_restore.go` | 5 |
| 9 | `internal/domain/auth/workspace/handler.go` | 5 |
| 13 | `tests/integration/setup.go` | 4 |
| 13 | `internal/domain/warehouse/wishlist/handler.go` | 4 |
| 13 | `internal/domain/warehouse/repairphoto/handler.go` | 4 |

## 5. BLOCKER and CRITICAL Issues

**BLOCKER: none.**

**CRITICAL: 203 issues**, all of two rules — `go:S1192` (111, duplicated string literals) and `go:S3776` (92, excessive cognitive complexity). Full list below (file:line · rule · message).

| File:Line | Rule | Message |
|---|---|---|
| `cmd/photo-admin/main.go:121` | go:S3776 | Reduce Cognitive Complexity from 18 to 15 |
| `cmd/photo-admin/main.go:126` | go:S1192 | Constant for "Failed to connect to database: %v" (×3) |
| `cmd/photo-admin/main.go:216` | go:S3776 | Reduce Cognitive Complexity from 28 to 15 |
| `cmd/seed/main.go:108` | go:S3776 | Reduce Cognitive Complexity from 23 to 15 |
| `cmd/seed/main.go:338` | go:S3776 | Reduce Cognitive Complexity from 18 to 15 |
| `cmd/seed/main.go:818` | go:S3776 | Reduce Cognitive Complexity from 16 to 15 |
| `internal/api/middleware/approval_middleware.go:62` | go:S3776 | Reduce Cognitive Complexity from 18 to 15 |
| `internal/api/middleware/auth.go:37` | go:S3776 | Reduce Cognitive Complexity from 27 to 15 |
| `internal/api/middleware/logger.go:14` | go:S3776 | Reduce Cognitive Complexity from 17 to 15 |
| `internal/api/router.go:119` | go:S3776 | Reduce Cognitive Complexity from 19 to 15 |
| `internal/api/router.go:159` | go:S1192 | Constant for "Home Warehouse API" (×6) |
| `internal/domain/analytics/handler.go:229` | go:S1192 | Constant for "workspace context required" (×11) |
| `internal/domain/auth/member/handler.go:15` | go:S3776 | Reduce Cognitive Complexity from 45 to 15 |
| `internal/domain/auth/member/handler.go:20` | go:S1192 | Constant for "workspace context required" (×5) |
| `internal/domain/auth/member/handler.go:39` | go:S1192 | Constant for "/members/{user_id}" (×3) |
| `internal/domain/auth/member/handler.go:47` | go:S1192 | Constant for "member not found" (×3) |
| `internal/domain/auth/notification/handler.go:15` | go:S3776 | Reduce Cognitive Complexity from 29 to 15 |
| `internal/domain/auth/notification/handler.go:20` | go:S1192 | Constant for "authentication required" (×6) |
| `internal/domain/auth/oauth/handler.go:130` | go:S3776 | Reduce Cognitive Complexity from 17 to 15 |
| `internal/domain/auth/pushsubscription/handler.go:14` | go:S3776 | Reduce Cognitive Complexity from 18 to 15 |
| `internal/domain/auth/pushsubscription/handler.go:19` | go:S1192 | Constant for "authentication required" (×4) |
| `internal/domain/auth/session/handler.go:47` | go:S1192 | Constant for "not authenticated" (×3) |
| `internal/domain/auth/user/entity.go:36` | go:S1192 | Constant for "email is required" (×3) |
| `internal/domain/auth/user/entity.go:39` | go:S1192 | Constant for "full name is required" (×3) |
| `internal/domain/auth/user/handler.go:1253` | go:S3776 | Reduce Cognitive Complexity from 19 to 15 |
| `internal/domain/auth/user/handler.go:149` | go:S1192 | Constant for "/users/me" (×5) |
| `internal/domain/auth/user/handler.go:155` | go:S1192 | Constant for "/users/me/avatar" (×3) |
| `internal/domain/auth/user/handler.go:182` | go:S1192 | Constant for "email is already taken" (×3) |
| `internal/domain/auth/user/handler.go:208` | go:S1192 | Constant for "failed to generate token" (×3) |
| `internal/domain/auth/user/handler.go:213` | go:S1192 | Constant for "failed to generate refresh token" (×3) |
| `internal/domain/auth/user/handler.go:293` | go:S1192 | Constant for "user not found" (×9) |
| `internal/domain/auth/user/handler.go:349` | go:S1192 | Constant for "not authenticated" (×18) |
| `internal/domain/auth/user/handler.go:521` | go:S1192 | Constant for "superuser access required" (×4) |
| `internal/domain/auth/user/handler.go:666` | go:S1192 | Constant for "image/jpeg" (×3) |
| `internal/domain/auth/user/handler.go:667` | go:S1192 | Constant for "image/png" (×3) |
| `internal/domain/auth/user/handler.go:668` | go:S1192 | Constant for "image/webp" (×3) |
| `internal/domain/auth/user/handler.go:672` | go:S3776 | Reduce Cognitive Complexity from 20 to 15 |
| `internal/domain/auth/user/handler.go:708` | go:S1192 | Constant for "Content-Type" (×3) |
| `internal/domain/auth/workspace/handler.go:15` | go:S3776 | Reduce Cognitive Complexity from 18 to 15 |
| `internal/domain/auth/workspace/handler.go:20` | go:S1192 | Constant for "authentication required" (×3) |
| `internal/domain/auth/workspace/handler.go:47` | go:S1192 | Constant for "workspace not found" (×4) |
| `internal/domain/auth/workspace/handler.go:84` | go:S3776 | Reduce Cognitive Complexity from 24 to 15 |
| `internal/domain/auth/workspace/handler.go:89` | go:S1192 | Constant for "workspace context required" (×3) |
| `internal/domain/batch/service.go:129` | go:S3776 | Reduce Cognitive Complexity from 16 to 15 |
| `internal/domain/batch/service.go:133` | go:S1192 | Constant for "entity_id required for update" (×6) |
| `internal/domain/batch/service.go:150` | go:S1192 | Constant for "invalid update data" (×6) |
| `internal/domain/batch/service.go:164` | go:S1192 | Constant for "entity_id required for delete" (×6) |
| `internal/domain/batch/service.go:179` | go:S3776 | Reduce Cognitive Complexity from 16 to 15 |
| `internal/domain/batch/service.go:226` | go:S3776 | Reduce Cognitive Complexity from 16 to 15 |
| `internal/domain/batch/service.go:273` | go:S3776 | Reduce Cognitive Complexity from 16 to 15 |
| `internal/domain/batch/service.go:320` | go:S3776 | Reduce Cognitive Complexity from 16 to 15 |
| `internal/domain/batch/service.go:367` | go:S3776 | Reduce Cognitive Complexity from 16 to 15 |
| `internal/domain/importexport/handler.go:118` | go:S1192 | Constant for "workspace context required" (×4) |
| `internal/domain/importexport/handler.go:81` | go:S1192 | Constant for "Import/Export" (×4) |
| `internal/domain/importexport/service.go:413` | go:S3776 | Reduce Cognitive Complexity from 51 to 15 |
| `internal/domain/importexport/service.go:557` | go:S1192 | Constant for "name is required" (×7) |
| `internal/domain/importexport/workspace_backup.go:330` | go:S1192 | Constant for "Created At" (×10) |
| `internal/domain/importexport/workspace_backup.go:330` | go:S1192 | Constant for "Updated At" (×10) |
| `internal/domain/importexport/workspace_backup.go:445` | go:S1192 | Constant for "Short Code" (×3) |
| `internal/domain/importexport/workspace_restore.go:135` | go:S3776 | Reduce Cognitive Complexity from 21 to 15 |
| `internal/domain/importexport/workspace_restore.go:381` | go:S3776 | Reduce Cognitive Complexity from 26 to 15 |
| `internal/domain/importexport/workspace_restore.go:427` | go:S3776 | Reduce Cognitive Complexity from 17 to 15 |
| `internal/domain/paperless/handler.go:19` | go:S3776 | Reduce Cognitive Complexity from 28 to 15 |
| `internal/domain/paperless/handler.go:22` | go:S1192 | Constant for "/paperless/settings" (×3) |
| `internal/domain/paperless/handler.go:25` | go:S1192 | Constant for "workspace context required" (×5) |
| `internal/domain/sync/service.go:52` | go:S3776 | Reduce Cognitive Complexity from 60 to 15 |
| `internal/domain/sync/service_test.go:724` | go:S3776 | Reduce Cognitive Complexity from 17 to 15 |
| `internal/domain/warehouse/activity/handler.go:15` | go:S3776 | Reduce Cognitive Complexity from 31 to 15 |
| `internal/domain/warehouse/activity/handler.go:20` | go:S1192 | Constant for "workspace context required" (×3) |
| `internal/domain/warehouse/attachment/handler.go:131` | go:S1192 | Constant for "attachment.created" (×3) |
| `internal/domain/warehouse/attachment/handler.go:31` | go:S3776 | Reduce Cognitive Complexity from 53 to 15 |
| `internal/domain/warehouse/attachment/handler.go:36` | go:S1192 | Constant for "workspace context required" (×8) |
| `internal/domain/warehouse/attachment/handler.go:63` | go:S1192 | Constant for "attachment not found" (×5) |
| `internal/domain/warehouse/attachment/handler.go:87` | go:S1192 | Constant for "invalid attachment type" (×3) |
| `internal/domain/warehouse/borrower/handler.go:17` | go:S3776 | Reduce Cognitive Complexity from 57 to 15 |
| `internal/domain/warehouse/borrower/handler.go:22` | go:S1192 | Constant for "workspace context required" (×8) |
| `internal/domain/warehouse/borrower/handler.go:42` | go:S1192 | Constant for "/borrowers/{id}" (×3) |
| `internal/domain/warehouse/category/handler.go:16` | go:S3776 | Reduce Cognitive Complexity from 70 to 15 |
| `internal/domain/warehouse/category/handler.go:21` | go:S1192 | Constant for "workspace context required" (×10) |
| `internal/domain/warehouse/category/handler.go:62` | go:S1192 | Constant for "/categories/{id}" (×3) |
| `internal/domain/warehouse/company/handler.go:17` | go:S3776 | Reduce Cognitive Complexity from 67 to 15 |
| `internal/domain/warehouse/company/handler.go:22` | go:S1192 | Constant for "workspace context required" (×7) |
| `internal/domain/warehouse/company/handler.go:47` | go:S1192 | Constant for "/companies/{id}" (×3) |
| `internal/domain/warehouse/company/handler.go:56` | go:S1192 | Constant for "company not found" (×5) |
| `internal/domain/warehouse/container/handler.go:17` | go:S3776 | Reduce Cognitive Complexity from 63 to 15 |
| `internal/domain/warehouse/container/handler.go:22` | go:S1192 | Constant for "workspace context required" (×8) |
| `internal/domain/warehouse/container/handler.go:47` | go:S1192 | Constant for "/containers/{id}" (×3) |
| `internal/domain/warehouse/container/service.go:52` | go:S3776 | Reduce Cognitive Complexity from 21 to 15 |
| `internal/domain/warehouse/declutter/handler.go:15` | go:S3776 | Reduce Cognitive Complexity from 17 to 15 |
| `internal/domain/warehouse/declutter/handler.go:20` | go:S1192 | Constant for "workspace context required" (×3) |
| `internal/domain/warehouse/favorite/handler.go:15` | go:S3776 | Reduce Cognitive Complexity from 30 to 15 |
| `internal/domain/warehouse/favorite/handler.go:20` | go:S1192 | Constant for "workspace context required" (×3) |
| `internal/domain/warehouse/favorite/handler.go:25` | go:S1192 | Constant for "authentication required" (×3) |
| `internal/domain/warehouse/importjob/handler.go:123` | go:S3776 | Reduce Cognitive Complexity from 37 to 15 |
| `internal/domain/warehouse/importjob/handler.go:128` | go:S1192 | Constant for "workspace context required" (×4) |
| `internal/domain/warehouse/importjob/handler.go:162` | go:S1192 | Constant for "import job not found" (×3) |
| `internal/domain/warehouse/importjob/handler.go:164` | go:S1192 | Constant for "failed to get import job" (×3) |
| `internal/domain/warehouse/importjob/upload_handler.go:40` | go:S3776 | Reduce Cognitive Complexity from 18 to 15 |
| `internal/domain/warehouse/inventory/entity_test.go:237` | go:S3776 | Reduce Cognitive Complexity from 25 to 15 |
| `internal/domain/warehouse/inventory/handler.go:191` | go:S3776 | Reduce Cognitive Complexity from 40 to 15 |
| `internal/domain/warehouse/inventory/handler.go:24` | go:S3776 | Reduce Cognitive Complexity from 48 to 15 |
| `internal/domain/warehouse/inventory/handler.go:271` | go:S1192 | Constant for "inventory.updated" (×4) |
| `internal/domain/warehouse/inventory/handler.go:356` | go:S3776 | Reduce Cognitive Complexity from 30 to 15 |
| `internal/domain/warehouse/inventory/handler.go:38` | go:S1192 | Constant for "failed to list inventory" (×5) |
| `internal/domain/warehouse/inventory/handler.go:83` | go:S1192 | Constant for "inventory not found" (×8) |
| `internal/domain/warehouse/item/entity_test.go:111` | go:S3776 | Reduce Cognitive Complexity from 21 to 15 |
| `internal/domain/warehouse/item/handler.go:201` | go:S1192 | Constant for "item not found" (×9) |
| `internal/domain/warehouse/item/handler.go:225` | go:S1192 | Constant for "/items/{id}" (×3) |
| `internal/domain/warehouse/item/handler.go:78` | go:S3776 | Reduce Cognitive Complexity from **148** to 15 |
| `internal/domain/warehouse/item/handler.go:83` | go:S1192 | Constant for "workspace context required" (×13) |
| `internal/domain/warehouse/item/handler_test.go:1188` | go:S3776 | Reduce Cognitive Complexity from 20 to 15 |
| `internal/domain/warehouse/itemphoto/handler.go:298` | go:S1192 | Constant for "invalid item_id" (×5) |
| `internal/domain/warehouse/itemphoto/handler.go:34` | go:S3776 | Reduce Cognitive Complexity from 66 to 15 |
| `internal/domain/warehouse/itemphoto/handler.go:408` | go:S3776 | Reduce Cognitive Complexity from 29 to 15 |
| `internal/domain/warehouse/itemphoto/handler.go:40` | go:S1192 | Constant for "workspace context required" (×12) |
| `internal/domain/warehouse/itemphoto/handler.go:472` | go:S1192 | Constant for "Content-Type" (×5) |
| `internal/domain/warehouse/itemphoto/handler.go:68` | go:S1192 | Constant for "photo not found" (×7) |
| `internal/domain/warehouse/itemphoto/handler.go:98` | go:S1192 | Constant for "photo does not belong to workspace" (×3) |
| `internal/domain/warehouse/itemphoto/service.go:163` | go:S3776 | Reduce Cognitive Complexity from 24 to 15 |
| `internal/domain/warehouse/itemphoto/service.go:489` | go:S3776 | Reduce Cognitive Complexity from 27 to 15 |
| `internal/domain/warehouse/itemphoto/service.go:574` | go:S3776 | Reduce Cognitive Complexity from 16 to 15 |
| `internal/domain/warehouse/item/service.go:78` | go:S3776 | Reduce Cognitive Complexity from 28 to 15 |
| `internal/domain/warehouse/item/service_test.go:205` | go:S3776 | Reduce Cognitive Complexity from 18 to 15 |
| `internal/domain/warehouse/label/handler.go:16` | go:S3776 | Reduce Cognitive Complexity from 56 to 15 |
| `internal/domain/warehouse/label/handler.go:21` | go:S1192 | Constant for "workspace context required" (×7) |
| `internal/domain/warehouse/label/handler.go:40` | go:S1192 | Constant for "/labels/{id}" (×3) |
| `internal/domain/warehouse/loan/handler.go:170` | go:S3776 | Reduce Cognitive Complexity from **114** to 15 |
| `internal/domain/warehouse/loan/handler.go:175` | go:S1192 | Constant for "workspace context required" (×11) |
| `internal/domain/warehouse/loan/handler.go:181` | go:S1192 | Constant for "failed to list loans" (×4) |
| `internal/domain/warehouse/loan/handler.go:186` | go:S1192 | Constant for "failed to decorate loans" (×6) |
| `internal/domain/warehouse/loan/handler.go:247` | go:S1192 | Constant for "loan not found" (×4) |
| `internal/domain/warehouse/loan/handler.go:252` | go:S1192 | Constant for "failed to decorate loan" (×5) |
| `internal/domain/warehouse/loan/handler.go:68` | go:S3776 | Reduce Cognitive Complexity from 18 to 15 |
| `internal/domain/warehouse/location/handler.go:17` | go:S3776 | Reduce Cognitive Complexity from 67 to 15 |
| `internal/domain/warehouse/location/handler.go:22` | go:S1192 | Constant for "workspace context required" (×9) |
| `internal/domain/warehouse/location/handler.go:47` | go:S1192 | Constant for "/locations/{id}" (×3) |
| `internal/domain/warehouse/location/service.go:49` | go:S3776 | Reduce Cognitive Complexity from 18 to 15 |
| `internal/domain/warehouse/maintenance/handler.go:17` | go:S3776 | Reduce Cognitive Complexity from 71 to 15 |
| `internal/domain/warehouse/maintenance/handler.go:22` | go:S1192 | Constant for "workspace context required" (×8) |
| `internal/domain/warehouse/maintenance/handler.go:70` | go:S1192 | Constant for "/maintenance/{id}" (×3) |
| `internal/domain/warehouse/maintenance/handler.go:79` | go:S1192 | Constant for "maintenance schedule not found" (×4) |
| `internal/domain/warehouse/movement/handler.go:15` | go:S3776 | Reduce Cognitive Complexity from 18 to 15 |
| `internal/domain/warehouse/movement/handler.go:20` | go:S1192 | Constant for "workspace context required" (×3) |
| `internal/domain/warehouse/movement/handler.go:26` | go:S1192 | Constant for "failed to list movements" (×3) |
| `internal/domain/warehouse/pendingchange/handler.go:24` | go:S3776 | Reduce Cognitive Complexity from **104** to 15 |
| `internal/domain/warehouse/pendingchange/handler.go:29` | go:S1192 | Constant for "workspace context required" (×5) |
| `internal/domain/warehouse/pendingchange/handler.go:35` | go:S1192 | Constant for "authentication required" (×5) |
| `internal/domain/warehouse/pendingchange/handler.go:40` | go:S1192 | Constant for "failed to check permissions" (×4) |
| `internal/domain/warehouse/pendingchange/handler.go:70` | go:S1192 | Constant for "failed to fetch user details" (×5) |
| `internal/domain/warehouse/pendingchange/handler.go:98` | go:S1192 | Constant for "pending change not found" (×6) |
| `internal/domain/warehouse/pendingchange/service.go:1119` | go:S3776 | Reduce Cognitive Complexity from 19 to 15 |
| `internal/domain/warehouse/pendingchange/service.go:214` | go:S3776 | Reduce Cognitive Complexity from 22 to 15 |
| `internal/domain/warehouse/pendingchange/service.go:566` | go:S1192 | Constant for "entity_id is required for update action" (×10) |
| `internal/domain/warehouse/pendingchange/service.go:570` | go:S1192 | Constant for "failed to unmarshal update payload: %w" (×8) |
| `internal/domain/warehouse/pendingchange/service.go:578` | go:S1192 | Constant for "entity_id is required for delete action" (×10) |
| `internal/domain/warehouse/pendingchange/service.go:585` | go:S1192 | Constant for "unsupported action: %s" (×10) |
| `internal/domain/warehouse/pendingchange/service.go:910` | go:S3776 | Reduce Cognitive Complexity from 27 to 15 |
| `internal/domain/warehouse/repairattachment/handler.go:18` | go:S3776 | Reduce Cognitive Complexity from 34 to 15 |
| `internal/domain/warehouse/repairattachment/handler.go:23` | go:S1192 | Constant for "workspace context required" (×3) |
| `internal/domain/warehouse/repairlog/handler.go:17` | go:S3776 | Reduce Cognitive Complexity from **108** to 15 |
| `internal/domain/warehouse/repairlog/handler.go:22` | go:S1192 | Constant for "workspace context required" (×9) |
| `internal/domain/warehouse/repairlog/handler.go:59` | go:S1192 | Constant for "/repairs/{id}" (×3) |
| `internal/domain/warehouse/repairlog/handler.go:68` | go:S1192 | Constant for "repair log not found" (×5) |
| `internal/domain/warehouse/repairphoto/handler.go:32` | go:S3776 | Reduce Cognitive Complexity from 49 to 15 |
| `internal/domain/warehouse/repairphoto/handler.go:37` | go:S1192 | Constant for "workspace context required" (×6) |
| `internal/domain/warehouse/repairphoto/handler.go:65` | go:S1192 | Constant for "photo not found" (×9) |
| `internal/domain/warehouse/repairphoto/handler.go:67` | go:S1192 | Constant for "failed to get photo" (×4) |
| `internal/domain/warehouse/repairphoto/service.go:104` | go:S3776 | Reduce Cognitive Complexity from 17 to 15 |
| `internal/domain/warehouse/wishlist/handler.go:23` | go:S3776 | Reduce Cognitive Complexity from 58 to 15 |
| `internal/domain/warehouse/wishlist/handler.go:28` | go:S1192 | Constant for "workspace context required" (×5) |
| `internal/domain/warehouse/wishlist/handler.go:54` | go:S1192 | Constant for "/wishlist/{id}" (×3) |
| `internal/domain/warehouse/wishlist/handler.go:63` | go:S1192 | Constant for "wishlist item not found" (×3) |
| `internal/domain/warehouse/wishlist/service.go:112` | go:S3776 | Reduce Cognitive Complexity from 34 to 15 |
| `internal/infra/imageprocessor/processor.go:76` | go:S3776 | Reduce Cognitive Complexity from 47 to 15 |
| `internal/infra/imageprocessor/processor_test.go:257` | go:S3776 | Reduce Cognitive Complexity from 19 to 15 |
| `internal/infra/imageprocessor/processor_test.go:458` | go:S3776 | Reduce Cognitive Complexity from 44 to 15 |
| `internal/infra/postgres/inventory_repository_test.go:295` | go:S3776 | Reduce Cognitive Complexity from 16 to 15 |
| `internal/infra/postgres/repairlog_repository.go:33` | go:S3776 | Reduce Cognitive Complexity from 18 to 15 |
| `internal/infra/queue/redis_queue.go:147` | go:S3776 | Reduce Cognitive Complexity from 16 to 15 |
| `internal/infra/storage/config_test.go:8` | go:S3776 | Reduce Cognitive Complexity from 30 to 15 |
| `internal/infra/storage/storage_test.go:13` | go:S3776 | Reduce Cognitive Complexity from 16 to 15 |
| `internal/infra/storage/storage_test.go:57` | go:S3776 | Reduce Cognitive Complexity from 27 to 15 |
| `internal/infra/storage/validation_test.go:7` | go:S3776 | Reduce Cognitive Complexity from 16 to 15 |
| `internal/infra/webpush/sender.go:149` | go:S1192 | Constant for "push service returned status %d" (×3) |
| `internal/infra/webpush/sender.go:47` | go:S3776 | Reduce Cognitive Complexity from 16 to 15 |
| `internal/jobs/expiry_reminders.go:102` | go:S3776 | Reduce Cognitive Complexity from 19 to 15 |
| `internal/jobs/expiry_reminders.go:276` | go:S3776 | Reduce Cognitive Complexity from 16 to 15 |
| `internal/jobs/maintenance_reminders.go:45` | go:S1192 | Constant for "2006-01-02" (×3) |
| `internal/jobs/maintenance_reminders.go:65` | go:S3776 | Reduce Cognitive Complexity from 20 to 15 |
| `internal/jobs/scheduler.go:133` | go:S1192 | Constant for "0 9 * * *" (×4) |
| `internal/worker/import_worker.go:188` | go:S3776 | Reduce Cognitive Complexity from 21 to 15 |
| `internal/worker/import_worker.go:195` | go:S1192 | Constant for "Failed to count rows: %v" (×6) |
| `internal/worker/import_worker.go:223` | go:S1192 | Constant for "name is required" (×5) |
| `internal/worker/import_worker.go:286` | go:S3776 | Reduce Cognitive Complexity from 22 to 15 |
| `internal/worker/import_worker.go:310` | go:S1192 | Constant for "failed to load existing locations: %v" (×3) |
| `internal/worker/import_worker.go:376` | go:S3776 | Reduce Cognitive Complexity from 21 to 15 |
| `internal/worker/import_worker.go:468` | go:S3776 | Reduce Cognitive Complexity from 22 to 15 |
| `internal/worker/import_worker.go:56` | go:S3776 | Reduce Cognitive Complexity from 22 to 15 |
| `internal/worker/import_worker.go:619` | go:S3776 | Reduce Cognitive Complexity from **83** to 15 |
| `tests/integration/setup.go:80` | go:S1192 | Constant for "failed to create request: %v" (×3) |
| `tests/integration/setup.go:83` | go:S1192 | Constant for "Content-Type" (×3) |
| `tests/integration/setup.go:85` | go:S1192 | Constant for "Bearer " (×3) |
| `tests/integration/setup.go:90` | go:S1192 | Constant for "failed to make request: %v" (×3) |

**Worst complexity offenders:** `item/handler.go:78` (148), `loan/handler.go:170` (114), `repairlog/handler.go:17` (108), `pendingchange/handler.go:24` (104), `worker/import_worker.go:619` (83).

## 6. Security Hotspots

2 hotspots, both in `Dockerfile`, category **permission**, status `TO_REVIEW`.

| File:Line | Category | Probability | Rule | Message |
|---|---|---|---|---|
| `Dockerfile:10` | permission | MEDIUM | docker:S6470 | Copying recursively might inadvertently add sensitive data to the container. Make sure it is safe here. |
| `Dockerfile:43` | permission | MEDIUM | docker:S6471 | This image might run with "root" as the default user. Make sure it is safe here. |

These two unreviewed hotspots drive the **Security Review rating of E**.

## 7. Notes

- **Exclusions from sources:** `*_test.go` (where applicable), vendored deps, generated `*.sql.go`, mocks, and `testdb`/`testfixtures` helpers were excluded from the scanned source set. (Some `*_test.go` and `tests/integration/` files still appear in issues — they were within the analyzed scope for this run.)
- **Coverage is 0.0% / none** because no Go coverage report (e.g. `go test -coverprofile`) was imported into this scan; it is not a measure of actual test coverage.
- This was a **fresh scan against the default ("Sonar way") quality profile** — no custom rule tuning or baseline applied.
- The single **BUG** is outside CRITICAL severity: `tests/integration/workspace_test.go:25` (`go:S3923`) — a conditional whose branches are identical.
- The 8 **INFO** issues are all `go:S1135` unresolved `TODO` comments (in `workspace_restore.go`, `paperless/service.go`, `inventory/service.go`, `item_repository.go`, and four `tests/integration/*` files).
