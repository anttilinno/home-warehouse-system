# Phase 65: Item Lookup & Not-Found Flow — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 65-item-lookup-and-not-found-flow
**Areas discussed:** A. /items/new route shape, B. Exact-match guard, C. UPC enrichment UX, D. Match-state banner content

---

## A. /items/new route shape

### Q1 — Hand-off wiring

| Option | Description | Selected |
|--------|-------------|----------|
| New /items/new route + ItemFormPage (Recommended) | Add Route path="items/new" with a thin ItemFormPage reading ?barcode= from useSearchParams, renders existing ItemForm with defaultValues, on success navigates to /items/{id}. Matches ROADMAP SC#2 verbatim. | ✓ |
| Reuse ItemPanel via /items?new=1&barcode= | ItemsListPage reads ?new=1 and opens the slide-over pre-filled. Zero new page code but deviates from URL contract. | |
| New route mounting ItemPanel | ItemCreatePage at /items/new renders the same slide-over full-screen. More indirection. | |

### Q2 — Form defaults on /items/new

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-gen SKU + empty other fields (Recommended) | Mirrors ItemPanel create-mode parity. UPC enrichment (area C) can backfill name/brand/category on accept. | ✓ |
| Auto-gen SKU + auto-fire enrichment on mount | Same plus eagerly runs enrichment. | (same fetch will happen in area C decisions) |
| Minimal — barcode only, no SKU | Diverges from existing ItemPanel pattern. | |

