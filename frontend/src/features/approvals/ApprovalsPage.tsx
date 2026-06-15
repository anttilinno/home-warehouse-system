import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Window,
  BevelButton,
  RetroTable,
  RetroBadge,
  RetroInput,
  RetroEmptyState,
  BulkActionBar,
  retroToast,
} from "@/components/retro";
import { RetroConfirmDialog } from "@/components/retro/overlay";
import { useTableSelection } from "@/components/retro/data";
import { useShortcuts } from "@/components/shortcuts";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { PendingChangeDTO } from "@/lib/api/pendingChanges";
import { useApprovalsList } from "./hooks/useApprovalsList";
import {
  useApproveChange,
  useRejectChange,
} from "./hooks/useApprovalMutations";

// SYS-01 (Phase 14 Plan 01) — the /approvals review surface. A paginated
// activity-table of PENDING approval requests with Shift+Click multi-select
// (useTableSelection — id-keyed, survives re-sort) and a BulkActionBar exposing
// Approve + Reject chips. There is NO bulk endpoint: each chip iterates the
// selected ids via Promise.allSettled (partial-failure tolerant), surfaces a
// per-batch summary toast, then invalidates the ["pending-changes", wsId]
// PREFIX ONCE (refreshing this list AND the dashboard side-rail count).
//
// Defer is OMITTED — there is no backend defer endpoint (Approve/Reject only).
//
// A 403 from the list (non-owner/admin) renders a calm static guard, never the
// table (T-14-01 cosmetic guard; the server re-checks canReviewChanges on every
// write). The shortcut bindings are useMemo'd over useCallback'd actions that
// read `t` through a ref so the memo deps stay primitive (render-loop guard,
// hit 4× in prior phases).

const ACTION_VARIANT: Record<
  PendingChangeDTO["action"],
  "info" | "warn" | "danger"
> = {
  create: "info",
  update: "warn",
  delete: "danger",
};

function isoDate(value?: string): string {
  return value ? value.slice(0, 10) : "—";
}

function shortId(value?: string | null): string {
  if (!value) return "—";
  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}

