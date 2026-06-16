import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BevelButton, RetroDialog, RetroTextarea } from "@/components/retro";

const MAX_CAPTION = 200;

export interface CaptionDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Initial caption value (the photo's current caption, or "" for bulk). */
  initial?: string;
  /** Dialog title. Defaults to EDIT CAPTION. */
  title?: React.ReactNode;
  /** SAVE — commit the caption text (trimmed to ≤200 chars). */
  onSave: (caption: string) => void;
  /** CANCEL / ESC / scrim — dismiss without saving. */
  onClose: () => void;
}

/**
 * Blue-titled caption editor (UI-SPEC §4 Caption edit). A RetroTextarea with a
 * live `{n}/200` mono counter; Enter saves, ESC cancels (ESC routes through the
 * modal stack inside RetroDialog — no own document listener). Used per-photo and
 * for bulk-apply (one caption across a selection).
 */
export function CaptionDialog({
  open,
  initial = "",
  title,
  onSave,
  onClose,
}: Readonly<CaptionDialogProps>) {
  const { t } = useLingui();
  const [value, setValue] = useState(initial);

  // Reset to the photo's current caption each time the dialog (re)opens.
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);

  const save = () => onSave(value.slice(0, MAX_CAPTION));

  return (
    <RetroDialog
      open={open}
      onClose={onClose}
      title={title ?? <Trans>EDIT CAPTION</Trans>}
      titlebarVariant="blue"
      width="min(440px,92vw)"
      footer={
        <>
          <BevelButton variant="neutral" onClick={onClose}>
            <Trans>CANCEL</Trans>
          </BevelButton>
          <BevelButton variant="primary" onClick={save}>
            <Trans>SAVE</Trans>
          </BevelButton>
        </>
      }
    >
      <RetroTextarea
        label={<Trans>Caption</Trans>}
        value={value}
        maxLength={MAX_CAPTION}
        aria-label={t`Caption`}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // Enter (no Shift) saves; Shift+Enter inserts a newline.
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          }
        }}
      />
      <p className="text-right font-mono text-12 tabular-nums text-fg-muted">
        {value.length}/{MAX_CAPTION}
      </p>
    </RetroDialog>
  );
}
