# Phase 57: Retro Form Primitives - Research

**Researched:** 2026-04-15
**Domain:** React form primitives (custom retro library) + react-hook-form/zod + floating-ui
**Confidence:** HIGH

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (RetroSelect):** Fully custom div-based dropdown — `<button>` trigger + `<ul role="listbox">` with `<li role="option">` children. **No native `<select>`.**
- **D-02 (Combobox positioning):** Use `@floating-ui/react` for dropdown positioning. The only new runtime dependency beyond RHF/zod.
- **D-03 (RetroFormField pattern):** `Controller`-for-all. Every child wrapped via RHF `Controller`. No `register`-forwarding variant.
- **D-04 (New deps):** `react-hook-form`, `zod`, `@hookform/resolvers`, `@floating-ui/react`. No Radix, no shadcn.
- **D-05 (Plan batching):** 3 plans — (57-01) Textarea/Checkbox/FileInput; (57-02) Select/Combobox/FormField; (57-03) Pagination/ConfirmDialog/EmptyState + /demo wiring + barrel + tests.

### Claude's Discretion

- floating-ui middleware config (flip, shift, size)
- Combobox async debounce (suggested 250ms)
- RetroFormField TS generics (infer from `control`)
- Test strategy per component
- Whether RetroConfirmDialog extends existing RetroDialog or is standalone
- `/demo` section ordering within UI-SPEC's focal hierarchy

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

## Phase Requirements

Phase 57 is infrastructure — no user-facing REQ-IDs. It unblocks all CRUD forms (Phases 58–62) and five pre-declared RetroConfirmDialog consumers (delete item, delete borrower, archive taxonomy, delete photo, mark loan returned).

## Summary

Phase 57 delivers 9 retro-styled primitives on top of an already-shipped retro design system (v2.0). The aesthetic, tokens, and barrel are fixed — this phase extends, not redesigns. The two technical risks are (1) building accessible keyboard-navigable listbox/combobox widgets without a headless library (Radix/Downshift explicitly forbidden per v2.0 decision) and (2) wiring react-hook-form + zod through a single Controller-based `RetroFormField` that downstream phases will depend on.

All key dependency versions verified against npm registry today [VERIFIED: npm registry 2026-04-15]: `react-hook-form@7.72.1`, `zod@4.3.6`, `@hookform/resolvers@5.2.2`, `@floating-ui/react@0.27.19`. React 19.2 and TypeScript 6.0 are already in the project.

**Primary recommendation:** Follow the existing `RetroInput`/`RetroDialog` patterns verbatim (forwardRef, Tailwind 4 retro tokens, amber focus ring, Lingui `t` macro). Build the listbox/combobox ARIA state machine by hand against the WAI-ARIA 1.2 combobox pattern — it is well-specified, the project is single-select, and adding Downshift would violate D-04. Extend `RetroDialog` for `RetroConfirmDialog` rather than duplicate it; the existing `<dialog>` + `useImperativeHandle` pattern already handles backdrop, ESC, and focus trap.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Form state / validation | Browser (RHF Controller) | — | Client-side only; server validation is separate layer |
| Dropdown positioning | Browser (@floating-ui/react) | — | Pure DOM measurement |
| Async option loading (Combobox) | Browser -> API backend | API (Phase 56 modules) | Demo uses categories/locations endpoint |
| File selection | Browser (`<input type="file">`) | — | No upload in this phase; just selection state |
| Modal / focus trap | Browser (native `<dialog>`) | — | Reuses shipped RetroDialog |
| Pagination math | Browser (pure component) | — | Stateless; parent owns page + pageSize |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | ^7.72.1 | Form state + validation | [VERIFIED: npm registry] Already locked in STATE.md v2.1 decisions; `Controller` API matches D-03 |
| zod | ^4.3.6 | Schema validation | [VERIFIED: npm registry] Standard RHF companion; pairs with `@hookform/resolvers/zod` |
| @hookform/resolvers | ^5.2.2 | Bridge zod <-> RHF | [VERIFIED: npm registry] Official RHF resolver package |
| @floating-ui/react | ^0.27.19 | Dropdown positioning (Combobox/Select) | [VERIFIED: npm registry] Locked by D-02; ~3kB; handles flip/shift/size/virtual elements |

