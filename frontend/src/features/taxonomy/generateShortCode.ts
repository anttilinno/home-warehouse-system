// Client-side short-code generator for the location/container CREATE forms, so
// the field is pre-filled with a ready-to-label code instead of left blank (the
// backend would otherwise auto-assign one the user never sees). 4 random bytes →
// 8 lowercase hex chars, matching the existing server-generated format and the
// schema's `^[A-Za-z0-9]{4,8}$` rule. The field stays editable; uniqueness is
// enforced server-side on submit (a collision at 8 hex is astronomically rare).
export function generateShortCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
