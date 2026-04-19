// Phase 65 LOOK-03 — feature-local enrichment banner on /items/new.
//
// Renders iff `data.found === true`. Each suggested field (name, brand)
// gets its own row with a [USE] chip that writes to the form via
// useFormContext().setValue(field, value, { shouldDirty: true }) — the
// caller MUST wrap the tree in FormProvider (ItemForm does this by
// default after Plan 65-05 Task 1).
//
// D-13: yellow HazardStripe + h2 "SUGGESTIONS AVAILABLE"
// D-14: per-field [USE] + USE ALL + DISMISS
// D-15: category shown as helper text only — NEVER writes category_id
// D-16: found:false caller is responsible; this component renders null
//       defensively when data.found === false
// D-23: BRAND [USE] writes to form.brand (first-class field — NOT a
//       description concatenation workaround). ItemCreateValues gained
//       an optional `brand: z.string().max(120)` field in Plan 65-02.
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useLingui } from "@lingui/react/macro";
import { RetroPanel, RetroButton, HazardStripe } from "@/components/retro";
import type { BarcodeProduct } from "@/lib/api/barcode";
import type { ItemCreateValues } from "./forms/schemas";

export interface UpcSuggestionBannerProps {
  data: BarcodeProduct;
}

export function UpcSuggestionBanner({ data }: UpcSuggestionBannerProps) {
  const { t } = useLingui();
  const { setValue } = useFormContext<ItemCreateValues>();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (!data.found) return null;

  const hasName = !!data.name;
  const hasBrand = !!data.brand;
  const hasCategory = !!data.category;

  const applyName = () => {
    if (data.name) {
      setValue("name", data.name, { shouldDirty: true });
    }
  };

  // D-23: write directly to form.brand (first-class field after Plan 65-02).
  // NO description prefix workaround.
  const applyBrand = () => {
    if (data.brand) {
      setValue("brand", data.brand, { shouldDirty: true });
    }
  };

  const applyAll = () => {
    if (hasName) applyName();
    if (hasBrand) applyBrand();
    // D-15: NEVER apply category
  };

  const handleDismiss = () => setDismissed(true);

  return (
    <RetroPanel>
      <HazardStripe variant="yellow" className="mb-md" />
      <h2 className="text-[20px] font-bold uppercase text-retro-ink mb-sm">
        {t`SUGGESTIONS AVAILABLE`}
      </h2>
      <div className="flex flex-col gap-sm">
        {hasName && (
          <div className="flex items-center gap-md flex-wrap">
            <span className="font-mono font-bold uppercase text-[14px] text-retro-charcoal min-w-[72px]">
              {t`NAME`}
            </span>
            <span className="font-mono font-bold text-[14px] text-retro-ink break-all flex-1">
              {data.name}
            </span>
            <RetroButton variant="primary" onClick={applyName}>
              {t`[USE]`}
            </RetroButton>
          </div>
        )}
        {hasBrand && (
          <div className="flex items-center gap-md flex-wrap">
            <span className="font-mono font-bold uppercase text-[14px] text-retro-charcoal min-w-[72px]">
              {t`BRAND`}
            </span>
            <span className="font-mono font-bold text-[14px] text-retro-ink break-all flex-1">
              {data.brand}
            </span>
            <RetroButton variant="primary" onClick={applyBrand}>
              {t`[USE]`}
            </RetroButton>
          </div>
        )}
        {hasCategory && (
          <p className="font-sans text-[14px] text-retro-ink">
            {t`Category hint: ${data.category} — pick manually below.`}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-md justify-end mt-md">
        <RetroButton variant="neutral" onClick={handleDismiss}>
          {t`DISMISS`}
        </RetroButton>
        <RetroButton variant="primary" onClick={applyAll}>
          {t`USE ALL`}
        </RetroButton>
      </div>
    </RetroPanel>
  );
}
