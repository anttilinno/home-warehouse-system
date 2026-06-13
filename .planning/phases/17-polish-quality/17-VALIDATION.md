# Phase 17 — VALIDATION (acceptance gate)

Phase passes only when ALL are GREEN (orchestrator-run, real — not subagent self-report).

## Automated gate
- Frontend: `cd frontend2 && bun run lint:tsc && bun run test && bun run build && bun run lint:imports` all green.
- i18n guards still green: `bun run lint:i18n && bun run lint:i18n:format` (no new untranslated strings; any new UI string in et+ru).
- **POL-04**: `node scripts/check-bundle-budget.mjs` exits 0 against a fresh `vite build`; self-tests `node --test scripts/__tests__/check-bundle-budget.test.mjs` pass; the script FAILS (exit 1) when a chunk is artificially bloated (prove regression detection via a fixture).
- Backend (only if touched): `cd backend && go build ./... && go test ./...` + any new `-tags=integration` suite (TEST_DATABASE_URL=...warehouse_test).

## Live E2E gate (against dev stack :5173/:8080)
- **POL-02**: `bun run test:e2e e2e/a11y-sweep.spec.ts` (chromium) — zero serious/critical axe violations across the swept routes.
- **POL-03**: `bun run test:e2e e2e/keyboard-nav.spec.ts` — focus-visible reachable, ESC closes modal, no trap.
- **POL-05**: `bun run test:e2e e2e/responsive.spec.ts` — 5-breakpoint structural contract holds; dashboard screenshots captured.
- Existing specs still pass (spot-check the phase's touched specs; full 15-spec run batched to avoid the 20/min auth limiter — restart backend if mass auth-fail).

## Verification
- `gsd-verifier` (sonnet): goal-backward PASS on POL-01..06.
- POL-01 + POL-06: `COVERAGE-MATRIX.md` + `ENDPOINT-DIFF.md` committed; every HTTP-crossing flow maps to an E2E or Go integration test (gaps either filled or logged as deferred-with-reason).

## Success-criteria → evidence map
| SC | Evidence |
|---|---|
| POL-01 every flow tested | COVERAGE-MATRIX.md maps flows→specs; gap-fill committed |
| POL-02 axe sweep clean | a11y-sweep.spec passes; @axe-core/playwright wired |
| POL-03 keyboard nav | keyboard-nav.spec passes; global focus-visible fallback |
| POL-04 bundle guard | check-bundle-budget.mjs + manifest + CI job; regression-detect proven |
| POL-05 breakpoint matrix | responsive.spec at 320/360/768/1024/1440; screenshots; visual-diff residue logged |
| POL-06 parity gate | ENDPOINT-DIFF.md (parity complete, deltas documented); route checklist |

## Residues expected → FINAL-REVIEW-CHECKLIST
- Pixel visual-diff vs sketch 006 PNG (human eye; structural asserted).
- `e2e-frontend2.yml` CI workflow needs first-real-PR validation (orchestrator can't run GH Actions).
- One-week dogfooding before legacy `frontend/` retirement (POL-06).
- 3 niche legacy inventory endpoints (`/inventory/{id}/loans`, `/available/{itemId}`, `/total-quantity/{itemId}`) deferred to backlog.