### Supporting (already in project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | (existing) | Icons | Check/chevron/x icons in select/combobox/file-chip |
| @lingui/react | ^5.9.5 | i18n | All user-visible strings via `t` macro (mandatory) |
| @testing-library/react | ^16.3.2 | Unit/integration tests | Existing retro test pattern |
| @testing-library/user-event | ^14.6.1 | Keyboard nav tests | Critical for Select/Combobox keyboard contract |
| vitest | ^4.1.3 | Test runner | Existing config |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled Select listbox | Downshift / React Aria / Radix Select | **Forbidden by D-04.** Would give accessibility for free but contradicts the "no UI library" decision |
| `@floating-ui/react` | Pure CSS `position: absolute` | [CITED: floating-ui docs] CSS-only clips at scroll parents and viewport edges; D-02 locks floating-ui |
| `zod` | `yup`, `valibot` | zod is locked in v2.1 decisions |
| Auto-resize textarea lib | Manual `scrollHeight` measurement | Manual is ~10 lines; no dep needed |

**Installation (Plan 57-01 first task):**

```bash
cd frontend2 && bun add react-hook-form@^7.72.1 zod@^4.3.6 @hookform/resolvers@^5.2.2 @floating-ui/react@^0.27.19
```

## Architecture Patterns

### System Architecture Diagram

```
Parent page (e.g. /demo, later Phase 58-62 CRUD pages)
    |
    v
  useForm({ resolver: zodResolver(schema) })
    |  (control, handleSubmit, formState)
    v
  <RetroFormField name="..." label="..." control={control}>
    |
    v
    <Controller> --(field: { value, onChange, onBlur, ref }, fieldState: { error })
    |
    v
    [ RetroSelect | RetroCombobox | RetroTextarea | RetroCheckbox | RetroFileInput ]
    |
    v
    renders amber focus ring + retro bevel + error border
    |
    v (for RetroCombobox async search)
    frontend2/src/lib/api/<entity>.ts (Phase 56 API modules)
```

Orthogonal primitives (not inside a form):
- `RetroPagination` — controlled (page, pageSize, totalCount) -> onChange
- `RetroConfirmDialog` — imperative handle (extends RetroDialog) -> onConfirm/onCancel
- `RetroEmptyState` — pure presentation + optional primary-action slot

### Recommended Project Structure

```
frontend2/src/components/retro/
├── RetroSelect.tsx            # NEW
├── RetroCombobox.tsx          # NEW
├── RetroTextarea.tsx          # NEW
├── RetroCheckbox.tsx          # NEW
├── RetroFileInput.tsx         # NEW
├── RetroPagination.tsx        # NEW
├── RetroConfirmDialog.tsx     # NEW (wraps/extends RetroDialog)
├── RetroEmptyState.tsx        # NEW
├── RetroFormField.tsx         # NEW (RHF Controller wrapper)
├── index.ts                   # EXTEND — add 9 exports
└── __tests__/
    ├── RetroSelect.test.tsx
    ├── RetroCombobox.test.tsx
    ├── RetroTextarea.test.tsx
    ├── RetroCheckbox.test.tsx
    ├── RetroFileInput.test.tsx
    ├── RetroPagination.test.tsx
    ├── RetroConfirmDialog.test.tsx
    ├── RetroEmptyState.test.tsx
    └── RetroFormField.test.tsx
```

### Pattern 1: forwardRef + retro tokens (match RetroInput.tsx)

