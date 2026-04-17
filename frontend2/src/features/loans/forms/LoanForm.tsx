import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLingui } from "@lingui/react/macro";
import {
  RetroFormField,
  RetroInput,
  RetroTextarea,
  RetroCombobox,
  RetroPanel,
  type RetroOption,
} from "@/components/retro";
import { useAuth } from "@/features/auth/AuthContext";
import { itemsApi } from "@/lib/api/items";
import { borrowersApi } from "@/lib/api/borrowers";
import type { Loan } from "@/lib/api/loans";
import {
  loanCreateSchema,
  loanEditSchema,
  type LoanCreateValues,
  type LoanEditValues,
} from "./schemas";

/**
 * LoanForm — RHF + zod + RetroFormField, create and edit modes.
 *
 * Create mode fields (in order — UI-SPEC §Layout Contract):
 *   ITEM (combobox, async search) → BORROWER (combobox, eager load) →
 *   QUANTITY → LOANED ON → DUE DATE → NOTES
 *
 * Edit mode body:
 *   LOAN DETAILS (LOCKED) panel (item, borrower, qty, loaned_at — read-only,
 *   helper text "This cannot be changed after creation...") →
 *   DUE DATE → NOTES
 *
 * Submit payload shape:
 *   create → { inventory_id, borrower_id, quantity, loaned_at?, due_date?, notes? }
 *   edit   → { due_date?, notes? }
 *
 * Cross-field validation (handled on submit, NOT in the schema because the
 * schema doesn't see the sibling `loan.loaned_at` in edit mode):
 *   - due_date >= loaned_at
 *   - loaned_at not more than 1 day in the future
 *
 * Combobox options exclude archived items/borrowers by passing `archived: false`.
 * The combobox's internal 250ms debounce covers the item search; LoanForm does
 * NOT add external debounce (Pitfall 1 / threat T-62-24).
 */

