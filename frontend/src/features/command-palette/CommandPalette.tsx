import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
  CommandEmpty,
  CommandLoading,
} from "cmdk";
import { Trans, useLingui } from "@lingui/react/macro";
import { useNavigate } from "react-router";
import { useModalStack } from "@/components/modal";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { paletteRoutes } from "./paletteRoutes";
import { useEntitySearch, type EntityHit } from "./useEntitySearch";
import { addRecent, getRecent, type RecentKind } from "./recentActions";

// TUI-05 + §4 — the cmdk palette body (React.lazy target; 16-03 mounts it inside
// ShellChrome). Default-exported via index.ts.
//
// cmdk runs in fully-controlled mode (shouldFilter={false} + controlled value/
// onValueChange) so async entity rows are never double-filtered/hidden. The
// static groups (Routes/Workspaces/Recent) are client substring-filtered here;
// the entity groups arrive PRE-filtered from the server. Item `value`s are stable
// id-based strings (`route:…`/`workspace:…`/`item:…`) — NOT display text — so async
// arrivals don't reset cmdk's selection (Pitfall 3). `value` is reset only on
// QUERY change (a fresh result set re-selects its first row), not per fetch-settle.
//
// ESC flows through the shared capture-phase useModalStack (TUI-02) — NO custom
// document keydown. Every selection records the row in the localStorage MRU, then
// navigates / setWorkspace, then closes. Retro-os chrome: own scrim + pinstriped
// powder-blue title bar, Silkscreen heading, IBM Plex body (sketches 006-008).

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

