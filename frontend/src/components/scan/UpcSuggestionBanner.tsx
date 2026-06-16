import { useQuery } from "@tanstack/react-query";
import { Trans } from "@lingui/react/macro";
import { BevelButton, RetroBadge } from "@/components/retro";
import { barcodeApi } from "@/lib/api/barcode";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// SCAN-10 — product-prefill suggestion banner. Lives on the item-CREATE form
// (11-06 mounts it in ItemFormPage), NOT on /scan. Gates on /^\d{8,14}$/ BEFORE
// the lookup; renders NOTHING for non-numeric codes or a found:false product
// (never a dead banner). USE = name only; USE ALL = name + brand.
const UPC_RE = /^\d{8,14}$/;

export interface UpcSuggestion {
  name: string;
  brand?: string;
}

export interface UpcSuggestionBannerProps {
  /** The prefilled barcode from ?barcode= (user-controlled). */
  code: string;
  /** Prefill the form. USE → {name}; USE ALL → {name, brand}. */
  onUse: (suggestion: UpcSuggestion) => void;
  /** Hide the banner (no fetch retry). */
  onDismiss: () => void;
}

export function UpcSuggestionBanner({
  code,
  onUse,
  onDismiss,
}: Readonly<UpcSuggestionBannerProps>) {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const isUpc = UPC_RE.test(code);

  const query = useQuery({
    queryKey: ["barcode", wsId as string, code],
    queryFn: () => barcodeApi.lookup(code),
    enabled: isUpc, // gate BEFORE the fetch — non-UPC never hits the network.
  });

  // Suppress for non-numeric/short codes or an unknown product (found:false).
  if (!isUpc) return null;
  const product = query.data;
  if (!product?.found) return null;

  return (
    <section className="flex flex-col gap-sp-2 border-2 border-border-ink bg-info-bg p-sp-3">
      <div className="flex items-center gap-sp-2">
        <RetroBadge variant="info">
          <Trans>PRODUCT FOUND</Trans>
        </RetroBadge>
        {/* No `source` field on ProductResponse — the source chip from the
            UI-SPEC is omitted rather than fabricated (deviation, see SUMMARY). */}
      </div>

      <p className="font-body text-14 text-fg-ink">
        {product.name}
        {product.brand ? ` — ${product.brand}` : ""}
      </p>

      <div className="flex flex-wrap justify-end gap-sp-2">
        <BevelButton
          variant="neutral"
          onClick={() => onUse({ name: product.name })}
        >
          <Trans>USE NAME</Trans>
        </BevelButton>
        <BevelButton
          variant="primary"
          onClick={() => onUse({ name: product.name, brand: product.brand })}
        >
          <Trans>USE ALL</Trans>
        </BevelButton>
        <BevelButton variant="neutral" onClick={onDismiss}>
          <Trans>DISMISS</Trans>
        </BevelButton>
      </div>
    </section>
  );
}
