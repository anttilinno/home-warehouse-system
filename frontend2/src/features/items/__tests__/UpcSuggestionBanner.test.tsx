// Phase 65 Wave 0 scaffold (Plan 65-01 Task 3). UpcSuggestionBanner
// lands in Plan 65-05. Scaffold enumerates D-13..D-16 as it.todo.
import { describe, it } from "vitest";

describe("UpcSuggestionBanner render contract (D-13)", () => {
  it.todo("D-13: renders yellow HazardStripe + h2 t`SUGGESTIONS AVAILABLE`");
  it.todo("D-13: no new retro atom imported — uses RetroPanel + HazardStripe + RetroButton from @/components/retro barrel only");
});

describe("UpcSuggestionBanner per-field acceptance (D-14, D-23)", () => {
  it.todo("D-14: name row renders label t`NAME` + value + [USE] RetroButton variant=\"primary\"");
  it.todo("D-14/D-23: brand row renders label t`BRAND` + value + [USE] when brand non-empty — writes to form.brand field (NOT description)");
  it.todo("D-14: brand row does NOT render when brand is null/empty");
  it.todo("D-14: [USE] click calls useFormContext().setValue(field, value, { shouldDirty: true })");
  it.todo("D-14/D-23: USE ALL button applies every non-empty field in one click (name AND brand via first-class setValue calls)");
  it.todo("D-14: DISMISS collapses the banner locally (no cache / no form writes)");
});

describe("UpcSuggestionBanner category hint (D-15)", () => {
  it.todo("D-15: non-empty external_category renders helper text t`Category hint: ${cat} — pick manually below.` with NO [USE] chip");
  it.todo("D-15: empty external_category does not render the helper row");
  it.todo("D-15: setValue is NEVER called with (\"category_id\", ...) anywhere in the banner's render/event path");
});

describe("UpcSuggestionBanner silent failure (D-16)", () => {
  it.todo("D-16: renders null when data.found === false (caller is responsible for gating)");
});