function matches(label: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return label.toLowerCase().includes(q);
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { workspaces, setWorkspace } = useWorkspace();

  // cmdk controlled state: `value` = selected item, `query` = search input.
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");

  // ESC pops this overlay via the shared modal stack (never a custom listener).
  useModalStack(open, onClose);

  // Reset the selected row only when the QUERY changes (so a fresh result set
  // re-selects its first row) — NOT on every fetch settle (Pitfall 3).
  // biome-ignore lint/correctness/useExhaustiveDependencies: query is the intentional re-run trigger (reset selection on query change), not read in the body.
  useEffect(() => {
    setValue("");
  }, [query]);

  // Restore invoker focus on close (cmdk autofocuses its input on open).
  const invokerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      invokerRef.current = document.activeElement as HTMLElement | null;
    } else {
      invokerRef.current?.focus?.();
    }
  }, [open]);

  const entities = useEntitySearch(query);

  // Snapshot the MRU once per open so a selection write doesn't re-order the
  // visible list mid-interaction.
  const recent = open ? getRecent() : [];

  const run = useCallback(
    (
      entry: {
        id: string;
        kind: RecentKind;
        label: string;
        to?: string;
      },
      go: () => void,
    ) => {
      addRecent(entry);
      go();
      onClose();
    },
    [onClose],
  );

  if (!open) return null;

  const renderEntityGroup = (
    heading: ReactNode,
    kind: Exclude<RecentKind, "route" | "workspace">,
    rows: EntityHit[],
    toFor: (hit: EntityHit) => string,
  ) => {
    if (rows.length === 0) return null;
    return (
      <CommandGroup
        heading={heading}
        className="px-sp-2 py-sp-1 text-11 font-semibold uppercase tracking-wide text-fg-muted"
      >
        {rows.map((hit) => (
          <CommandItem
            key={hit.id}
            value={`${kind}:${hit.id}`}
            onSelect={() =>
              run({ id: hit.id, kind, label: hit.name, to: toFor(hit) }, () =>
                navigate(toFor(hit)),
              )
            }
            className="cursor-pointer px-sp-3 py-sp-2 font-body text-14 text-fg-ink data-[selected=true]:bg-titlebar-blue data-[selected=true]:text-fg-ink"
          >
            {hit.name}
          </CommandItem>
        ))}
      </CommandGroup>
    );
  };

  return (
    // Full-screen retro scrim; clicking it closes the palette.
    // biome-ignore lint/a11y/noStaticElementInteractions: presentational backdrop; click-to-close is a mouse convenience
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users close via ESC (handled by the modal stack)
    <div
      data-testid="command-palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-fg-ink/40 p-sp-6 pt-[12vh]"
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: mouse-only guard so backdrop click-to-close ignores clicks inside the dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t`Command palette`}
        className="w-full max-w-[640px] border-2 border-border-ink bg-bg-panel shadow-hard-ink"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pinstriped powder-blue title bar (System 7), Silkscreen heading. */}
        <div className="flex items-center justify-between border-b-2 border-border-ink bg-titlebar-blue px-sp-3 py-sp-2">
          <span className="font-display text-16 uppercase text-fg-ink">
            <Trans>Command Palette</Trans>
          </span>
          <button
            type="button"
            aria-label={t`Close`}
            title={t`Close`}
            onClick={onClose}
            className="flex h-[14px] w-[14px] flex-none cursor-pointer items-center justify-center border-2 border-border-ink bg-bg-panel text-10 leading-none"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <Command
          shouldFilter={false}
          loop
          value={value}
          onValueChange={setValue}
          className="font-body"
        >
          <div className="border-b-2 border-border-ink bg-bg-panel-2 px-sp-3 py-sp-2">
            <CommandInput
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={t`Search routes, workspaces, items…`}
              className="w-full border-2 border-border-ink bg-bg-panel px-sp-2 py-sp-1 font-body text-14 text-fg-ink shadow-[inset_1px_1px_var(--color-bevel-shade)] outline-none placeholder:text-fg-faint"
            />
          </div>

          <CommandList className="max-h-[50vh] overflow-y-auto px-sp-1 py-sp-2">
            <CommandEmpty className="px-sp-3 py-sp-3 font-body text-14 text-fg-muted">
              <Trans>No results.</Trans>
            </CommandEmpty>

            {/* Routes — static, client substring-filtered. */}
            <CommandGroup
              heading={t`Routes`}
              className="px-sp-2 py-sp-1 text-11 font-semibold uppercase tracking-wide text-fg-muted"
            >
              {paletteRoutes
                .filter((r) => matches(t(r.label), query))
                .map((r) => {
                  const label = t(r.label);
                  return (
                    <CommandItem
                      key={r.to}
                      value={`route:${r.to}`}
                      onSelect={() =>
                        run({ id: r.to, kind: "route", label, to: r.to }, () =>
                          navigate(r.to),
                        )
                      }
                      className="cursor-pointer px-sp-3 py-sp-2 font-body text-14 text-fg-ink data-[selected=true]:bg-titlebar-blue data-[selected=true]:text-fg-ink"
                    >
                      {label}
                    </CommandItem>
                  );
                })}
            </CommandGroup>

            {/* Workspaces — client-filtered; select switches the workspace. */}
            <CommandGroup
              heading={t`Workspaces`}
              className="px-sp-2 py-sp-1 text-11 font-semibold uppercase tracking-wide text-fg-muted"
            >
              {(workspaces ?? [])
                .filter((ws) => matches(ws.name, query))
                .map((ws) => (
                  <CommandItem
                    key={ws.id}
                    value={`workspace:${ws.id}`}
                    onSelect={() =>
                      run(
                        { id: ws.id, kind: "workspace", label: ws.name },
                        () => setWorkspace(ws.id),
                      )
                    }
                    className="cursor-pointer px-sp-3 py-sp-2 font-body text-14 text-fg-ink data-[selected=true]:bg-titlebar-blue data-[selected=true]:text-fg-ink"
                  >
                    {ws.name}
                  </CommandItem>
                ))}
            </CommandGroup>

            {/* Recent — localStorage MRU, client-filtered. */}
            {recent.length > 0 && (
              <CommandGroup
                heading={t`Recent`}
                className="px-sp-2 py-sp-1 text-11 font-semibold uppercase tracking-wide text-fg-muted"
              >
                {recent
                  .filter((entry) => matches(entry.label, query))
                  .map((entry) => (
                    <CommandItem
                      key={`recent:${entry.id}`}
                      value={`recent:${entry.id}`}
                      onSelect={() =>
                        run(entry, () => {
                          if (entry.kind === "workspace") {
                            setWorkspace(entry.id);
                          } else if (entry.to) {
                            navigate(entry.to);
                          }
                        })
                      }
                      className="cursor-pointer px-sp-3 py-sp-2 font-body text-14 text-fg-ink data-[selected=true]:bg-titlebar-blue data-[selected=true]:text-fg-ink"
                    >
                      {entry.label}
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}

            {/* Live entity search — already filtered by the server. */}
            {entities.isFetching && (
              <CommandLoading className="px-sp-3 py-sp-2 font-body text-14 text-fg-muted">
                <Trans>Searching…</Trans>
              </CommandLoading>
            )}
            {renderEntityGroup(
              t`Items`,
              "item",
              entities.items,
              (hit) => `/items/${hit.id}`,
            )}
            {renderEntityGroup(
              t`Borrowers`,
              "borrower",
              entities.borrowers,
              (hit) => `/borrowers/${hit.id}`,
            )}
            {renderEntityGroup(
              t`Locations`,
              "location",
              entities.locations,
              () => `/taxonomy?tab=locations`,
            )}
            {renderEntityGroup(
              t`Containers`,
              "container",
              entities.containers,
              () => `/taxonomy?tab=containers`,
            )}
          </CommandList>
        </Command>
      </div>
    </div>
  );
}
