# Phase 07 — Deferred Items

Out-of-scope discoveries logged during execution (not fixed in the discovering plan).

## D-07-07-A: /items/new create form omits the backend-required `sku`

- **Found during:** Plan 07-07, Task 1 (live E2E lifecycle spec)
- **Discovery:** The backend `POST /workspaces/{wsId}/items` returns
  `422 "expected required property sku to be present"` when the body has no
  `sku`. The current create form (`ItemFormPage` + `useItemFormMutations`)
  collects name/category/location/quantity/barcode/description but NOT a SKU,
  and does not synthesize one — so a form-driven create 422s today.
- **Why deferred:** This is a Plan-05/06 form-contract gap, not in scope for the
  07-07 E2E + doc-correction plan. The 07-07 spec sanctions cookie-authed
  `page.request` seeding (with a valid `sku`) as the create path, so the
  lifecycle gate (ITEM-01/05) is proven without depending on the broken form.
- **Suggested owner:** A follow-up touching `ItemFormPage`/`schema.ts`/
  `useItemFormMutations` — either add a SKU field (with optional auto-generate,
  cf. the Quick Capture `QC-{timestamp}-{random}` SKU convention in ROADMAP) or
  send a generated SKU on create. Confirm against `item/handler.go` createInput.
- **Evidence:** live probe `POST .../items {name}` → 422; `{name, sku}` → 200.
