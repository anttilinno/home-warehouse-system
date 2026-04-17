import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { HttpError } from "@/lib/api";
import {
  loansApi,
  loanKeys,
  type Loan,
  type CreateLoanInput,
  type UpdateLoanInput,
} from "@/lib/api/loans";
import { itemKeys } from "@/lib/api/items";
import { borrowerKeys } from "@/lib/api/borrowers";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro";

/**
 * Phase 62 loan mutation hooks.
 *
 * Invalidation sets map 1:1 to `62-UI-SPEC.md#Interaction Contracts`:
 *   - Create → loanKeys.all + itemKeys.detail(inv) + borrowerKeys.detail(bor)
 *     + itemKeys.lists() + borrowerKeys.lists()  [5 sets]
 *   - Update → loanKeys.all  [1 set]
 *   - Return → loanKeys.all + loanKeys.detail(id) + itemKeys.detail(inv)
 *     + borrowerKeys.detail(bor)  [4 sets]
 *
 * 400 branches decode a small fixed vocabulary of backend error messages
 * (Plan 62-01 handler + existing create handler) into specific toasts; any
 * other error falls back to a generic retry prompt (Pitfall: HttpError
 * branching).
 */

function isHttp400(err: unknown, contains: string): boolean {
  if (!(err instanceof HttpError)) return false;
  if (err.status !== 400) return false;
  return err.message.toLowerCase().includes(contains.toLowerCase());
}

export function useCreateLoan() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<Loan, unknown, CreateLoanInput>({
    mutationFn: (input) =>
      loansApi.create(workspaceId!, {
        ...input,
        loaned_at: input.loaned_at ? `${input.loaned_at}T00:00:00Z` : undefined,
        due_date: input.due_date ? `${input.due_date}T00:00:00Z` : undefined,
      }),
    onSuccess: (loan) => {
      qc.invalidateQueries({ queryKey: loanKeys.all });
      qc.invalidateQueries({ queryKey: itemKeys.detail(loan.inventory_id) });
      qc.invalidateQueries({ queryKey: borrowerKeys.detail(loan.borrower_id) });
      qc.invalidateQueries({ queryKey: itemKeys.lists() });
      qc.invalidateQueries({ queryKey: borrowerKeys.lists() });
      addToast(t`Loan created.`, "success");
    },
    onError: (err) => {
      if (isHttp400(err, "already has an active loan")) {
        addToast(t`This item is already on loan.`, "error");
        return;
      }
      if (isHttp400(err, "is not available")) {
        addToast(t`This item is not available for loan.`, "error");
        return;
      }
      if (isHttp400(err, "exceeds available quantity")) {
        addToast(t`Not enough units available for loan.`, "error");
        return;
      }
      addToast(
        t`Could not create loan. Check your connection and try again.`,
        "error",
      );
    },
  });
}

export function useUpdateLoan() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<Loan, unknown, { id: string; input: UpdateLoanInput }>({
    mutationFn: ({ id, input }) =>
      loansApi.update(workspaceId!, id, {
        ...input,
        due_date: input.due_date ? `${input.due_date}T00:00:00Z` : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: loanKeys.all });
      addToast(t`Loan updated.`, "success");
    },
    onError: (err) => {
      if (isHttp400(err, "cannot edit returned")) {
        addToast(t`This loan has already been returned.`, "error");
        return;
      }
      if (isHttp400(err, "must be after loaned")) {
        addToast(t`Due date can't be before the loaned-on date.`, "error");
        return;
      }
      addToast(t`Could not update loan. Try again.`, "error");
    },
  });
}

export function useReturnLoan() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<
    void,
    unknown,
    { id: string; itemId: string; borrowerId: string }
  >({
    mutationFn: ({ id }) => loansApi.return(workspaceId!, id),
    onSuccess: (_void, { id, itemId, borrowerId }) => {
      qc.invalidateQueries({ queryKey: loanKeys.all });
      qc.invalidateQueries({ queryKey: loanKeys.detail(id) });
      qc.invalidateQueries({ queryKey: itemKeys.detail(itemId) });
      qc.invalidateQueries({ queryKey: borrowerKeys.detail(borrowerId) });
      addToast(t`Loan returned.`, "success");
    },
    onError: (err) => {
      if (isHttp400(err, "already been returned")) {
        addToast(t`This loan has already been returned.`, "error");
        return;
      }
      addToast(t`Could not return loan. Try again.`, "error");
    },
  });
}
