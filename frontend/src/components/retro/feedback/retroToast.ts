import { toast } from "sonner";
import type { ExternalToast } from "sonner";

type ToastFn = typeof toast;
type ToastMessage = Parameters<ToastFn["error"]>[0];

/**
 * `retroToast` is sonner's `toast`, re-exported so Phase 6 consumers get the
 * full ergonomics surface — `retroToast.promise(...)` (required by Phase 6
 * SC4), `.success` / `.info` / `.warning`, `.loading`, `.custom`, `.dismiss`,
 * `.message`, and the callable `retroToast(...)` itself.
 *
 * One deliberate override: `.error` defaults to `duration: Infinity` so danger
 * toasts NEVER auto-dismiss (a failure must not silently vanish — UI-SPEC +
 * test-enforced). This is enforced at the call surface because sonner reads
 * duration per-toast and the Toaster cannot set a per-type duration. A caller
 * may still pass an explicit `duration` to opt out.
 *
 * The VISUAL skin lives entirely in `RetroToaster` (RetroToast.tsx) via sonner's
 * `unstyled` + `classNames` API. The engine (sonner@2.0.7 — FINAL, registry-
 * verified + exact-pinned in Plan 04-01) is invisible to callers; the UI-SPEC
 * "sonner declined" note is superseded on the ENGINE only, while the UI-SPEC
 * toast VISUAL contract remains binding and is realised by the skin.
 *
 * Implemented as a forwarding function (not by mutating sonner's shared
 * singleton) so importing this module has no global side effect.
 */
const retroToastFn = ((message: ToastMessage, data?: ExternalToast) =>
  toast(message, data)) as ToastFn;

// Copy every method/prop off sonner's `toast` so promise / success / dismiss /
// loading / custom / message / getToasts all keep working.
Object.assign(retroToastFn, toast);

// Danger override: error toasts persist unless the caller opts out via `duration`.
retroToastFn.error = (message: ToastMessage, data?: ExternalToast) =>
  toast.error(message, { duration: Number.POSITIVE_INFINITY, ...data });

export const retroToast = retroToastFn;
