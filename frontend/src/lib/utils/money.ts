// Phase 10b Plan 01 — cents → currency display helper. The backend stores and
// returns all monetary amounts as integer CENTS (T-10b-01); this is the single
// shared boundary that converts them to a human-readable major-unit string.
//
// DISPLAY-ONLY: the value produced here NEVER flows back to the API. Form input
// is transformed the other way (major-unit string → Math.round(value * 100)) in
// the feature schemas — floats are never sent to the server.
//
// Default currency is "EUR" (A2). Intl.NumberFormat with style:"currency" emits
// the locale-appropriate symbol/grouping; passing `undefined` as the first arg
// lets the runtime pick the user's locale.
export function formatCents(
  cents: number,
  currency?: string | null,
): string {
  // The repair-cost rollup can return a null/empty currency_code (e.g. a
  // zero-cost repair); a default-param only guards `undefined`, so a literal
  // `null` would reach Intl.NumberFormat and throw RangeError. Coalesce here.
  const code = currency || "EUR";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: code,
  }).format(cents / 100);
}
