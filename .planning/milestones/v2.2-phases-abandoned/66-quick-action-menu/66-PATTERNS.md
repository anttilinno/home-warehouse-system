# Phase 66: Quick-Action Menu — Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 11 (3 NEW, 5 MODIFIED, 3 DELETED)
**Analogs found:** 11 / 11 (all creations/modifications have a strong in-repo analog)

---

## File Classification

| File | Action | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `frontend2/src/features/scan/QuickActionMenu.tsx` | NEW | component (dialog overlay) | state-branching, request-response (via injected callbacks) + client-side query read | `frontend2/src/components/scan/ScanResultBanner.tsx` (prop surface, 4-state branching, copy) + `frontend2/src/components/retro/RetroConfirmDialog.tsx` (RetroDialog consumption + mount/unmount lifecycle) | exact (props) + exact (dialog plumbing) |
| `frontend2/src/features/scan/__tests__/QuickActionMenu.test.tsx` | NEW | test (component) | state-matrix + event-driven (user interactions) | `frontend2/src/components/scan/__tests__/ScanResultBanner.states.test.tsx` (state-matrix per-branch coverage) + `ScanResultBanner.test.tsx` (migrated Phase 64 MATCH assertions) | exact |
| `useMarkReviewedItem` (NEW symbol inside `frontend2/src/features/items/hooks/useItemMutations.ts`) | NEW EXPORT | hook (TanStack mutation) | CRUD (PATCH) | `useRestoreItem` (`useItemMutations.ts` lines 95–108) | exact |
| `frontend2/src/features/scan/ScanPage.tsx` | MODIFIED | orchestrator page | request-response + event-driven | self (existing `{banner && <ScanResultBanner … />}` block at lines 230–246 is the swap site) | self-reference |
| `frontend2/src/components/scan/index.ts` | MODIFIED | barrel | N/A | self (lines 1–10) — remove `ScanResultBanner` export | self-reference |
| `frontend2/src/features/scan/__tests__/ScanPage.test.tsx` | MODIFIED | test (integration) | event-driven | self (Phase 65 assertions targeting `ScanResultBanner`) — re-home to `QuickActionMenu` | self-reference |
| `frontend2/locales/en/messages.po` | MODIFIED | i18n catalog | N/A | Phase 65 diff (lines 1336, 1378, 1543, 1340, 1937, 2281, 680, 1864) — msgid additions + reuse | exact |
| `frontend2/locales/et/messages.po` | MODIFIED | i18n catalog | N/A | Phase 65 ET diff (same line numbers, lines 1136, 1336–1341, 1378, 1543–1544, 1864–1865, 2281–2282) — msgstr hand-fill | exact |
| `frontend2/src/components/scan/ScanResultBanner.tsx` | DELETED | — | — | N/A (deletion) | N/A |
| `frontend2/src/components/scan/__tests__/ScanResultBanner.test.tsx` | DELETED | — | — | N/A (deletion; assertions re-homed) | N/A |
| `frontend2/src/components/scan/__tests__/ScanResultBanner.states.test.tsx` | DELETED | — | — | N/A (deletion; coverage re-homed into `QuickActionMenu.test.tsx`) | N/A |

---

## Pattern Assignments

### `frontend2/src/features/scan/QuickActionMenu.tsx` (NEW — component, state-branching)

**Primary analog:** `frontend2/src/components/scan/ScanResultBanner.tsx`
**Dialog-plumbing analog:** `frontend2/src/components/retro/RetroConfirmDialog.tsx`
**Loans-probe analog:** `frontend2/src/features/loans/hooks/useLoansForItem.ts` (usage pattern)
**Toast analog:** `frontend2/src/features/items/hooks/useItemMutations.ts` (mutation + toast composition)

#### Imports pattern — from `ScanResultBanner.tsx` lines 30–34

```typescript
import { useLingui } from "@lingui/react/macro";
import { RetroPanel, RetroButton, HazardStripe } from "@/components/retro";
import { formatScanTime } from "@/lib/scanner";
import type { ScanLookupStatus } from "@/lib/api/scan";
import type { Item } from "@/lib/api/items";
```

**Phase 66 delta:**
- Replace `RetroPanel` with `RetroDialog, type RetroDialogHandle` (same barrel).
- Add `useEffect, useRef` from `react` for dialog open/close lifecycle.
- Add `useLoansForItem` from `@/features/loans/hooks/useLoansForItem`.
- Add `useMarkReviewedItem, useRestoreItem` from `@/features/items/hooks/useItemMutations`.
- `RetroPanel` import is DROPPED — `QuickActionMenu` does not render one.

#### Prop-surface pattern — from `ScanResultBanner.tsx` lines 36–51