```tsx
// Source: frontend2/src/components/retro/RetroInput.tsx (verified pattern)
const RetroTextarea = forwardRef<HTMLTextAreaElement, RetroTextareaProps>(
  ({ error, className, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={`w-full min-h-[88px] border-retro-thick ${error ? "border-retro-red" : "border-retro-ink"} bg-retro-cream font-mono text-[14px] text-retro-ink placeholder:text-retro-gray p-sm outline-2 outline-offset-2 outline-transparent focus:outline-retro-amber disabled:bg-retro-gray disabled:cursor-not-allowed ${className || ""}`}
      {...rest}
    />
  )
);
```

### Pattern 2: RHF Controller inside RetroFormField (D-03)

```tsx
// Source: [CITED: react-hook-form.com/docs/usecontroller/controller]
interface RetroFormFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  control: Control<T>;
  label: string;
  helper?: string;
  children: ReactElement; // single child primitive
}

function RetroFormField<T extends FieldValues>({ name, control, label, helper, children }: RetroFormFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-xs">
          <label htmlFor={field.name} className="text-[14px] font-semibold uppercase tracking-wide">{label}</label>
          {cloneElement(children, { ...field, id: field.name, error: fieldState.error?.message })}
          {helper && !fieldState.error && <p className="text-[14px] text-retro-charcoal/70">{helper}</p>}
          {fieldState.error && <p className="text-[14px] text-retro-red font-mono">{fieldState.error.message}</p>}
        </div>
      )}
    />
  );
}
```

Children receive `{ value, onChange, onBlur, ref, id, error }` via `cloneElement`. All 5 wrappable primitives MUST accept this prop shape.

### Pattern 3: floating-ui for Select/Combobox

```tsx
// Source: [CITED: floating-ui.com/docs/react]
import { useFloating, autoUpdate, offset, flip, shift, size, useRole, useDismiss, useListNavigation, useInteractions } from "@floating-ui/react";

const { refs, floatingStyles, context } = useFloating({
  open,
  onOpenChange: setOpen,
  whileElementsMounted: autoUpdate,
  middleware: [
    offset(4),
    flip({ padding: 8 }),
    shift({ padding: 8 }),
    size({
      apply({ rects, elements, availableHeight }) {
        Object.assign(elements.floating.style, {
          width: `${rects.reference.width}px`,
          maxHeight: `${Math.min(availableHeight, 320)}px`,
        });
      },
    }),
  ],
});
```

Combine with `useListNavigation` (keyboard), `useRole('listbox')`, `useDismiss` (Esc + outside click). This is the canonical floating-ui Select/Combobox recipe.

### Pattern 4: WAI-ARIA combobox

```tsx
// Source: [CITED: w3.org/WAI/ARIA/apg/patterns/combobox/]
<div role="combobox" aria-expanded={open} aria-controls="listbox-id" aria-haspopup="listbox">
  <input
    value={query}
    onChange={...}
    aria-autocomplete="list"
    aria-activedescendant={activeId}
  />
</div>
<ul id="listbox-id" role="listbox">
  {options.map((opt, i) => (
    <li
      id={`opt-${i}`}
      role="option"
      aria-selected={i === activeIndex}
      key={opt.id}
    >{opt.label}</li>
  ))}
</ul>
```

Keyboard contract: Up/Down move activeIndex, Enter selects, Esc closes, Home/End jump, typeahead on Select (not Combobox — Combobox uses the input).

### Pattern 5: RetroConfirmDialog extending RetroDialog

```tsx
// Extends existing frontend2/src/components/retro/RetroDialog.tsx
interface RetroConfirmDialogProps {
  title: string;           // "CONFIRM DELETE"
  body: ReactNode;         // "This action cannot be undone."
  escapeLabel: string;     // "KEEP ITEM" | "← BACK"
  destructiveLabel: string;// "DELETE ITEM"
  variant: "destructive" | "soft"; // destructive = hazard stripe + red; soft = amber (loan-returned case)
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}
```

Action button swaps label to `WORKING…` (mono) when `onConfirm` returns a Promise that has not resolved.

