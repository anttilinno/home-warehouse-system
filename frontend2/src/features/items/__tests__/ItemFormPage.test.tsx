// Phase 65 Wave 0 scaffold (Plan 65-01 Task 3). ItemFormPage lands in
// Plan 65-05. Scaffold enumerates every acceptance criterion from
// 65-CONTEXT D-01..D-05 + D-13..D-16 integration as it.todo. Plan 65-05
// turns these into real user-event flows inside MemoryRouter +
// QueryClientProvider.
import { describe, it } from "vitest";

describe("ItemFormPage route + URL-state (D-01, D-02)", () => {
  it.todo("D-01: <Route path=\"items/new\" element={<ItemFormPage />}> is reachable from AppRoutes");
  it.todo("D-02: reads ?barcode= via useSearchParams and passes to ItemForm defaultValues.barcode");
  it.todo("D-02: generateSku() fires exactly once per mount (not per render)");
  it.todo("D-02: renders normally with no ?barcode= param (form usable as plain create page)");
});

describe("ItemFormPage chrome (D-03)", () => {
  it.todo("D-03: heading renders t`NEW ITEM` at h1 level");
  it.todo("D-03: submit button reads t`CREATE ITEM` when idle, t`WORKING…` when mutation isPending");
  it.todo("D-03: CANCEL button on CLEAN form calls navigate(-1)");
  it.todo("D-03: CANCEL button on DIRTY form opens RetroConfirmDialog with t`DISCARD CHANGES?` title");
  it.todo("D-03: DISCARD destructive button inside dialog calls navigate(-1)");
  it.todo("D-03: ← BACK button inside dialog closes dialog without nav");
});

describe("ItemFormPage create flow (D-04, D-05)", () => {
  it.todo("D-04: successful create invalidates scanKeys.lookup(barcode) AND itemKeys.all");
  it.todo("D-04: successful create navigates to /items/{created.id}");
  it.todo("D-05: uses useCreateItem from ../hooks/useItemMutations (no duplicate mutation logic)");
});

describe("ItemFormPage + UpcSuggestionBanner integration (D-13..D-16)", () => {
  it.todo("D-13: renders UpcSuggestionBanner ABOVE ItemForm when enrichment.data.found === true");
  it.todo("D-14: [USE] chip on a suggested field calls setValue(field, value, { shouldDirty: true })");
  it.todo("D-15: category shown as helper text only — no [USE] chip on category row");
  it.todo("D-16: enrichment.isError → banner does NOT render + console.error kind: upc-enrichment-fail logged");
  it.todo("D-16: enrichment.data.found === false → banner does NOT render");
});