```typescript
export interface ScanResultBannerProps {
  code: string;
  format: string;
  timestamp: number;
  lookupStatus: ScanLookupStatus;
  match: Item | null;
  onScanAgain: () => void;
  onViewItem?: (itemId: string) => void;
  onCreateWithBarcode?: (code: string) => void;
  onRetry?: () => void;
}
```

**Phase 66 delta (D-19):** copy 1:1 into `QuickActionMenuProps`, then ADD three new required callbacks:

```typescript
  /** Rendered in MATCH state when activeLoan === null && !is_archived. */
  onLoan: (itemId: string) => void;
  /** Rendered in MATCH state when needs_review && !is_archived. */
  onMarkReviewed: (itemId: string) => void;
  /** Rendered in MATCH state when is_archived === true. */
  onUnarchive: (itemId: string) => void;
```

#### Dialog lifecycle — from `RetroConfirmDialog.tsx` lines 56–63 + `RetroDialog.tsx` lines 22–27

```typescript
// RetroConfirmDialog forwards open/close via an imperative handle:
const innerRef = useRef<RetroDialogHandle>(null);
useImperativeHandle(ref, () => ({
  open: () => innerRef.current?.open(),
  close: () => innerRef.current?.close(),
}));
```

```typescript
// RetroDialog itself (the primitive being consumed):
const dialogRef = useRef<HTMLDialogElement>(null);
useImperativeHandle(ref, () => ({
  open: () => dialogRef.current?.showModal(),
  close: () => dialogRef.current?.close(),
}));
```

**Phase 66 pattern (D-02, D-20):** `QuickActionMenu` does NOT `forwardRef`. It mounts/unmounts driven by the caller's `{banner && …}` conditional, and owns its own open/close internally:

```typescript
const dialogRef = useRef<RetroDialogHandle>(null);
useEffect(() => {
  dialogRef.current?.open();
  return () => {
    dialogRef.current?.close();
  };
}, []);
```

