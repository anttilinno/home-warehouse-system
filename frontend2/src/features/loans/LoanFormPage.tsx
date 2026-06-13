import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Window,
  BevelButton,
  RetroInput,
  RetroSelect,
  RetroTextarea,
  RetroBadge,
  RetroConfirmDialog,
  retroToast,
} from "@/components/retro";
import { loansApi, type CreateLoanBody } from "@/lib/api/loans";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import {
  loanFormSchema,
  type LoanFormInput,
  type LoanFormValues,
} from "./schema";
import { useLoanPickerOptions } from "./hooks/useLoanPickerOptions";

// Phase 8 Plan 03 — the /loans/new create-loan form (LOAN-02). The ONLY way to
// create a loan, and the forward-compat target for the Phase 11 scan deep link
// (/loans/new?itemId=).
//
// One blue Window (NEW LOAN), centered max-w-[560px], RHF + zod — mirrors
// InventoryFormPage. Pickers are NATIVE RetroSelects from useLoanPickerOptions
// (inventory entries + borrowers, both clamped to limit=100). An empty source
// list disables the select with the add-one-first hint.
//
// The wire field is inventory_id, NEVER item_id (Pitfall 1 / override 1): the
// form posts the selected inventory ENTRY's id. ?itemId= PRE-FILTERS the
// inventory picker to that item's entries (FROM ITEM badge + locked hint) and
// auto-selects when exactly one entry matches — it does NOT preselect/lock an
// item field; with multiple matches the user still chooses the entry.
//
// Dirty-form navigation opens a butter DISCARD CHANGES? confirm (the item/
// inventory-form guard pattern — useBlocker is unavailable in declarative-router
// mode). On success → retroToast + invalidate ["loans", wsId] (+ the item's
// by-item key when created from ?itemId), then navigate.

const EMPTY_DEFAULTS: LoanFormInput = {
  inventory_id: "",
  borrower_id: "",
  due_date: "",
  notes: "",
};

// Serialize a YYYY-MM-DD date to RFC3339; "" / undefined → undefined (omit).
function toRfc3339(date: string | undefined): string | undefined {
  if (!date) return undefined;
  return `${date}T00:00:00Z`;
}

