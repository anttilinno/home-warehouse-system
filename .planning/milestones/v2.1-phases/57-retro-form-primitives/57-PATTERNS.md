# Phase 57: Retro Form Primitives - Pattern Map

**Mapped:** 2026-04-15
**Files analyzed:** 19 (9 new components + 9 new tests + 1 barrel modification + 1 demo page modification; package.json install is tooling, not a source pattern)
**Analogs found:** 19 / 19 — every new file has an in-repo analog

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend2/src/components/retro/RetroTextarea.tsx` | component (form primitive) | request-response (controlled input) | `frontend2/src/components/retro/RetroInput.tsx` | exact |
| `frontend2/src/components/retro/RetroCheckbox.tsx` | component (form primitive) | request-response (controlled input) | `frontend2/src/components/retro/RetroInput.tsx` | role-match (different DOM shape, same forwardRef + error pattern) |
| `frontend2/src/components/retro/RetroFileInput.tsx` | component (form primitive) | file-I/O (selection state) | `frontend2/src/components/retro/RetroInput.tsx` | role-match (input element + retro chrome) |
| `frontend2/src/components/retro/RetroSelect.tsx` | component (composite widget) | event-driven (open/close/select state) | `frontend2/src/components/retro/RetroTabs.tsx` + `RetroDialog.tsx` | role-match (Tabs = active-key state; Dialog = portaled layer) |
| `frontend2/src/components/retro/RetroCombobox.tsx` | component (composite widget) | event-driven + async fetch | `frontend2/src/components/retro/RetroInput.tsx` (trigger) + `RetroSelect.tsx` (new sibling) | partial (no exact analog — async + listbox is novel) |
| `frontend2/src/components/retro/RetroFormField.tsx` | component (provider/wrapper) | event-driven (RHF Controller) | `frontend2/src/components/retro/ToastProvider` / `RetroPanel.tsx` | partial (wrapper shape; Controller pattern itself has no in-repo analog) |
| `frontend2/src/components/retro/RetroPagination.tsx` | component (pure presentation) | request-response (controlled onChange) | `frontend2/src/components/retro/RetroTabs.tsx` | role-match (stateless controlled button row) |
| `frontend2/src/components/retro/RetroConfirmDialog.tsx` | component (modal wrapper) | event-driven (imperative open/close) | `frontend2/src/components/retro/RetroDialog.tsx` | exact (wraps/extends directly) |
| `frontend2/src/components/retro/RetroEmptyState.tsx` | component (pure presentation) | — (no data flow) | `frontend2/src/components/retro/RetroPanel.tsx` | role-match (panel + title + body + optional slot) |
| `frontend2/src/components/retro/index.ts` | config (barrel) | — | existing file (extend) | exact |
| `frontend2/src/pages/DemoPage.tsx` | page (demo/showcase) | — | self (existing sections) | exact (extend with new sections) |
| `frontend2/src/components/retro/__tests__/Retro*.test.tsx` (x9) | test | — | `RetroInput.test.tsx`, `RetroDialog.test.tsx` | exact |

## Pattern Assignments

### `RetroTextarea.tsx` (component, request-response)

**Analog:** `frontend2/src/components/retro/RetroInput.tsx` (lines 1-36)

**forwardRef + props shape** (lines 1-9):
```tsx
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

interface RetroInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  error?: string;
}