Mount = `showModal()`; unmount (when `banner` flips to `null`) = `close()`. Guard against React StrictMode double-mount (Pitfall #4) by either:
- Ignoring — `showModal()` on an already-open dialog throws `InvalidStateError`; wrap in try/catch; OR
- Use a mount-ref guard (`mountedRef.current` toggled in the effect).

#### Variant derivation — from `ScanResultBanner.tsx` lines 70–79

```typescript
const variant: BannerVariant =
  lookupStatus === "loading"
    ? "loading"
    : lookupStatus === "error"
      ? "error"
      : lookupStatus === "success"
        ? match
          ? "match"
          : "not-found"
        : "loading";
```

**Reuse verbatim** — same four states, same precedence, idle→loading fallback (prevents the "loading-but-no-banner" gap in the first render tick after decode).

#### Heading copy — from `ScanResultBanner.tsx` lines 88–95

```typescript
const heading =
  variant === "loading"
    ? t`LOOKING UP…`
    : variant === "match"
      ? t`MATCHED`
      : variant === "not-found"
        ? t`NOT FOUND`
        : t`LOOKUP FAILED`;
```

**Reuse verbatim** (UI-SPEC §Copywriting Contract → REUSE row). All four msgids already exist in `frontend2/locales/en/messages.po` and `frontend2/locales/et/messages.po`. No new heading msgids in Phase 66.

#### Hazard stripe mapping — from `ScanResultBanner.tsx` lines 81–86

```typescript
const stripe: "red" | "yellow" | null =
  variant === "error"
    ? "red"
    : variant === "not-found"
      ? "yellow"
      : null;
```

**Reuse verbatim.** Placement differs: `<HazardStripe variant={stripe} className="mb-md" />` INSIDE the `RetroDialog` body (above the heading). `RetroDialog` itself has a built-in hazard stripe controlled by `hideHazardStripe` — set `hideHazardStripe` to `true` and render our own state-conditional stripe (so MATCH and LOADING render NO stripe).

#### Loading cursor glyph — from `ScanResultBanner.tsx` lines 100–107

```typescript
<h2 className="text-[20px] font-bold uppercase text-retro-ink mb-sm">
  {heading}
  {variant === "loading" && (
    <span className="retro-cursor-blink ml-xs" aria-hidden="true">
      ▍
    </span>
  )}
</h2>
```

**Reuse verbatim.** The `.retro-cursor-blink` CSS class from Phase 65 globals.css already respects `prefers-reduced-motion: reduce`.

#### MATCH metadata block — from `ScanResultBanner.tsx` lines 110–129 (NAME+CODE rows) + 148–160 (FORMAT pill) + 174–178 (timestamp)

```typescript
{variant === "match" && match && (
  <>
    <div className="flex items-center gap-md flex-wrap">
      <span className="font-mono font-bold uppercase text-[14px] text-retro-charcoal">
        {t`NAME`}
      </span>
      <span className="font-mono font-bold text-[24px] text-retro-ink break-all">
        {match.name}
      </span>
    </div>
    <div className="flex items-center gap-md flex-wrap">
      <span className="font-mono font-bold uppercase text-[14px] text-retro-charcoal">
        {t`CODE`}
      </span>
      <span className="font-mono font-bold text-[24px] text-retro-ink break-all">
        {match.short_code}
      </span>
    </div>
  </>
)}
```

```typescript
// Format pill (shown in LOADING / MATCH / NOT-FOUND, NOT in ERROR)
<div className="flex items-center gap-md flex-wrap">
  <span className="font-mono font-bold uppercase text-[14px] text-retro-charcoal">
    {t`FORMAT`}
  </span>
  <span
    data-testid="scan-format-pill"
    className="font-mono text-[12px] uppercase border-retro-thick border-retro-ink bg-retro-amber text-retro-ink px-sm py-xs"
  >
    {format}
  </span>
</div>
```

```typescript
// Timestamp (MATCH only)
{variant === "match" && (
  <p className="font-mono text-[14px] text-retro-charcoal">
    {formatScanTime(timestamp)}
  </p>
)}
```

**Reuse verbatim** — the `scan-format-pill` testid is preserved so the migrated `ScanPage.test.tsx` assertion still binds.

#### NOT-FOUND / ERROR body copy — from `ScanResultBanner.tsx` lines 162–172

```typescript
{variant === "not-found" && (
  <p className="font-sans text-[14px] text-retro-ink">
    {t`No item in this workspace matches this barcode.`}
  </p>
)}

{variant === "error" && (
  <p className="font-sans text-[14px] text-retro-ink">
    {t`Could not reach the server. Check your connection and retry, or create a new item with this barcode.`}
  </p>
)}
```

**Reuse verbatim.** Both msgids are already in the EN+ET catalogs (UI-SPEC §Body Copy).

#### Action-button LAYOUT — DEPARTURE from banner (D-12, UI-SPEC §Delta from Phase 65)

Banner (lines 181–200) uses `<div className="flex flex-wrap gap-md justify-end mt-md">` (horizontal wrapping). **Phase 66 diverges**: vertical stack, full-width buttons.

```typescript
// NEW layout for QuickActionMenu
<div className="flex flex-col gap-md mt-lg">
  {/* buttons stacked top-to-bottom, each w-full */}
</div>
```

Every `RetroButton` gets `className="w-full"`; exactly one is `variant="primary"` per state (UI-SPEC §Primary CTA).

#### Action matrix in MATCH — from CONTEXT.md D-16 / UI-SPEC §Action Matrix

```typescript
// Inside MATCH branch, AFTER the metadata block:
const isArchived = match.is_archived === true;
const needsReview = match.needs_review === true;
const loansProbe = useLoansForItem(
  lookupStatus === "success" && match ? match.id : undefined
);
// activeLoan is null until resolved OR when no active loan exists; use
// query.isPending + isArchived + probe error to disambiguate (D-10, D-22).

// Render order:
// 1. VIEW ITEM (primary) — always in MATCH
// 2. LOAN | UNARCHIVE | (skeleton) | (hidden)
// 3. MARK REVIEWED (if needsReview && !isArchived)
// 4. BACK TO SCAN (neutral, always last)
```

#### LOAN slot loading skeleton — from CONTEXT.md D-10 + UI-SPEC §Action Matrix notes

```typescript
{loansProbe.isPending && !isArchived && (
  <RetroButton variant="neutral" disabled aria-busy="true" className="w-full">
    {t`LOAN`}
  </RetroButton>
)}
```

Uses the standard `disabled` styling on `RetroButton` — no new CSS. `aria-busy="true"` announces transient state to AT.

#### Mutation-triggered actions — from `useItemMutations.ts` lines 95–108 usage pattern

The component invokes the hooks and calls `.mutate(match.id)`. Dialog stays open (D-11). Toast + refetch handled inside the hooks:

```typescript
const markReviewed = useMarkReviewedItem();
const restore = useRestoreItem();

// Handler bound to the neutral-variant button:
<RetroButton
  variant="neutral"
  className="w-full"
  onClick={() => markReviewed.mutate(match.id)}
>
  {t`MARK REVIEWED`}
</RetroButton>
```

#### Structured error log — from CONTEXT.md D-22

```typescript
// Inside the component, watching loansProbe.error:
useEffect(() => {
  if (loansProbe.error) {
    console.error({
      kind: "scan-loans-probe-fail",
      itemId: match?.id,
      error: loansProbe.error,
    });
  }
}, [loansProbe.error, match?.id]);
```

When `loansProbe.error` is truthy, HIDE the LOAN button entirely (conservative — don't render a loan action whose state we can't verify).

#### Dialog `onClose` wiring — from `RetroConfirmDialog.tsx` lines 74–78 + 83–85

```typescript
// RetroConfirmDialog pattern — onCancel fires both from `<dialog>` native
// close (ESC, backdrop) and from the cancel button:
const handleCancel = () => {
  onCancel?.();
  innerRef.current?.close();
};

<RetroDialog ref={innerRef} onClose={onCancel} hideHazardStripe={…}>
```

**Phase 66 pattern (D-03 dismiss parity):** wire `onClose={onScanAgain}` on `RetroDialog` so ESC / backdrop / built-in `[X]` / in-dialog `BACK TO SCAN` all converge on `onScanAgain()` → `setBanner(null)` in the parent. Set `hideHazardStripe={true}` — the component draws its own state-conditional stripe.

---

### `frontend2/src/features/scan/__tests__/QuickActionMenu.test.tsx` (NEW — test, state-matrix)

**Primary analog:** `frontend2/src/components/scan/__tests__/ScanResultBanner.states.test.tsx`
**Secondary analog:** `frontend2/src/components/scan/__tests__/ScanResultBanner.test.tsx` (Phase 64 parity assertions migrated to MATCH state)

#### Imports + setup — from `ScanResultBanner.states.test.tsx` lines 11–33

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

vi.mock("@/lib/scanner", () => ({
  formatScanTime: vi.fn(() => "Just now"),
}));

import { ScanResultBanner } from "../ScanResultBanner";
import type { Item } from "@/lib/api/items";

i18n.load("en", {});
i18n.activate("en");

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}
afterEach(() => cleanup());
```

**Phase 66 delta:**
- Import `QuickActionMenu` from `../QuickActionMenu`.
- Swap bare `render()` for `renderWithProviders` from `./fixtures` — the component pulls `useMarkReviewedItem` / `useRestoreItem` (require QueryClient + Auth providers) and `useLingui` (require I18nProvider, already layered inside `renderWithProviders`).
- Call `setupDialogMocks()` in `beforeEach` (fixtures already ships it) — jsdom does NOT implement `HTMLDialogElement.showModal` / `.close`, so without this mock `dialogRef.current?.open()` throws.
- Mock `useLoansForItem` per-test to control `activeLoan` and `isPending`:

```typescript
vi.mock("@/features/loans/hooks/useLoansForItem", () => ({
  useLoansForItem: vi.fn(() => ({
    activeLoan: null,
    history: [],
    isPending: false,
    error: null,
  })),
}));
```

#### Prop factory — from `ScanResultBanner.states.test.tsx` lines 35–98

```typescript
const matchItem: Item = {
  id: "item-42",
  workspace_id: "ws-1",
  sku: "SKU-042",
  name: "Coca-Cola 330ml",
  short_code: "CC3-A1",
  barcode: "5449000000996",
  min_stock_level: 0,
  created_at: "2026-04-19T00:00:00Z",
  updated_at: "2026-04-19T00:00:00Z",
};

