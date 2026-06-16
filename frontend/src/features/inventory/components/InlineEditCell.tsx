import { type ReactNode, useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { RetroInput, RetroSelect, StatusPill } from "@/components/retro";
import type { Condition, InventoryStatus } from "@/lib/types";
import {
  CONDITION_LABEL,
  CONDITION_VARIANT,
  CONDITIONS,
  STATUS_LABEL,
  STATUS_VARIANT,
  STATUSES,
} from "../inventoryEnums";

// Phase 7b Plan 02 — click-to-edit single cell (UI-SPEC §3). Editing is per-cell,
// NOT a row edit mode: click (or Enter/Space when focused) swaps the rest display
// for an inline control; Blur OR Enter commits; ESC reverts WITHOUT committing
// and WITHOUT touching the modal stack (R9 — the cell is not a modal surface, so
// ESC is a field-local onKeyDown that stopPropagation()s and never pops
// useModalStack). Optimism + revert live in the mutation layer; this component
// only owns the local edit lifecycle and validation gate.

interface BaseProps {
  itemName: string;
  /** Disabled cells render the rest value but never enter edit mode. */
  disabled?: boolean;
}

interface QuantityProps extends BaseProps {
  field: "quantity";
  value: number;
  onCommit: (next: number) => void;
}
interface StatusProps extends BaseProps {
  field: "status";
  value: InventoryStatus;
  onCommit: (next: InventoryStatus) => void;
}
interface ConditionProps extends BaseProps {
  field: "condition";
  value: Condition;
  onCommit: (next: Condition) => void;
}

export type InlineEditCellProps = QuantityProps | StatusProps | ConditionProps;

export function InlineEditCell(props: InlineEditCellProps) {
  const { t } = useLingui();
  const { field, itemName, disabled } = props;
  const [editing, setEditing] = useState(false);
  // Draft holds the in-progress value as a string for inputs/selects.
  const [draft, setDraft] = useState<string>(String(props.value));
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Re-sync the draft whenever we (re)enter edit mode or the committed value
  // changes underneath us (optimistic patch / server refetch).
  useEffect(() => {
    if (editing) setDraft(String(props.value));
  }, [editing, props.value]);

  // Auto-focus + select the control on entering edit mode.
  useEffect(() => {
    if (!editing) return;
    if (field === "quantity") {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      selectRef.current?.focus();
    }
  }, [editing, field]);

  const ariaLabel =
    field === "quantity"
      ? t`Edit quantity for ${itemName}`
      : field === "status"
        ? t`Edit status for ${itemName}`
        : t`Edit condition for ${itemName}`;

  function enterEdit() {
    if (disabled) return;
    setEditing(true);
  }

  function cancel() {
    setDraft(String(props.value));
    setEditing(false);
  }

  function commit() {
    if (field === "quantity") {
      const n = Number(draft);
      // Qty empty or < 0 (or non-numeric) does NOT commit — revert instead of
      // firing a doomed request (UI-SPEC §3 Validation row).
      if (draft.trim() === "" || !Number.isFinite(n) || n < 0) {
        cancel();
        return;
      }
      setEditing(false);
      if (n !== props.value) props.onCommit(n);
      return;
    }
    if (field === "status") {
      setEditing(false);
      if (draft !== props.value) props.onCommit(draft as InventoryStatus);
      return;
    }
    setEditing(false);
    if (draft !== props.value) props.onCommit(draft as Condition);
  }

  // ── Rest state ───────────────────────────────────────────────────────────
  if (!editing) {
    let display: ReactNode;
    if (field === "quantity") {
      display = <span className="font-mono tabular-nums">{props.value}</span>;
    } else if (field === "status") {
      const s = props.value;
      display = (
        <StatusPill variant={STATUS_VARIANT[s]}>{STATUS_LABEL[s]}</StatusPill>
      );
    } else {
      const c = props.value;
      display = (
        <StatusPill variant={CONDITION_VARIANT[c]}>
          {CONDITION_LABEL[c]}
        </StatusPill>
      );
    }

    return (
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={enterEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            enterEdit();
          }
        }}
        className={`inline-flex items-center gap-sp-1 border border-transparent bg-transparent px-[2px] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink ${
          disabled
            ? "cursor-not-allowed"
            : field === "quantity"
              ? "cursor-text hover:border-table-rule"
              : "cursor-pointer hover:border-table-rule"
        }`}
      >
        {display}
      </button>
    );
  }

  // ── Edit state ─────────────────────────────────────────────────────────────
  const onKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      // Field-local cancel — never the modal stack (R9).
      e.stopPropagation();
      e.preventDefault();
      cancel();
    }
  };

  if (field === "quantity") {
    return (
      <RetroInput
        ref={inputRef}
        type="number"
        min={0}
        mono
        label=""
        aria-label={ariaLabel}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        className="min-w-[64px]"
      />
    );
  }

  const options = field === "status" ? STATUSES : CONDITIONS;
  const labels = field === "status" ? STATUS_LABEL : CONDITION_LABEL;

  return (
    <RetroSelect
      ref={selectRef}
      label=""
      aria-label={ariaLabel}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={commit}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {(labels as Record<string, string>)[opt]}
        </option>
      ))}
    </RetroSelect>
  );
}
