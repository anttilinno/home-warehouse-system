import { type Control, Controller, type FieldErrors } from "react-hook-form";
import { Trans, useLingui } from "@lingui/react/macro";
import { RetroSelect } from "@/components/retro";
import type { InventoryFormInput } from "../schema";
import type { usePickerOptions } from "../hooks/usePickerOptions";

type Pickers = ReturnType<typeof usePickerOptions>;

// Phase 7b refactor — the inventory form's "What & where" group: the Item /
// Location / Container native selects plus the empty-source disabled hints.
// Extracted from InventoryFormPage to lift the empty/locked picker computations
// and the per-select error reads out of the page body. The item select locks to
// a ?item= deep link on create; empty sources disable with an add-one-first hint.
export function InventoryWhereFields({
  control,
  errors,
  pickers,
  isEdit,
  prefillItem,
}: Readonly<{
  control: Control<InventoryFormInput>;
  errors: FieldErrors<InventoryFormInput>;
  pickers: Pickers;
  isEdit: boolean;
  prefillItem: string;
}>) {
  const { t } = useLingui();
  const itemsEmpty = !pickers.isLoading && pickers.items.length === 0;
  const locationsEmpty = !pickers.isLoading && pickers.locations.length === 0;
  const itemLocked = !isEdit && prefillItem.length > 0;

  return (
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
  );
}