function baseCallbacks() {
  return {
    onScanAgain: vi.fn(),
    onViewItem: vi.fn(),
    onCreateWithBarcode: vi.fn(),
    onRetry: vi.fn(),
  };
}

function matchProps() {
  return {
    code: "5449000000996",
    format: "ean_13",
    timestamp: 1700000000000,
    lookupStatus: "success" as const,
    match: matchItem,
    ...baseCallbacks(),
  };
}
```

**Phase 66 delta:** extend `baseCallbacks()` with `onLoan: vi.fn(), onMarkReviewed: vi.fn(), onUnarchive: vi.fn()`. Add factory variations for the D-16 matrix:

```typescript
function archivedMatchItem(): Item {
  return { ...matchItem, is_archived: true };
}
function needsReviewMatchItem(): Item {
  return { ...matchItem, needs_review: true };
}
```

#### Per-state assertion pattern — from `ScanResultBanner.states.test.tsx` lines 100–258

```typescript
describe("ScanResultBanner LOADING state (D-20)", () => {
  it("D-20: lookupStatus=\"loading\" renders h2 t`LOOKING UP…`", () => {
    renderWithI18n(<ScanResultBanner {...loadingProps()} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toContain("LOOKING UP…");
  });
  // …5 more LOADING assertions…
});

describe("ScanResultBanner MATCH state (D-18)", () => {
  it("D-18: MATCH VIEW ITEM button onClick calls onViewItem(match.id)", async () => {
    const user = userEvent.setup();
    const props = matchProps();
    renderWithI18n(<ScanResultBanner {...props} />);
    const btn = screen.getByRole("button", { name: /VIEW ITEM/i });
    await user.click(btn);
    expect(props.onViewItem).toHaveBeenCalledWith("item-42");
  });
});
```

**Phase 66 additional tests (D-16 matrix — 6 rows + 3 non-match states):**

1. MATCH + `is_archived=false && activeLoan=null && needs_review=false` → assert VIEW ITEM + LOAN + BACK TO SCAN rendered; assert MARK REVIEWED + UNARCHIVE absent
2. MATCH + `needs_review=true` → assert MARK REVIEWED visible between LOAN and BACK TO SCAN
3. MATCH + `activeLoan=non-null` → assert LOAN absent, VIEW ITEM + BACK TO SCAN present
4. MATCH + `activeLoan=non-null && needs_review=true` → assert LOAN absent, MARK REVIEWED present
5. MATCH + `is_archived=true` → assert UNARCHIVE present, LOAN absent, MARK REVIEWED absent
6. MATCH + `is_archived=true && activeLoan=non-null` → assert UNARCHIVE still present (defense-in-depth per D-16 last row)
7. LOADING state (reuse Phase 65 assertions verbatim — heading + dimmed code + cursor glyph)
8. NOT-FOUND state (reuse — CREATE ITEM button callsite + helper copy)
9. ERROR state (reuse — RETRY + CREATE fallback + BACK TO SCAN)

**Plus:**
- LOAN-slot skeleton test: `useLoansForItem` returns `{ isPending: true }` → assert a button with name `/LOAN/i` exists AND has `disabled` attribute AND `aria-busy="true"`
- LOAN-slot hidden-on-error test: `useLoansForItem` returns `{ error: new Error("boom") }` → assert LOAN button is absent; assert `console.error` called with `expect.objectContaining({ kind: "scan-loans-probe-fail" })` (use `vi.spyOn(console, "error")`)
- Mark Reviewed click: `useMarkReviewedItem.mutate` called with `match.id`; dialog stays open (assert dialog still in DOM)
- Unarchive click: `useRestoreItem.mutate` called with `match.id`; dialog stays open
- BACK TO SCAN click: `onScanAgain` called; assert NO navigate (nav is parent's concern)
- ESC keypress: native `<dialog>` close event → asserts `onScanAgain` called (set up via `fireEvent` on the `dialog` element — see `setupDialogMocks` for how the jsdom mock dispatches `close`)

#### Dual-state absence sweep — from `ScanResultBanner.states.test.tsx` lines 260–291

```typescript
describe("ScanResultBanner dual-state absence sweep (T-65-06-03)", () => {
  it("exactly one of {LOOKING UP…, MATCHED, NOT FOUND, LOOKUP FAILED} renders per state — never two", () => {
    const headings = ["LOOKING UP…", "MATCHED", "NOT FOUND", "LOOKUP FAILED"] as const;
    const cases = [
      { label: "loading", props: loadingProps(), expected: "LOOKING UP…" },
      { label: "match", props: matchProps(), expected: "MATCHED" },
      // …
    ];
    for (const { label, props, expected } of cases) {
      const { container, unmount } = renderWithI18n(<ScanResultBanner {...props} />);
      const h2 = container.querySelector("h2");
      expect(h2).not.toBeNull();
      const text = h2!.textContent ?? "";
      for (const h of headings) {
        if (h === expected) expect(text).toContain(h);
        else expect(text).not.toContain(h);
      }
      unmount();
    }
  });
});
```

**Reuse verbatim** — port the sweep to `QuickActionMenu` as a regression guard against dual-variant render (same single-exclusive-variant invariant applies).

---

### `useMarkReviewedItem()` inside `frontend2/src/features/items/hooks/useItemMutations.ts` (NEW EXPORT — hook, CRUD)

**Analog:** `useRestoreItem` — `useItemMutations.ts` lines 95–108

```typescript
export function useRestoreItem() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => itemsApi.restore(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all });
      addToast(t`Item restored.`, "success");
    },
    onError: () => addToast(t`Could not update item. Try again.`, "error"),
  });
}
```

**Phase 66 pattern (D-18) — append AFTER `useRestoreItem` (just before `useDeleteItem` at line 110):**

```typescript
export function useMarkReviewedItem() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<Item, unknown, string>({
    mutationFn: (id) => itemsApi.update(workspaceId!, id, { needs_review: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all });
      addToast(t`Item marked reviewed.`, "success");
    },
    onError: () => addToast(t`Could not update item. Try again.`, "error"),
  });
}
```

**Deltas from `useRestoreItem`:**
- Return type `Item` (not `void`) because `itemsApi.update` returns the updated item (see `items.ts` line 92: `patch<Item>(…)`)
- `mutationFn` calls `itemsApi.update(wsId, id, { needs_review: false })` (PATCH body, NOT a POST to `/restore`)
- Success toast new msgid `Item marked reviewed.` (extracted in-phase)
- Error toast reuses existing `Could not update item. Try again.` (already in catalog — `messages.po:638`, shared with `useArchiveItem` / `useRestoreItem`)
- `Item` must be added to the existing imports at lines 3–9 if not already imported (already is — line 6: `type Item`)

#### Hook unit test — append to `frontend2/src/features/items/__tests__/useItemMutations.test.ts` (lines 201–221 block)

```typescript
// Current "useArchiveItem / useRestoreItem" describe block has two its —
// add a third describe or expand the existing one:
it("mark-reviewed success toast", async () => {
  const { Wrapper } = makeWrapper();
  itemsApiMock.update.mockResolvedValue({ /* an Item payload */ });
  const { result } = renderHook(() => useMarkReviewedItem(), { wrapper: Wrapper });
  await act(async () => {
    await result.current.mutateAsync("item-id");
  });
  expect(addToast).toHaveBeenCalledWith(expect.stringContaining("reviewed"), "success");
  expect(itemsApiMock.update).toHaveBeenCalledWith(
    expect.any(String),
    "item-id",
    { needs_review: false },
  );
});
```

---

### `frontend2/src/features/scan/ScanPage.tsx` (MODIFIED — orchestrator)

**Analog:** self (lines 148–174 existing handlers, lines 230–246 existing `ScanResultBanner` block).

#### Import swap — lines 46–52

**Before (current):**
```typescript
import {
  BarcodeScanner,
  ManualBarcodeEntry,
  ScanErrorPanel,
  ScanResultBanner,
  type BarcodeScannerErrorKind,
} from "@/components/scan";
```

**After:**
```typescript
import {
  BarcodeScanner,
  ManualBarcodeEntry,
  ScanErrorPanel,
  type BarcodeScannerErrorKind,
} from "@/components/scan";
import { QuickActionMenu } from "./QuickActionMenu";
```

#### New callback handlers — append after line 174 (`handleLookupRetry`)

**Analog pattern (setBanner-null-then-navigate per D-11):**

```typescript
// Line 152-157 existing (DO NOT modify handler signature but DO add setBanner(null) prefix per D-11):
const handleViewItem = useCallback(
  (itemId: string) => {
    navigate(`/items/${itemId}`);
  },
  [navigate],
);
```

**Phase 66 pattern — add `setBanner(null)` BEFORE `navigate()` in the three navigating handlers + add three NEW handlers:**

```typescript
const handleViewItem = useCallback(
  (itemId: string) => {
    setBanner(null);                          // D-11 added
    navigate(`/items/${itemId}`);
  },
  [navigate],
);

