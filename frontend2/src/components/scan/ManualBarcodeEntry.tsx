// frontend2/src/components/scan/ManualBarcodeEntry.tsx
//
// SCAN-05 manual entry form — fallback path when camera unavailable / denied.
//
// Validation contract (CONTEXT.md D-14 + UI-SPEC Manual tab copy):
// - Trim input; require 1..256 chars (no format gate — any code supported)
// - maxLength={256} attribute for input clamping; runtime check is defensive
//   guard for paste events that bypass maxLength in some environments
// - Submit disabled when trimmed input is empty
// - Pressing Enter in the input submits the form (keyboard-first)
// - onSubmit receives the trimmed value; input clears on successful submit
//
// Plain useState — no react-hook-form / zod (PATTERNS.md §13: "simpler than
// ItemForm"). One field + a length check — no library needed.
import { useId, useState, type FormEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { RetroInput, RetroButton } from "@/components/retro";

export interface ManualBarcodeEntryProps {
  onSubmit: (code: string) => void;
}

export function ManualBarcodeEntry({ onSubmit }: ManualBarcodeEntryProps) {
  const { t } = useLingui();
  const inputId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const isEmpty = trimmed.length === 0;
  const tooLong = trimmed.length > 256;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isEmpty) {
      setError(t`Enter a code before submitting.`);
      return;
    }
    if (tooLong) {
      setError(t`Code must be 256 characters or fewer.`);
      return;
    }
    setError(null);
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-md">
      <label
        htmlFor={inputId}
        className="font-mono font-bold uppercase text-[14px] text-retro-ink"
      >
        {t`BARCODE OR CODE`}
      </label>
      <RetroInput
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        placeholder={t`Enter code manually`}
        maxLength={256}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        error={error ?? undefined}
      />
      <p className="font-mono text-[14px] text-retro-charcoal">
        {t`Any code supported — QR text, UPC, EAN, Code128 alphanumeric.`}
      </p>
      <RetroButton type="submit" variant="primary" disabled={isEmpty}>
        {t`LOOK UP CODE`}
      </RetroButton>
    </form>
  );
}
