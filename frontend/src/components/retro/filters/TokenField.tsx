import type { ReactNode } from "react";
import { Trans, useLingui } from "@lingui/react/macro";

/** One removable token inside the field (an active filter or a committed term). */
export interface FieldToken {
  key: string;
  label: ReactNode;
  displayValue: ReactNode;
  onRemove: () => void;
}

export interface TokenFieldProps {
  /** Active-filter + committed-term tokens (rendered as removable chips). */
  tokens: FieldToken[];
  /** The LIVE search input value (controlled). */
  value: string;
  /** Called on each keystroke of the live input. */
  onChange: (value: string) => void;
  /** Called when Enter pins the current input as a term (trimmed). */
  onCommit: (term: string) => void;
  /** Wipe every token + the live input. */
  onClearAll: () => void;
  /** Called when Backspace on an empty input removes the last token. */
  onBackspaceEmpty?: () => void;
  placeholder?: string;
  className?: string;
}

/**
 * A sunken search field where every active filter and committed search term is a
 * removable chip sitting inside the field, ahead of the live input. Typing
 * filters live; Enter pins the term as a `SEARCH:` token; Backspace on an empty
 * input removes the last token; a `CLEAR` button resets everything. Replaces the
 * FilterBar search box + its separate chip row with one surface.
 */
export function TokenField({
  tokens,
  value,
  onChange,
  onCommit,
  onClearAll,
  onBackspaceEmpty,
  placeholder,
  className = "",
}: Readonly<TokenFieldProps>) {
  const { t } = useLingui();

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const term = value.trim();
      // commitTerm consumes the live search box in the same URL write, so the
      // controlled `value` clears on the next render — no separate onChange("").
      if (term) onCommit(term);
    } else if (e.key === "Backspace" && value === "" && tokens.length > 0) {
      onBackspaceEmpty?.();
    }
  }

  const hasContent = tokens.length > 0 || value !== "";

  return (
    <div
      className={`flex flex-wrap items-center gap-sp-1 border-2 border-border-ink bg-bg-panel px-[8px] py-[6px] bevel-sunken focus-within:outline-3 focus-within:outline-offset-1 focus-within:outline-titlebar-blue ${className}`}
    >
      {tokens.map((token) => {
        const labelText =
          typeof token.label === "string" || typeof token.label === "number"
            ? String(token.label)
            : token.key;
        return (
          <span
            key={token.key}
            className="inline-flex items-center gap-[6px] rounded-chip border border-border-ink bg-titlebar-blue px-sp-2 py-px text-11 font-bold uppercase tracking-7 text-fg-ink"
          >
            <span className="text-fg-muted">{token.label}:</span>
            <span>{token.displayValue}</span>
            <button
              type="button"
              aria-label={t`Remove ${labelText} filter`}
              title={t`Remove ${labelText} filter`}
              onClick={token.onRemove}
              className="cursor-pointer text-fg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </span>
        );
      })}

      <input
        type="search"
        // Stable hook for the "/" focus-search shortcut (see ItemsListPage).
        data-search-input
        aria-label={t`Filter items`}
        placeholder={placeholder ?? t`Search… ↵ to pin`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="min-w-[120px] flex-1 bg-transparent text-14 text-fg-ink focus:outline-none"
      />

      {hasContent && (
        <button
          type="button"
          onClick={onClearAll}
          className="flex-none cursor-pointer px-sp-1 text-11 font-bold uppercase tracking-7 text-fg-muted hover:text-fg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
        >
          <Trans>CLEAR</Trans>
        </button>
      )}
    </div>
  );
}