const handleCreateWithBarcode = useCallback(
  (code: string) => {
    setBanner(null);                          // D-11 added
    navigate(`/items/new?barcode=${encodeURIComponent(code)}`);
  },
  [navigate],
);

// NEW (D-09):
const handleLoan = useCallback(
  (itemId: string) => {
    setBanner(null);
    navigate(`/loans/new?itemId=${encodeURIComponent(itemId)}`);
  },
  [navigate],
);

// NEW (D-11 — dialog stays open; no setBanner(null); no navigate):
const handleMarkReviewed = useCallback((_itemId: string) => {
  // No-op in ScanPage: QuickActionMenu calls useMarkReviewedItem().mutate
  // directly. This callback exists for prop-interface symmetry and to allow
  // ScanPage to intercept for analytics / future hooks if needed.
}, []);

const handleUnarchive = useCallback((_itemId: string) => {
  // Same shape as handleMarkReviewed; mutation runs inside the menu.
}, []);
```

**ALTERNATIVE (preferred — simpler):** `QuickActionMenu` invokes `useMarkReviewedItem()` / `useRestoreItem()` internally and does NOT require `onMarkReviewed` / `onUnarchive` callbacks. Planner's call — both are valid. If preferred alternative is taken, strip the no-op handlers and adjust `QuickActionMenuProps` accordingly.

#### Render-site swap — lines 230–246

**Before:**
```tsx
{banner && (
  <ScanResultBanner
    code={banner.code}
    format={banner.format}
    timestamp={banner.timestamp}
    lookupStatus={lookup.status}
    match={lookup.match}
    onScanAgain={handleScanAgain}
    onViewItem={handleViewItem}
    onCreateWithBarcode={handleCreateWithBarcode}
    onRetry={handleLookupRetry}
  />
)}
```

**After:**
```tsx
{banner && (
  <QuickActionMenu
    code={banner.code}
    format={banner.format}
    timestamp={banner.timestamp}
    lookupStatus={lookup.status}
    match={lookup.match}
    onScanAgain={handleScanAgain}
    onViewItem={handleViewItem}
    onCreateWithBarcode={handleCreateWithBarcode}
    onRetry={handleLookupRetry}
    onLoan={handleLoan}
    onMarkReviewed={handleMarkReviewed}
    onUnarchive={handleUnarchive}
  />
)}
```

All other `ScanPage` code (lines 1–147, 175–229, 247–279) is UNCHANGED. The scanner-pause invariant `const paused = banner !== null;` at line 198 is preserved verbatim (D-21).

---

### `frontend2/src/components/scan/index.ts` (MODIFIED — barrel)

**Analog:** self.

**Before (line 8):**
```typescript
export * from "./ScanResultBanner";
```

**After:** delete the line. If any external consumer still imports `ScanResultBanner` (verify with a repo-wide grep during planning), update those imports in the same phase.

---

### `frontend2/src/features/scan/__tests__/ScanPage.test.tsx` (MODIFIED — integration test)

**Analog:** self. The spec asserts `ScanResultBanner` rendering indirectly by finding user-visible text (`findByText("MATCHED")` / role-based queries). Lingui macros in tests render EN strings; all Phase 65 assertions that match headings (`MATCHED`, `LOOKING UP…`, `NOT FOUND`, `LOOKUP FAILED`, `VIEW ITEM`, `CREATE ITEM WITH THIS BARCODE`, `RETRY`, `SCAN AGAIN`, `CODE`, `NAME`, `FORMAT`) continue to pass as-is AS LONG AS the `QuickActionMenu` emits the same msgids.

**Phase 66 migration rules:**
- Any test that specifically finds `ScanResultBanner` by component import or by a banner-specific class (`.border-retro-thick.border-retro-ink` on a RetroPanel) must be retargeted at the dialog. Use `screen.getByRole("dialog")` or the `scan-quick-action-menu` `data-testid` if the planner adds one.
- Replace `SCAN AGAIN` assertions with `BACK TO SCAN` in the dialog (new Phase 66 copy per D-23 + UI-SPEC). Tests that asserted `SCAN AGAIN` against the banner need the button text updated.
- Add `setupDialogMocks()` in `beforeEach` if it wasn't already there (it is — line 76: `setupDialogMocks();`). No new test-harness work.

---

### `frontend2/locales/en/messages.po` (MODIFIED — i18n catalog)

**Analog:** Phase 65 extraction diff — pattern of `#: path/to/file.tsx:LINE` comment + `msgid "..."` + `msgstr "..."` (for EN the msgstr equals the msgid verbatim).

