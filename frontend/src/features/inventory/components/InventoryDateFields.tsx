import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Trans } from "@lingui/react/macro";
import { RetroInput } from "@/components/retro";
import type { InventoryFormInput } from "../schema";

// Phase 7b refactor — the inventory form's optional "Dates" group (Acquired /
// Warranty expires / Expiry date). Extracted from InventoryFormPage to lift the
// three date inputs and their error reads out of the page body. Each serializes
// YYYY-MM-DD → RFC3339 in the mutations hook; absent dates are omitted.
export function InventoryDateFields({
  register,
  errors,
}: Readonly<{
  register: UseFormRegister<InventoryFormInput>;
  errors: FieldErrors<InventoryFormInput>;
}>) {
  return (
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
  );
}
