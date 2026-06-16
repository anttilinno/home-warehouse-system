import { useState, type FormEvent } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BevelButton, RetroInput } from "@/components/retro";

// SCAN-05 — manual code entry. Funnels a trimmed non-empty code into the SHARED
// scan-result state machine (same contract as a live decode / history re-fire).
export interface ManualBarcodeEntryProps {
  /** Shared funnel: source tag distinguishes manual entry (CONTEXT OQ7). */
  onSubmit: (code: string, source: "manual") => void;
}

export function ManualBarcodeEntry({ onSubmit }: Readonly<ManualBarcodeEntryProps>) {
  const { t } = useLingui();
  const [value, setValue] = useState("");
  const trimmed = value.trim();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed) return; // no-op on blank
    onSubmit(trimmed, "manual");
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-sp-3">
      <RetroInput
        mono
        label={t`ENTER CODE`}
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex justify-end">
        <BevelButton
          type="submit"
          variant="primary"
          disabled={!trimmed}
          aria-disabled={!trimmed || undefined}
        >
          ◎ <Trans>LOOK UP CODE</Trans>
        </BevelButton>
      </div>
    </form>
  );
}