**Existing entries to DROP** (Lingui extract does this automatically when the string stops appearing in source):
- The three deleted files (`ScanResultBanner.tsx`, its two test files) currently anchor the `#: src/components/scan/ScanResultBanner.tsx:90` comments at lines 1335, 1339, 1377, 1542, 1936, 2280. Extraction will re-anchor these comments to `src/features/scan/QuickActionMenu.tsx:NN` for the REUSED strings; msgid + msgstr lines are unchanged.
- `SCAN AGAIN` (line 1937) — only stop REFERENCING it from QuickActionMenu; UI-SPEC §Delta instructs NOT to remove the msgid because it may be referenced elsewhere (run a grep during planning).

**NEW entries to ADD** (extract step via `bun run extract` — the block format matches the existing entries):

```
#: src/features/scan/QuickActionMenu.tsx:NN
msgid "LOAN"
msgstr "LOAN"

#: src/features/scan/QuickActionMenu.tsx:NN
msgid "MARK REVIEWED"
msgstr "MARK REVIEWED"

#: src/features/scan/QuickActionMenu.tsx:NN
msgid "UNARCHIVE"
msgstr "UNARCHIVE"

#: src/features/scan/QuickActionMenu.tsx:NN
msgid "BACK TO SCAN"
msgstr "BACK TO SCAN"

#: src/features/items/hooks/useItemMutations.ts:NN
msgid "Item marked reviewed."
msgstr "Item marked reviewed."
```

