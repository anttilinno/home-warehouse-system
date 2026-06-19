import type { UseFormRegisterReturn } from "react-hook-form";
import { Trans } from "@lingui/react/macro";
import { RetroBadge, RetroFormField } from "@/components/retro";
import { UpcSuggestionBanner, type UpcSuggestion } from "@/components/scan";

// Phase 7 refactor — the item form's Barcode field + its SCAN-10 UPC suggestion
// banner. Extracted from ItemFormPage to lift the scan-prefill branching out of
// the page render: the FROM SCAN badge + hint show only on a prefilled create,
// and the self-fetching UPC banner mounts until dismissed. Behavior is identical
// to the inlined RetroFormField + custom input + banner.
export function BarcodeField({
  showFromScan,
  error,
  register,
  code,
  upcDismissed,
  onUse,
  onDismiss,
}: Readonly<{
  showFromScan: boolean;
  error?: string;
  register: UseFormRegisterReturn;
  code: string;
  upcDismissed: boolean;
  onUse: (suggestion: UpcSuggestion) => void;
  onDismiss: () => void;
}>) {
  return (
    <>
      {/* Barcode uses RetroFormField so the FROM SCAN badge can sit in the
          label row (right-aligned) per UI-SPEC §3. */}
      <RetroFormField
        label={
          <span className="flex items-center justify-between gap-sp-2">
            <Trans>Barcode</Trans>
            {showFromScan && (
              <RetroBadge variant="info">
                <Trans>FROM SCAN</Trans>
              </RetroBadge>
            )}
          </span>
        }
        hint={
          showFromScan ? (
            <Trans>Prefilled from scan — edit if needed.</Trans>
          ) : undefined
        }
        error={error}
      >
        {(fieldId, describedBy) => (
          <input
            id={fieldId}
            type="text"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`w-full border-2 px-[10px] py-[7px] font-mono text-14 text-fg-ink bevel-sunken focus:outline-3 focus:outline-offset-1 focus:outline-titlebar-blue ${
              error
                ? "border-danger bg-danger-bg"
                : "border-border-ink bg-bg-panel"
            }`}
            {...register}
          />
        )}
      </RetroFormField>
      {showFromScan && !upcDismissed && (
        <UpcSuggestionBanner code={code} onUse={onUse} onDismiss={onDismiss} />
      )}
    </>
  );
}