### Q3 — Post-create navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to /items/{created.id} (Recommended) | Matches ItemPanel onSuccess contract. Invalidates itemKeys.all + scanKeys.lookup(code). | ✓ |
| Navigate back to /scan | Scanner was unmounted anyway (Pitfall #1); returning doesn't fix that. | |
| Navigate to /items (list) | Loses the continue-scanning thread. | |

### Q4 — Routes tree location

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling of /items and /items/:id (Recommended) | Alongside existing items routes in routes/index.tsx. New page at features/items/ItemFormPage.tsx. | ✓ |
| Nested under /items with shared layout | Requires layout route splitting. No obvious benefit. | |
| Under /scan/new-item | Research flagged as defer-to-later. Diverges from ROADMAP URL. | |

### Q5 — Page chrome

| Option | Description | Selected |
|--------|-------------|----------|
| Retro header + CREATE/CANCEL + dirty-guard (Recommended) | Mirrors ItemPanel look at full-page scale; dirty-check via existing onDirtyChange. | ✓ |
| Bare form, no dirty-guard | Stray tap / back button loses the scanned barcode. | |
| Full RetroDialog-style frame inside page | More styling; functionally same as option 1. | |

### Q6 — Reach beyond scanner

| Option | Description | Selected |
|--------|-------------|----------|
| Reachable but ItemPanel stays primary on /items (Recommended) | ItemPanel slide-over stays primary for list-page add. /items/new is alternate entry (scan, bookmark, future FAB). | ✓ |
| Make /items/new canonical; deprecate ItemPanel | Larger refactor; out of Phase 65 scope. | |
| /items/new is scan-only | Limits reuse; future FAB would need another decision. | |

---

## B. Exact-match guard

### Q1 — Match scope

| Option | Description | Selected |
|--------|-------------|----------|
| Barcode-only exact match (Recommended) | Compare item.barcode === code; SKU/short_code hits → not-found (user creates new). | ✓ |
| Barcode OR SKU OR short_code | Broader acceptance; matches v1.3 multi-entity intent but broadens 'match' semantics. | |
| Trust FTS — no client-side guard | Risky; FTS can fuzzy-match; violates LOOK-01 wording. | |

### Q2 — Case sensitivity

| Option | Description | Selected |
|--------|-------------|----------|
| Case-sensitive (Recommended) | Machine-read barcodes preserve case. Manual input preserves user's keystrokes. | ✓ |
| Case-insensitive | Changes established equality semantics; unnecessary. | |

### Q3 — Not-found signal

| Option | Description | Selected |
|--------|-------------|----------|
| Empty list OR guard-fails = not-found (Recommended) | Both conditions produce the same ScanLookupResult.match = null. Triggers LOOK-02 flow consistently. | ✓ |
| Guard-fail = separate 'fuzzy-match' state | Anti-feature per research ('no did-you-mean'). | |

### Q4 — Workspace_id defense placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inside itemsApi.lookupByBarcode helper (Recommended) | Helper does fetch + guard + workspace assertion. Logs structured console.error on mismatch. Can't be forgotten. | ✓ |
| Inside useScanLookup hook body | Splits responsibility. Harder to unit-test in isolation. | |
| Skip frontend assertion | Pitfall #5 regression risk; defense is cheap. | |

---

## C. UPC enrichment UX

### Q1 — Banner placement

| Option | Description | Selected |
|--------|-------------|----------|
| On /items/new only, above ItemForm (Recommended) | Matches ROADMAP SC#3 verbatim. Single query invocation. Clean separation. | ✓ |
| On both scan banner AND /items/new | Two query invocations; duplicates decision point. | |
| On scan banner only (before nav) | URL gets long (barcode + name + brand); escaping-prone. | |

### Q2 — Accept granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Per-field accept chips (Recommended) | Each suggested field has its own [USE] button + 'USE ALL' convenience. Matches 'never auto-written' for each field independently. | ✓ |
| Single APPLY SUGGESTIONS button | All-or-nothing; user has to delete mistakes after if suggestion mixes good + bad. | |
| Inline editable preview | Form-within-form complexity; banner shouldn't have its own inputs. | |

### Q3 — Category string handling

| Option | Description | Selected |
|--------|-------------|----------|
| Show as helper text only — never auto-fill (Recommended) | Displays 'Category hint: <string> — pick manually below'. Avoids fuzzy-match bugs and auto-category creation. | ✓ |
| Fuzzy-match to existing categories | Riskier; can be wrong. | |
| Skip category entirely | Most conservative; LOOK-03 wording mentions category so hint-only preserves the intent. | |

### Q4 — Failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Silent skip; no banner on { found: false } (Recommended) | Query runs; on error or found=false, banner simply never renders. console.error for observability, no user-facing toast. | ✓ |
| Inline 'Fetching suggestions…' spinner + toast on fail | More feedback but risks feeling slow. | |
| Always render banner with RETRY on fail | Clutters form in common case. | |

### Q5 — Fetch trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-fetch on mount when barcode matches /^\d{8,14}$/ (Recommended) | useQuery enabled on regex match. No fetch for QR URLs / short alphanumerics. | ✓ |
| Explicit 'LOOK UP SUGGESTIONS' button | Adds a tap; abuse surface is small anyway. | |
| Auto-fetch for any barcode | Contradicts LOOK-03 regex gate (which IS the spec). | |

### Q6 — Visual style

| Option | Description | Selected |
|--------|-------------|----------|
| RetroPanel with hazard-stripe header + per-field chips (Recommended) | Uses existing RetroPanel atom. No new retro primitive. Consistent vocabulary with ScanResultBanner + ScanErrorPanel. | ✓ |
| Inline one-liner with APPLY button | Contradicts per-field accept decision. | |
| New UpcSuggestionBanner atom in retro barrel | Overkill for a single use-site; retro barrel not widened in Phase 65. | |

### Q7 — API helper placement

| Option | Description | Selected |
|--------|-------------|----------|
| New lib/api/barcode.ts with barcodeApi + barcodeKeys (Recommended) | Mirrors existing one-domain-per-file pattern. Exported via lib/api/index.ts barrel. | ✓ |
| Extend lib/api/scan.ts with scanApi.lookupExternal | Keeps scan domain narrow. | |
| Co-locate in features/items/ | Inconsistent with every other domain helper. | |

---

## D. Match-state banner content

### Q1 — Match info displayed

| Option | Description | Selected |
|--------|-------------|----------|
| Name + short_code + VIEW ITEM button (Recommended) | Item.name uppercase + short_code mono + RetroButton to /items/{id}. Clean Phase 66 replacement boundary. | ✓ |
| Name only + VIEW link | Loses the short_code confirmation cue. | |
| Full preview (name + short_code + category + thumbnail) | Overlaps Phase 66 QuickActionMenu; risks throwaway UI. | |

### Q2 — Not-found rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Inside ScanResultBanner as a variant (Recommended) | Phase 66 replaces entire banner, so prop-surface widening is safe. One component for the post-decode moment. | ✓ |
| Separate ScanNotFoundPanel component | Cleaner boundaries but duplicates shell; Phase 66 then has to choose which one to replace. | |
| Toast + scanner resumes | Contradicts D-02 pause invariant and LOOK-02. | |

### Q3 — Loading state

| Option | Description | Selected |
|--------|-------------|----------|
| Banner with 'LOOKING UP…' + dimmed code (Recommended) | Banner renders immediately on decode; match/not-found swaps in when lookup resolves. SCAN AGAIN stays active. | ✓ |
| Banner shows code+format only until resolved | Slow network gives no signal that something is happening. | |
| Skeleton shimmer | Unnecessary complexity. | |

### Q4 — Error state

| Option | Description | Selected |
|--------|-------------|----------|
| Error variant with RETRY + CREATE (Recommended) | 'LOOKUP FAILED' + error message + RETRY (refetch) + CREATE ITEM fallback + SCAN AGAIN. User never stuck on flaky network. | ✓ |
| Treat error as not-found | Hides real failure modes; creating might also fail. | |
| Toast + scanner resumes | Loses error context + retry path. | |

### Q5 — History backfill on match

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — backfill entityType + entityId on match (Recommended) | New useScanHistory.update method; ScanPage effect calls it when lookup resolves to a match. Sets up Phase 66 cheap history-tap. | ✓ |
| No — leave entityType as 'unknown' | Phase 66 re-fetches on every history tap. | |

### Q6 — Manual format lookup behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Run lookup for every format including MANUAL (Recommended) | Same handleDecode code path per Phase 64 D-14/D-15; single code path matters. | ✓ |
| Skip lookup for MANUAL | Divergent flow; bad UX. | |

### Q7 — Cache settings

| Option | Description | Selected |
|--------|-------------|----------|
| staleTime 30s, gcTime 5m, enabled on code+workspaceId (Recommended) | Matches research/ARCHITECTURE recommendation. Rescanning same code within a session is instant. | ✓ |
| staleTime Infinity + manual invalidation | More invalidation surface to maintain across mutations. | |
| No cache (staleTime 0) | Wasteful for rescan-same-code pattern. | |

---

## Claude's Discretion

- Exact retro copy for every new string (EN first; ET gap-fill this phase).
- Visual treatment of "LOOKING UP…" text.
- Whether useScanHistory.update is a separate method or add() gains upsert semantics.
- Exact UpcSuggestionBanner row layout.
- Dirty-guard dialog copy on CANCEL / navigate-away from /items/new.
- /items/new ErrorBoundary wrapping.
- Precise structured-log `kind` strings.
- Whether enrichment staleTime:Infinity is per-query or app-level.

## Deferred Ideas

See CONTEXT.md `<deferred>` section — downstream phases (66–69), v2.3+ ideas (GTIN-14, duplicate-scan warning, inline dialog create flow, per-field rejection memory), and explicit "never" (auto-write, cross-tenant leak, new backend endpoint, shadcn/ui port).
