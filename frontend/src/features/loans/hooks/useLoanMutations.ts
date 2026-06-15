import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { loansApi } from "@/lib/api/loans";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { Loan } from "@/lib/types";

// Phase 8 Plan 04 — the loan lifecycle write surface (LOAN-03 return,
// LOAN-04 extend + edit). MIRRORS useInventoryMutations EXACTLY: onMutate
// snapshots EVERY `["loans", wsId]` query, patches the matching loan in place,
// onError restores the snapshot + fires a persistent retroToast.error,
// onSettled re-invalidates the prefix so the SERVER value (incl. its recomputed
// is_overdue — override 2) is authoritative (T-08-04: no client-trusted state
// survives a 4xx).
//
// Pitfall 4: loan list caches are a BARE `{ items: Loan[] }` envelope (no
// total/page wrapper — huma's `$schema` deliberately unmodelled), so the patch
// guards Array.isArray(old.items).

/** Snapshot context: every captured `["loans", wsId]` query entry. */
interface OptimisticContext {
  snapshots: [QueryKey, unknown][];
}

/** A single loan-list cache shape — only `items` is patched. */
type LoanListLike = { items: Loan[] } & Record<string, unknown>;

export interface ExtendLoanArg {
  id: string;
  new_due_date: string;
}
export interface UpdateLoanArg {
  id: string;
  due_date?: string;
  notes?: string;
}

export function useLoanMutations() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const queryClient = useQueryClient();
  const { t } = useLingui();

  const prefix: QueryKey = ["loans", wsId as string];

  function invalidate() {
    // Prefix-match (default exact:false) — covers list + by-item + by-borrower.
    queryClient.invalidateQueries({ queryKey: prefix });
  }

  // Snapshot + optimistically patch the matching loan across ALL loan caches
  // (list / by-item / by-borrower — any param combo currently cached).
  async function optimisticPatch(
    id: string,
    patch: Partial<Loan>,
  ): Promise<OptimisticContext> {
    await queryClient.cancelQueries({ queryKey: prefix });
    const snapshots = queryClient.getQueriesData({ queryKey: prefix });
    queryClient.setQueriesData<LoanListLike>({ queryKey: prefix }, (old) => {
      if (!old || !Array.isArray(old.items)) return old;
      return {
        ...old,
        items: old.items.map((loan) =>
          loan.id === id ? { ...loan, ...patch } : loan,
        ),
      };
    });
    return { snapshots };
  }

  function restore(ctx: OptimisticContext | undefined) {
    ctx?.snapshots.forEach(([key, data]) =>
      queryClient.setQueryData(key, data),
    );
  }

  const returnLoan = useMutation<Loan, Error, string, OptimisticContext>({
    mutationFn: (id) => loansApi.return(wsId as string, id),
    onMutate: (id) =>
      optimisticPatch(id, {
        is_active: false,
        returned_at: new Date().toISOString(),
      }),
    onError: (_err, _arg, ctx) => {
      restore(ctx);
      retroToast.error(t`Couldn't return this loan.`);
    },
    onSettled: invalidate,
  });

  const extendLoan = useMutation<Loan, Error, ExtendLoanArg, OptimisticContext>(
    {
      mutationFn: ({ id, new_due_date }) =>
        loansApi.extend(wsId as string, id, new_due_date),
      // Patch due_date only; the server recomputes is_overdue, surfaced by the
      // onSettled re-invalidation (override 2 — never client date math).
      onMutate: ({ id, new_due_date }) =>
        optimisticPatch(id, { due_date: new_due_date }),
      onError: (_err, _arg, ctx) => {
        restore(ctx);
        retroToast.error(t`Couldn't extend this loan.`);
      },
      onSettled: invalidate,
    },
  );

  const updateLoan = useMutation<Loan, Error, UpdateLoanArg, OptimisticContext>(
    {
      mutationFn: ({ id, due_date, notes }) =>
        loansApi.update(wsId as string, id, { due_date, notes }),
      onMutate: ({ id, due_date, notes }) =>
        optimisticPatch(id, { due_date, notes }),
      onError: (_err, _arg, ctx) => {
        restore(ctx);
        retroToast.error(t`Couldn't save this loan.`);
      },
      onSettled: invalidate,
    },
  );

  return { returnLoan, extendLoan, updateLoan };
}
