import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import {
  Window,
  BevelButton,
  RetroInput,
  RetroSelect,
  RetroTextarea,
  RetroConfirmDialog,
} from "@/components/retro";
import { get } from "@/lib/api";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { Inventory } from "@/lib/types";
import {
  CONDITIONS,
  CONDITION_LABEL,
  STATUSES,
  STATUS_LABEL,
} from "./inventoryEnums";
import {
  inventoryFormSchema,
  type InventoryFormInput,
  type InventoryFormValues,
} from "./schema";
import {
  useInventoryFormMutations,
  type DirtyMap,
} from "./hooks/useInventoryFormMutations";
import { usePickerOptions } from "./hooks/usePickerOptions";

// Phase 7b Plan 03 — create/edit inventory entry form (INV-02, INV-03).
//
// One blue Window (ADD ENTRY / EDIT ENTRY), centered max-w-[560px], RHF + zod.
// Mirrors the Phase 7 item form (ItemFormPage). Pickers are NATIVE RetroSelects
// populated from usePickerOptions; an empty source list disables the select with
// the add-one-first hint. Status is rendered ONLY on create (the full PATCH has
// no status field — Pitfall 6 / R10). ?item= prefills (and locks) the item.
//
// Dates serialize YYYY-MM-DD → RFC3339 in the mutations hook; absent dates are
// omitted. expiry-before-acquired is a client zod refinement.
//
// Dirty-form navigation opens a butter DISCARD CHANGES? confirm (the item-form
// guard pattern; useBlocker is unavailable in declarative-router mode, so the
// guard routes through attemptLeave + a beforeunload listener). On success →
// invalidate (hook) + navigate to /items/{item_id} so the new entry is visible
// in the INV-08 panel.

// RHF defaults. Strings default to "" so dirtyFields is meaningful; quantity is
// held as the number-input string.
const EMPTY_DEFAULTS: InventoryFormInput = {
  item_id: "",
  location_id: "",
  container_id: "",
  quantity: "1",
  condition: "GOOD",
  status: "AVAILABLE",
  date_acquired: "",
  warranty_expires: "",
  expiration_date: "",
  notes: "",
};

// Slice an RFC3339 timestamp to the <input type="date"> YYYY-MM-DD value.
function toDateInput(rfc?: string): string {
  return rfc ? rfc.slice(0, 10) : "";
}

// Map a loaded entry to the form's INPUT shape (edit-mode reset).
function entryToDefaults(entry: Inventory): InventoryFormInput {
  return {
    item_id: entry.item_id,
    location_id: entry.location_id,
    container_id: entry.container_id ?? "",
    quantity: String(entry.quantity),
    condition: entry.condition,
    status: entry.status,
    date_acquired: toDateInput(entry.date_acquired),
    warranty_expires: toDateInput(entry.warranty_expires),
    expiration_date: toDateInput(entry.expiration_date),
    notes: entry.notes ?? "",
  };
}

