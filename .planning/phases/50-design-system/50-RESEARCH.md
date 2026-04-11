# Phase 50: Design System - Research

**Researched:** 2026-04-10
**Domain:** Retro industrial UI component library (React 19 + Tailwind CSS 4)
**Confidence:** HIGH

## Summary

This phase builds ten retro-styled UI primitives in `frontend2/src/components/retro/` that all subsequent feature pages (layout, dashboard, settings) will compose from. The components are: RetroButton, RetroPanel, RetroInput, RetroCard, RetroDialog, RetroTable, RetroTabs, RetroToast, RetroBadge, and HazardStripe. Each must render with the BAM industrial game aesthetic: thick dark outlines (3-4px), beveled borders, cream backgrounds, monospace data fields, and uppercase labels.

The existing codebase already has retro design tokens in `globals.css` (`@theme` block with colors, borders, shadows, fonts, spacing), a `bg-hazard-stripe` utility class, and inline retro styling patterns in the auth pages (AuthPage.tsx, LoginForm.tsx). These auth components contain ad-hoc implementations of buttons, inputs, tabs, and panels that should be extracted into the formal design system. The demo page at `/demo` serves as both a living style guide and visual validation target.

**Primary recommendation:** Build pure presentational components using Tailwind utility classes against existing design tokens. No new npm dependencies needed -- React 19 + Tailwind CSS 4 + existing tokens cover all ten components. Extract patterns already proven in the auth pages into reusable, prop-driven components.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DS-01 | RetroButton with thick outlines, beveled borders, color variants (primary, danger, neutral), and visual states (default, hover, pressed, disabled) | BAM ref images 2, 5 show button styles; existing auth pages have inline button patterns to extract |
| DS-02 | RetroPanel with thick border, cream background, optional hazard stripe header, and close button | BAM ref images 2, 3, 5, 6 show panel variations; `RetroPanel` already exists inline in routes/index.tsx |
| DS-03 | RetroInput with monospace text, icon prefix support, and inline validation error states | BAM ref image 5 shows input fields; LoginForm.tsx has icon-prefix input pattern to extract |
| DS-04 | RetroCard for content grouping with thick borders and shadow | BAM ref images 3, 4 show card-like containers; similar to RetroPanel but lighter |
| DS-05 | RetroDialog (modal) with overlay, panel styling, and close button | BAM ref image 2 shows dialog-like panels with X close buttons; needs portal/overlay pattern |
| DS-06 | RetroTable with thick borders, alternating row styling, header styling | BAM ref image 6 shows tabular data areas; industrial table aesthetic |
| DS-07 | RetroTabs with file-folder tab styling, active/inactive states | BAM ref images 5, 6 show tab bars; AuthPage.tsx already has tab implementation to extract |
| DS-08 | RetroToast for transient notifications with retro styling | Needed for action feedback in dashboard/settings phases; no existing implementation |
| DS-09 | RetroBadge for status labels and counts with color-coded backgrounds | BAM ref images 1, 2 show badge-like status indicators |
| DS-10 | HazardStripe decorative divider component | Already exists as CSS utility `bg-hazard-stripe`; wrap as a configurable component |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.2.5 | UI framework | [VERIFIED: frontend2/package.json] Already installed |
| tailwindcss | ^4.2.2 | Utility-first CSS | [VERIFIED: frontend2/package.json] All styling via Tailwind utilities against @theme tokens |
| @tailwindcss/vite | ^4.2.2 | Tailwind Vite integration | [VERIFIED: frontend2/package.json] Already configured |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | ^16.3.2 | Component testing | [VERIFIED: frontend2/package.json] Test render + interaction for each component |
| vitest | ^4.1.3 | Test runner | [VERIFIED: frontend2/package.json] Already configured with jsdom |

### No New Dependencies Required

