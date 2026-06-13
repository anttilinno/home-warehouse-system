---
phase: 11-scan
nyquist_compliant: false
wave_0_complete: false
---

# Phase 11 — Scan — VALIDATION

Pre-execution contract. Flags flip true only after execution closes Wave-0 gaps. Orchestrator
verifies at the phase gate.

## Requirement → evidence map
| Req | Deliverable | Verifiable by |
|-----|-------------|---------------|
| SCAN-01 | /scan single Window, BarcodeScanner mounted ONCE (persistent sibling, not in a RetroTabs panel) | scan page test (scanner stays mounted across tab switches) |
| SCAN-02 | decode QR/UPC-A/EAN-13/Code128 via @yudiel/react-qr-scanner@2.5.1 + barcode-detector; pause prop-driven | dep pin present; Scanner formats prop; pause via `paused` not unmount |
| SCAN-03 | AudioContext beep + haptic (ios-haptics / navigator.vibrate) + visual flash on scan | feedback util test (reduced-motion variant) |
| SCAN-04 | Android torch toggle (getCapabilities().torch), auto-hidden iOS | torch control gated on capability |
| SCAN-05 | Manual tab: RetroInput + LOOK UP CODE | manual-entry funnels to lookup handler |
| SCAN-06 | History tab last-10 (`hws-scan-history` localStorage), row tap re-fires | history util test (cap 10, re-fire) |
| SCAN-07 | clear history + confirm dialog | confirm-then-clear test |
| SCAN-08 | 4-state banner LOADING/MATCH/NOT-FOUND/ERROR via lookupByBarcode (reduced-motion cursor) | banner test (4 states from one handler) |
| SCAN-09 | NOT-FOUND → "Create item" → /items/new?barcode=<code> | banner CTA nav test |
| SCAN-10 | /^\d{8,14}$/ → USE/USE ALL/DISMISS prefill from GET /barcode/{code} into ItemFormPage | suggestion-banner test |
| SCAN-11 | post-MATCH quick-action overlay View Item / Loan / Back; gated (Loan hidden if active loan, Unarchive if archived, Mark Reviewed if needs_review) | overlay test (gating from is_archived/needs_review/byItem active) |
| SCAN-12 | /claim/:code (login) → MATCH item / 404 create-item-with-barcode (PORT LEGACY create-entity) | claim route test |

## Binding overrides (must hold in shipped code)
1. BarcodeScanner mounts ONCE in a persistent always-mounted sibling layer (RetroTabs unmounts panels — do NOT put the scanner in a panel); pause is the `paused` prop, never unmount.
2. Scanner stack EXACT pins: @yudiel/react-qr-scanner@2.5.1, barcode-detector@3.0.8, ios-haptics@0.1.4. Foundation plan `bun add` (NON-frozen install) + commit lockfile; later plans frozen.
3. Formats restricted to QR/UPC-A/EAN-13/Code128.
4. Feedback: AudioContext beep + ios-haptics(iOS17.4+)/navigator.vibrate + visual flash; prefers-reduced-motion-aware.
5. Torch via MediaStreamTrack applyConstraints gated on getCapabilities().torch; iOS auto-hide.
6. History localStorage `hws-scan-history`, last 10, clear-with-confirm.
7. ONE post-scan handler funnels live-scan + history-tap + manual-entry → lookupByBarcode → banner → quick-actions. encodeURIComponent path-guard (already in lookupByBarcode).
8. Add `needs_review` to frontend2 Item type; active-loan gate via loansApi.byItem active.length; Loan → /loans/new?itemId=; MARK REVIEWED only if items update can clear needs_review.
9. SCAN-12 = PORT LEGACY create-entity (NO new backend, NO claim-as-loan).
10. routes/index.tsx + Sidebar.tsx single-writer (the /scan + /claim/:code routes + Scan nav); render-loop guard; query keys ["item-by-barcode"|"barcode", ...].

## Phase gate (orchestrator)
- tsc clean, full `bun run test` green, build, lint:imports OK.
- Live Playwright by-barcode spec (MANUAL-entry path: manual code → MATCH + NOT-FOUND banners) isolated (auth limiter) — re-establishes the G-65-01 guard.
- gsd-verifier PASS; flip SCAN-01..12 + traceability; log residues (camera/torch/haptic are device-only human-UAT residues).

## Nyquist sign-off (flip after execution)
- [ ] scanner stack added (3 pins) + lockfile committed.
- [ ] scan page (single-mount) + manual + history + banner + quick-actions + claim shipped + tests green.
- [ ] by-barcode E2E spec discovered + green (manual path).
