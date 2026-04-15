import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { itemsApi, itemKeys, type ItemListParams } from "@/lib/api/items";
import { RetroPanel, RetroButton, HazardStripe } from "@/components/retro";

export function ApiDemoPage() {
  const { t } = useLingui();
  const { workspaceId, isLoading: authLoading } = useAuth();

  const params: ItemListParams = { page: 1, limit: 10 };
  const query = useQuery({
    queryKey: itemKeys.list(params),
    queryFn: () => itemsApi.list(workspaceId!, params),
    enabled: !!workspaceId,
  });

  if (authLoading) return null;

  return (
    <div className="min-h-dvh bg-retro-cream p-lg flex flex-col gap-xl">
      {/* Page header */}
      <RetroPanel showHazardStripe>
        <h1 className="text-[28px] font-semibold uppercase text-retro-charcoal">
          {t`API Demo`}
        </h1>
      </RetroPanel>

      {/* Anonymous state — no workspaceId (user not signed in) */}
      {!workspaceId && (
        <RetroPanel>
          <p className="text-retro-charcoal">
            {t`Sign in to run the real API fetch. This page is public for reachability; the underlying endpoint requires authentication.`}
          </p>
        </RetroPanel>
      )}

      {/* Loading state */}
      {workspaceId && query.isPending && (
        <RetroPanel>
          <p className="font-mono text-retro-charcoal">{t`Loading data from API…`}</p>
        </RetroPanel>
      )}

      {/* Error state */}
      {workspaceId && query.isError && (
        <RetroPanel className="border-retro-red">
          <HazardStripe className="mb-md" />
          <p className="text-retro-red mb-md">
            {t`Could not reach the API. Check your network and the backend URL, then retry.`}
          </p>
          <RetroButton variant="primary" onClick={() => query.refetch()}>
            {t`Retry fetch`}
          </RetroButton>
        </RetroPanel>
      )}

      {/* Empty state — success but zero records */}
      {workspaceId && query.isSuccess && query.data.items.length === 0 && (
        <RetroPanel>
          <h2 className="text-[20px] font-semibold uppercase text-retro-charcoal">
            {t`No data returned`}
          </h2>
          <p className="text-retro-charcoal mt-sm">
            {t`The endpoint responded successfully but returned zero records. Create a record in the backend, then retry.`}
          </p>
        </RetroPanel>
      )}

      {/* Success state — data received */}
      {workspaceId && query.isSuccess && query.data.items.length > 0 && (
        <RetroPanel>
          <h2 className="text-[20px] font-semibold uppercase text-retro-charcoal">
            {t`Data loaded`}
          </h2>
          <ul className="font-mono text-retro-charcoal mt-md flex flex-col gap-xs">
            {query.data.items.map((item) => (
              <li
                key={item.id}
                className="border-retro-thick border-retro-charcoal p-sm"
              >
                {item.name}{" "}
                <span className="opacity-60">({item.id})</span>
              </li>
            ))}
          </ul>
        </RetroPanel>
      )}
    </div>
  );
}