This phase needs zero additional npm packages. The retro design system is built entirely with:
- React 19 for component structure and refs/forwarding
- Tailwind CSS 4 utility classes for all styling
- Existing `@theme` design tokens for colors, borders, shadows
- Native HTML `<dialog>` element for RetroDialog (no portal library needed)
- CSS animations for RetroToast (no animation library needed)

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<dialog>` | @radix-ui/react-dialog | Radix adds focus trap + animation, but contradicts "fully custom" decision; native dialog has good browser support |
| CSS-only toast | react-hot-toast / sonner | Third-party toasts fight the retro aesthetic; simple CSS + setTimeout is sufficient for online-only SPA |
| Manual class composition | cva (class-variance-authority) | cva helps variant management but adds a dependency for 10 components; Tailwind conditional classes are sufficient at this scale |

## Architecture Patterns

### Recommended Project Structure
```
frontend2/src/components/retro/
  RetroButton.tsx        # DS-01
  RetroPanel.tsx         # DS-02
  RetroInput.tsx         # DS-03
  RetroCard.tsx          # DS-04
  RetroDialog.tsx        # DS-05
  RetroTable.tsx         # DS-06
  RetroTabs.tsx          # DS-07
  RetroToast.tsx         # DS-08 (+ toast context/provider)
  RetroBadge.tsx         # DS-09
  HazardStripe.tsx       # DS-10
  index.ts               # Barrel export
```

### Pattern 1: Component API Design (forwardRef + className merge)
**What:** Every component forwards refs and merges custom classNames with retro base styles
**When to use:** All ten components -- ensures composability with parent layouts
**Example:**
```typescript
// [ASSUMED] Standard React 19 component pattern
import { forwardRef, type ButtonHTMLAttributes } from "react";

interface RetroButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "neutral";
}

