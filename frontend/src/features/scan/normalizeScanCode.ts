// Printed QR labels encode the shortlink URL `s.go/<short_code>` (optionally
// with an https:// scheme and/or a trailing slash). The in-app camera decodes
// that WHOLE URL, so strip the shortlink host down to the bare 4-12 char code
// before it drives the by-code lookup and the create-with-code (item barcode /
// container short_code) flow — otherwise `s.go/ABCD` never matches and trips
// the short_code rule. Anything that is NOT an s.go shortlink (product EAN/UPC
// barcodes, other QR payloads, or an already-bare code typed by hand) passes
// through untouched.
//
// The /r/{code} + /claim/{code} server paths already receive the bare code
// (Angie rewrites s.go/{code} → /r/{code}), so this normalization is only for
// the camera/manual capture path.
const SHORTLINK_URL =
  /^(?:https?:\/\/)?(?:www\.)?s\.go\/([A-Za-z0-9]{4,12})\/?$/i;

export function normalizeScanCode(raw: string): string {
  const trimmed = raw.trim();
  const match = SHORTLINK_URL.exec(trimmed);
  return match ? match[1] : trimmed;
}
