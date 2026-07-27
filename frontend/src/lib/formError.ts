import { HttpError } from "@/lib/api";

// Form submit catch blocks used to collapse every failure into one generic
// "Couldn't save this X." — which hid the actionable 4xx reasons the backend
// already sends (e.g. "short code already exists" on a duplicate QR label).
//
// 4xx detail is written for the user, so it is shown verbatim. 5xx bodies and
// network/parse failures are not, so those keep the generic fallback. 401 never
// reaches here (api.ts refreshes / redirects).
export function formErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpError && err.status >= 400 && err.status < 500) {
    return err.message || fallback;
  }
  return fallback;
}