const RetroButton = forwardRef<HTMLButtonElement, RetroButtonProps>(
  ({ variant = "neutral", className = "", children, ...props }, ref) => {
    const variantClass = {
      primary: "bg-retro-amber text-retro-ink",
      danger: "bg-retro-red text-white",
      neutral: "bg-retro-cream text-retro-ink",
    }[variant];

    return (
      <button
        ref={ref}
        className={`h-[44px] px-lg border-retro-thick border-retro-ink font-bold uppercase text-[14px] shadow-retro-raised hover:brightness-110 active:shadow-retro-pressed disabled:bg-retro-gray disabled:cursor-not-allowed ${variantClass} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
```

### Pattern 2: RetroDialog with Native `<dialog>`
**What:** Use HTML `<dialog>` element with `showModal()` for proper focus trapping and backdrop
**When to use:** RetroDialog component -- modal overlays
**Example:**
```typescript
// [VERIFIED: MDN Web Docs] <dialog> has 97%+ browser support, built-in focus trap
import { forwardRef, useRef, useImperativeHandle, type ReactNode } from "react";

interface RetroDialogProps {
  children: ReactNode;
  onClose?: () => void;
}

export interface RetroDialogHandle {
  open: () => void;
  close: () => void;
}

const RetroDialog = forwardRef<RetroDialogHandle, RetroDialogProps>(
  ({ children, onClose }, ref) => {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useImperativeHandle(ref, () => ({
      open: () => dialogRef.current?.showModal(),
      close: () => dialogRef.current?.close(),
    }));

    return (
      <dialog
        ref={dialogRef}
        onClose={onClose}
        className="bg-retro-cream border-retro-extra-thick border-retro-ink shadow-retro-raised p-0 backdrop:bg-black/50"
      >
        {children}
      </dialog>
    );
  }
);
```

### Pattern 3: Toast System with Context + CSS Animations
**What:** Lightweight toast provider using React context + state, no external dependency
**When to use:** RetroToast notifications for user feedback
**Example:**
```typescript
// [ASSUMED] Standard React context pattern for toast
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface Toast {
  id: string;
  message: string;
  variant: "success" | "error" | "info";
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, variant?: Toast["variant"]) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, variant: Toast["variant"] = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast container renders at bottom-right */}
      <div className="fixed bottom-lg right-lg flex flex-col gap-sm z-50">
        {toasts.map((toast) => (
          <RetroToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
```

### Pattern 4: Extracting Existing Auth Patterns
**What:** The auth pages already contain ad-hoc retro patterns that should become the design system components
**When to use:** Phase 50 implementation -- extract, then refactor auth to consume

| Auth Page Pattern | Becomes Component | Key Extraction |
|-------------------|-------------------|----------------|
| Tab buttons in AuthPage.tsx (lines 24-27) | RetroTabs | Tab bar with active/inactive states, file-folder aesthetic |
| Panel wrapper in AuthPage.tsx (line 53) | RetroPanel | Bordered cream panel with optional hazard stripe and X button |
| Input fields in LoginForm.tsx (lines 84-92) | RetroInput | Monospace text, icon prefix, thick border, focus outline |
| Submit button in LoginForm.tsx (lines 150-161) | RetroButton | Beveled shadow, hover/active/disabled states |
| Error message in LoginForm.tsx (lines 140-148) | (inline pattern) | Red text alert -- can be part of RetroInput error prop |
| RetroPanel in routes/index.tsx (lines 28-37) | RetroPanel | Simplified version to merge with AuthPage pattern |

### Anti-Patterns to Avoid
- **Inline retro styles in feature pages:** After this phase, no feature page should define its own border/shadow/font classes for retro elements. Use the design system components.
- **Over-abstracting variants:** Ten components with 2-3 variants each is sufficient. Do not build a generic "variant" system with 20+ options -- keep it simple.
- **CSS-in-JS or styled-components:** All styling is Tailwind utility classes. No runtime CSS generation.
- **Heavy animation libraries:** Do not add framer-motion/motion for this phase. CSS transitions and keyframes handle button press, toast slide-in, and dialog fade.
- **Generic component library patterns:** Do not model after shadcn/ui or Radix primitives architecture. These are simple, opinionated retro components, not headless primitives.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal focus trap | Custom focus trap logic | Native `<dialog>` element `showModal()` | Built-in focus trap, Escape close, backdrop click, accessibility |
| Unique IDs for toasts | Custom incrementing counter | `crypto.randomUUID()` | Built into all modern browsers, no collisions |
| Class merging | Custom string concatenation | Template literals with Tailwind | At 10 components, simple string concat is fine; no need for clsx/twMerge |
| Color tokens | Hardcoded hex in components | Tailwind `@theme` tokens (already defined) | Single source of truth in globals.css |

## Common Pitfalls

### Pitfall 1: Shadow Direction Inconsistency
**What goes wrong:** Some components use `shadow-retro-raised` (2px 2px offset) while others use arbitrary inset shadows, creating an inconsistent bevel direction.
**Why it happens:** Ad-hoc styling per component instead of using the design token shadows.
**How to avoid:** Every raised element uses `shadow-retro-raised`. Every pressed/active state uses `shadow-retro-pressed`. No custom box-shadow values in components.
**Warning signs:** Buttons look like light comes from different directions. Pressed state doesn't visually "sink."

### Pitfall 2: Forgetting Disabled States
**What goes wrong:** Components look interactive when disabled -- user clicks with no feedback.
**Why it happens:** Disabled styling is easy to forget when focusing on the happy path aesthetic.
**How to avoid:** Every interactive component (Button, Input, Tabs) must define `disabled:bg-retro-gray disabled:cursor-not-allowed disabled:shadow-none` or equivalent. Test disabled state in demo page.
**Warning signs:** Demo page shows interactive elements without disabled examples.

### Pitfall 3: Missing Focus Visible Styles
**What goes wrong:** Keyboard users cannot tell which element is focused -- accessibility failure.
**Why it happens:** Thick borders (3-4px) make default browser focus outlines invisible or ugly.
**How to avoid:** Use `outline-2 outline-offset-2 outline-transparent focus-visible:outline-retro-amber` on all interactive elements. The amber outline on offset looks intentional with the retro aesthetic.
**Warning signs:** Tabbing through the demo page shows no visual focus indicator.

### Pitfall 4: Not Forwarding Refs
**What goes wrong:** Parent components cannot access DOM nodes for focus management, scroll-into-view, or dialog control.
**Why it happens:** Using simple function components without forwardRef.
**How to avoid:** Every component uses `forwardRef`. This is especially critical for RetroInput (form libraries need ref access) and RetroDialog (needs imperative open/close).
**Warning signs:** Form libraries or focus management code throwing "ref is null" errors.

### Pitfall 5: RetroToast Z-index Conflicts
**What goes wrong:** Toasts appear behind the dialog overlay or behind the sidebar.
**Why it happens:** Multiple positioned elements competing for stacking context.
**How to avoid:** Define a clear z-index scale: toast container z-50, dialog backdrop z-40, sidebar z-30. Document in the demo page.
**Warning signs:** Toast notification invisible when a dialog is open.

### Pitfall 6: Table Responsiveness
**What goes wrong:** RetroTable overflows on mobile, breaking the layout with horizontal scroll that clips the thick borders.
**Why it happens:** Tables with thick borders and monospace font are naturally wide.
**How to avoid:** Wrap RetroTable in `overflow-x-auto` container. On narrow screens, consider a card-based alternative layout. Phase 51+ pages will need responsive table handling.
**Warning signs:** Demo page table overflows on mobile viewport.

## Code Examples

### Existing Design Tokens (already in globals.css)
```css
/* Source: frontend2/src/styles/globals.css -- VERIFIED in codebase */
@theme {
  --color-retro-cream: #F5F0E1;
  --color-retro-charcoal: #2A2A2A;
  --color-retro-ink: #1A1A1A;
  --color-retro-amber: #D4A017;
  --color-retro-orange: #E67E22;
  --color-retro-red: #CC3333;
  --color-retro-green: #4A7C4A;
  --color-retro-blue: #3366AA;
  --color-retro-hazard-yellow: #FFD700;
  --color-retro-hazard-black: #1A1A1A;
  --color-retro-gray: #8B8B8B;

  --border-width-retro-thick: 3px;
  --border-width-retro-extra-thick: 4px;

  --shadow-retro-raised: 2px 2px 0px #1A1A1A;
  --shadow-retro-pressed: inset 2px 2px 0px rgba(0, 0, 0, 0.3);

  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: 'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace;
}
```

### Existing Inline Button Pattern (to extract)
```tsx
/* Source: frontend2/src/features/auth/LoginForm.tsx lines 150-161 -- VERIFIED */
<button
  type="submit"
  disabled={isSubmitting}
  className={`w-full h-[44px] border-retro-thick border-retro-ink text-[14px] font-bold uppercase ${
    isSubmitting
      ? "bg-retro-gray text-retro-gray cursor-not-allowed"
      : "bg-retro-cream text-retro-ink shadow-retro-raised hover:bg-retro-amber hover:cursor-pointer active:shadow-retro-pressed"
  }`}
>
  {isSubmitting ? t`PROCESSING...` : t`LOG IN`}
</button>
```

### Existing Inline Input Pattern (to extract)
```tsx
/* Source: frontend2/src/features/auth/LoginForm.tsx lines 84-92 -- VERIFIED */
<input
  className="w-full h-[40px] border-retro-thick border-retro-ink bg-retro-cream font-mono text-[14px] text-retro-ink placeholder:text-retro-gray pl-[40px] pr-sm outline-2 outline-offset-2 outline-transparent focus:outline-retro-amber"
/>
```

### Existing Inline Tab Pattern (to extract)
```tsx
/* Source: frontend2/src/features/auth/AuthPage.tsx lines 24-27 -- VERIFIED */
const tabBase = "min-w-[120px] h-[36px] text-[14px] font-bold uppercase border-retro-thick border-retro-ink cursor-pointer";
const activeTabClass = `${tabBase} bg-retro-cream border-b-0`;
const inactiveTabClass = `${tabBase} bg-retro-gray`;
```

### BAM Reference Image Analysis
```
Reference 1 (1.png): Icon set -- thick-outlined icons with colored fills, industrial symbols
Reference 2 (2.png): UI components -- panels with hazard stripes, buttons, badges, status indicators, progress bars, warning signs
Reference 3 (3.png): Full app layout -- dark charcoal background, cream panels, file-folder tabs, grid layout
Reference 4 (4.png): Player profile card -- avatar frame, inventory grid, thick borders, cream/charcoal contrast
Reference 5 (5.png): Auth forms -- login/register tabs, input fields with icon prefixes, button states (active/inactive), error/success messages, toggle switches
Reference 6 (6.png): Settings panels -- tab navigation (AUDIO/GRAPHICS/CONTROLS), sliders, dropdowns, checkbox lists, table-like layouts
```

### Component-to-Reference Mapping
| Component | Primary Reference | Key Visual Elements |
|-----------|-------------------|---------------------|
| RetroButton | 2.png, 5.png | Beveled shadow, amber hover, pressed inset, disabled gray |
| RetroPanel | 2.png, 3.png, 5.png | Cream bg, thick ink border, optional hazard stripe header, red X close |
| RetroInput | 5.png | Thick border, monospace text, icon prefix slot, amber focus ring |
| RetroCard | 3.png, 4.png | Like Panel but lighter -- no hazard stripe, used for content grouping |
| RetroDialog | 2.png | Panel-styled modal with backdrop, X close button, hazard stripe |
| RetroTable | 6.png | Thick header border, alternating row tint, monospace data cells |
| RetroTabs | 5.png, 6.png | File-folder tabs, active tab merges with panel (border-b-0), inactive gray |
| RetroToast | 2.png | Small panel with color-coded left border (green/red/amber), auto-dismiss |
| RetroBadge | 1.png, 2.png | Small inline label with colored bg, thick border, uppercase text |
| HazardStripe | 2.png, 3.png | Yellow-black diagonal stripe pattern, configurable height |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS modules per component | Tailwind utility classes | Tailwind v4 (2025) | No separate CSS files, all styling inline in JSX |
| Portal libraries for modals | Native `<dialog>` element | 2024 (97%+ support) | No dependency needed for focus trap + backdrop |
| Class merging (clsx + twMerge) | Simple template literals | When component count is small (<15) | No dependency; scale up if needed later |
| forwardRef function | React 19 ref as prop | React 19 (2024) | Can pass ref directly without forwardRef wrapper [ASSUMED -- verify React 19 ref-as-prop support] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | React 19 supports ref as a regular prop without forwardRef | State of the Art | LOW -- if not, use forwardRef (standard pattern, already used in codebase) |
| A2 | Native `<dialog>` element provides sufficient accessibility for RetroDialog without additional ARIA work | Architecture Patterns | MEDIUM -- may need aria-labelledby, aria-describedby attributes manually |
| A3 | CSS `@keyframes` with Tailwind `animate-*` utilities are sufficient for toast slide-in/out without an animation library | Architecture Patterns | LOW -- CSS animations are well-supported; can add complexity later if needed |
| A4 | Ten components is the complete set needed before Phase 51 (App Layout) can begin | Phase Requirements | LOW -- Phase 51 success criteria reference sidebar, topbar, loading indicator, error boundary which compose from these primitives |

## Open Questions

1. **Should auth pages be refactored to use design system components in this phase?**
   - What we know: Auth pages (LoginForm, RegisterForm, AuthPage) have inline retro styling that duplicates what the design system will provide
   - What's unclear: Whether refactoring auth to consume the new components is in-scope for Phase 50 or deferred
   - Recommendation: Include a refactoring task in Phase 50 -- it validates the component APIs against real usage and reduces code duplication. The auth pages are the first consumers.

2. **Toast provider placement in component tree**
   - What we know: ToastProvider needs to wrap the app to be available everywhere. Currently App.tsx has I18nProvider > BrowserRouter > AuthProvider > AppRoutes.
   - What's unclear: Whether to add ToastProvider now (Phase 50) or when it is first needed (Phase 51+)
   - Recommendation: Create the ToastProvider in Phase 50 but do NOT wire it into App.tsx yet. The demo page can render its own provider instance for testing. Phase 51 wires it into the app shell.

3. **Demo page route protection**
   - What we know: The demo page at `/demo` is a style guide. Current routes use RequireAuth for protected pages.
   - What's unclear: Whether `/demo` should be behind auth or public
   - Recommendation: Make `/demo` a public route (no RequireAuth) so it can be viewed without logging in. It is a development tool, not a user feature.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.3 + @testing-library/react 16.3.2 |
| Config file | `frontend2/vite.config.ts` (test section) |
| Quick run command | `cd frontend2 && bun run test` |
| Full suite command | `cd frontend2 && bun run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DS-01 | RetroButton renders variants and states | unit | `cd frontend2 && bunx vitest run src/components/retro/__tests__/RetroButton.test.tsx` | Wave 0 |
| DS-02 | RetroPanel renders with hazard stripe and close button | unit | `cd frontend2 && bunx vitest run src/components/retro/__tests__/RetroPanel.test.tsx` | Wave 0 |
| DS-03 | RetroInput renders with icon, monospace, error state | unit | `cd frontend2 && bunx vitest run src/components/retro/__tests__/RetroInput.test.tsx` | Wave 0 |
| DS-04 | RetroCard renders with border and shadow | unit | `cd frontend2 && bunx vitest run src/components/retro/__tests__/RetroCard.test.tsx` | Wave 0 |
| DS-05 | RetroDialog opens/closes with modal behavior | unit | `cd frontend2 && bunx vitest run src/components/retro/__tests__/RetroDialog.test.tsx` | Wave 0 |
| DS-06 | RetroTable renders header and rows | unit | `cd frontend2 && bunx vitest run src/components/retro/__tests__/RetroTable.test.tsx` | Wave 0 |
| DS-07 | RetroTabs switches active tab | unit | `cd frontend2 && bunx vitest run src/components/retro/__tests__/RetroTabs.test.tsx` | Wave 0 |
| DS-08 | RetroToast shows and auto-dismisses | unit | `cd frontend2 && bunx vitest run src/components/retro/__tests__/RetroToast.test.tsx` | Wave 0 |
| DS-09 | RetroBadge renders variants | unit | `cd frontend2 && bunx vitest run src/components/retro/__tests__/RetroBadge.test.tsx` | Wave 0 |
| DS-10 | HazardStripe renders with configurable height | unit | `cd frontend2 && bunx vitest run src/components/retro/__tests__/HazardStripe.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend2 && bun run test`
- **Per wave merge:** `cd frontend2 && bun run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/retro/__tests__/` directory -- needs creation
- [ ] All 10 test files listed above -- none exist yet
- [ ] Visual validation via `/demo` page -- manual browser check (cannot automate retro aesthetic verification)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | -- |
| V3 Session Management | No | -- |
| V4 Access Control | No | -- |
| V5 Input Validation | Minimal | RetroInput should support `type`, `required`, `pattern` pass-through to native input |
| V6 Cryptography | No | -- |

No significant security concerns for UI primitives. RetroInput must not suppress native HTML validation attributes. RetroDialog must not prevent Escape key closing (native `<dialog>` handles this).

## Sources

### Primary (HIGH confidence)
- frontend2 codebase -- verified existing tokens, patterns, and structure
- BAM reference images (`.planning/references/retro-ui/1-6.png`) -- visual design targets
- Phase 48 RESEARCH.md -- established tokens, stack, and conventions
- Phase 49 CONTEXT.md -- auth page patterns as extraction source

### Secondary (MEDIUM confidence)
- [MDN `<dialog>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog) -- native modal behavior [CITED: MDN Web Docs]
- `.planning/research/ARCHITECTURE.md` -- component naming convention (retro- prefix) and structure

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, everything already installed and verified
- Architecture: HIGH -- patterns extracted from working auth page code + standard React patterns
- Pitfalls: HIGH -- based on actual BAM reference analysis and common component library issues

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable -- no external dependencies to go stale)