### Anti-Patterns to Avoid

- **Using native `<select>` with CSS override.** Forbidden by D-01; the retro bevel + amber focus ring cannot be achieved cross-platform on the native control.
- **Registering inputs with `register()` instead of `Controller`.** Forbidden by D-03; breaks the single mental model for downstream phases.
- **`position: absolute` dropdowns.** Forbidden by D-02; floating-ui is mandatory.
- **Generic `CANCEL` / `OK` button labels.** Forbidden by UI-SPEC Copywriting Contract.
- **Hardcoded strings.** Every user-visible string MUST go through Lingui `t` macro (existing project rule — see STATE.md v2.0 decisions).
- **New design tokens.** UI-SPEC explicitly says phase 57 introduces NO new tokens.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown viewport positioning | Custom `getBoundingClientRect` + scroll listener math | `@floating-ui/react` | [CITED: floating-ui docs] Handles virtual keyboard, scroll parents, iframe edges, RTL; D-02 locks this |
| Form state machine | Custom `useReducer` form store | `react-hook-form` | Dirty tracking, validation scheduling, field arrays, subscriptions — weeks of work, already solved |
| Schema validation | Custom validators | `zod` + `@hookform/resolvers/zod` | Type inference (`z.infer<typeof schema>`) is the feature |
| Focus trap in dialog | Custom Tab cycling | Native `<dialog>` element | Already used by existing RetroDialog; browser handles trap, backdrop, ESC |
| Option list keyboard nav | Custom `onKeyDown` switch | `useListNavigation` from floating-ui | Handles wrap-around, Home/End, disabled skip, virtual lists |

**Key insight:** All five items above are deceptively complex. floating-ui and RHF are the two dependencies that pay back their bundle cost within a single form.

## Runtime State Inventory

Not applicable — greenfield phase. No rename/refactor/migration involved.

## Common Pitfalls

### Pitfall 1: Controller + ref forwarding

**What goes wrong:** `Controller`'s `field.ref` isn't forwarded to the underlying DOM element, so RHF's `setFocus(name)` and error-auto-focus fail silently.

**Why it happens:** `cloneElement` merges props but TypeScript doesn't enforce that children accept `ref`. Easy to miss on custom components.

**How to avoid:** Every primitive wrappable by RetroFormField (Textarea, Select, Combobox, Checkbox, FileInput) MUST use `forwardRef`. Verify by calling `setFocus` in a test.

**Warning signs:** `setFocus` silently does nothing; validation errors don't scroll into view.

### Pitfall 2: floating-ui `size` middleware + scroll

**What goes wrong:** Dropdown renders 10px tall when placed inside a scrolled container because `availableHeight` measures from the current scroll position, not the viewport.

**Why it happens:** [CITED: floating-ui docs] `size` is viewport-relative by default.

**How to avoid:** Set `boundary: 'clippingAncestors'` or pass explicit `padding` on size middleware. Test with dropdown near viewport bottom.

### Pitfall 3: Native `<dialog>` + React state

**What goes wrong:** Calling `showModal()` on a `<dialog>` that is already open throws `InvalidStateError`.

**Why it happens:** React 19's dev-mode StrictMode double-invokes effects; if `open()` is called from an effect, it runs twice.

**How to avoid:** Follow existing RetroDialog pattern — imperative `open()`/`close()` via `useImperativeHandle`, never inside `useEffect`. Check `dialogRef.current?.open` before calling `showModal()` (the existing code already relies on this being idempotent; verify once).

### Pitfall 4: zod v4 resolver package mismatch

**What goes wrong:** `zodResolver` throws at runtime because `@hookform/resolvers` version doesn't match `zod` major.

**Why it happens:** [VERIFIED: npm registry] zod 4.x requires `@hookform/resolvers` 5.x. zod 3.x paired with resolvers 3.x. Easy to mix.

**How to avoid:** Install the exact versions in Standard Stack above. If `zodResolver` import fails, check both versions.