export function LoanFormPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentWorkspaceId: wsId } = useWorkspace();
  const [searchParams] = useSearchParams();

  // ?itemId= PRE-FILTERS the inventory picker (override 1 / Pitfall 6). Empty
  // string when absent.
  const itemIdFilter = searchParams.get("itemId") ?? "";
  const fromItem = itemIdFilter.length > 0;

  const { inventoryOptions, borrowerOptions, isLoading } = useLoanPickerOptions(
    fromItem ? itemIdFilter : undefined,
  );

  const {
    handleSubmit,
    control,
    register,
    setValue,
    setError,
    formState: { errors, isDirty, isSubmitting, isSubmitSuccessful },
  } = useForm<LoanFormInput>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  // ?itemId auto-select: when exactly one entry matches the filter, preselect it
  // so the borrower is the only remaining choice (UI-SPEC §2). With multiple
  // matches the user still picks the entry.
  useEffect(() => {
    if (fromItem && inventoryOptions.length === 1) {
      setValue("inventory_id", inventoryOptions[0].id, { shouldDirty: false });
    }
  }, [fromItem, inventoryOptions, setValue]);

  const createLoan = useMutation({
    mutationFn: (body: CreateLoanBody) =>
      loansApi.create(wsId as string, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans", wsId as string] });
      if (fromItem) {
        queryClient.invalidateQueries({
          queryKey: ["loans", wsId as string, "by-item", itemIdFilter],
        });
      }
      retroToast.success(t`Loan created.`);
    },
    onError: () => retroToast.error(t`Couldn't create this loan.`),
  });

  // Dirty-form navigation guard (mirrors InventoryFormPage — no useBlocker in
  // declarative-router mode).
  const [pendingLeave, setPendingLeave] = useState<string | null>(null);
  const guardActive = isDirty && !isSubmitSuccessful;

  useEffect(() => {
    if (!guardActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [guardActive]);

  function attemptLeave(to: string) {
    if (guardActive) {
      setPendingLeave(to);
    } else {
      navigate(to);
    }
  }

  async function onSubmit(raw: LoanFormInput) {
    const values: LoanFormValues = loanFormSchema.parse(raw);
    // Build the wire body — inventory_id (NOT item_id), quantity fixed at 1 this
    // phase. Omit absent optionals (never zero-inject).
    const body: CreateLoanBody = {
      inventory_id: values.inventory_id,
      borrower_id: values.borrower_id,
      quantity: 1,
    };
    const due = toRfc3339(values.due_date);
    if (due) body.due_date = due;
    if (values.notes) body.notes = values.notes;

    try {
      await createLoan.mutateAsync(body);
      // From ?itemId → back to the item detail (where the new loan shows in the
      // panel); otherwise to the active-loans tab.
      navigate(fromItem ? `/items/${itemIdFilter}` : "/loans?tab=active");
    } catch {
      setError("root", { message: t`Couldn't create this loan.` });
    }
  }

  function handleCancel() {
    attemptLeave(fromItem ? `/items/${itemIdFilter}` : "/loans");
  }

  const inventoryEmpty = !isLoading && inventoryOptions.length === 0;
  const borrowersEmpty = !isLoading && borrowerOptions.length === 0;

  return (
    <div className="mx-auto max-w-[560px]">
      <Window title={t`NEW LOAN`} titlebarVariant="blue">
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-sp-4"
        >
          {/* Form-level error banner (submit/server failure). */}
          {errors.root?.message && (
            <div
              role="alert"
              className="border-2 border-border-ink bg-danger-bg p-sp-3 text-[14px] text-danger"
            >
              <span aria-hidden="true">✕ </span>
              {errors.root.message}
            </div>
          )}

          {/* Inventory entry picker (required). ?itemId pre-filters + FROM ITEM. */}
          <div className="flex flex-col gap-sp-2">
            <Controller
              control={control}
              name="inventory_id"
              render={({ field }) => (
                <RetroSelect
                  label={
                    <span className="inline-flex items-center gap-sp-2">
                      <Trans>Inventory entry</Trans>
                      {fromItem && (
                        <RetroBadge variant="info">
                          <Trans>From item</Trans>
                        </RetroBadge>
                      )}
                    </span>
                  }
                  required
                  aria-required="true"
                  error={errors.inventory_id?.message}
                  disabled={inventoryEmpty}
                  {...field}
                >
                  <option value="">{t`— Select an inventory entry`}</option>
                  {inventoryOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </RetroSelect>
              )}
            />
            {inventoryEmpty && (
              <p className="text-[12px] text-fg-muted">
                <Trans>No inventory entries yet — add one first.</Trans>
              </p>
            )}
            {fromItem && !inventoryEmpty && (
              <p className="text-[12px] text-fg-muted">
                <Trans>Loaning this item — pick a borrower.</Trans>
              </p>
            )}
          </div>

          {/* Borrower picker (required). Auto-focus when created from ?itemId. */}
          <div className="flex flex-col gap-sp-2">
            <Controller
              control={control}
              name="borrower_id"
              render={({ field }) => (
                <RetroSelect
                  label={<Trans>Borrower</Trans>}
                  required
                  aria-required="true"
                  error={errors.borrower_id?.message}
                  disabled={borrowersEmpty}
                  autoFocus={fromItem}
                  {...field}
                >
                  <option value="">{t`— Select a borrower`}</option>
                  {borrowerOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </RetroSelect>
              )}
            />
            {borrowersEmpty && (
              <p className="text-[12px] text-fg-muted">
                <Trans>No borrowers yet — add one first.</Trans>
              </p>
            )}
          </div>

          {/* Due date (optional). */}
          <div className="flex flex-col gap-sp-2">
            <RetroInput
              label={<Trans>Due date</Trans>}
              type="date"
              mono
              error={errors.due_date?.message}
              {...register("due_date")}
            />
            <p className="text-[12px] text-fg-muted">
              <Trans>Optional — leave blank for no due date.</Trans>
            </p>
          </div>

          {/* Notes (optional). */}
          <RetroTextarea
            label={<Trans>Notes</Trans>}
            error={errors.notes?.message}
            {...register("notes")}
          />

          {/* Footer — pinned action row. */}
          <div className="flex justify-end gap-sp-2 border-t-2 border-border-ink pt-sp-3">
            <BevelButton type="button" variant="neutral" onClick={handleCancel}>
              <Trans>Cancel</Trans>
            </BevelButton>
            <BevelButton type="submit" variant="primary" disabled={isSubmitting}>
              <Trans>Create loan</Trans>
            </BevelButton>
          </div>
        </form>
      </Window>

      {/* Dirty-form discard guard (butter, non-destructive decision). */}
      <RetroConfirmDialog
        open={pendingLeave !== null}
        title={<Trans>DISCARD CHANGES?</Trans>}
        titlebarVariant="butter"
        confirmVariant="neutral"
        confirmLabel={<Trans>Discard</Trans>}
        cancelLabel={<Trans>Keep editing</Trans>}
        onConfirm={() => {
          const to = pendingLeave;
          setPendingLeave(null);
          if (to) navigate(to);
        }}
        onCancel={() => setPendingLeave(null)}
        onClose={() => setPendingLeave(null)}
      >
        <Trans>Your changes will be lost.</Trans>
      </RetroConfirmDialog>
    </div>
  );
}
