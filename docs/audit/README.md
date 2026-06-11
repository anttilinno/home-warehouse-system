# Full Codebase Audit — 2026-06-11

> **Remediation status (same day):** all CRITICAL/HIGH/MEDIUM and most LOW findings fixed in the working tree — backend security F1–F20, backend quality top-10 + mediums, frontend security/data-layer/perf/a11y, i18n backfill (1,156-key parity across en/et/ru), DB migrations 002–006 (tenant columns, housekeeping, integrity hardening, composite-FK tenancy, pending_changes sync columns), stale `backend/db/schema.sql` deleted. Deferred (feature-sized): RLS (B2), stock ledger (B3), change_log sync feed (B4), unified media model (B6), asynq migration for imports, frontend page decomposition beyond ItemRow, offline delete queueing, e2e test-suite hardening, ~38 pre-existing `tests/integration` failures (stale expectations, predate audit).

Scope: `backend/` (Go), `frontend/` (Next.js), database schema. `frontend2/` excluded by request.

| Report | File | Findings |
|--------|------|----------|
| Backend security | [BACKEND-SECURITY.md](BACKEND-SECURITY.md) | 1 critical, 5 high, 7 medium, 7 low |
| Backend quality & architecture | [BACKEND-QUALITY.md](BACKEND-QUALITY.md) | 7 high, ~10 medium |
| Frontend (security, data layer, state, perf, tests, i18n, a11y) | [FRONTEND.md](FRONTEND.md) | 5 high, ~12 medium |
| Database schema (defects + radical redesign) | [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md) | 2 critical, 4 high + redesign proposals B1–B8 |

## Top cross-cutting priorities

1. **Cross-tenant IDOR on attachments** (`BACKEND-SECURITY F1`) — any workspace member can read and **delete** another workspace's attachments and backing files. `warehouse.attachments` has no `workspace_id`; handler explicitly discards the workspace check. Fix immediately.
2. **Session lifecycle is broken** (`F2`, `F3`) — logout never revokes the refresh token, and a revoked session can resurrect itself via the "legacy token" fallback on refresh. Token theft survives logout and revocation.
3. **Tenant isolation is query-discipline only** (`DATABASE-SCHEMA A2`, `A3`) — no composite FKs, several unscoped `WHERE id = $1` mutations, `container_tags.tag_value` globally unique across tenants. Schema redesign B1 (composite-key tenancy) + B2 (RLS) makes the bug class unrepresentable.
4. **Schema drift: the "canonical" dump is stale** (`A1`) — `backend/db/schema.sql` predates migration consolidation, lacks `items.needs_review` which live queries use, and references migrations 002–012 that no longer exist. Delete it; keep one dbmate-generated dump + CI drift check.
5. **Frontend cookie-auth proxy has no CSRF defense and the offline caches outlive logout** (`FRONTEND 1.3`, `1.5`, `1.6`) — IndexedDB and service worker caches retain the full inventory (and replay another user's queued mutations) after logout on a shared device.
6. **PATCH /items wipes omitted fields** (`BACKEND-QUALITY #1`) — partial update semantics violated; one partial-body client away from mass data loss.
7. **Import/restore is silently lossy and not authz-gated** (`F5`, `F6`, QUALITY #2) — any member can trigger a restore that bypasses the approval pipeline, injects cross-tenant FK references, and silently drops inventory/loans/attachments.

## Suggested fix order

1. **Week 1 (security)**: F1 attachments scoping, F2/F3 session revocation, F5 import authz, FRONTEND 1.3 CSRF guard in proxy route, FRONTEND 1.5/1.6 logout cache purge.
2. **Week 2 (data integrity)**: PATCH semantics fix, loan transaction (WR-01), `Config.Validate()` call, pagination clamp fix, DB housekeeping bundle (B7) + uniqueness hardening (B5).
3. **Schema milestone**: composite-key tenancy (B1) → RLS (B2) → sync redesign (B4). B3 (stock ledger) and B6 (unified media) are feature-sized; schedule with their respective feature work.
4. **Ongoing**: frontend API-base unification (2.1), giant page decomposition (3.1), i18n backfill (~150 missing ET/RU keys), test-quality fixes (arbitrary waits, conditional skips).