export function ApprovalsPage() {
  const { t } = useLingui();
  // useLingui()'s `t` is NOT referentially stable. The shortcut closures + bulk
  // handlers must carry stable deps (render-loop guard, hit 4× before), so they
  // read everything they need through refs. NOTE: the `@lingui/react/macro` `t`
  // is a COMPILE-TIME macro — it can only interpolate at its CALL SITE, so it is
  // NEVER invoked as a tagged template through a ref (that yields an empty
  // string). Instead the per-render `notifyRef` closures build the toast text
  // with the macro `t` directly and the stable handlers call through the ref.
  const notifyRef = useRef({
    approved: (ok: number, fail: number) => {
      if (fail > 0) retroToast.error(t`Approved ${ok}, ${fail} failed.`);
      else retroToast.success(t`Approved ${ok}.`);
    },
    rejected: (ok: number, fail: number) => {
      if (fail > 0) retroToast.error(t`Rejected ${ok}, ${fail} failed.`);
      else retroToast.success(t`Rejected ${ok}.`);
    },
    reasonRequired: () => retroToast.error(t`A reason is required to reject.`),
  });
  notifyRef.current = {
    approved: (ok: number, fail: number) => {
      if (fail > 0) retroToast.error(t`Approved ${ok}, ${fail} failed.`);
      else retroToast.success(t`Approved ${ok}.`);
    },
    rejected: (ok: number, fail: number) => {
      if (fail > 0) retroToast.error(t`Rejected ${ok}, ${fail} failed.`);
      else retroToast.success(t`Rejected ${ok}.`);
    },
    reasonRequired: () => retroToast.error(t`A reason is required to reject.`),
  };

  const { currentWorkspaceId: wsId, workspaces } = useWorkspace();
  const queryClient = useQueryClient();

  const { rows, total, isLoading, isError, isForbidden } = useApprovalsList();
  const sel = useTableSelection(rows);
  const approve = useApproveChange();
  const reject = useRejectChange();

  const workspaceName =
    workspaces?.find((w) => w.id === wsId)?.name ?? t`Workspace`;

  // ── Reject-reason dialog (the server requires a non-empty reason; gather one
  // for the whole batch via a small confirm dialog with a sunken input).
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  // ── Stable refs over the per-render-unstable values the bulk handlers close
  // over (`sel` is a fresh object each render; the react-query mutation objects
  // are too). Reading these through refs lets the handlers AND the shortcut
  // bindings carry EMPTY/stable deps — the render-loop guard (hit 4× before:
  // `sel`/mutation identities in a memo dep churn useShortcuts → re-register →
  // setState → re-render → loop).
  const selRef = useRef(sel);
  selRef.current = sel;
  const approveRef = useRef(approve);
  approveRef.current = approve;
  const rejectRef = useRef(reject);
  rejectRef.current = reject;
  const wsIdRef = useRef(wsId);
  wsIdRef.current = wsId;
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  // ── Bulk Approve — iterate the selected ids (NO bulk endpoint), tolerate
  // partial failure, then invalidate the prefix ONCE and clear the selection.
  const bulkApprove = useCallback(async () => {
    const selection = selRef.current;
    const ids = [...selection.selected];
    if (ids.length === 0) return;
    const results = await Promise.allSettled(
      ids.map((id) => approveRef.current.mutateAsync(id)),
    );
    const fail = results.filter((r) => r.status === "rejected").length;
    const ok = ids.length - fail;
    notifyRef.current.approved(ok, fail);
    queryClientRef.current.invalidateQueries({
      queryKey: ["pending-changes", wsIdRef.current],
    });
    selection.clear();
  }, []);

  // ── Bulk Reject — same allSettled loop, carrying the gathered reason.
  const bulkReject = useCallback(async (batchReason: string) => {
    const selection = selRef.current;
    const ids = [...selection.selected];
    if (ids.length === 0) return;
    const results = await Promise.allSettled(
      ids.map((id) =>
        rejectRef.current.mutateAsync({ id, reason: batchReason }),
      ),
    );
    const fail = results.filter((r) => r.status === "rejected").length;
    const ok = ids.length - fail;
    notifyRef.current.rejected(ok, fail);
    queryClientRef.current.invalidateQueries({
      queryKey: ["pending-changes", wsIdRef.current],
    });
    selection.clear();
  }, []);

  // ── Shortcut A → approve selected, R → open the reject-reason dialog. Stable
  // refs keep the memo deps EMPTY (NO render-loop). Labels are plain <Trans>-
  // equivalent strings built with the macro `t` at the (stable) call site below.
  const openReject = useCallback(() => {
    if (selRef.current.selected.size === 0) return;
    setReason("");
    setRejectOpen(true);
  }, []);

  // The macro `t` cannot ride a ref; the label strings are computed once with
  // the macro at the call site, and the memo's empty deps keep the binding
  // identity stable across re-renders (lingui re-renders the whole tree on a
  // locale switch, which legitimately rebuilds these — not a render-loop).
  const approveLabel = t`Approve selected`;
  const rejectLabel = t`Reject selected`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: approveLabel/rejectLabel are locale-stable; the t macro returns a fresh string each call, so including them would re-register the shortcuts every render. bulkApprove/openReject are stable.
  const bindings = useMemo(
    () => [
      {
        key: "A",
        label: approveLabel,
        action: () => {
          void bulkApprove();
        },
      },
      {
        key: "R",
        label: rejectLabel,
        danger: true,
        action: openReject,
      },
    ],
    [bulkApprove, openReject],
  );
  useShortcuts("approvals", bindings);

  // ── 403 → calm guard ONLY (no table, no bulk bar, no leak).
  if (isForbidden) {
    return (
      <div className="mx-auto min-w-0 max-w-[1280px]">
        <Window
          title={t`APPROVALS — ${workspaceName}`}
          titlebarVariant="butter"
        >
          <div className="p-sp-4">
            <RetroEmptyState
              eyebrow={<Trans>Approvals</Trans>}
              glyph="⊘"
              heading={<Trans>RESTRICTED</Trans>}
              body={
                <Trans>
                  Only workspace owners and admins can review approvals.
                </Trans>
              }
            />
          </div>
        </Window>
      </div>
    );
  }

  const showEmpty = !isLoading && !isError && rows.length === 0;

  return (
    <div className="mx-auto min-w-0 max-w-[1280px]">
      <Window title={t`APPROVALS — ${workspaceName}`} titlebarVariant="butter">
        {isLoading && (
          <p className="p-sp-4 font-mono text-13 text-fg-muted">
            <Trans>Loading…</Trans>
          </p>
        )}

        {isError && (
          <p className="p-sp-4 text-13 font-semibold text-danger">
            <Trans>Couldn't load pending changes. Try again.</Trans>
          </p>
        )}

        {showEmpty && (
          <div className="p-sp-4">
            <RetroEmptyState
              eyebrow={<Trans>Approvals</Trans>}
              glyph="◇"
              heading={<Trans>NOTHING PENDING</Trans>}
              body={
                <Trans>
                  No changes are waiting for review. New requests appear here.
                </Trans>
              }
            />
          </div>
        )}

        {!isLoading && !isError && rows.length > 0 && (
          <>
            <p className="px-sp-4 pt-sp-3 font-mono text-12 tabular-nums text-fg-muted">
              {t`${total} pending`}
            </p>
            <RetroTable>
              <thead>
                <tr>
                  <th>{t`Requester`}</th>
                  <th>{t`Entity`}</th>
                  <th>{t`Action`}</th>
                  <th>{t`Requested`}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((change) => (
                  <tr
                    key={change.id}
                    aria-selected={sel.selected.has(change.id)}
                    onClick={(e) => sel.onRowClick(change.id, e)}
                    className={`cursor-pointer ${
                      sel.selected.has(change.id) ? "bg-titlebar-blue/30" : ""
                    }`}
                  >
                    <td>
                      <span className="font-semibold">
                        {change.requester_name || "—"}
                      </span>
                      {change.requester_email && (
                        <span className="block font-mono text-11 text-fg-muted">
                          {change.requester_email}
                        </span>
                      )}
                    </td>
                    <td className="font-mono text-12">
                      <span className="font-semibold">
                        {change.entity_type}
                      </span>
                      <span className="text-fg-muted">
                        {" "}
                        {shortId(change.entity_id)}
                      </span>
                    </td>
                    <td>
                      <RetroBadge variant={ACTION_VARIANT[change.action]}>
                        {change.action}
                      </RetroBadge>
                    </td>
                    <td className="font-mono tabular-nums text-fg-muted">
                      {isoDate(change.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </RetroTable>

            {sel.selected.size > 0 && (
              <div className="p-sp-3">
                <BulkActionBar
                  selectedCount={sel.selected.size}
                  onClear={sel.clear}
                >
                  <BevelButton
                    variant="mint"
                    onClick={() => {
                      void bulkApprove();
                    }}
                  >
                    <Trans>✓ APPROVE</Trans>
                  </BevelButton>
                  <BevelButton variant="danger" onClick={openReject}>
                    <Trans>✕ REJECT</Trans>
                  </BevelButton>
                </BulkActionBar>
              </div>
            )}
          </>
        )}

        <RetroConfirmDialog
          open={rejectOpen}
          title={<Trans>Reject selected changes</Trans>}
          confirmLabel={<Trans>REJECT</Trans>}
          onConfirm={() => {
            const trimmed = reason.trim();
            if (trimmed.length === 0) {
              retroToast.error(t`A reason is required to reject.`);
              return;
            }
            setRejectOpen(false);
            void bulkReject(trimmed);
          }}
          onCancel={() => setRejectOpen(false)}
          onClose={() => setRejectOpen(false)}
        >
          <span className="space-y-sp-2">
            <Trans>
              Rejecting requires a reason — it is recorded with the decision.
            </Trans>
            <RetroInput
              label={<Trans>Reason</Trans>}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t`e.g. duplicate request`}
            />
          </span>
        </RetroConfirmDialog>
      </Window>
    </div>
  );
}
