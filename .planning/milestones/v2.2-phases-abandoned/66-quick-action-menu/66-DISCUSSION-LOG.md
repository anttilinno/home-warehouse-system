# Phase 66: Quick-Action Menu — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `66-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 66 — quick-action-menu
**Areas discussed:** Overlay container, Banner replacement scope, Loan button behavior, Action layout + timing

---

## Out-of-band Question

**User:** "How far am I from feature parity with frontend1?"

**Answered inline** before discussion areas. Summary:
- Phase 66 itself is *ahead* of legacy v1.3 on state branching (legacy has none).
- Lost vs legacy in Phase 66 scope: MOVE (no inventory-move UI in /frontend2) + REPAIR (no repair-log feature in /frontend2) — both intentionally deferred per REQUIREMENTS.md:89–90.
- Remaining v2.2 parity gap (Phases 67–70): FAB, Loan scan preselect, Quick Capture port, Taxonomy cascade.
- Beyond v2.2: Repair Log port, Declutter assistant, offline/PWA, bulk ops.

---

## Overlay container

### Q1 — Which primitive should the QuickActionMenu overlay be built from?

| Option | Description | Selected |
|--------|-------------|----------|
| RetroDialog (Recommended) | Native HTML `<dialog>` via showModal(). Browser gives ESC + ::backdrop scroll-lock + focus-trap for free. Already used elsewhere in /frontend2. Fixed max-w-[480px], centered. Least new code, established primitive. | ✓ |
| Bottom sheet (custom) | RetroPanel + fixed z-stack rising from bottom of viewport (thumb-friendly on mobile). Copies AppShell.tsx:44–59 backdrop pattern. Slides up on open, down on close. Requires custom ESC handler, focus-trap, and scroll-lock. More UX polish for mobile, more code + test surface. | |
| Inline panel (no overlay) | Keep rendering QuickActionMenu in-flow above the tabpanel (same slot as current ScanResultBanner). No backdrop, no modal semantics. Minimal intrusion — scanner remains visible below. Simplest possible change; closest to Phase 65's banner pattern. | |

**User's choice:** RetroDialog (Recommended)
**Notes:** Preview selected with the centered-modal ASCII. Established primitive + free a11y primitives.

### Q2 — When should the RetroDialog open/close relative to the banner+pause state?

| Option | Description | Selected |
|--------|-------------|----------|
| Open immediately on decode (Recommended) | Dialog opens the moment banner is set. Shows LOADING inside the dialog while useScanLookup resolves. Scanner paused for the whole dialog-open lifetime. Matches Phase 64 D-02 invariant (paused = banner !== null) without edit. | ✓ |
| Open only after match resolves | Dialog opens only when lookup.status === 'success' && lookup.match. Other states still render inline via ScanResultBanner. Two rendering surfaces post-decode; cleaner separation of concerns but more orchestration in ScanPage. | |
| Open on decode, close on not-found/error | Opens immediately, auto-closes when lookup resolves to not-found or error. Oscillation on slow networks. | |

**User's choice:** Open immediately on decode
**Notes:** Keeps the Phase 64 D-02 invariant unchanged; dialog open is synchronous with banner state.

### Q3 — Should ESC / backdrop-click / explicit [X] / 'BACK TO SCAN' all behave identically?

| Option | Description | Selected |
|--------|-------------|----------|
| All identical: close + unpause (Recommended) | All four triggers call setBanner(null) which closes dialog AND unpauses scanner. Simplest mental model. | ✓ |
| BACK TO SCAN only; X/ESC/backdrop just close dialog | BACK TO SCAN unpauses + clears banner; X/ESC/backdrop just close the overlay but leave banner state intact. More state-machine complexity. | |
| Disable backdrop-click; ESC/X/BACK TO SCAN identical | Block default ::backdrop click to prevent accidental dismissal on mis-taps. | |

**User's choice:** All identical: close + unpause
**Notes:** One dismissal semantics; no "half-dismissed" states.

### Q4 — What does the scanner viewfinder look like underneath the dialog while it's open?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep visible, dimmed by native ::backdrop (Recommended) | Scanner stays mounted and paused; user sees the frozen last-frame camera preview dimmed 50% by the dialog's backdrop. Preserves spatial context. Zero extra work. | ✓ |
| Hide viewfinder (scanner tab content swapped) | When dialog is open, render a placeholder or nothing in the scan tab panel. Cleaner visual but adds state branching. May re-trigger camera re-permission on iOS. | |

**User's choice:** Keep visible, dimmed by native ::backdrop
**Notes:** No iOS re-permission risk.

---

## Banner replacement scope

### Q5 — Does QuickActionMenu own all 4 lookup states (LOADING/MATCH/NOT-FOUND/ERROR), or only MATCH?

