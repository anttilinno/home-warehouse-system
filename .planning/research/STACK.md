# Technology Stack — v2.1 Feature Parity Additions

**Project:** Home Warehouse System — `/frontend2` retro frontend
**Researched:** 2026-04-14
**Mode:** Ecosystem (targeted additions)
**Overall confidence:** HIGH

## Context Summary

`/frontend2` is a Vite 8 + React 19 + React Router v7 + Tailwind CSS 4 SPA with a hand-rolled retro component library and Lingui i18n. Online-only, no PWA/offline/IndexedDB layer. v2.1 needs:

1. Items CRUD (list + detail + create/edit + photo upload)
2. Loan management (loans + returns + history)
3. Barcode scanning (camera-based, reuse frontend1 patterns)
4. Categories / Locations / Containers management

Backend API exists and is used by frontend1. Goal is the **minimum library surface** compatible with the retro aesthetic.

## Recommended Stack Additions

### Core Additions (required)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@tanstack/react-query` | `^5.62.x` | Server state / caching for items, loans, categories, locations | Standard for React 19 SPAs; dedupes requests, background refetch, optimistic updates for CRUD. Frontend1 leans on Next server components/fetch — those don't translate, so an explicit client cache is essential here. |
| `react-hook-form` | `^7.70.x` | Forms for items/loans/categories/locations | Matches frontend1. Works with plain inputs (no Radix required). Integrates with zod via `@hookform/resolvers`. |
| `@hookform/resolvers` | `^5.2.x` | RHF ↔ zod bridge | One-liner schema validation. |
| `zod` | `^4.3.x` | Schema validation (shared with backend error shapes) | Already used in frontend1; keep identical request/response types across frontends. |
| `@yudiel/react-qr-scanner` | `2.5.1` (exact) | Camera barcode/QR scanning | **Reuse from frontend1.** Project-validated on iOS/Android (v1.3, v1.9), ZXing-based, handles QR/UPC/EAN/Code128. React 19 compatible. Headless enough to wrap in a retro dialog. |
| `barcode-detector` | `3.0.0` (exact) | Polyfill for BarcodeDetector API | `@yudiel/react-qr-scanner` uses native `BarcodeDetector` when present; the polyfill is what frontend1 ships for iOS Safari / desktop Firefox. Keep parity. |
| `date-fns` | `^4.1.x` | Loan due-date / return-date formatting, relative time for history | Small, tree-shakeable. Matches frontend1 tokens so existing `useDateFormat` hook keeps working. |

### Likely Needed (recommended)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@tanstack/react-virtual` | `^3.13.x` | Virtualize items list | Items list can reach thousands of rows; virtualization keeps retro table scrolling at 60fps. Headless — no style injection. |
| `uuid` | `^13.0.x` (UUIDv7) | Client-side idempotency keys for create mutations | Backend expects UUIDv7 idempotency keys per v1.1 decision. Even online-only, this avoids duplicate creates on double-tap. |

### Optional / Defer

| Library | Why Possibly Needed | Recommendation |
|---------|---------------------|----------------|
| `fuse.js` | Client-side fuzzy search over items | **Defer.** Online-only — prefer backend search. Add only if backend lacks fuzzy search or UX demands instant filter without round-trip. |
| `cmdk` | Command palette / searchable combobox for category/location pickers | **Defer unless needed.** Retro aesthetic likely wants a hand-built listbox; re-evaluate during design. |
| `sonner` | Toast notifications | **Skip.** Retro toast component already exists. |
| `lucide-react` | Icons | **Check first.** If the retro lib ships pixel/terminal glyphs, do not add. Otherwise add sparingly. |
| `motion` (Framer) | Animations | **Skip for v2.1.** Retro aesthetic leans on CSS transitions; avoid ~50kB bundle bump. |
| `@dnd-kit/*` | Drag-reorder for category tree | **Defer.** Up/down buttons suffice initially. |
| `papaparse` | CSV import/export | **Defer — out of scope for v2.1.** |
| `ios-haptics` | Scan haptic feedback parity | Optional (1kB). Add only if UX review asks for it. |

### Explicitly NOT Adding (Anti-dependencies)

| Library | Why Not |
|---------|---------|
| `@radix-ui/*` | Duplicates retro component library; Radix default chrome fights terminal styling. Build dialog/popover/select on retro primitives. |
| `next-intl` | Frontend2 uses Lingui — keep it. |
| `next-themes` | No Next.js; existing frontend2 theme toggle already works without it. |
| `serwist` / `@serwist/next` | v2.1 is **online-only**. No service worker, no PWA. |
| `idb` | No IndexedDB — no offline queue, no form-draft persistence in v2.1. |
| `recharts` | No charts in v2.1 feature set. |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Only if retro lib lacks a className helper. Check `frontend2/src` first — likely already solved. |

## Photo Upload Approach

**Recommendation: `multipart/form-data` direct to backend, via native `FormData` + `fetch` wrapped in a React Query mutation. No extra library.**

Rationale:
- Backend's `itemphoto` endpoints (92.4% coverage per v1.4) already accept multipart from frontend1. Matching the wire format = zero backend changes.
- Base64 in JSON bloats payloads 33% and blocks the main thread encoding large camera frames.
- No offline queue in v2.1 → no need for IndexedDB blob storage (the v1.9 quickCapturePhotos pattern).
- `<input type="file" accept="image/*" capture="environment">` gives native iOS/Android camera + gallery picker with zero JS. Wrap in retro-styled label.
- Multi-photo upload: prefer **per-photo POST** calls via `Promise.allSettled` so one failure doesn't lose the whole set. Match whatever helper frontend1's `client.ts` exposes.

