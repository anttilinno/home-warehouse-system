---
phase: 07b-inventory
plan: 03
type: execute
wave: 2
depends_on: ["07b-01"]
files_modified:
  - frontend2/src/features/inventory/schema.ts
  - frontend2/src/features/inventory/schema.test.ts
  - frontend2/src/features/inventory/hooks/useInventoryFormMutations.ts
  - frontend2/src/features/inventory/hooks/useInventoryFormMutations.test.tsx
  - frontend2/src/features/inventory/hooks/usePickerOptions.ts
  - frontend2/src/features/inventory/InventoryFormPage.tsx
  - frontend2/src/features/inventory/InventoryFormPage.test.tsx
  - frontend2/src/features/inventory/components/MoveDialog.tsx
  - frontend2/src/features/inventory/components/MoveDialog.test.tsx
autonomous: true
requirements: [INV-02, INV-03, INV-04]
must_haves:
  truths:
    - "The create form collects item/location/container selects + quantity/condition/status + acquired/warranty/expiry dates + notes and POSTs a valid entry"
    - "The edit form omits Status (full PATCH has no status field) and PATCHes location/quantity/condition/dates/notes"
    - "Date fields serialize YYYY-MM-DD → RFC3339 on submit; expiry-before-acquired is a client validation error"
    - "The move dialog posts {location_id, container_id?} ONLY (whole-entry, no quantity split) and invalidates both inventory and movements"
  artifacts:
    - path: "frontend2/src/features/inventory/InventoryFormPage.tsx"
      provides: "Create + edit entry form (one page, status only on create)"
      min_lines: 120
    - path: "frontend2/src/features/inventory/components/MoveDialog.tsx"
      provides: "Whole-entry relocate dialog (blue titlebar, modal stack)"
      min_lines: 60
    - path: "frontend2/src/features/inventory/schema.ts"
      provides: "zod create/edit schema incl. expiry≥acquired refinement"
      exports: ["inventoryFormSchema"]
  key_links:
    - from: "frontend2/src/features/inventory/components/MoveDialog.tsx"
      to: "inventoryApi.move"
      via: "POST /inventory/{id}/move {location_id, container_id?}"
      pattern: "\\.move\\("
    - from: "frontend2/src/features/inventory/hooks/useInventoryFormMutations.ts"
      to: 'invalidateQueries(["inventory", wsId])'
      via: "create/update onSuccess"
      pattern: "\\[\"inventory\""
---

<objective>
Build the create/edit entry form (INV-02, INV-03) and the whole-entry move dialog (INV-04). Mirrors the shipped item form (RHF + zod + RetroFormField, dirty-fields PATCH builder) but over inventory's contract: native RetroSelect pickers populated from the locations/containers/items read endpoints, three optional date fields serialized to RFC3339, status present ONLY on create.