(Line numbers auto-filled by the extractor.)

**Verify NO duplicates** of existing entries: `LOOKING UP…` (1336), `LOOKUP FAILED` (1340), `MATCHED` (1378), `NOT FOUND` (1543), `VIEW ITEM` (2281), `CREATE ITEM WITH THIS BARCODE` (680), `RETRY` (1864), `Item restored.` (1139), `Could not update item. Try again.` (638), `NAME`, `CODE`, `FORMAT`, `No item in this workspace matches this barcode.`, `Could not reach the server. …`.

---

### `frontend2/locales/et/messages.po` (MODIFIED — i18n catalog, hand-fill)

**Analog:** Phase 65 ET hand-fill pattern (concrete diffs at lines 331, 681, 1337, 1341, 1379, 1544, 1865, 2282 from the Grep above).

**NEW entries** (hand-fill, per UI-SPEC §Copywriting Contract and CONTEXT.md §Specifics):

```
#: src/features/scan/QuickActionMenu.tsx:NN
msgid "LOAN"
msgstr "LAENA"

#: src/features/scan/QuickActionMenu.tsx:NN
msgid "MARK REVIEWED"
msgstr "MÄRGI ÜLE VAADATUD"

#: src/features/scan/QuickActionMenu.tsx:NN
msgid "UNARCHIVE"
msgstr "TAASTA ARHIIVIST"

#: src/features/scan/QuickActionMenu.tsx:NN
msgid "BACK TO SCAN"
msgstr "TAGASI SKANNEERIMA"

#: src/features/items/hooks/useItemMutations.ts:NN
msgid "Item marked reviewed."
msgstr "Ese märgitud üle vaadatuks."
```

