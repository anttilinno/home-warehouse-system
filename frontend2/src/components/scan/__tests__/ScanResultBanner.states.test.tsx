// Phase 65 Wave 0 scaffold (Plan 65-01 Task 3). ScanResultBanner is
// widened in Plan 65-06 to four states (LOADING / MATCH / NOT-FOUND /
// ERROR per D-17..D-21). This file is a SIBLING to
// ScanResultBanner.test.tsx — the existing file's 7 tests stay green
// under the Phase 64 MATCH-only shape until Plan 65-06 migrates them.
// Plan 65-06 converts these it.todo into real assertions using the
// renderWithQueryClient helper from @/test-utils-query.
import { describe, it } from "vitest";

describe("ScanResultBanner LOADING state (D-20)", () => {
  it.todo("D-20: lookupStatus=\"loading\" renders h2 t`LOOKING UP…`");
  it.todo("D-20: LOADING renders dimmed code echo (text-retro-charcoal/60)");
  it.todo("D-20: LOADING renders SCAN AGAIN button AS INTERACTIVE (not disabled)");
  it.todo("D-20: LOADING renders a blinking cursor glyph ▍ with class that maps to @keyframes retro-cursor-blink");
  it.todo("D-20: LOADING does NOT render a hazard stripe");
});

describe("ScanResultBanner MATCH state (D-18)", () => {
  it.todo("D-18: lookupStatus=\"success\" + match!=null renders h2 t`MATCHED`");
  it.todo("D-18: MATCH renders t`NAME` label + match.name value (24px mono bold)");
  it.todo("D-18: MATCH renders t`CODE` label + match.short_code value (mono)");
  it.todo("D-18: MATCH VIEW ITEM button onClick calls onViewItem(match.id)");
  it.todo("D-18: MATCH also renders SCAN AGAIN");
});

describe("ScanResultBanner NOT-FOUND state (D-19)", () => {
  it.todo("D-19: lookupStatus=\"success\" + match===null renders yellow HazardStripe");
  it.todo("D-19: NOT-FOUND renders h2 t`NOT FOUND`");
  it.todo("D-19: NOT-FOUND renders helper line t`No item in this workspace matches this barcode.`");
  it.todo("D-19: NOT-FOUND CREATE ITEM WITH THIS BARCODE button onClick calls onCreateWithBarcode(code)");
  it.todo("D-19: NOT-FOUND also renders SCAN AGAIN");
});

describe("ScanResultBanner ERROR state (D-21)", () => {
  it.todo("D-21: lookupStatus=\"error\" renders red HazardStripe");
  it.todo("D-21: ERROR renders h2 t`LOOKUP FAILED`");
  it.todo("D-21: ERROR RETRY button onClick calls onRetry");
  it.todo("D-21: ERROR also renders CREATE ITEM WITH THIS BARCODE fallback");
  it.todo("D-21: ERROR also renders SCAN AGAIN");
});
