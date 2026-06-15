import { useMemo, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Window,
  BevelButton,
  // overlay
  RetroDialog,
  RetroConfirmDialog,
  Popover,
  // form
  RetroFormField,
  RetroSelect,
  RetroCombobox,
  RetroTextarea,
  RetroCheckbox,
  RetroFileInput,
  // feedback
  RetroToaster,
  retroToast,
  RetroStatusDot,
  StatusPill,
  RetroEmptyState,
  // data
  RetroTable,
  useTableSelection,
  RetroPagination,
  RetroTabs,
  // filters
  FilterBar,
  FilterPopover,
  BulkActionBar,
  SavedFilters,
  type TitlebarVariant,
} from "@/components/retro";
import { useShortcuts } from "@/components/shortcuts";

// The /demo review surface (Success Criterion 1): one Window section per atom
// family, rendered INSIDE the AppShell so the live Phase 3 modal-stack +
// shortcuts providers are available (the escStack integration test exercises the
// real stack; this page proves the composition end-to-end). The route is
// DEV-gated in routes/index.tsx (and its Sidebar link in Sidebar.tsx) so it
// never ships as a user route. All atoms import through the single
// @/components/retro barrel.

// A muted caption naming an atom and its key states beneath each demo cell.
function Caption({ children }: { children: React.ReactNode }) {
  return <p className="text-14 text-fg-muted">{children}</p>;
}

// A family section: a Window with the family's semantic titlebar mood, body
// content stacked at the within-section rhythm.
function Section({
  title,
  titlebarVariant,
  children,
}: {
  title: React.ReactNode;
  titlebarVariant: TitlebarVariant;
  children: React.ReactNode;
}) {
  return (
    <Window title={title} titlebarVariant={titlebarVariant}>
      <div className="flex flex-col gap-sp-4">{children}</div>
    </Window>
  );
}

interface DemoRow {
  id: string;
  name: string;
  qty: number;
}

const DEMO_ROWS: DemoRow[] = [
  { id: "r1", name: "Cordless drill", qty: 3 },
  { id: "r2", name: "Socket set", qty: 12 },
  { id: "r3", name: "Tape measure", qty: 7 },
  { id: "r4", name: "Spirit level", qty: 2 },
  { id: "r5", name: "Stud finder", qty: 1 },
];