**Reuse-verify** the ET strings (UI-SPEC confirms these already present in catalog): `OTSIN…` (1337), `OTSING EBAÕNNESTUS` (1341), `VASTE LEITUD` (1379), `EI LEITUD` (1544), `VAATA ESET` (2282), `LOO UUS ESE SELLE VÖÖTKOODIGA` (681), `PROOVI UUESTI` (1865), `Ese taastatud.` (1140), `Eseme uuendamine ebaõnnestus. Proovi uuesti.` (639), `Ese arhiveeritud.` (1120).

---

## Shared Patterns

### TanStack mutation hook template
**Source:** `frontend2/src/features/items/hooks/useItemMutations.ts` lines 80–108
**Apply to:** `useMarkReviewedItem` (new export)

```typescript
export function useXxxItem() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<ReturnType, unknown, string>({
    mutationFn: (id) => itemsApi.xxx(workspaceId!, id /* , payload */),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all });
      addToast(t`…`, "success");
    },
    onError: () => addToast(t`Could not update item. Try again.`, "error"),
  });
}
```

### Dialog lifecycle via ref + mount effect
**Source:** `frontend2/src/components/retro/RetroConfirmDialog.tsx` lines 56–77 (imperative open/close) + `RetroDialog.tsx` lines 22–27 (primitive)
**Apply to:** `QuickActionMenu` — but DROP the `forwardRef` wrapper; the dialog opens on mount and closes on unmount via `useEffect` because the caller already toggles the conditional `{banner && <QuickActionMenu …/>}`.

### Lingui-macro wrapping
**Source:** `ScanResultBanner.tsx` lines 66–96 (all string renders); `useItemMutations.ts` lines 36, 43, 47, 51, 60, 65, 69, 75, 84, 89, 91, 99, 104, 106
**Apply to:** `QuickActionMenu.tsx`, `useMarkReviewedItem`
Pattern: import `useLingui` from `@lingui/react/macro`, destructure `const { t } = useLingui()` at top of function, wrap every literal in `t\`…\``.

### Structured `console.error({ kind, … })`
**Source:** CONTEXT.md D-22 (uses Phase 64 D-12 / Phase 65 D-08 vocabulary)
**Apply to:** `QuickActionMenu` when `useLoansForItem` errors
**Kind string:** `"scan-loans-probe-fail"` (discretion resolved in UI-SPEC §Logging)

### Barrel-only retro imports
**Source:** Phase 54 rule — `@/components/retro` barrel
**Apply to:** `QuickActionMenu.tsx` — no direct-file imports of `RetroDialog`, `RetroButton`, `HazardStripe` (all come from `@/components/retro`). Verify by inspecting `frontend2/src/components/retro/index.ts` (not read here but conventionally exports all primitives).

### Test harness
**Source:** `frontend2/src/features/scan/__tests__/fixtures.ts` (entire file)
**Apply to:** `QuickActionMenu.test.tsx` — use `renderWithProviders` + `setupDialogMocks` from `./fixtures`. `setupDialogMocks()` shims `HTMLDialogElement.showModal` / `.close` for jsdom.

---

## No Analog Found

All files have strong analogs. No gaps. Planner can work entirely from in-repo patterns.

---

## Metadata

**Analog search scope:**
- `frontend2/src/components/scan/` (entire dir — banner + tests + barrel)
- `frontend2/src/components/retro/` (`RetroDialog.tsx`, `RetroConfirmDialog.tsx`)
- `frontend2/src/features/items/hooks/` (mutation hook analogs + tests)
- `frontend2/src/features/loans/hooks/` (`useLoansForItem`)
- `frontend2/src/features/scan/` (`ScanPage.tsx` + `__tests__/fixtures.ts` + `ScanPage.test.tsx`)
- `frontend2/locales/en/messages.po` + `frontend2/locales/et/messages.po` (line-numbered reuse audit)
- `frontend2/src/lib/api/items.ts` (Item type + `itemsApi.update` + `itemKeys`)

**Files scanned:** 12 (5 source, 3 tests, 2 locales, 1 API module, 1 fixture)

**Pattern extraction date:** 2026-04-19