Client-side resize (optional, recommended):
- Use `createImageBitmap` + `OffscreenCanvas` + `canvas.convertToBlob({ type: 'image/webp', quality: 0.85 })` to downsample >4000px phone captures to ~1920px before upload.
- Zero-dep native API. 5–10× bandwidth savings on mobile.
- Degrade gracefully: if `OffscreenCanvas` unavailable (older Safari), upload raw.

Progress UI:
- `fetch` doesn't expose upload progress. Use a small `XMLHttpRequest` wrapper (~30 lines) inside the React Query mutation when progress matters.
- For v2.1 MVP, a simple "Uploading… / Done" indicator via mutation `isPending` is sufficient.

## Barcode Scanner Reusability

**`@yudiel/react-qr-scanner` is fully reusable in frontend2.** Confidence: HIGH.

- Plain React component, no Next.js coupling.
- Renders its own `<video>` + overlay; viewfinder frame is CSS-stylable via `constraints` and a custom child overlay.
- React 19 compatible (frontend1 ships React 19.2.3 + this scanner in production).
- Retro styling: mount `<Scanner>` inside the existing retro dialog/modal primitive; layer absolute-positioned retro SVG corner brackets + scanline over the video. The library doesn't force its own chrome.
- Keep the `barcode-detector` polyfill dep — the scanner auto-detects and uses it on iOS Safari.

**Do NOT lift the entire frontend1 `BarcodeScanner` component verbatim** — it's tangled with offline scan history (IndexedDB), AudioContext beep, and ios-haptics. For v2.1, build a lean retro wrapper:
- Camera permission prompt → retro dialog
- Scan result → close dialog, route to item detail or "not found → create" flow
- Flashlight toggle via `MediaStreamTrack.applyConstraints({ torch: true })` (same technique as frontend1)
- Skip scan history persistence (online-only, no IndexedDB)
- Audio/haptic feedback optional

## Integration with Existing Retro Library

- **Forms:** RHF's `register()` returns `{ name, ref, onChange, onBlur }` — drop-in for retro `<RetroInput>` as long as it forwards refs. Verify `forwardRef` is set on existing input components; if not, one-line fix per component.
- **Dialogs:** Use existing retro dialog for scanner, delete confirmation, photo viewer. No Radix.
- **Select / combobox:** Category and location pickers need searchable trees. If retro lib has only a basic `<RetroSelect>`, build a retro combobox on top of a plain button + floating panel + keyboard nav (~100 lines). Avoid cmdk to preserve aesthetic.
- **Tables:** Existing retro table + `@tanstack/react-virtual` for the items list body. Keep thead/tfoot normal, virtualize tbody rows.
- **Toasts:** Existing retro toast; wire React Query's `onError`/`onSuccess` to it.

## Installation

```bash
# Core
npm install @tanstack/react-query react-hook-form @hookform/resolvers zod \
            @yudiel/react-qr-scanner@2.5.1 barcode-detector@3.0.0 \
            date-fns uuid

# Recommended
npm install @tanstack/react-virtual

# Dev
npm install -D @types/uuid
```

Lock `@yudiel/react-qr-scanner` and `barcode-detector` to the exact versions frontend1 uses (`2.5.1` / `3.0.0`) for behavioral parity while both frontends coexist.

## Version Compatibility Notes

- All listed libraries support React 19. React Query v5 officially supports React 18+; no issue on 19.
- `zod` v4 is current and matches frontend1. Do not mix v3/v4 — schema types differ.
- `date-fns` v4 is ESM-first; native with Vite 8.
- Vite 8 (in frontend2) handles all of the above without plugin changes. SWC plugin for Lingui keeps working.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Server state | React Query v5 | SWR | RQ has richer mutation/optimistic APIs. SWR lighter but weaker mutation story. |
| Forms | react-hook-form | TanStack Form | RHF battle-tested, matches frontend1. TanStack Form adds learning curve for zero gain. |
| Barcode | `@yudiel/react-qr-scanner` | `react-zxing`, `html5-qrcode` | Project already validated `@yudiel` across iOS PWA; re-testing alternatives is pure risk. |
| Photo upload | native FormData + fetch/XHR | `react-dropzone`, `filepond`, `uppy` | All bring styling baggage that fights retro aesthetic. Native input + label handles drag-drop in ~10 lines. |
| Image resize | native `createImageBitmap` + `OffscreenCanvas` | `browser-image-compression`, `pica` | Native is zero-dep and fast; libraries add 20–50kB for marginal quality gains. |
| Virtualization | `@tanstack/react-virtual` | `react-window`, `react-virtuoso` | TanStack Virtual is headless — critical for retro look. |
| Date | `date-fns` | `dayjs`, `luxon` | Frontend1 uses date-fns; keep identical formatting tokens. |

## Sources

- `frontend/package.json` — proven-working deps in this project (HIGH)
- `frontend2/package.json` — current baseline (HIGH)
- `.planning/PROJECT.md` — v1.3 / v1.9 decisions confirming `@yudiel/react-qr-scanner` + `barcode-detector` reliability (HIGH)
- React Query v5 docs — React 19 compatibility (HIGH, training data)
- MDN BarcodeDetector API / OffscreenCanvas support matrix (HIGH, training data)
- `@yudiel/react-qr-scanner` npm — verified via frontend1 usage through v1.9 (HIGH)