### Pitfall 5: Combobox async race

**What goes wrong:** Fast-typing user sees stale results — request for query "ham" resolves after request for "hammer".

**Why it happens:** Naive fetch without cancellation.

**How to avoid:** Use TanStack Query's `useQuery` with the search term in the queryKey (Phase 56 infra) OR use an `AbortController` per request and ignore resolved results whose query doesn't match the current query. Debounce 250ms (CONTEXT.md discretion).

### Pitfall 6: File `<input type="file">` value reset

**What goes wrong:** Selecting the same file twice does nothing (no change event).

**Why it happens:** Browser dedupes identical file values on the native input.

**How to avoid:** Reset `inputRef.current.value = ""` after reading files. Store selected files in React state, not on the input.

### Pitfall 7: Lingui extraction misses dynamic strings

**What goes wrong:** `t`ARCHIVE ${entityName}`` doesn't extract to catalog because Lingui can't statically analyze template interpolation on labels.

**Why it happens:** Lingui extraction is AST-based.

**How to avoid:** Use `t({ message: 'ARCHIVE CATEGORY' })` with explicit pre-built variants per entity, or use ICU plural/select syntax. Planner should decide per-primitive; the destructive-action inventory (UI-SPEC) lists all 5 cases — pre-enumerate.

## Code Examples

### Auto-resize Textarea (up to 8 rows)

```tsx
// Source: manual — MDN scrollHeight pattern
const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
  const el = e.currentTarget;
  el.style.height = "auto";
  const lineHeight = 24; // 16px * 1.5
  const maxHeight = lineHeight * 8;
  el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
};
```

### Checkbox with 44px hit area, 24px visual box

```tsx
// Visual 24x24 centered inside 44x44 label hit area
<label className="inline-flex items-center gap-sm min-h-[44px] min-w-[44px] cursor-pointer">
  <span className="relative w-[24px] h-[24px] border-retro-thick border-retro-ink bg-retro-cream">
    <input type="checkbox" className="absolute inset-0 opacity-0 peer" {...props} />
    <span className="absolute inset-0 hidden peer-checked:block bg-retro-amber" />
    {/* check icon positioned inside on checked */}
  </span>
  <span className="text-[16px]">{label}</span>
</label>
```

### Pagination visibility contract

```tsx
// From UI-SPEC: "single-page (hidden)"
if (totalCount <= pageSize) return null;
// mono counter: `Page ${page} of ${Math.ceil(totalCount/pageSize)}`
```

### RetroCombobox async options (using TanStack Query — Phase 56)

