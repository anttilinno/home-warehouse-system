import { useId, useRef, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { Trans } from "@lingui/react/macro";
import { BevelButton } from "../BevelButton";

export interface RetroFileInputProps {
  label: ReactNode;
  /** Emits the current File[] whenever the selection changes (add/drop/remove). */
  onChange: (files: File[]) => void;
  /** Restrict accepted types (native `accept` syntax), passed to the input. */
  accept?: string;
  /** Allow selecting multiple files. Default true. */
  multiple?: boolean;
  /** Max size per file in bytes; oversized files are rejected with an error. */
  maxSize?: number;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Sunken dashed drop zone + BROWSE… button, both triggering a hidden native
 * file input. Emits `File[]` only via `onChange` (click-to-browse + basic
 * drag-drop) — it NEVER reads file contents (no content-reading APIs); the
 * actual multipart upload is Phase 7/14b. Oversized files surface a danger
 * error and are rejected.
 */
export function RetroFileInput({
  label,
  onChange,
  accept,
  multiple = true,
  maxSize,
  disabled = false,
}: Readonly<RetroFileInputProps>) {
  const { t } = useLingui();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = (incoming: File[]) => {
    if (disabled) return;
    const accepted: File[] = [];
    let rejected: string | null = null;
    for (const f of incoming) {
      if (maxSize != null && f.size > maxSize) {
        rejected = t`File is too large (max ${formatSize(maxSize)}).`;
        continue;
      }
      accepted.push(f);
    }
    setError(rejected);
    if (accepted.length === 0) return;
    const next = multiple ? [...files, ...accepted] : accepted.slice(-1);
    setFiles(next);
    onChange(next);
  };

  const removeAt = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-sp-1">
      <label
        htmlFor={inputId}
        className="text-12 font-bold uppercase tracking-8 text-fg-muted"
      >
        {label}
      </label>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop is a pointer-only enhancement; the BROWSE button is the keyboard-accessible path */}
      <div
        data-testid="file-drop-zone"
        className={`flex flex-col items-center gap-sp-2 border-2 border-dashed p-sp-4 text-center bevel-sunken ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : dragging
              ? "border-titlebar-blue bg-info-bg"
              : "border-border-ink bg-bg-panel-2"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          addFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <p className="text-14 text-fg-muted">
          {dragging ? (
            <Trans>Release to add</Trans>
          ) : (
            <Trans>Drop files here, or</Trans>
          )}
        </p>
        <BevelButton
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <Trans>BROWSE…</Trans>
        </BevelButton>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            // Reset so re-selecting the same file fires change again.
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="text-12 font-semibold text-danger">
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="flex flex-col gap-sp-1">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${f.size}-${f.lastModified}`}
              className="flex items-center gap-sp-2 border-2 border-border-ink bg-bg-panel px-sp-2 py-[4px]"
            >
              <span className="flex-1 truncate font-mono text-12 text-fg-ink">
                {f.name}
              </span>
              <span className="font-mono text-12 tabular-nums text-fg-muted">
                {formatSize(f.size)}
              </span>
              <BevelButton
                type="button"
                aria-label={t`Remove ${f.name}`}
                title={t`Remove ${f.name}`}
                className="!px-[8px] !py-[2px] !text-11"
                onClick={() => removeAt(i)}
              >
                ✕
              </BevelButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
