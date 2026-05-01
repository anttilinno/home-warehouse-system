#!/usr/bin/env bash
# Smoke verification for Phase 1 (FOUND-01 + FOUND-02).
# Run from repo root: bash scripts/verify-phase-01-scaffold.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== FOUND-02: forbidden-imports grep guard ==="
node scripts/check-forbidden-imports.mjs
node --test scripts/__tests__/check-forbidden-imports.test.mjs

echo "=== FOUND-01: frontend2 scaffold typecheck + build ==="
cd "$REPO_ROOT/frontend2"
bun run lint:tsc
bun run lint:imports
bun run build
test -f dist/index.html
if grep -rq '__react-query-devtools' dist/; then
  echo "FAIL: dist/ contains react-query-devtools strings (Pitfall 4)" >&2
  exit 1
fi

echo "=== FOUND-01: dev server smoke (foreground 5s) ==="
# CSR-aware smoke: Vite serves the unmodified index.html — the placeholder text
# is rendered by React at runtime, NOT by the dev server. So we (a) confirm the
# dev server returns HTTP 200 with the index.html shell, and (b) confirm the
# placeholder text is present in the BUILT bundle (proves the React tree
# compiled the route correctly). This mirrors the documented Deviation #6 in
# 01-01-SUMMARY.md (curl|grep against CSR is unsatisfiable without a headless
# browser; full DOM-render assertion is deferred to Phase 5/6 Playwright).
bun run dev &> /tmp/vite-dev-smoke.log &
DEVPID=$!
trap 'kill "$DEVPID" 2>/dev/null || true' EXIT
sleep 4
if ! curl -sf http://localhost:5173/ | grep -q '<div id="root">'; then
  echo "FAIL: dev server did not return the index.html shell" >&2
  tail -50 /tmp/vite-dev-smoke.log >&2
  exit 1
fi
kill "$DEVPID" 2>/dev/null || true
trap - EXIT
# Bundle-side assertion: the placeholder text must be present in the built JS
# bundle (proves the React route compiled and the text reaches the client).
if ! grep -rq "frontend2 — v3.0 placeholder shell" dist/assets/ 2>/dev/null; then
  echo "FAIL: built bundle does not contain placeholder shell text" >&2
  exit 1
fi

echo "=== ALL CHECKS PASSED ==="
