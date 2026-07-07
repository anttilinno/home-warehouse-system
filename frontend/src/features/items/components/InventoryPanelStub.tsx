import { Trans } from "@lingui/react/macro";
import { PixelIcon } from "@/components/retro";

// Phase 7 Plan 06 — the INVENTORY side-rail slot (UI-SPEC §2 Inventory STUB).
//
// This is a REAL named region in the detail layout — NOT a hidden/absent element.
// 7b swaps its body contents in without relayout. A recessed bg-bg-panel-2 panel
// with a 10px eyebrow, a ◇ glyph, and the exact stub copy. No CTA.

export function InventoryPanelStub() {
  return (
    <section
      aria-label="Inventory"
      className="flex flex-col items-center gap-sp-2 border-2 border-border-ink bg-bg-panel-2 bevel-sunken px-sp-4 py-sp-5 text-center"
    >
      <p className="text-10 font-bold uppercase tracking-14 text-fg-muted">
        <Trans>INVENTORY</Trans>
      </p>
      <span aria-hidden="true" className="text-32 leading-none text-fg-faint">
        <PixelIcon name="grid-3x3" size={28} />
      </span>
      <p className="text-14 text-fg-muted">
        <Trans>Stock entries arrive in 7b.</Trans>
      </p>
    </section>
  );
}