export function DemoPage() {
  const { t } = useLingui();

  // ---- FORM state ----
  const [selectValue, setSelectValue] = useState("");
  const [comboValue, setComboValue] = useState("");
  const [textareaValue, setTextareaValue] = useState("");
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  // ---- OVERLAY state ----
  const [dialogVariant, setDialogVariant] = useState<TitlebarVariant | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLButtonElement>(null);

  // ---- FILTER state ----
  const [search, setSearch] = useState("");
  const [categorySel, setCategorySel] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("overview");

  // ---- DATA selection (drives the Bottombar bulk-action chips) ----
  const selection = useTableSelection(DEMO_ROWS);
  const selectedCount = selection.selected.size;
  // `clear` is a stable useCallback from the hook; pull it out so the memo below
  // depends only on stable references (NOT the whole `selection` object, which
  // is a fresh object every render — depending on it would re-run the memo +
  // re-register every render and churn the registry into an infinite loop).
  const clearSelection = selection.clear;

  // Success Criterion 5: register a bulk-action group into the shortcuts SSOT
  // whenever the table selection is non-empty. The Phase 3 Bottombar reads the
  // same SSOT, so these surface as desktop key-cap chips; clearing the selection
  // unregisters the group (empty array → nothing registered → no chips).
  // Pitfall 3: memoize the bindings (stable deps only) so the register effect
  // does not churn.
  const bulkActions = useMemo(
    () =>
      selectedCount > 0
        ? [
            {
              key: "X",
              label: `Delete ${selectedCount} selected`,
              action: clearSelection,
              danger: true,
            },
            {
              key: "M",
              label: `Move ${selectedCount} selected`,
              action: () => {},
            },
          ]
        : [],
    [selectedCount, clearSelection],
  );
  useShortcuts("bulk-actions", bulkActions);

  const allSelected =
    selectedCount === DEMO_ROWS.length && DEMO_ROWS.length > 0;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <div className="flex flex-col gap-sp-6">
      {/* Local Toaster mount so toast launchers render here (AppShell mounts its
          own in Phase 6; for the demo this is self-contained). */}
      <RetroToaster />

      <header className="flex flex-col gap-sp-1">
        <h1 className="font-display text-16 uppercase text-fg-ink">
          <Trans>Atom Demo</Trans>
        </h1>
        <Caption>
          <Trans>
            Every Phase 4 retro-os atom family, for visual review against
            sketches 006-008.
          </Trans>
        </Caption>
      </header>

      {/* ===================== FORM ATOMS ===================== */}
      <Section title={<Trans>Form Atoms</Trans>} titlebarVariant="blue">
        <RetroSelect
          label={<Trans>Category</Trans>}
          value={selectValue}
          onChange={(e) => setSelectValue(e.target.value)}
        >
          <option value="">{t`Select…`}</option>
          <option value="tools">Tools</option>
          <option value="hardware">Hardware</option>
          <option value="consumables">Consumables</option>
        </RetroSelect>
        <Caption>
          <Trans>RetroSelect — skinned native select.</Trans>
        </Caption>

        <RetroCombobox
          label={<Trans>Location</Trans>}
          value={comboValue}
          onChange={setComboValue}
          options={[
            { value: "shelf-a", label: "Shelf A" },
            { value: "shelf-b", label: "Shelf B" },
            { value: "garage", label: "Garage" },
          ]}
        />
        <Caption>
          <Trans>RetroCombobox — editable, keyboard-driven listbox.</Trans>
        </Caption>

        <RetroTextarea
          label={<Trans>Notes</Trans>}
          value={textareaValue}
          onChange={(e) => setTextareaValue(e.target.value)}
        />
        <Caption>
          <Trans>RetroTextarea — sunken multi-line field.</Trans>
        </Caption>

        <div className="flex flex-col gap-sp-2">
          <RetroCheckbox
            label={<Trans>Checked / unchecked</Trans>}
            checked={checkboxChecked}
            onChange={(e) => setCheckboxChecked(e.target.checked)}
          />
          <RetroCheckbox
            label={<Trans>Indeterminate (partial)</Trans>}
            indeterminate
          />
          <RetroCheckbox label={<Trans>Disabled</Trans>} disabled />
        </div>
        <Caption>
          <Trans>RetroCheckbox — all three states.</Trans>
        </Caption>

        <RetroFileInput
          label={<Trans>Attachments</Trans>}
          onChange={() => {}}
          multiple
        />
        <Caption>
          <Trans>RetroFileInput — click + drag-drop drop zone.</Trans>
        </Caption>

        <RetroFormField
          label={<Trans>With hint</Trans>}
          hint={t`A helpful hint.`}
        >
          {(id, describedBy) => (
            <input
              id={id}
              aria-describedby={describedBy}
              className="border-2 border-border-ink bg-bg-panel bevel-sunken px-[10px] py-[7px] text-14"
            />
          )}
        </RetroFormField>
        <RetroFormField
          label={<Trans>With error</Trans>}
          error={t`This field is required.`}
          required
        >
          {(id, describedBy) => (
            <input
              id={id}
              aria-describedby={describedBy}
              aria-invalid="true"
              className="border-2 border-danger bg-danger-bg px-[10px] py-[7px] text-14"
            />
          )}
        </RetroFormField>
        <Caption>
          <Trans>RetroFormField — default / hint / error.</Trans>
        </Caption>
      </Section>

      {/* ===================== OVERLAY ATOMS ===================== */}
      <Section title={<Trans>Overlay Atoms</Trans>} titlebarVariant="blue">
        <div className="flex flex-wrap gap-sp-2">
          <BevelButton onClick={() => setDialogVariant("blue")}>
            <Trans>Dialog (info)</Trans>
          </BevelButton>
          <BevelButton onClick={() => setDialogVariant("mint")}>
            <Trans>Dialog (success)</Trans>
          </BevelButton>
          <BevelButton onClick={() => setDialogVariant("butter")}>
            <Trans>Dialog (warning)</Trans>
          </BevelButton>
          <BevelButton onClick={() => setConfirmOpen(true)}>
            <Trans>Confirm dialog</Trans>
          </BevelButton>
          <BevelButton
            ref={menuAnchorRef}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Trans>Menu ▾</Trans>
          </BevelButton>
        </div>
        <Caption>
          <Trans>
            RetroDialog (each titlebar variant), RetroConfirmDialog,
            Menu/Popover.
          </Trans>
        </Caption>

        <RetroDialog
          open={dialogVariant !== null}
          onClose={() => setDialogVariant(null)}
          title={<Trans>Example Dialog</Trans>}
          titlebarVariant={dialogVariant ?? "blue"}
          footer={
            <BevelButton onClick={() => setDialogVariant(null)}>
              <Trans>Close</Trans>
            </BevelButton>
          }
        >
          <p className="text-14">
            <Trans>
              A centered-modal retro-os Window. ESC pops it via the modal stack.
            </Trans>
          </p>
        </RetroDialog>

        <RetroConfirmDialog
          open={confirmOpen}
          title={<Trans>Delete item?</Trans>}
          confirmLabel={<Trans>Delete</Trans>}
          onConfirm={() => setConfirmOpen(false)}
          onCancel={() => setConfirmOpen(false)}
          onClose={() => setConfirmOpen(false)}
        >
          <Trans>This can&rsquo;t be undone.</Trans>
        </RetroConfirmDialog>

        <Popover
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          anchorRef={menuAnchorRef}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="flex items-center gap-sp-2 px-sp-2 py-[6px] text-14 text-fg-ink hover:bg-titlebar-blue"
            onClick={() => setMenuOpen(false)}
          >
            <Trans>Edit</Trans>
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex items-center gap-sp-2 px-sp-2 py-[6px] text-14 text-danger hover:bg-danger-bg"
            onClick={() => setMenuOpen(false)}
          >
            <Trans>Delete</Trans>
          </button>
        </Popover>
      </Section>

      {/* ===================== FEEDBACK ATOMS ===================== */}
      <Section title={<Trans>Feedback Atoms</Trans>} titlebarVariant="mint">
        <div className="flex flex-wrap gap-sp-2">
          <BevelButton onClick={() => retroToast.success(t`Saved.`)}>
            <Trans>Toast: success</Trans>
          </BevelButton>
          <BevelButton onClick={() => retroToast.info(t`Heads up.`)}>
            <Trans>Toast: info</Trans>
          </BevelButton>
          <BevelButton onClick={() => retroToast.warning(t`Careful.`)}>
            <Trans>Toast: warning</Trans>
          </BevelButton>
          <BevelButton onClick={() => retroToast.error(t`Something failed.`)}>
            <Trans>Toast: error</Trans>
          </BevelButton>
        </div>
        <Caption>
          <Trans>
            retroToast — all four types (error never auto-dismisses).
          </Trans>
        </Caption>

        <div className="flex flex-wrap items-center gap-sp-4">
          <RetroStatusDot state="live" />
          <RetroStatusDot state="idle" />
          <RetroStatusDot state="error" />
        </div>
        <Caption>
          <Trans>RetroStatusDot — live (blinks) / idle / error.</Trans>
        </Caption>

        <div className="flex flex-wrap gap-sp-2">
          <StatusPill variant="ok">OK</StatusPill>
          <StatusPill variant="warn">WARN</StatusPill>
          <StatusPill variant="info">INFO</StatusPill>
          <StatusPill variant="danger">DANGER</StatusPill>
        </div>
        <Caption>
          <Trans>StatusPill — OK / WARN / INFO / DANGER.</Trans>
        </Caption>

        <RetroEmptyState
          heading={<Trans>Nothing here yet</Trans>}
          body={
            <Trans>
              This list is empty. Add your first item to get started.
            </Trans>
          }
        />
        <RetroEmptyState
          eyebrow={<Trans>Filtered</Trans>}
          heading={<Trans>No matches</Trans>}
          body={
            <Trans>
              No items match these filters. Clear a filter or adjust your
              search.
            </Trans>
          }
        />
        <Caption>
          <Trans>RetroEmptyState — no-data and filtered variants.</Trans>
        </Caption>
      </Section>

      {/* ===================== DATA ATOMS ===================== */}
      <Section title={<Trans>Data Atoms</Trans>} titlebarVariant="mint">
        <RetroTable>
          <thead>
            <tr>
              <th>
                <RetroCheckbox
                  label=""
                  aria-label={t`Select all rows`}
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={() =>
                    allSelected
                      ? selection.clear()
                      : DEMO_ROWS.forEach((r) => {
                          selection.onRowClick(r.id, {
                            metaKey: true,
                            ctrlKey: false,
                            shiftKey: false,
                          });
                        })
                  }
                />
              </th>
              <th>{t`Item`}</th>
              <th className="text-right">{t`Qty`}</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_ROWS.map((row) => (
              <tr
                key={row.id}
                aria-selected={selection.selected.has(row.id)}
                onClick={(e) => selection.onRowClick(row.id, e)}
              >
                <td>
                  <RetroCheckbox
                    label=""
                    aria-label={row.name}
                    checked={selection.selected.has(row.id)}
                    onChange={() =>
                      selection.onRowClick(row.id, {
                        metaKey: true,
                        ctrlKey: false,
                        shiftKey: false,
                      })
                    }
                  />
                </td>
                <td>{row.name}</td>
                <td className="mono text-right">{row.qty}</td>
              </tr>
            ))}
          </tbody>
        </RetroTable>
        <Caption>
          <Trans>
            RetroTable + useTableSelection — click, Shift+Click range, header
            select-all (indeterminate dash on partial). Select rows to surface
            bulk-action chips in the Bottombar.
          </Trans>
        </Caption>

        <RetroPagination
          page={page}
          pageCount={5}
          perPage={20}
          onPageChange={setPage}
        />
        <Caption>
          <Trans>
            RetroPagination — beveled pager with current-page accent.
          </Trans>
        </Caption>

        <RetroTabs
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            {
              id: "overview",
              label: "Overview",
              content: (
                <p className="text-14">
                  <Trans>Overview tab panel.</Trans>
                </p>
              ),
            },
            {
              id: "history",
              label: "History",
              content: (
                <p className="text-14">
                  <Trans>History tab panel.</Trans>
                </p>
              ),
            },
            {
              id: "archived",
              label: "Archived",
              content: null,
              disabled: true,
            },
          ]}
        />
        <Caption>
          <Trans>RetroTabs — folder-tab control with roving tabindex.</Trans>
        </Caption>
      </Section>

      {/* ===================== FILTER ATOMS ===================== */}
      <Section title={<Trans>Filter Atoms</Trans>} titlebarVariant="butter">
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          facets={[
            {
              key: "category",
              label: "Category",
              trigger: (
                <FilterPopover
                  label="Category"
                  options={[
                    { value: "tools", label: "Tools" },
                    { value: "hardware", label: "Hardware" },
                  ]}
                  selected={categorySel}
                  onChange={setCategorySel}
                />
              ),
            },
          ]}
          itemCount={DEMO_ROWS.length}
          filterChips={categorySel.map((c) => ({
            key: c,
            label: "Category",
            displayValue: c,
          }))}
          onRemoveFilter={(key) =>
            setCategorySel((prev) => prev.filter((c) => c !== key))
          }
          onClearAll={() => setCategorySel([])}
          primaryAction={
            <BevelButton variant="primary">
              <Trans>+ Add item</Trans>
            </BevelButton>
          }
        />
        <Caption>
          <Trans>
            FilterBar + FilterPopover — search, facets, chips, count, CTA.
          </Trans>
        </Caption>

        <BulkActionBar
          selectedCount={selectedCount}
          onClear={() => selection.clear()}
          destructiveAction={{
            label: <Trans>Delete</Trans>,
            confirmTitle: <Trans>Delete selected?</Trans>,
            confirmBody: <Trans>This can&rsquo;t be undone.</Trans>,
            onConfirm: () => selection.clear(),
          }}
        >
          <BevelButton>
            <Trans>Move</Trans>
          </BevelButton>
        </BulkActionBar>
        <Caption>
          <Trans>
            BulkActionBar — inline mobile selection surface (destructive routes
            through a confirm dialog).
          </Trans>
        </Caption>

        <SavedFilters
          savedFilters={[
            {
              id: "low-stock",
              name: "Low stock",
              filters: {},
              createdAt: "2026-06-13T00:00:00.000Z",
            },
            {
              id: "on-loan",
              name: "On loan",
              filters: {},
              createdAt: "2026-06-13T00:00:00.000Z",
            },
          ]}
          onApply={() => {}}
          onDelete={() => {}}
          onSaveCurrent={() => {}}
        />
        <Caption>
          <Trans>SavedFilters — preset chips + ▾ PRESETS menu.</Trans>
        </Caption>
      </Section>
    </div>
  );
}
