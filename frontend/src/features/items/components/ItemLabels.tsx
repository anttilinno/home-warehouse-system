import { useMemo, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BevelButton,
  PixelIcon,
  RetroBadge,
  RetroCheckbox,
  retroToast,
} from "@/components/retro";
import { Popover } from "@/components/retro/overlay";
import type { Label } from "@/lib/types";
import { labelsApi } from "@/lib/api/labels";

// Phase 7 Plan 06 — read-only label attach/detach row (UI-SPEC §2 DETAILS tab).
// Chips of attached labels each carry a ✕ detach; ⊕ ADD LABEL opens a checklist
// popover of EXISTING workspace labels (attach). Label creation/management is
// Phase 10 — this row only attaches/detaches existing labels.

export interface ItemLabelsProps {
  wsId: string;
  itemId: string;
}

export function ItemLabels({ wsId, itemId }: Readonly<ItemLabelsProps>) {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const labelIdsKey = ["items", wsId, "labels", itemId];

  const attachedQuery = useQuery({
    queryKey: labelIdsKey,
    queryFn: () => labelsApi.getItemLabelIds(wsId, itemId),
    enabled: Boolean(wsId) && Boolean(itemId),
  });

  const workspaceLabelsQuery = useQuery({
    queryKey: ["labels", wsId],
    queryFn: () => labelsApi.listWorkspaceLabels(wsId),
    enabled: Boolean(wsId),
  });

  const attachedIds = useMemo(
    () => attachedQuery.data ?? [],
    [attachedQuery.data],
  );
  const workspaceLabels = useMemo<Label[]>(
    () => workspaceLabelsQuery.data ?? [],
    [workspaceLabelsQuery.data],
  );

  const labelById = useMemo(() => {
    const map = new Map<string, Label>();
    for (const l of workspaceLabels) map.set(l.id, l);
    return map;
  }, [workspaceLabels]);

  function invalidateAttached() {
    queryClient.invalidateQueries({ queryKey: labelIdsKey });
  }

  const attach = useMutation({
    mutationFn: (labelId: string) => labelsApi.attach(wsId, itemId, labelId),
    onSuccess: invalidateAttached,
    onError: () => retroToast.error(t`Couldn't attach that label.`),
  });
  const detach = useMutation({
    mutationFn: (labelId: string) => labelsApi.detach(wsId, itemId, labelId),
    onSuccess: invalidateAttached,
    onError: () => retroToast.error(t`Couldn't detach that label.`),
  });
  const attachLabel = attach.mutate;
  const detachLabel = detach.mutate;

  const attachedSet = useMemo(() => new Set(attachedIds), [attachedIds]);

  function toggle(labelId: string, checked: boolean) {
    if (checked) attachLabel(labelId);
    else detachLabel(labelId);
  }

  return (
    <div className="flex flex-wrap items-center gap-sp-1">
      {attachedIds.map((id) => {
        const label = labelById.get(id);
        return (
          <RetroBadge key={id} variant="neutral">
            {label?.name ?? id}
            <button
              type="button"
              aria-label={t`Detach ${label?.name ?? id}`}
              title={t`Detach ${label?.name ?? id}`}
              onClick={() => detachLabel(id)}
              className="cursor-pointer text-fg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
            >
              ✕
            </button>
          </RetroBadge>
        );
      })}

      <BevelButton
        ref={triggerRef}
        variant="neutral"
        aria-haspopup="menu"
        aria-expanded={open}
        className="!px-[8px] !py-[2px] !text-11"
        onClick={() => setOpen((o) => !o)}
      >
        <PixelIcon name="plus" size={16} /> <Trans>ADD LABEL</Trans>
      </BevelButton>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        role="menu"
        minWidth={220}
      >
        <div className="flex flex-col gap-sp-1 px-sp-2 py-sp-1">
          {workspaceLabels.length === 0 ? (
            <p className="px-sp-1 py-sp-1 text-12 text-fg-muted">
              <Trans>No labels yet — manage labels in Phase 10.</Trans>
            </p>
          ) : (
            workspaceLabels.map((label) => (
              <RetroCheckbox
                key={label.id}
                label={label.name}
                checked={attachedSet.has(label.id)}
                onChange={(e) => toggle(label.id, e.target.checked)}
              />
            ))
          )}
        </div>
      </Popover>
    </div>
  );
}
