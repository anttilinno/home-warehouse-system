import { useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Trans, useLingui } from "@lingui/react/macro";
import { RetroEmptyState, Window, retroToast } from "@/components/retro";
import { itemsApi } from "@/lib/api/items";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// ClaimPage — the `/claim/:code` create-entity claim flow (SCAN-12, parity).
//
// USER DECISION (binding override 9): this is a PORT of the legacy
// /claim/[code] create-ENTITY page, NOT a claim-as-loan flow. There is no JSON
// resolve endpoint and no new backend route. It resolves :code via the existing
// itemsApi.lookupByBarcode and either:
//   MATCH (Item) → routes to the matched item detail (/items/:id)
//   404  (null)  → offers create-item-with-this-barcode (/items/new?barcode=…)
//
// The route is registered under RequireAuth by 11-06 (single-writer
// routes/index.tsx); login gating is NOT re-implemented here (T-11-12).
//
// The :code path param is user-controlled. lookupByBarcode encodeURIComponents
// it for the lookup path; this component encodeURIComponents it AGAIN for the
// /items/new?barcode= link so a `../etc`-style code can never leak a raw path
// segment into the create URL (Pitfall 5 / T-11-11).
export function ClaimPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { code = "" } = useParams<{ code: string }>();
  const { currentWorkspaceId } = useWorkspace();

  const query = useQuery({
    queryKey: ["item-by-barcode", currentWorkspaceId, code],
    queryFn: () => itemsApi.lookupByBarcode(currentWorkspaceId as string, code),
    enabled: currentWorkspaceId != null && code !== "",
  });

  const { data: item, isError } = query;
  // RESOLVING while the workspace is settling OR the lookup is in flight.
  const isResolving =
    currentWorkspaceId == null || query.isPending || query.isFetching;

  // Surface lookup failures as a persistent toast (sonner default duration is
  // long-lived) in addition to the in-page danger banner below.
  useEffect(() => {
    if (isError) {
      retroToast.error(t`Couldn't resolve this code. Try scanning again.`);
    }
  }, [isError, t]);

  // MATCH → route straight to the item detail. Navigate (declarative) so the
  // claim URL is replaced rather than pushed onto history.
  if (item) {
    return <Navigate to={`/items/${item.id}`} replace />;
  }

  // ERROR → in-page role="alert" danger banner (ItemFormPage root-error idiom).
  if (isError) {
    return (
      <main className="mx-auto w-full max-w-[480px] p-sp-4">
        <Window title={<Trans>Claim code</Trans>} titlebarVariant="mint">
          <p
            role="alert"
            className="border-2 border-border-ink bg-danger-bg p-sp-3 text-14 text-danger"
          >
            <Trans>
              Couldn't resolve this code. Check your connection and try again.
            </Trans>
          </p>
          <div className="mt-sp-4 flex justify-end">
            <Link
              to="/scan"
              className="inline-flex cursor-pointer items-center justify-center gap-sp-2 border-2 border-border-ink bg-bg-panel px-[14px] py-[6px] font-body text-13 font-semibold uppercase tracking-4 text-fg-ink bevel-raised-ink hover:brightness-103 active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed"
            >
              <Trans>Back to scan</Trans>
            </Link>
          </div>
        </Window>
      </main>
    );
  }

  // RESOLVING — the retro stepped-progress loading idiom (UI-SPEC §3).
  if (isResolving) {
    return (
      <main className="grid min-h-[60vh] place-items-center p-sp-4">
        <Window
          title={<Trans>Claim code</Trans>}
          titlebarVariant="mint"
          className="w-full max-w-[400px]"
          bodyClassName="grid place-items-center gap-sp-4 p-sp-5"
        >
          <div
            aria-busy="true"
            className="grid h-[32px] w-[32px] place-items-center border-2 border-border-ink bg-bg-panel-2 bevel-sunken"
          >
            <span
              aria-hidden="true"
              className="retro-progress h-[10px] w-[10px] bg-fg-ink"
            />
          </div>
          <div role="status" className="text-center">
            <p className="text-14 text-fg-muted">
              <Trans>Resolving code…</Trans>
            </p>
            <p className="mt-sp-1 break-all font-mono text-12 tabular-nums text-fg-faint">
              {code}
            </p>
          </div>
        </Window>
      </main>
    );
  }

  // UNRESOLVABLE (404 / null) — create-entity: offer to create an item with
  // this barcode prefilled. encodeURIComponent the code in the link (Pitfall 5).
  const createHref = `/items/new?barcode=${encodeURIComponent(code)}`;

  return (
    <main className="mx-auto w-full max-w-[480px] p-sp-4">
      <Window title={<Trans>Claim code</Trans>} titlebarVariant="mint">
        <p className="text-14 text-fg-muted">
          <Trans>
            No item matches this code yet. Create one with the code attached.
          </Trans>
        </p>
        <p className="mt-sp-2 break-all font-mono text-13 tabular-nums text-fg-ink">
          {code}
        </p>
        <div className="mt-sp-4 flex flex-wrap gap-sp-3">
          {/* A real anchor (role="link") styled as a mint bevel button — a
              button-in-anchor would be invalid HTML and hide the link role. */}
          <Link
            to={createHref}
            className="inline-flex cursor-pointer items-center justify-center gap-sp-2 border-2 border-border-ink bg-titlebar-mint px-[14px] py-[6px] font-body text-13 font-semibold uppercase tracking-4 text-fg-ink bevel-raised-ink hover:brightness-103 active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed"
          >
            <Trans>Create item with this code</Trans>
          </Link>
        </div>

        {/* RetroEmptyState fallback per UI-SPEC § Feedback Family — the
            genuinely-empty "code not found" affordance, BACK TO SCAN → /scan. */}
        <div className="mt-sp-4 border-t-2 border-border-ink pt-sp-2">
          <RetroEmptyState
            glyph="◎"
            heading={<Trans>Code not found</Trans>}
            body={
              <Trans>
                That code isn't linked to anything in this workspace.
              </Trans>
            }
            action={{
              label: <Trans>Back to scan</Trans>,
              onClick: () => navigate("/scan"),
            }}
          />
        </div>
      </Window>
    </main>
  );
}
