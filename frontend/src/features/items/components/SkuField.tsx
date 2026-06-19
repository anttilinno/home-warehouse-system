import type { UseFormRegisterReturn } from "react-hook-form";
import { Trans } from "@lingui/react/macro";
import { RetroFormField } from "@/components/retro";

// Phase 7 refactor — the item form's SKU field. Extracted from ItemFormPage to
// lift its create-vs-edit branching out of the page render: SKU is required and
// editable on create, immutable (disabled + read-only, with a hint) on edit, and
// the backend PATCH input carries no `sku` — so the edit value is display-only.
// Behavior is identical to the inlined RetroFormField + custom input.
export function SkuField({
  isEdit,
  error,
  register,
}: Readonly<{
  isEdit: boolean;
  error?: string;
  register: UseFormRegisterReturn;
}>) {
  return (
    <RetroFormField
      label={<Trans>SKU</Trans>}
      required={!isEdit}
      hint={
        isEdit ? (
          <Trans>SKU can't be changed after an item is created.</Trans>
        ) : undefined
      }
      error={error}
    >
      {(fieldId, describedBy) => (
        <input
          id={fieldId}
          type="text"
          required={!isEdit}
          aria-required={isEdit ? undefined : "true"}
          disabled={isEdit}
          readOnly={isEdit}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full border-2 px-[10px] py-[7px] font-mono text-14 text-fg-ink bevel-sunken focus:outline-3 focus:outline-offset-1 focus:outline-titlebar-blue disabled:cursor-not-allowed disabled:text-fg-muted ${
            error
              ? "border-danger bg-danger-bg"
              : "border-border-ink bg-bg-panel"
          }`}
          {...register}
        />
      )}
    </RetroFormField>
  );
}
