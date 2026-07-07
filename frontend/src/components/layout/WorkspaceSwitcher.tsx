import { useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { PixelIcon, Popover, retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// WorkspaceSwitcher (AUTH-06): the live TopBar pill. Replaces the Phase 3
// disabled placeholder. Reads the D-12 SSOT via useWorkspace(); the pill is a
// <button> trigger (aria-haspopup="listbox") that opens a chromeless Phase 4
// Popover listbox of workspaces. Selecting a non-current workspace switches
// context (persists + invalidates entity caches) and fires a mint toast.
//
// States (UI-SPEC §4):
//   - loading  → aria-busy skeleton label, non-expanding
//   - single   → renders the name, aria-disabled, no ▾ (nothing to switch to)
//   - zero      → trigger disabled; popover (if forced) shows the empty row
//   - multi    → full listbox switcher
//
// ESC closes via useModalStack (the Popover owns it — LOCKED; never logs out).

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2";

const PILL_BASE =
  "hidden select-none items-center gap-sp-1 border-2 border-border-ink bg-bg-panel-2 px-sp-2 py-[2px] text-13 font-semibold sm:inline-flex";

export function WorkspaceSwitcher() {
  const { t } = useLingui();
  const { currentWorkspaceId, setWorkspace, workspaces, isLoading } =
    useWorkspace();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  // Loading: the probe is in flight — skeleton label, non-interactive.
  if (isLoading) {
    return (
      <span
        data-testid="workspace-pill"
        aria-busy="true"
        aria-disabled="true"
        className={`${PILL_BASE} cursor-default text-fg-faint opacity-70`}
      >
        <Trans>Loading workspaces…</Trans>
      </span>
    );
  }

  const list = workspaces ?? [];
  const current = list.find((w) => w.id === currentWorkspaceId);
  const label = current?.name ?? t`Workspace`;

  // Single workspace: render the name but non-expanding (nothing to switch to).
  if (list.length === 1) {
    return (
      <span
        data-testid="workspace-pill"
        aria-disabled="true"
        title={list[0].name}
        className={`${PILL_BASE} cursor-default`}
      >
        {list[0].name}
      </span>
    );
  }

  function handleSelect(id: string, name: string) {
    setOpen(false);
    if (id === currentWorkspaceId) return;
    setWorkspace(id);
    retroToast.success(t`Switched to ${name}.`);
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        data-testid="workspace-pill"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${PILL_BASE} bevel-raised-ink active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed ${FOCUS_RING}`}
      >
        <span className="max-w-[160px] truncate">{label}</span>
        <PixelIcon name="chevron-down" />
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        role="listbox"
        minWidth={220}
      >
        <p className="px-sp-3 py-[4px] text-10 font-bold uppercase tracking-14 text-fg-muted">
          <Trans>Workspaces</Trans>
        </p>

        {list.length === 0 ? (
          <div
            // Informational empty-state row — not a selectable option, so it
            // carries no listbox option semantics (avoids a non-focusable
            // interactive role inside the listbox).
            className="px-sp-3 py-sp-2 text-13 text-fg-muted"
          >
            <Trans>No workspaces. Contact an owner.</Trans>
          </div>
        ) : (
          list.map((w) => {
            const isCurrent = w.id === currentWorkspaceId;
            return (
              <button
                key={w.id}
                type="button"
                role="option"
                aria-selected={isCurrent}
                aria-current={isCurrent ? "true" : undefined}
                onClick={() => handleSelect(w.id, w.name)}
                className={`flex w-full items-center justify-between gap-sp-3 px-sp-3 py-sp-2 text-left text-14 min-h-[44px] hover:bg-titlebar-blue focus-visible:bg-titlebar-blue ${FOCUS_RING} ${
                  isCurrent ? "bg-titlebar-blue font-semibold" : ""
                }`}
              >
                <span className="truncate">{w.name}</span>
                {isCurrent && <span aria-hidden="true">✓</span>}
              </button>
            );
          })
        )}
      </Popover>
    </>
  );
}
