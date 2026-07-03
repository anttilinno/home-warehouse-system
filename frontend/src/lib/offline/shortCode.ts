// Client-generated short_code for offline creates (Phase 3 — "print offline").
// short_code is the code printed on the physical QR/barcode label, so unlike
// the internal tempId it must be FINAL at creation, never remapped. Backend
// accepts an optional client-supplied short_code (item/service.go:72,
// location/handler.go:369): minLength 4, maxLength 8, pattern ^[A-Za-z0-9]+$.
// 8-char base62 (62^8 ≈ 2×10^14) keeps a same-workspace collision negligible.
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateShortCode(): string {
  // ponytail: bytes[i] % 62 has a ~0.4% modulo bias (256 % 62 = 8) toward the
  // first 8 chars — irrelevant at this entropy for a display code that isn't a
  // security credential. Upgrade to rejection sampling only if a real
  // collision-rate defect ever surfaces.
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let code = "";
  for (let i = 0; i < bytes.length; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  return code;
}
