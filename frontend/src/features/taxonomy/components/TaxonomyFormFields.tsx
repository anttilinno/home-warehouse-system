import type { UseFormRegisterReturn } from "react-hook-form";
import { Trans } from "@lingui/react/macro";
import { RetroInput, RetroTextarea } from "@/components/retro";

// Shared field blocks for the taxonomy CRUD forms (TAX refactor). The Name,
// Description, and Short code fields were byte-identical across the Category /
// Location / Container / Label dialogs (RetroInput/RetroTextarea + the same
// hint copy). Each takes the spread RHF register result plus the resolved error
// string so the owning form keeps full control of its schema. Markup is verbatim.

// NameField — the required name input shared by every taxonomy form.
export function NameField({
  register,
  error,
}: Readonly<{ register: UseFormRegisterReturn; error?: string }>) {
  return (
    <RetroInput
      label={<Trans>Name</Trans>}
      required
      aria-required="true"
      error={error}
      {...register}
    />
  );
}

// DescriptionField — the optional description textarea with its "Optional." hint.
export function DescriptionField({
  register,
  error,
}: Readonly<{ register: UseFormRegisterReturn; error?: string }>) {
  return (
    <div className="flex flex-col gap-sp-2">
      <RetroTextarea
        label={<Trans>Description</Trans>}
        error={error}
        {...register}
      />
      <p className="text-12 text-fg-muted">
        <Trans>Optional.</Trans>
      </p>
    </div>
  );
}

// ShortCodeField — the optional short-code input with its auto-generate hint.
export function ShortCodeField({
  register,
  error,
}: Readonly<{ register: UseFormRegisterReturn; error?: string }>) {
  return (
    <div className="flex flex-col gap-sp-2">
      <RetroInput
        label={<Trans>Short code</Trans>}
        error={error}
        {...register}
      />
      <p className="text-12 text-fg-muted">
        <Trans>Optional — auto-generated if left blank.</Trans>
      </p>
    </div>
  );
}