| Option | Description | Selected |
|--------|-------------|----------|
| All 4 states — delete ScanResultBanner (Recommended) | QuickActionMenu is the single post-decode surface. Dialog opens on decode with LOADING, content morphs per lookup.status. ScanResultBanner + 2 test files deleted. | ✓ |
| MATCH only — banner stays for the other 3 | QuickActionMenu opens only on match. ScanResultBanner keeps rendering LOADING / NOT-FOUND / ERROR inline. Two post-decode rendering surfaces. | |

**User's choice:** All 4 states — delete ScanResultBanner
**Notes:** Executes the Phase 65 D-17 scope-lock verbatim.

### Q6 — Inside the dialog on NOT-FOUND, how should the 'create item' action appear?

| Option | Description | Selected |
|--------|-------------|----------|
| CREATE ITEM WITH THIS BARCODE as primary action (Recommended) | NOT-FOUND renders CREATE ITEM WITH THIS BARCODE button (nav to /items/new?barcode=<code>) as Phase 65 D-19 + BACK TO SCAN. | ✓ |
| Close dialog + show inline NOT FOUND banner | Dialog auto-closes on not-found; user sees inline 'NOT FOUND' panel. Re-creates banner surface despite deletion. | |

**User's choice:** CREATE ITEM WITH THIS BARCODE as primary action
**Notes:** Reuses Phase 65 navigation handler + muscle memory.

### Q7 — On lookup ERROR inside the dialog, what actions are shown?

| Option | Description | Selected |
|--------|-------------|----------|
| RETRY + CREATE ITEM fallback + BACK TO SCAN (Recommended) | Mirror current ScanResultBanner D-21: LOOKUP FAILED hazard stripe + RETRY (lookup.refetch) + CREATE ITEM WITH THIS BARCODE fallback + BACK TO SCAN. | ✓ |
| RETRY + BACK TO SCAN only | No CREATE ITEM fallback on error. Can strand the user if backend is down. | |

**User's choice:** RETRY + CREATE ITEM fallback + BACK TO SCAN
**Notes:** Most recoverable UX.

### Q8 — While useScanLookup is in flight (LOADING state), what's inside the dialog?