Purpose: the entry authoring + relocation surfaces. Move is the action that creates a movement record (INV-07's data source), so its invalidation of `["movements", wsId]` is load-bearing.
Output: schema, form mutations hook, picker-options hook, InventoryFormPage, MoveDialog — all tested. (Route registration for /inventory/new|/:id/edit is Plan 04.)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/07b-inventory/07b-RESEARCH.md
@.planning/phases/07b-inventory/07b-UI-SPEC.md
@frontend2/src/features/items/ItemFormPage.tsx
@frontend2/src/features/items/schema.ts
@frontend2/src/features/items/hooks/useItemFormMutations.ts
@frontend2/src/lib/api/inventory.ts
@frontend2/src/features/inventory/inventoryEnums.ts

<interfaces>
<!-- From Plan 01. Use directly. -->
inventoryApi.create(wsId, body) → Inventory; update(wsId, id, body) → Inventory (NO status in body — Pitfall 6); move(wsId, id, location_id, container_id?) → Inventory (NO quantity — Pitfall 2).
inventoryEnums: CONDITIONS, STATUSES (ordered arrays), CONDITION_LABEL, STATUS_LABEL (Title-Case).

<!-- Picker source endpoints (07b-RESEARCH) — all paginated envelopes, fetch limit=100 once -->
GET /workspaces/{wsId}/items?limit=100 → {items:[{id,name,sku}],...}
GET /workspaces/{wsId}/locations?limit=100 → {items:[{id,name}],...}
GET /workspaces/{wsId}/containers?limit=100 → {items:[{id,name?}],...}

<!-- Atoms via @/components/retro -->
Window; BevelButton(variant); RetroFormField; RetroInput(type="number"|"date"); RetroSelect(label,error,...selectProps); RetroTextarea; RetroConfirmDialog; RetroDialog(open,onClose,title,titlebarVariant="blue",footer); retroToast.
useWorkspace() → { currentWorkspaceId }.

<!-- Item form patterns to mirror -->
- RHF defaults are "" strings (dirtyFields meaningfulness); zod transforms coerce on submit.
- buildPatchBody emits dirty fields only ("" = clear string, omitted = unchanged) — Pitfall 4.
- Dirty-form navigation opens a butter DISCARD CHANGES? RetroConfirmDialog.
- t-via-ref render-loop guard; destructure stable .mutate.
</interfaces>

Date handling (Pitfall 4): the form `<input type="date">` value is `YYYY-MM-DD`; on submit serialize a non-empty date to RFC3339 by appending `T00:00:00Z` because the backend binds `*time.Time`. Absent dates are OMITTED (never zero-injected). Create enforces quantity ≥ 1; the inline quantity route (Plan 02) is the ≥ 0 path.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Schema + form mutations + picker-options hook</name>
  <files>frontend2/src/features/inventory/schema.ts, frontend2/src/features/inventory/schema.test.ts, frontend2/src/features/inventory/hooks/useInventoryFormMutations.ts, frontend2/src/features/inventory/hooks/useInventoryFormMutations.test.tsx, frontend2/src/features/inventory/hooks/usePickerOptions.ts</files>
  <behavior>
    - inventoryFormSchema requires item_id, location_id, condition; quantity ≥ 1; status required (validated, but the edit body-builder drops it); container_id/dates/notes optional.
    - A cross-field refinement rejects expiry_date earlier than date_acquired with "Expiry can't be before the acquired date.".
    - buildCreateBody includes status + serializes set dates to RFC3339; omits empty optional fields (no zero-injection).
    - buildPatchBody emits dirty fields only, NEVER includes status (Pitfall 6), serializes dirty dates to RFC3339, and bundles location_id+quantity+condition as the full-PATCH requires.
    - create onSuccess invalidates ["inventory", wsId]; update invalidates the same prefix.
  </behavior>
  <action>Create `schema.ts` mirroring item `schema.ts`: zod object with `item_id`/`location_id` (required, min 1), `container_id` (optional ""), `quantity` (coerced number, min 1), `condition` (enum from CONDITIONS), `status` (enum from STATUSES — required), `date_acquired`/`warranty_expires`/`expiration_date` (optional date strings ""), `notes` (optional ""). Add `.refine` for expiry≥acquired. Export `inventoryFormSchema`, `InventoryFormValues` (z.infer), `InventoryFormInput` (z.input). Create `useInventoryFormMutations.ts` mirroring `useItemFormMutations.ts`: a `buildCreateBody` (includes status; `toRfc3339(d)` helper appends `T00:00:00Z` to non-empty dates; omits empty optionals), a `buildPatchBody(values, dirty)` that emits dirty fields only and NEVER `status`, always sends location_id+quantity+condition when any of the PATCH-owned fields is dirty (the backend full PATCH requires the bundle — Pitfall 6/Research Pattern 2), serializes dirty dates. `create`/`update` mutations invalidate `["inventory", wsId]` prefix + toast. Create `usePickerOptions.ts`: three `useQuery`s (items/locations/containers keyed `["items"|"locations"|"containers", wsId, {limit:100}]`) returning `{id,label}[]` option arrays (label = name; items append sku). Write `schema.test.ts` (required fields, expiry<acquired error, quantity<1 error) and `useInventoryFormMutations.test.tsx` (create body has status + RFC3339 dates; patch body omits status; both invalidate).</action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/inventory/schema.test.ts src/features/inventory/hooks/useInventoryFormMutations.test.tsx && bunx tsc -b --noEmit</automated>
  </verify>
  <done>Schema enforces required + quantity≥1 + expiry≥acquired; create body carries status & RFC3339 dates; patch body never carries status; both invalidate the inventory prefix.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: InventoryFormPage (create + edit)</name>
  <files>frontend2/src/features/inventory/InventoryFormPage.tsx, frontend2/src/features/inventory/InventoryFormPage.test.tsx</files>
  <behavior>
    - At /inventory/new the form shows Item/Location/Container selects (populated from usePickerOptions), Quantity, Condition, Status, three date inputs, Notes; submit POSTs and navigates to /items/{item_id} on success.
    - ?item={id} prefills (and may lock) the Item select.
    - At /inventory/{id}/edit the form loads the entry, prefills, and OMITS the Status field (edit mode); submit PATCHes.
    - A picker whose source list is empty disables that select with the "No locations yet — add one first." hint.
    - Submitting with a missing required field shows the sketch-007 in-window RetroFormField error treatment.
    - A dirty form prompts the butter DISCARD CHANGES? confirm before navigating away.
  </behavior>
  <action>Create `InventoryFormPage.tsx` mirroring `ItemFormPage.tsx`: blue Window (`ADD ENTRY`/`EDIT ENTRY`), `max-w-[560px] mx-auto`, RHF + zodResolver(inventoryFormSchema). Read `useParams().id` to switch create/edit; in edit mode `useQuery` the entry via inventoryApi (add a `get` method usage — or fetch via inventoryApi.byItem is wrong; use a direct `inventoryApi` get; if Plan 01 did not expose a single-entry get, fetch through `get<Inventory>` — but prefer adding nothing: edit can load via the list cache or a dedicated query keyed `["inventory", wsId, "detail", id]` calling a `get`; if inventoryApi lacks `get`, this plan MAY add an `inventoryApi.get` ONLY in lib/api/inventory.ts — NOTE: that file is owned by Plan 01's wave; to stay disjoint, instead fetch the entry via a local `useQuery` calling `get<Inventory>` from `@/lib/api` directly in this page). Render fields per UI-SPEC §2 grouping; Status RetroSelect rendered ONLY when create (R10). `?item=` from useSearchParams prefills item_id. Disable+hint empty pickers. Dirty-guard via react-router useBlocker → butter RetroConfirmDialog (DISCARD CHANGES? copy). On success: invalidate (handled by hook) + navigate to `/items/${item_id}`. Use t-via-ref + stable .mutate. Write `InventoryFormPage.test.tsx` with MSW + QueryClient + MemoryRouter at /inventory/new: assert selects populate, a valid submit calls create, edit-mode hides Status, empty-required submit shows an error.</action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/inventory/InventoryFormPage.test.tsx && bunx tsc -b --noEmit && bun run lint:imports</automated>
  </verify>
  <done>Create form posts a valid entry incl. status + dates; edit omits Status; empty pickers disabled with hint; required-field error shows; dirty-guard works.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: MoveDialog (whole-entry relocate)</name>
  <files>frontend2/src/features/inventory/components/MoveDialog.tsx, frontend2/src/features/inventory/components/MoveDialog.test.tsx</files>
  <behavior>
    - The dialog (blue titlebar `MOVE ENTRY`) shows a context line "{item} — currently in {path}.", a required To-location RetroSelect, and an optional To-container RetroSelect.
    - The MOVE button is disabled until a target distinct from the current location/container is chosen (no-op move blocked with the hint).
    - Submit calls inventoryApi.move(wsId, id, location_id, container_id?) — the request body has NO quantity key.
    - On success the dialog invalidates BOTH ["inventory", wsId] AND ["movements", wsId] (manual — movements emit no SSE) and toasts "Moved to {location}."; on error reverts + retroToast.error.
    - ESC closes via the modal stack (RetroDialog default).
  </behavior>
  <action>Create `MoveDialog.tsx`: props `{ open; onClose; entry: Inventory; locationOptions; containerOptions }` (options reused from usePickerOptions — caller passes them, OR the dialog calls usePickerOptions itself). Render via `RetroDialog` (titlebarVariant default blue). Context line from joined labels. Two RetroSelects; local target state; disable MOVE when target equals the entry's current (location_id && container_id) — show the "Pick a different location or container." hint. A `useMutation` calling `inventoryApi.move`; onSuccess: `queryClient.invalidateQueries({queryKey:["inventory", wsId]})` AND `{queryKey:["movements", wsId]}` (both prefix), close, `retroToast.success`; onError: `retroToast.error`. Write `MoveDialog.test.tsx` (MSW + QueryClient): assert MOVE disabled on no-op, assert the move call fires with `{location_id}` and no quantity, assert both query keys invalidated (spy on invalidateQueries).</action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/inventory/components/MoveDialog.test.tsx && bunx tsc -b --noEmit</automated>
  </verify>
  <done>Move dialog posts location-only (no quantity), blocks no-op moves, invalidates inventory + movements, toasts on success/error.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → /api → backend | create/move/edit writes cross here; cross-tenant item/location/container validation is server-authoritative |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07b-06 | Tampering | move target location_id | mitigate | Backend validates target location/container belong to the workspace (cross-tenant move → 404). Client only submits ids from the workspace-scoped picker lists; a forged id is rejected server-side. |
| T-07b-07 | Input validation | form date + quantity | mitigate | zod validates quantity ≥ 1 + expiry≥acquired client-side; dates serialized to RFC3339; backend re-validates enums + UUIDs + quantity. No zero-injection of absent optional fields (Pitfall 4/7). |
| T-07b-08 | Repudiation | move with no quantity field | accept | move body is location-only by design (whole-entry); the movement record logs the full quantity. moved_by is null server-side (no user attribution wired) — accepted, documented in 07b-RESEARCH. |
</threat_model>

<verification>
- `bun run test src/features/inventory/` (this plan's files) green.
- `bunx tsc -b --noEmit` + `bun run lint:imports` clean.
- Grep gate: `grep -v '^//' frontend2/src/features/inventory/components/MoveDialog.tsx | grep -c quantity` — confirm no `quantity` appears in the move request body construction (manual-read the matches; the gate flags accidental quantity split).
</verification>

<success_criteria>
The create form authors a full valid entry (status + RFC3339 dates), the edit form correctly omits Status, and the move dialog relocates a whole entry (location-only) while invalidating both the inventory and movements caches. (Routes wired in Plan 04.)
</success_criteria>

<output>
Create `.planning/phases/07b-inventory/07b-03-SUMMARY.md` when done
</output>