export interface LoanFormProps {
  formId: string;
  mode: "create" | "edit";
  loan?: Loan;
  onSubmit: (values: LoanCreateValues | LoanEditValues) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function LoanForm({
  formId,
  mode,
  loan,
  onSubmit,
  onDirtyChange,
}: LoanFormProps) {
  const { t } = useLingui();
  const { workspaceId } = useAuth();

  const [itemSearch, setItemSearch] = useState("");
  const [itemOptions, setItemOptions] = useState<
    { id: string; name: string; sku?: string | null }[]
  >([]);
  const [itemLoading, setItemLoading] = useState(false);
  const [borrowerOptions, setBorrowerOptions] = useState<
    { id: string; name: string; email?: string | null }[]
  >([]);

  // Empty-string -> undefined coercion at resolve time (belt).
  const schema = mode === "create" ? loanCreateSchema : loanEditSchema;
  const baseResolver = zodResolver(schema) as Resolver<
    LoanCreateValues | LoanEditValues
  >;
  const resolver: Resolver<LoanCreateValues | LoanEditValues> = (
    values,
    ctx,
    opts,
  ) => {
    const v = values as Record<string, unknown>;
    const cleaned = {
      ...v,
      loaned_at: v.loaned_at === "" ? undefined : v.loaned_at,
      due_date: v.due_date === "" ? undefined : v.due_date,
      notes: v.notes === "" ? undefined : v.notes,
    };
    return baseResolver(
      cleaned as LoanCreateValues | LoanEditValues,
      ctx,
      opts,
    );
  };

  const defaultValues = useMemo<LoanCreateValues | LoanEditValues>(() => {
    if (mode === "create") {
      return {
        inventory_id: "",
        borrower_id: "",
        quantity: 1,
        loaned_at: todayISO(),
        due_date: "",
        notes: "",
      } as LoanCreateValues;
    }
    return {
      due_date: loan?.due_date ? loan.due_date.slice(0, 10) : "",
      notes: loan?.notes ?? "",
    } as LoanEditValues;
  }, [mode, loan]);

  const { control, handleSubmit, formState, setError, clearErrors } = useForm<
    LoanCreateValues | LoanEditValues
  >({
    mode: "onSubmit",
    resolver,
    defaultValues,
  });

  useEffect(() => {
    onDirtyChange?.(formState.isDirty);
  }, [formState.isDirty, onDirtyChange]);

  // Item combobox: async search. RetroCombobox debounces the onSearch call
  // internally (250ms), so we trigger a fresh list request on every echoed
  // search query.
  useEffect(() => {
    if (mode !== "create" || !workspaceId) return;
    let cancelled = false;
    setItemLoading(true);
    itemsApi
      .list(workspaceId, {
        archived: false,
        search: itemSearch || undefined,
        limit: 25,
      })
      .then((r) => {
        if (cancelled) return;
        setItemOptions(
          r.items.map((it) => ({ id: it.id, name: it.name, sku: it.sku })),
        );
      })
      .catch(() => {
        // Swallow: empty option list rendered; user sees "No matches found."
      })
      .finally(() => {
        if (!cancelled) setItemLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [itemSearch, mode, workspaceId]);

  // Borrower combobox: one-shot list (archived=false). Client-side filter by
  // combobox typing — borrowers are fewer than items, no backend search needed.
  useEffect(() => {
    if (mode !== "create" || !workspaceId) return;
    let cancelled = false;
    borrowersApi
      .list(workspaceId, { archived: false, limit: 500 })
      .then((r) => {
        if (cancelled) return;
        setBorrowerOptions(
          r.items.map((b) => ({ id: b.id, name: b.name, email: b.email })),
        );
      })
      .catch(() => {
        /* swallow; empty list */
      });
    return () => {
      cancelled = true;
    };
  }, [mode, workspaceId]);

  const itemRetroOptions: RetroOption[] = itemOptions.map((it) => ({
    value: it.id,
    label: it.sku ? `${it.name} (${it.sku})` : it.name,
  }));

  const borrowerRetroOptions: RetroOption[] = borrowerOptions.map((b) => ({
    value: b.id,
    label: b.email ? `${b.name} (${b.email})` : b.name,
  }));

  const submit = handleSubmit(async (values) => {
    clearErrors("root");
    if (mode === "create") {
      const v = values as LoanCreateValues;
      const cleaned: LoanCreateValues = {
        inventory_id: v.inventory_id,
        borrower_id: v.borrower_id,
        quantity: v.quantity,
        loaned_at: v.loaned_at || undefined,
        due_date: v.due_date || undefined,
        notes: v.notes || undefined,
      };
      // Cross-field: due_date >= loaned_at when both present
      if (
        cleaned.due_date &&
        cleaned.loaned_at &&
        cleaned.due_date < cleaned.loaned_at
      ) {
        setError("due_date", {
          message: t`Due date can't be before the loaned-on date.`,
        });
        return;
      }
      // Cross-field: loaned_at not more than 1 day in the future
      if (cleaned.loaned_at && cleaned.loaned_at > tomorrowISO()) {
        setError("loaned_at", {
          message: t`Loaned-on date can't be in the future.`,
        });
        return;
      }
      await onSubmit(cleaned);
      return;
    }

    // Edit mode
    const v = values as LoanEditValues;
    const cleaned: LoanEditValues = {
      due_date: v.due_date || undefined,
      notes: v.notes || undefined,
    };
    if (cleaned.due_date && loan?.loaned_at) {
      const loanedDate = loan.loaned_at.slice(0, 10);
      if (cleaned.due_date < loanedDate) {
        setError("due_date", {
          message: t`Due date can't be before the loaned-on date.`,
        });
        return;
      }
    }
    await onSubmit(cleaned);
  });

  return (
    <form id={formId} onSubmit={submit} className="flex flex-col gap-md">
      {mode === "edit" && loan && (
        <RetroPanel className="border-2 border-retro-gray">
          <h3 className="text-[14px] font-semibold uppercase tracking-wider text-retro-charcoal/70 mb-sm">
            {t`LOAN DETAILS (LOCKED)`}
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-md gap-y-xs text-[16px]">
            <dt className="font-sans font-semibold uppercase text-[14px] text-retro-ink">
              {t`ITEM`}
            </dt>
            <dd className="font-sans text-retro-ink">{loan.item.name}</dd>
            <dt className="font-sans font-semibold uppercase text-[14px] text-retro-ink">
              {t`BORROWER`}
            </dt>
            <dd className="font-sans text-retro-ink">{loan.borrower.name}</dd>
            <dt className="font-sans font-semibold uppercase text-[14px] text-retro-ink">
              {t`QUANTITY`}
            </dt>
            <dd className="font-mono text-retro-ink">×{loan.quantity}</dd>
            <dt className="font-sans font-semibold uppercase text-[14px] text-retro-ink">
              {t`LOANED ON`}
            </dt>
            <dd className="font-mono text-retro-ink">
              {loan.loaned_at.slice(0, 10)}
            </dd>
          </dl>
          <p className="text-[14px] text-retro-charcoal/70 mt-sm">
            {t`This cannot be changed after creation. Return this loan and create a new one to change the item, borrower, or quantity.`}
          </p>
        </RetroPanel>
      )}

      {mode === "create" && (
        <>
          <RetroFormField
            name="inventory_id"
            control={control}
            label={t`ITEM`}
          >
            <RetroCombobox
              placeholder={t`Pick an item…`}
              options={itemRetroOptions}
              onSearch={setItemSearch}
              loading={itemLoading}
            />
          </RetroFormField>

          <RetroFormField
            name="borrower_id"
            control={control}
            label={t`BORROWER`}
          >
            <RetroCombobox
              placeholder={t`Pick a borrower…`}
              options={borrowerRetroOptions}
            />
          </RetroFormField>

          <RetroFormField
            name="quantity"
            control={control}
            label={t`QUANTITY`}
            helper={t`Whole units only`}
          >
            <RetroInput
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              placeholder="1"
              className="font-mono"
            />
          </RetroFormField>

          <RetroFormField
            name="loaned_at"
            control={control}
            label={t`LOANED ON`}
            helper={t`Today by default`}
          >
            <RetroInput type="date" className="font-mono" />
          </RetroFormField>
        </>
      )}

      <RetroFormField
        name="due_date"
        control={control}
        label={t`DUE DATE`}
        helper={t`Optional — leave blank for open-ended loans`}
      >
        <RetroInput type="date" className="font-mono" />
      </RetroFormField>

      <RetroFormField
        name="notes"
        control={control}
        label={t`NOTES`}
        helper={t`Optional — up to 1000 characters`}
      >
        <RetroTextarea
          rows={4}
          placeholder={t`Delivery arrangement, condition on loan, etc.`}
        />
      </RetroFormField>
    </form>
  );
}