| Option | Description | Selected |
|--------|-------------|----------|
| LOOKING UP… + dimmed code echo + BACK TO SCAN (Recommended) | Reuse the Phase 65 D-20 loading treatment. No action button skeletons (they'd flicker on resolve). | ✓ |
| LOOKING UP + skeleton of disabled action buttons | Show eventual action layout with all buttons disabled/skeletonized. Risks action flicker when Loan→Unarchive swap happens. | |

**User's choice:** LOOKING UP… + dimmed code echo + BACK TO SCAN
**Notes:** Avoids button-identity flicker across LOADING → MATCH.

---

## Loan button behavior

### Q9 — Phase 68 (INT-LOAN-01) ships /loans/new?itemId preselect later. In Phase 66, what does LOAN do?

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to /loans/new?itemId=<id> now (Recommended) | Phase 66 sets the URL; LoanForm ignores unknown params today (user re-picks item manually). Phase 68 scope shrinks to one line in LoanForm: read itemId from useSearchParams and preselect. | ✓ |
| Navigate to /loans/new (no itemId param) | User lands on /loans/new with nothing preselected. Phase 68 has to retrofit the URL shape too. | |
| No-op stub button (nothing happens) | Button rendered for QA-02 compliance but onClick does nothing. Confusing. | |
| Disabled 'Coming soon' button | Button visible but disabled. Honest but unusable for one phase. | |

**User's choice:** Navigate to /loans/new?itemId=<id> now
**Notes:** Splits INT-LOAN-01 across the seam the roadmap already implies (Phase 66 = button + URL, Phase 68 = form wiring).

### Q10 — While useLoansForItem(item.id) is in flight, how should the LOAN button render?

| Option | Description | Selected |
|--------|-------------|----------|
| Show skeleton / disabled LOAN button (Recommended) | Render a disabled LOAN placeholder during the loading window; swap to real LOAN / Unarchive / hidden once activeLoan resolves. No misleading 'click me' affordance. | ✓ |
| Optimistically show LOAN as enabled | Show LOAN immediately; hide it if activeLoan resolves to non-null. Button flickers out from under user's finger. | |
| Hide LOAN until resolved | Render menu WITHOUT LOAN until useLoansForItem resolves. Layout shift. | |

**User's choice:** Show skeleton / disabled LOAN button
**Notes:** Flicker bounded to the LOAN/UNARCHIVE slot; other actions render normally.

### Q11 — When the user taps VIEW ITEM, LOAN (nav), or CREATE ITEM — should the dialog close before navigating, or just navigate?

| Option | Description | Selected |
|--------|-------------|----------|
| setBanner(null) first, then navigate (Recommended) | Explicitly close dialog + clear banner state before navigate(). On browser-back, user lands on /scan with clean scanner state. | ✓ |
| Navigate only; dialog tears down on unmount | Just navigate(). ScanPage unmounts on route change. Simpler but browser-back may restore banner state. | |

**User's choice:** setBanner(null) first, then navigate
**Notes:** Defensive against router state restoration on back navigation.

---

## Action layout + timing

### Q12 — How should the action buttons be laid out in the dialog?

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical stack, full-width RetroButtons (Recommended) | Each action is a full-width row (primary for lead, neutral for rest). Thumb-friendly on mobile. Scales cleanly from 2 actions to 4. Consistent with RetroConfirmDialog. | ✓ |
| 2-column grid (legacy v1.3 parity) | Grid-cols-2 matching legacy quick-action-menu.tsx. Awkward with odd action counts. | |
| Prominent primary + row of secondaries | Lead action tall/prominent; other actions in horizontal row below. More CSS complexity. | |

**User's choice:** Vertical stack, full-width RetroButtons
**Notes:** Preview selected — full-width rows scale to all state-branching combinations from the D-16 matrix.

### Q13 — How should MARK REVIEWED and UNARCHIVE behave when tapped?

| Option | Description | Selected |
|--------|-------------|----------|
| Fire mutation + toast + button disappears (Recommended) | useMarkReviewedItem / useRestoreItem runs with onSuccess invalidation; toast shows confirmation; button not rendered on next tick. Dialog stays open. | ✓ |
| Confirm-first via RetroConfirmDialog | Stacked confirm dialog. Awkward over an already-open dialog. Overkill for reversible actions. | |
| Fire mutation + toast + close overlay | Auto-close after mutation. Breaks "stay on /scan, keep scanning" invariant. | |

**User's choice:** Fire mutation + toast + button disappears
**Notes:** Matches existing useArchiveItem/useRestoreItem pattern; dialog stays open for further actions.

### Q14 — What gets the prominent/primary button variant in the MATCH state?

| Option | Description | Selected |
|--------|-------------|----------|
| VIEW ITEM (Recommended) | Lead action matches current ScanResultBanner D-18 MATCH. LOAN + MARK REVIEWED + BACK TO SCAN as neutral/secondary. Preserves Phase 65 user muscle memory. | ✓ |
| LOAN | LOAN is the primary CTA — implies scan flow is mostly about loans. | |
| No primary emphasis — all same variant | Every action uses neutral variant. Flat hierarchy; matches legacy look. | |

**User's choice:** VIEW ITEM
**Notes:** Consistent with Phase 65 banner MATCH state.

### Q15 — If item has needs_review=true AND also no active loan AND not archived, how do MARK REVIEWED + LOAN coexist?

| Option | Description | Selected |
|--------|-------------|----------|
| Both shown; MARK REVIEWED below LOAN (Recommended) | Order: VIEW ITEM (primary) → LOAN → MARK REVIEWED → BACK TO SCAN. needs_review is additive — doesn't replace LOAN. | ✓ |
| MARK REVIEWED replaces LOAN until reviewed | Treat needs_review as a gate. Forces workflow that may not match intent. | |
| MARK REVIEWED appears only when reopening the overlay | Hide MARK REVIEWED until explicit request. Hides a primary requirement affordance. | |

**User's choice:** Both shown; MARK REVIEWED below LOAN
**Notes:** QA-03 wording says "shown when flagged", not "replaces".

---

## Claude's Discretion

The user deferred these to Claude (documented in 66-CONTEXT.md `<decisions>` § Claude's Discretion):
- Exact retro copy for every new string (EN first; ET hand-fill in-phase)
- Visual treatment of the item metadata header inside the MATCH dialog
- Inline vs file-split for `useMarkReviewedItem()` (prefer inline in useItemMutations.ts)
- Dialog open/close animation (RetroDialog has none; leave as-is, respect prefers-reduced-motion)
- `aria-busy` treatment vs plain disabled RetroButton for LOADING LOAN skeleton
- retro-cursor-blink reuse on LOOKING UP… line
- Test harness extension pattern (reuse `renderWithProviders` unless repetitive)
- Structured-log `kind` strings (match Phase 64 D-12 vocabulary)

## Deferred Ideas

Captured in 66-CONTEXT.md `<deferred>`:

**Downstream phases:** LoanForm reads ?itemId= (Phase 68), FAB (Phase 67), Quick Capture (Phase 69), Taxonomy cascade (Phase 70).

**Beyond v2.2:** Move action (blocked on inventory-move UI), Repair action (blocked on repair-log port), Container/location barcode lookup (schema gap), Offline scan queue (online-only stance), Long-press/swipe gestures, Per-item shortcut config, Inline create-item dialog on /scan, Optimistic mutations, Action analytics.

**Never:** Grid layout (legacy parity), Confirm-first on Mark Reviewed/Unarchive, Gate loan on needs_review, Close overlay after Mark Reviewed/Unarchive, ScanResultBanner kept as fallback.