export function InventoryFormPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { currentWorkspaceId: wsId } = useWorkspace();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);

  // ?item= prefill (create only) — locks the item select to the deep-linked id.
  const prefillItem = searchParams.get("item") ?? "";

  const pickers = usePickerOptions();

  // Edit mode: load the entry via the generic get boundary (single-entry get
  // is not on inventoryApi, and lib/api/inventory.ts is owned by Plan 01's
  // wave — so this page fetches through `get<Inventory>` directly to stay
  // disjoint). Keyed under the inventory detail prefix.
  const entryQuery = useQuery({
    queryKey: ["inventory", wsId as string, "detail", id],
    queryFn: () => get<Inventory>(`/workspaces/${wsId}/inventory/${id}`),
    enabled: isEdit && Boolean(wsId) && Boolean(id),
  });

  const { create, update } = useInventoryFormMutations();
  const createEntry = create.mutateAsync;
  const updateEntry = update.mutateAsync;

  const defaultValues = useMemo<InventoryFormInput>(
    () =>
      isEdit
        ? EMPTY_DEFAULTS
        : { ...EMPTY_DEFAULTS, item_id: prefillItem || EMPTY_DEFAULTS.item_id },
    [isEdit, prefillItem],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: {
      errors,
      dirtyFields,
      isDirty,
      isSubmitting,
      isSubmitSuccessful,
    },
  } = useForm<InventoryFormInput>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues,
  });

  // When the edit entry loads, reset the form to it (keeps dirtyFields meaningful).
  useEffect(() => {
    if (isEdit && entryQuery.data) {
      reset(entryToDefaults(entryQuery.data));
    }
  }, [isEdit, entryQuery.data, reset]);

  // Dirty-form navigation guard (item-form pattern — no useBlocker in
  // declarative-router mode). attemptLeave opens the butter confirm when dirty;
  // a beforeunload listener catches reload/tab-close.
  const [pendingLeave, setPendingLeave] = useState<string | null>(null);
  const guardActive = isDirty && !isSubmitSuccessful;

  useEffect(() => {
    if (!guardActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [guardActive]);

  function attemptLeave(to: string) {
    if (guardActive) {
      setPendingLeave(to);
    } else {
      navigate(to);
    }
  }

  async function onSubmit(raw: InventoryFormInput) {
    const values: InventoryFormValues = inventoryFormSchema.parse(raw);
    try {
      if (isEdit && id) {
        const dirty = dirtyFields as DirtyMap;
        await updateEntry({ id, values, dirty });
      } else {
        await createEntry(values);
      }
      // Navigate to the owning item detail so the new/edited entry is visible
      // in the INV-08 panel (UI-SPEC §2).
      navigate(`/items/${values.item_id}`);
    } catch {
      setError("root", { message: t`Couldn't save this entry.` });
    }
  }

  function handleCancel() {
    attemptLeave(
      isEdit && entryQuery.data
        ? `/items/${entryQuery.data.item_id}`
        : "/inventory",
    );
  }

  const titleText = isEdit ? t`EDIT ENTRY` : t`ADD ENTRY`;
  const submitLabel = isEdit ? t`Save changes` : t`Save entry`;

  // Empty-picker disabled state + hint.
  const itemsEmpty = !pickers.isLoading && pickers.items.length === 0;
  const locationsEmpty = !pickers.isLoading && pickers.locations.length === 0;
  const itemLocked = !isEdit && prefillItem.length > 0;

  return (
    <div className="mx-auto max-w-[560px]">
      <Window title={titleText} titlebarVariant="blue">
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-sp-4"
        >
          {/* Form-level error banner (submit/server failure). */}
          {errors.root?.message && (
            <div
              role="alert"
              className="border-2 border-border-ink bg-danger-bg p-sp-3 text-14 text-danger"
            >
              <span aria-hidden="true">✕ </span>
              {errors.root.message}
            </div>
          )}

          {/* Group 1 — What & where */}
          <div className="flex flex-col gap-sp-3">
            <Controller
              control={control}
              name="item_id"
              render={({ field }) => (
                <RetroSelect
                  label={<Trans>Item</Trans>}
                  required
                  aria-required="true"
                  error={errors.item_id?.message}
                  disabled={itemsEmpty || itemLocked}
                  {...field}
                >
                  <option value="">{t`— Select an item`}</option>
                  {pickers.items.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </RetroSelect>
              )}
            />
            {itemsEmpty && (
              <p className="text-12 text-fg-muted">
                <Trans>No items yet — add one first.</Trans>
              </p>
            )}

            <Controller
              control={control}
              name="location_id"
              render={({ field }) => (
                <RetroSelect
                  label={<Trans>Location</Trans>}
                  required
                  aria-required="true"
                  error={errors.location_id?.message}
                  disabled={locationsEmpty}
                  {...field}
                >
                  <option value="">{t`— Select a location`}</option>
                  {pickers.locations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </RetroSelect>
              )}
            />
            {locationsEmpty && (
              <p className="text-12 text-fg-muted">
                <Trans>No locations yet — add one first.</Trans>
              </p>
            )}

            <Controller
              control={control}
              name="container_id"
              render={({ field }) => (
                <RetroSelect
                  label={<Trans>Container</Trans>}
                  error={errors.container_id?.message}
                  {...field}
                  value={field.value ?? ""}
                >
                  <option value="">{t`— No container`}</option>
                  {pickers.containers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </RetroSelect>
              )}
            />
          </div>

          {/* Group 2 — Stock */}
          <div className="flex flex-col gap-sp-3">
            <RetroInput
              label={<Trans>Quantity</Trans>}
              type="number"
              min={1}
              mono
              required
              aria-required="true"
              error={errors.quantity?.message}
              {...register("quantity")}
            />
            <Controller
              control={control}
              name="condition"
              render={({ field }) => (
                <RetroSelect
                  label={<Trans>Condition</Trans>}
                  required
                  aria-required="true"
                  error={errors.condition?.message}
                  {...field}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {CONDITION_LABEL[c]}
                    </option>
                  ))}
                </RetroSelect>
              )}
            />
            {/* Status — CREATE ONLY (the full PATCH has no status field — R10). */}
            {!isEdit && (
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <RetroSelect
                    label={<Trans>Status</Trans>}
                    required
                    aria-required="true"
                    error={errors.status?.message}
                    {...field}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </RetroSelect>
                )}
              />
            )}
          </div>

          {/* Group 3 — Dates (optional) */}
          <div className="flex flex-col gap-sp-3">
            <RetroInput
              label={<Trans>Acquired</Trans>}
              type="date"
              mono
              error={errors.date_acquired?.message}
              {...register("date_acquired")}
            />
            <RetroInput
              label={<Trans>Warranty expires</Trans>}
              type="date"
              mono
              error={errors.warranty_expires?.message}
              {...register("warranty_expires")}
            />
            <RetroInput
              label={<Trans>Expiry date</Trans>}
              type="date"
              mono
              error={errors.expiration_date?.message}
              {...register("expiration_date")}
            />
          </div>

          {/* Group 4 — Notes */}
          <RetroTextarea
            label={<Trans>Notes</Trans>}
            error={errors.notes?.message}
            {...register("notes")}
          />

          {/* Footer — pinned action row */}
          <div className="flex justify-end gap-sp-2 border-t-2 border-border-ink pt-sp-3">
            <BevelButton type="button" variant="neutral" onClick={handleCancel}>
              <Trans>Cancel</Trans>
            </BevelButton>
            <BevelButton
              type="submit"
              variant="primary"
              disabled={isSubmitting}
            >
              {submitLabel}
            </BevelButton>
          </div>
        </form>
      </Window>

      {/* Dirty-form discard guard (butter, non-destructive decision). */}
      <RetroConfirmDialog
        open={pendingLeave !== null}
        title={<Trans>DISCARD CHANGES?</Trans>}
        titlebarVariant="butter"
        confirmVariant="neutral"
        confirmLabel={<Trans>Discard</Trans>}
        cancelLabel={<Trans>Keep editing</Trans>}
        onConfirm={() => {
          const to = pendingLeave;
          setPendingLeave(null);
          if (to) navigate(to);
        }}
        onCancel={() => setPendingLeave(null)}
        onClose={() => setPendingLeave(null)}
      >
        <Trans>Your edits will be lost.</Trans>
      </RetroConfirmDialog>
    </div>
  );
}
