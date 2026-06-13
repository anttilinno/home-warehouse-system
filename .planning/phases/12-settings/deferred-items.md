# Deferred Items — Phase 12 (discovered during Plan 12-01 execution)

These are PRE-EXISTING integration-test failures present on the base SHA
`6509be9f24eb428f5e17d165fec97c2dde502b4f`, unrelated to the member-domain
changes in Plan 12-01. Out of scope for 12-01 (not in `files_modified`,
different domains). Logged per the executor scope-boundary rule.

## D-12-01-A — `TestMultiUserWorkflow` fails on `GET /auth/me` (404)
- File: `backend/tests/integration/workflow_test.go:582`
- Symptom: `GET /auth/me` returns `404 page not found` in the integration test
  server; the test never reaches the `/members` POST that follows.
- Verified on BASE SHA: SAME failure (404 at line 582). Not caused by 12-01.
- Root cause (likely): the `/auth/me` route is not mounted in the
  integration `TestServer` wiring (route registration gap), independent of
  the member domain.

## D-12-01-B — `TestApprovalPipeline_*` fail on review-gating (202 vs 200/403)
- File: `backend/tests/integration/approval_pipeline_test.go:307` (and peers)
- Symptom: member-created items are expected to return `202` (pending review)
  but return `200` (created immediately) on this branch.
- Verified on BASE SHA: SAME tests fail (there the upstream `/members` POST
  returns `422` then item create `403`). Plan 12-01 actually *improves* the
  member-add step (now `200` — member added successfully via the retained
  `user_id` path), but the approval-pipeline `needs_review` gating remains
  unimplemented/disabled, so the test still fails for an unrelated reason.
- Cross-ref MEMORY: "Backend hardening: 3 fixes done, uncommitted — approval
  pipeline ... paused 2026-05-31". The approval pipeline is a separate,
  in-progress feature outside the member domain.

Neither item was modified by Plan 12-01. Both should be triaged by the
owning phase/feature, not the Settings members work.