const RetroInput = forwardRef<HTMLInputElement, RetroInputProps>(
  ({ icon, error, className, ...rest }, ref) => {
```
Apply identically but with `TextareaHTMLAttributes<HTMLTextAreaElement>` and `HTMLTextAreaElement` ref.

**Bevel + focus + error classes** (line 22):
```tsx
className={`w-full h-[40px] border-retro-thick ${error ? "border-retro-red" : "border-retro-ink"} bg-retro-cream font-mono text-[14px] text-retro-ink placeholder:text-retro-gray ${icon ? "pl-[40px]" : "pl-sm"} pr-sm outline-2 outline-offset-2 outline-transparent focus:outline-retro-amber disabled:bg-retro-gray disabled:cursor-not-allowed ${className || ""}`}
```
Swap `h-[40px]` for `min-h-[88px]` (auto-resize up to 8 rows per RESEARCH Pattern 1); drop icon logic.

**Error message render** (lines 25-27):
```tsx
{error && (
  <p className="text-retro-red text-[12px] mt-xs">{error}</p>
)}
```

**displayName + named export** (lines 33-36):
```tsx
RetroInput.displayName = "RetroInput";
export { RetroInput };
export type { RetroInputProps };
```

---

### `RetroCheckbox.tsx` (component, request-response)

**Analog:** `frontend2/src/components/retro/RetroInput.tsx` (forwardRef skeleton) + RESEARCH Code Example "Checkbox with 44px hit area".

**Reuse**: forwardRef pattern + error prop + displayName + named export from RetroInput.tsx (lines 1-36, verbatim structure).
**Novel**: 24px visual box inside 44px label hit area (RESEARCH Code Examples). Use `peer`/`peer-checked:` Tailwind 4 syntax per that snippet.

---

### `RetroFileInput.tsx` (component, file-I/O)

**Analog:** `frontend2/src/components/retro/RetroInput.tsx` (forwardRef + error pattern) + `RetroButton.tsx` (button chrome for the "CHOOSE FILE" visible trigger).

**Button trigger style** from `RetroButton.tsx` lines 14-21:
```tsx
const baseClasses =
  "h-[44px] px-md border-retro-thick border-retro-ink text-[14px] font-bold uppercase outline-2 outline-offset-2 outline-transparent focus-visible:outline-retro-amber";
```
Wrap a hidden `<input type="file">` with `ref={inputRef}`; show the button as the visible trigger. Reset `inputRef.current.value = ""` on each selection per RESEARCH Pitfall 6.

---

### `RetroSelect.tsx` (component, event-driven)

**Analog:** `frontend2/src/components/retro/RetroTabs.tsx` (controlled active-key pattern, lines 1-29) + `RetroInput.tsx` (trigger chrome) + floating-ui (RESEARCH Pattern 3).

**Controlled prop shape** from RetroTabs.tsx lines 1-6:
```tsx
interface RetroTabsProps {
  tabs: { key: string; label: string }[];
  activeTab: string;
  onTabChange: (key: string) => void;
  className?: string;
}
```
Adapt to `{ options, value, onChange }` with an `Option = { value: string; label: string; disabled?: boolean }` shape.

**Trigger button chrome** — combine `RetroButton` base classes (h-44, border-retro-thick, focus-visible:outline-retro-amber) with `RetroInput` bevel (`bg-retro-cream border-retro-ink`). Trigger is `<button aria-haspopup="listbox" aria-expanded={open}>` per WAI-ARIA (RESEARCH Pattern 4).

**Option row styling** — mirror RetroTable row alternation concept from `RetroTable.tsx` line 35 (`bg-retro-cream` / hover `bg-retro-amber` for focused option, matching `RetroButton.neutral` hover on line 10).

**Floating-ui wiring**: RESEARCH Pattern 3 verbatim (useFloating + offset(4) + flip + shift + size).

---

### `RetroCombobox.tsx` (component, event-driven + async)

**Analog:** `RetroSelect.tsx` (sibling, same listbox skeleton) + `RetroInput.tsx` (text input as combobox trigger) + async data from `frontend2/src/lib/api/categories.ts`.

**Async data source** from categories.ts lines 1-35:
```tsx
import { get, post, patch, del } from "@/lib/api";
export interface Category { id: string; name: string; ... }
export interface CategoryListResponse { items: Category[]; }
```
Use `categoriesApi.list()` via TanStack Query (per STATE.md v2.1 + RESEARCH Pitfall 5). QueryKey includes debounced search term.

**ARIA combobox role** — RESEARCH Pattern 4 verbatim.

---

### `RetroFormField.tsx` (component, event-driven/Controller wrapper)

**Analog:** No direct in-repo analog for RHF Controller. Closest is `RetroPanel.tsx` (lines 13-43) for the forwardRef + label + children wrapper shape. RHF pattern comes from RESEARCH Pattern 2.

**Wrapper layout** from RetroPanel.tsx lines 34-39:
```tsx
{title && (
  <h2 className="text-[20px] font-bold uppercase text-retro-ink mb-md">
    {title}
  </h2>
)}
{children}
```
Adapt to field-scale: `<label className="text-[14px] font-semibold uppercase tracking-wide">{label}</label>` (scaled down from panel title; matches UI-SPEC label typography).

**Controller + cloneElement** — RESEARCH Pattern 2 verbatim.

---

### `RetroPagination.tsx` (component, request-response)

**Analog:** `frontend2/src/components/retro/RetroTabs.tsx` (lines 1-29).

**Stateless controlled pattern** from RetroTabs.tsx lines 11-28:
```tsx
function RetroTabs({ tabs, activeTab, onTabChange, className }: RetroTabsProps) {
  return (
    <div className={`flex ${className || ""}`}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            type="button"
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`${tabBase} ${isActive ? "bg-retro-cream border-b-0" : "bg-retro-gray"}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
```
Adapt: `{ page, pageSize, totalCount, onChange }` prop shape; button row becomes prev / page numbers / next. Reuse `tabBase` class string concept but with `min-h-[36px]` (per CONTEXT.md touch-target spec for `>=768px`) and `font-mono` for numeric counter.

**Visibility gate** — RESEARCH Code Examples Pagination snippet: `if (totalCount <= pageSize) return null;`

---

### `RetroConfirmDialog.tsx` (component, event-driven, imperative)

**Analog:** `frontend2/src/components/retro/RetroDialog.tsx` (lines 1-55) — direct wrap/extend per D-03 recommendation.

**forwardRef + useImperativeHandle** (lines 19-27):
```tsx
const RetroDialog = forwardRef<RetroDialogHandle, RetroDialogProps>(
  ({ onClose, children }, ref) => {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useImperativeHandle(ref, () => ({
      open: () => dialogRef.current?.showModal(),
      close: () => dialogRef.current?.close(),
    }));
```

**Native `<dialog>` + backdrop** (lines 29-33):
```tsx
<dialog
  ref={dialogRef}
  className="bg-retro-cream border-retro-extra-thick border-retro-ink shadow-retro-raised p-0 max-w-[480px] w-full backdrop:bg-black/50"
  onClose={onClose}
>
```

**HazardStripe header** (line 43): `<HazardStripe className="mb-md" />` — keep for `variant="destructive"`; omit for `variant="soft"`.

**Action buttons** — compose `RetroButton variant="danger"` (destructive) or `variant="primary"` (soft) + `variant="neutral"` (escape). Wire `onConfirm` async Promise -> swap label to "WORKING..." per RESEARCH Pattern 5.

---

### `RetroEmptyState.tsx` (component, presentation)

**Analog:** `frontend2/src/components/retro/RetroPanel.tsx` (lines 1-48).

**Wrapper + title + children** (lines 18-41):
```tsx
<div
  ref={ref}
  className={`bg-retro-cream border-retro-thick border-retro-ink shadow-retro-raised p-lg relative ${className || ""}`}
>
  {showHazardStripe && <HazardStripe className="mb-md" />}
  {title && (
    <h2 className="text-[20px] font-bold uppercase text-retro-ink mb-md">
      {title}
    </h2>
  )}
  {children}
</div>
```
Adapt: drop `showClose`, add `action?: ReactNode` slot for primary CTA, center-align body per UI-SPEC.

---

### `index.ts` (barrel, config)

**Analog:** `frontend2/src/components/retro/index.ts` (lines 1-11, current state):
```ts
export { RetroButton } from "./RetroButton";
export { RetroPanel } from "./RetroPanel";
export { RetroInput } from "./RetroInput";
export { HazardStripe } from "./HazardStripe";
export { RetroCard } from "./RetroCard";
export { RetroDialog } from "./RetroDialog";
export type { RetroDialogHandle } from "./RetroDialog";
export { RetroTable } from "./RetroTable";
export { RetroTabs } from "./RetroTabs";
export { RetroBadge } from "./RetroBadge";
export { ToastProvider, useToast } from "./RetroToast";
```
Append 9 new named exports + any new types (e.g. `RetroConfirmDialogHandle`, `RetroSelectOption`, `RetroFormFieldProps`).

---

### `DemoPage.tsx` (page, extension)

**Analog:** `frontend2/src/pages/DemoPage.tsx` lines 52-77 (existing section template).

**Section template** (lines 62-76):
```tsx
<section className="mb-2xl">
  <h2 className="text-[20px] font-bold uppercase text-retro-cream mb-sm">
    RETROBUTTON
  </h2>
  <HazardStripe className="mb-md" />
  <div className="flex gap-md flex-wrap mb-md">
    <RetroButton variant="neutral">EXECUTE</RetroButton>
    ...
  </div>
</section>
```
Add one `<section>` per new primitive following this shape. Import additions go into the existing `@/components/retro` barrel import block at lines 2-14.

---

### Test files (`__tests__/Retro*.test.tsx`) x9

**Analog for simple primitives** (Textarea/Checkbox/FileInput/Pagination/EmptyState/FormField): `frontend2/src/components/retro/__tests__/RetroInput.test.tsx` (lines 1-86).

Key excerpts to copy:

**Test skeleton** (lines 1-9):
```tsx
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { RetroInput } from "../RetroInput";

describe("RetroInput", () => {
  it("renders an input element", () => {
    render(<RetroInput placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });
```

**forwardRef assertion** (lines 58-62):
```tsx
it("forwards ref to input element", () => {
  const ref = createRef<HTMLInputElement>();
  render(<RetroInput ref={ref} />);
  expect(ref.current).toBeInstanceOf(HTMLInputElement);
});
```

**Error + disabled assertions** (lines 33-56): copy verbatim per primitive (swap class names as needed).

**Analog for dialog/select/combobox** (dialog/listbox primitives): `frontend2/src/components/retro/__tests__/RetroDialog.test.tsx` (lines 1-60).

**HTMLDialogElement mock** (lines 6-17) — required for RetroConfirmDialog test:
```tsx
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});
```

**Imperative handle assertion** (lines 25-37):
```tsx
it("open() calls showModal on the dialog", () => {
  const ref = createRef<RetroDialogHandle>();
  render(<RetroDialog ref={ref}>Content</RetroDialog>);
  ref.current!.open();
  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
});
```

For RetroCombobox keyboard navigation tests, add `@testing-library/user-event` (already in deps per RESEARCH Standard Stack) — no in-repo analog; follow RESEARCH Pattern 4 ARIA contract.

## Shared Patterns

### Pattern: forwardRef + displayName + named export

**Source:** Every file in `frontend2/src/components/retro/*.tsx` that forwards a ref.
**Apply to:** All 9 new components (required — D-03 Controller + pitfall 1 require refs reach the DOM).

**Canonical skeleton** (from `RetroInput.tsx` lines 1, 8-9, 33-36):
```tsx
import { forwardRef, type XHTMLAttributes } from "react";

interface RetroXProps extends XHTMLAttributes<HTMLXElement> {
  error?: string;
}

const RetroX = forwardRef<HTMLXElement, RetroXProps>(({ error, className, ...rest }, ref) => {
  return ( ... );
});

RetroX.displayName = "RetroX";

export { RetroX };
export type { RetroXProps };
```

### Pattern: Retro bevel + amber focus + error state

**Source:** `frontend2/src/components/retro/RetroInput.tsx` line 22.
**Apply to:** Every interactive primitive (Textarea, Checkbox, FileInput button, Select trigger, Combobox input, Pagination buttons).

**Canonical class string:**
```
border-retro-thick ${error ? "border-retro-red" : "border-retro-ink"} bg-retro-cream font-mono text-[14px] text-retro-ink outline-2 outline-offset-2 outline-transparent focus:outline-retro-amber disabled:bg-retro-gray disabled:cursor-not-allowed
```

### Pattern: Error message render block

**Source:** `frontend2/src/components/retro/RetroInput.tsx` lines 25-27.
**Apply to:** Textarea, Checkbox, FileInput, Select, Combobox when error prop is supplied AND when not wrapped in RetroFormField (RetroFormField renders its own error per RESEARCH Pattern 2).
```tsx
{error && <p className="text-retro-red text-[12px] mt-xs">{error}</p>}
```

### Pattern: Button variants + 44px touch target

**Source:** `frontend2/src/components/retro/RetroButton.tsx` lines 7-38.
**Apply to:** RetroConfirmDialog action buttons (compose existing variants — do NOT create new variants per CONTEXT.md "`variant="primary"` (amber), `variant="danger"` (red), and `variant="neutral"`" inventory). FileInput "CHOOSE FILE" trigger should render a RetroButton.

### Pattern: HazardStripe as destructive header accent

**Source:** `frontend2/src/components/retro/HazardStripe.tsx` (whole file) + usage in `RetroDialog.tsx` line 43.
**Apply to:** RetroConfirmDialog `variant="destructive"` header only.
```tsx
<HazardStripe className="mb-md" />
```

### Pattern: Native `<dialog>` + imperative handle

**Source:** `frontend2/src/components/retro/RetroDialog.tsx` lines 19-48.
**Apply to:** RetroConfirmDialog (wrap RetroDialog directly; do not duplicate the `<dialog>` element).

### Pattern: Barrel import for consumers

**Source:** `frontend2/src/pages/DemoPage.tsx` lines 2-15:
```tsx
import {
  RetroButton,
  RetroPanel,
  ...
} from "@/components/retro";
import type { RetroDialogHandle } from "@/components/retro";
```
**Apply to:** Every new primitive is consumed through this barrel; DemoPage section additions extend the same import block.

### Pattern: Test file structure

**Source:** `frontend2/src/components/retro/__tests__/RetroInput.test.tsx` (simple primitive) and `RetroDialog.test.tsx` (dialog/imperative).
**Apply to:** All 9 new test files — one per primitive, co-located in `__tests__/`.

## No Analog Found

| File | Role | Data Flow | Reason | Fallback |
|------|------|-----------|--------|----------|
| (RHF Controller wiring inside `RetroFormField.tsx`) | wrapper | event-driven | No existing RHF usage in repo (Phase 57 is the first) | Follow RESEARCH Pattern 2 verbatim |
| (floating-ui wiring inside `RetroSelect.tsx` / `RetroCombobox.tsx`) | positioning | — | No existing floating-ui usage in repo | Follow RESEARCH Pattern 3 verbatim |
| (async search + TanStack Query inside `RetroCombobox.tsx`) | async data | async request-response | Phase 56 introduced TanStack Query but no Combobox-style consumer exists | Follow RESEARCH Code Example "RetroCombobox async options" + Pitfall 5 |
| (WAI-ARIA combobox/listbox keyboard contract) | ARIA | event-driven | No existing listbox widget in repo | Follow RESEARCH Pattern 4 + W3C APG citations |

## Metadata

**Analog search scope:** `frontend2/src/components/retro/`, `frontend2/src/components/retro/__tests__/`, `frontend2/src/pages/DemoPage.tsx`, `frontend2/src/lib/api/`
**Files scanned:** 12 components, 10 test files, 1 demo page, 1 barrel, 7 API modules
**Pattern extraction date:** 2026-04-15
**Notable absence:** No existing retro component uses the Lingui `t` macro (hardcoded "Close", uppercase ASCII labels). CONTEXT.md mandates `t` macro for user-visible strings in phase 57 primitives — this is a departure from existing retro code and planner should flag it explicitly. See `frontend2/src/features/auth/LoginForm.tsx` for the `useLingui` macro import pattern (`import { useLingui } from "@lingui/react/macro";`).
