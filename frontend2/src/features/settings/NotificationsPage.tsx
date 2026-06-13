import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api/settings";
import type { User } from "@/lib/types";
import {
  BevelButton,
  RetroCheckbox,
  Window,
  retroToast,
} from "@/components/retro";

// Phase 12 Plan 04 — SETT-07. Notification preferences over the free-form
// notification_preferences map[string]bool. Two contracts to honor:
//  - Opt-out default: an ABSENT key reads as ON (matches the job-side
//    prefEnabled default-true behavior).
//  - Wholesale replace (Pitfall 2): save sends the FULL five-key map, never a
//    partial — the backend replaces the map outright.
// RetroCheckbox is the contract (there is NO toggle atom).

// The five keys verified against backend jobs + the SSE notification_type enum
// (UI-SPEC §7). Order = display order.
const NOTIFICATION_KEYS = [
  "loan_alerts",
  "expiry_alerts",
  "maintenance_alerts",
  "low_stock",
  "workspace_activity",
] as const;

type NotificationKey = (typeof NOTIFICATION_KEYS)[number];
type PrefMap = Record<NotificationKey, boolean>;

function buildState(prefs: Record<string, boolean> | undefined): PrefMap {
  // Opt-out: absent key → true.
  return NOTIFICATION_KEYS.reduce((acc, key) => {
    acc[key] = prefs?.[key] ?? true;
    return acc;
  }, {} as PrefMap);
}

export function NotificationsPage() {
  const { t } = useLingui();
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => settingsApi.getMe(),
  });

  const [state, setState] = useState<PrefMap>(() =>
    buildState(me.data?.notification_preferences),
  );

  // Re-baseline local checkbox state once ME resolves (the initial render runs
  // before the query has data).
  useEffect(() => {
    if (me.data) setState(buildState(me.data.notification_preferences));
  }, [me.data]);

  const mutation = useMutation({
    mutationFn: (fullMap: PrefMap) =>
      // Send the WHOLE map — wholesale replace (Pitfall 2).
      settingsApi.updatePreferences({ notification_preferences: fullMap }),
    onSuccess: (_user: User) => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      retroToast.success(t`Notification settings saved.`);
    },
  });

  const toggle = (key: NotificationKey) =>
    setState((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <Window
      title={<Trans>Notifications</Trans>}
      bodyClassName="grid gap-sp-4 p-sp-4"
    >
      <p className="text-[14px] text-fg-ink">
        <Trans>Email & in-app alerts for:</Trans>
      </p>

      <div className="grid gap-sp-3">
        <RetroCheckbox
          checked={state.loan_alerts}
          onChange={() => toggle("loan_alerts")}
          label={
            <span>
              <span className="font-bold">
                <Trans>Loan reminders</Trans>
              </span>{" "}
              <span className="text-fg-muted">
                <Trans>(due soon, overdue)</Trans>
              </span>
            </span>
          }
        />
        <RetroCheckbox
          checked={state.expiry_alerts}
          onChange={() => toggle("expiry_alerts")}
          label={
            <span>
              <span className="font-bold">
                <Trans>Expiry alerts</Trans>
              </span>{" "}
              <span className="text-fg-muted">
                <Trans>(items expiring)</Trans>
              </span>
            </span>
          }
        />
        <RetroCheckbox
          checked={state.maintenance_alerts}
          onChange={() => toggle("maintenance_alerts")}
          label={
            <span>
              <span className="font-bold">
                <Trans>Maintenance alerts</Trans>
              </span>{" "}
              <span className="text-fg-muted">
                <Trans>(service due)</Trans>
              </span>
            </span>
          }
        />
        <RetroCheckbox
          checked={state.low_stock}
          onChange={() => toggle("low_stock")}
          label={
            <span className="font-bold">
              <Trans>Low stock</Trans>
            </span>
          }
        />
        <RetroCheckbox
          checked={state.workspace_activity}
          onChange={() => toggle("workspace_activity")}
          label={
            <span>
              <span className="font-bold">
                <Trans>Workspace activity</Trans>
              </span>{" "}
              <span className="text-fg-muted">
                <Trans>(invites, joins)</Trans>
              </span>
            </span>
          }
        />
      </div>

      <div className="flex justify-end">
        <BevelButton
          type="button"
          variant="primary"
          disabled={me.isPending || mutation.isPending}
          onClick={() => mutation.mutate(state)}
        >
          <Trans>Save changes</Trans>
        </BevelButton>
      </div>
    </Window>
  );
}