```tsx
// Source: [CITED: tanstack.com/query/latest]
const [query, setQuery] = useState("");
const debouncedQuery = useDebouncedValue(query, 250);
const { data: options = [], isFetching } = useQuery({
  queryKey: ["categories", "search", debouncedQuery],
  queryFn: ({ signal }) => categoriesApi.search(debouncedQuery, { signal }),
  enabled: debouncedQuery.length > 0,
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Formik | react-hook-form | ~2021 | Faster re-renders via uncontrolled pattern; smaller bundle |
| yup | zod | ~2022 | Superior TypeScript inference |
| Popper.js | floating-ui | 2022 (Popper renamed) | Same author; better tree-shaking and React hooks |
| zod 3.x + @hookform/resolvers 3.x | zod 4.x + @hookform/resolvers 5.x | 2025 | [VERIFIED: npm registry 2026-04-15] Version alignment critical |

**Deprecated/outdated:**
- Downshift-based comboboxes — not deprecated, but forbidden here by D-04.
- `useFormContext` + deep nesting — prefer passing `control` as prop per D-03.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 250ms debounce is good default for combobox async search | Discretion / Pitfall 5 | Too slow feels laggy, too fast hammers API; trivial to adjust |
| A2 | RetroConfirmDialog should extend RetroDialog (reuse) vs standalone | Pattern 5 | If standalone is chosen, duplicate ~40 lines; no functional impact |
| A3 | Auto-resize textarea via scrollHeight (no library) | Code Examples | If this misbehaves on Safari, add `field-sizing: content` CSS fallback |
| A4 | `cloneElement`-based child prop injection for RetroFormField | Pattern 2 | Alternative: render-prop children; `cloneElement` is simpler but less explicit |

If A2 or A4 matter to the user, planner should surface during plan-check.

## Open Questions

1. **Does `RetroConfirmDialog` extend `RetroDialog` or stand alone?**
   - What we know: UI-SPEC allows either; existing RetroDialog already handles backdrop/ESC/focus trap.
   - What's unclear: Planner's choice per CONTEXT.md discretion.
   - Recommendation: Extend (wrap) — avoid duplicate `<dialog>` infrastructure.

2. **Does RetroCombobox demo pull from real Phase 56 API (categories/locations) or use a static fixture on `/demo`?**
   - What we know: CONTEXT.md says "realistic async data source" using Phase 56 API modules.
   - What's unclear: Whether this means live API calls or a fixture that simulates the same shape.
   - Recommendation: Use the real `categoriesApi.list()` — `/demo` is a dev route and Phase 56 is shipped.

3. **Should RetroFormField children be a single ReactElement (cloneElement) or render-prop?**
   - Recommendation: Single ReactElement via `cloneElement` — matches the ergonomic pattern in CONTEXT.md code example.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun | package install | ✓ | (assumed, existing toolchain) | npm |
| Node | build | ✓ | existing | — |
| React 19 | all primitives | ✓ | 19.2.5 | — |
| TypeScript 6 | typing | ✓ | ~6.0.2 | — |
| Tailwind 4 | styling | ✓ | 4.2.2 | — |
| Vitest + Testing Library | tests | ✓ | 4.1.3 / 16.3.2 | — |
| Phase 56 API modules | Combobox async demo | ✓ | shipped | static fixture |

**Missing with no fallback:** None.
**Missing with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.3 + @testing-library/react 16.3.2 + @testing-library/user-event 14.6.1 |
| Config file | `frontend2/vitest.config.*` (existing) |
| Quick run command | `cd frontend2 && bun run test -- --run src/components/retro/__tests__/<File>.test.tsx` |
| Full suite command | `cd frontend2 && bun run test` |

### Phase Requirements -> Test Map

Phase 57 has no user-facing REQ-IDs; map to Success Criteria from phase description.

| SC # | Behavior | Test Type | Automated Command | File Exists? |
|------|----------|-----------|-------------------|-------------|
| SC-1 | All 9 primitives render with interactive states | unit per primitive | `bun run test -- --run src/components/retro/__tests__/Retro*.test.tsx` | Wave 0 |
| SC-2 | RetroFormField + RHF + zod surfaces inline errors | integration | `bun run test -- --run RetroFormField.test.tsx` | Wave 0 |
| SC-3 | RetroCombobox async + keyboard nav + 44px targets | integration | `bun run test -- --run RetroCombobox.test.tsx` | Wave 0 |
| SC-4 | RetroPagination exposes page-size nav + "N of M" | unit | `bun run test -- --run RetroPagination.test.tsx` | Wave 0 |
| SC-5 | Barrel exports + /demo consumes each primitive | smoke | `bun run test -- --run DemoPage.test.tsx` (new) | Wave 0 |

### Sampling Rate

- **Per task commit:** `bun run test -- --run src/components/retro/__tests__/<changed-file>.test.tsx`
- **Per plan merge:** `cd frontend2 && bun run test`
- **Phase gate:** full suite green + `bun run lint` + `bun run build`

### Wave 0 Gaps

- [ ] `src/components/retro/__tests__/RetroSelect.test.tsx`
- [ ] `src/components/retro/__tests__/RetroCombobox.test.tsx`
- [ ] `src/components/retro/__tests__/RetroTextarea.test.tsx`
- [ ] `src/components/retro/__tests__/RetroCheckbox.test.tsx`
- [ ] `src/components/retro/__tests__/RetroFileInput.test.tsx`
- [ ] `src/components/retro/__tests__/RetroPagination.test.tsx`
- [ ] `src/components/retro/__tests__/RetroConfirmDialog.test.tsx`
- [ ] `src/components/retro/__tests__/RetroEmptyState.test.tsx`
- [ ] `src/components/retro/__tests__/RetroFormField.test.tsx`
- [ ] Package install: `bun add react-hook-form zod @hookform/resolvers @floating-ui/react` (Plan 57-01 first step)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 56 scope |
| V3 Session Management | no | Phase 56 scope |
| V4 Access Control | no | Not a data-access phase |
| V5 Input Validation | **yes** | `zod` schemas at form boundary; server-side re-validation remains authoritative |
| V6 Cryptography | no | No crypto primitives introduced |

### Known Threat Patterns for React + RHF + zod

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unsanitized user input rendered in dialog body (confirm body echoes item name) | Tampering / XSS | React auto-escapes text children; never use `dangerouslySetInnerHTML` in confirm body |
| File input accepts oversized / wrong MIME | DoS / Tampering | Enforce `accept="image/jpeg,image/png,image/heic"` and client-side size check; server remains authoritative |
| Client-side zod is the only validation | Tampering | Treat client zod as UX; server MUST re-validate (already the case with DRF backend) |
| Combobox search term injection into query string | Info Disclosure | URL-encode query via Phase 56 API client (already does this) |

## Project Constraints (from CLAUDE.md / STATE.md)

CLAUDE.md not present at repo root. Applicable directives extracted from STATE.md and existing code:

- **No shadcn/Radix.** v2.0 locked decision. Hand-roll everything in `@/components/retro`.
- **All retro imports via `@/components/retro` barrel.** v2.0 locked.
- **Lingui `t` macro for every user-visible string.** Existing project rule; both `en` and `et` catalogs must compile before checkpoint.
- **Pre-build lint guard:** `bun run lint:imports` blocks `idb|serwist|offline|sync` imports. Confirm no new primitive pulls such deps transitively.
- **TanStack Query for server state.** v2.1 locked — RetroCombobox async search uses `useQuery`, not raw `fetch`.
- **`forwardRef` on every primitive.** Existing pattern across all retro components.

## Sources

### Primary (HIGH confidence)

- `frontend2/src/components/retro/RetroInput.tsx` — bevel pattern, focus ring, error state
- `frontend2/src/components/retro/RetroDialog.tsx` — native `<dialog>` + `useImperativeHandle` pattern
- `frontend2/package.json` — existing deps and versions
- `.planning/STATE.md` — v2.0 and v2.1 locked decisions
- `.planning/phases/57-retro-form-primitives/57-UI-SPEC.md` — visual contract
- npm registry (verified 2026-04-15): react-hook-form@7.72.1, zod@4.3.6, @hookform/resolvers@5.2.2, @floating-ui/react@0.27.19

### Secondary (MEDIUM confidence — official docs, not re-fetched this session)

- react-hook-form.com/docs/usecontroller/controller — Controller API
- floating-ui.com/docs/react — useFloating, middleware, useListNavigation
- w3.org/WAI/ARIA/apg/patterns/combobox — combobox keyboard contract
- w3.org/WAI/ARIA/apg/patterns/listbox — listbox keyboard contract

### Tertiary (LOW confidence)

None — all claims either verified in-repo or from stable authoritative sources.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all four new deps verified against npm registry today
- Architecture: HIGH — follows shipped RetroInput/RetroDialog patterns; D-01..D-05 fully constrain the approach
- Pitfalls: HIGH for items 1–4, 6–7 (well-known); MEDIUM for item 5 (depends on API shape)

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 days; RHF/zod/floating-ui are stable)
