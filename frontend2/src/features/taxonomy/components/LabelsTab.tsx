import { useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  RetroBadge,
  RetroEmptyState,
  RetroConfirmDialog,
} from "@/components/retro";
import type { Label } from "@/lib/types";
import { useLabelsQuery } from "../hooks/useLabelsQuery";
import { useLabelMutations } from "../hooks/useLabelMutations";
import { LabelFormDialog } from "./LabelFormDialog";

// Phase 10 Plan 04 — the Labels tab (TAX-07). FILLS the W2 LabelsTab STUB
// in-place; the export name `LabelsTab` is UNCHANGED (TaxonomyPage imports it).
// A flat CRUD list of workspace labels with the 8-swatch on-palette color
// picker. Consumes useLabelsQuery (BARE { items } — never .total) +
// useLabelMutations (PREFIX-invalidate ["labels", wsId]).
//
// Row anatomy (UI-SPEC §Label manager): [color swatch 16×16, 1px ink border —
// MANDATORY cue #3] [name 14px semibold] [optional muted description] … [EDIT][⌫].
// Archived rows: text-fg-muted + ARCHIVED badge + RESTORE (three-cue). Archive is
// the soft default; delete = plain pink RetroConfirmDialog (no-count copy — labels
// have no client attached-count fetch this phase).
//
// Render-loop guard: destructure the stable .mutate handlers; tRef pins `t`.

interface FormState {
  open: boolean;
  label: Label | null;
}

export function LabelsTab() {
  const { t } = useLingui();
  const tRef = useRef(t);
  tRef.current = t;

  const { rows, isLoading, isError, refetch } = useLabelsQuery();
  const { archive, restore, del } = useLabelMutations();
  const archiveLabel = archive.mutate;
  const restoreLabel = restore.mutate;
  const deleteLabel = del.mutate;

  const [form, setForm] = useState<FormState>({ open: false, label: null });
  const [deleteTarget, setDeleteTarget] = useState<Label | null>(null);

  const openCreate = () => setForm({ open: true, label: null });
  const openEdit = (label: Label) => setForm({ open: true, label });
  const closeForm = () => setForm({ open: false, label: null });

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteLabel({ id: deleteTarget.id, name: deleteTarget.name });
    setDeleteTarget(null);
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-sp-3">
        <p className="text-[14px] font-semibold text-danger">
          <Trans>COULDN'T LOAD LABELS</Trans>
        </p>
        <p className="text-[13px] text-fg-muted">
          <Trans>Something went wrong. Try again.</Trans>
        </p>
        <BevelButton onClick={() => refetch()}>
          <Trans>RETRY</Trans>
        </BevelButton>
      </div>
    );
  }

  if (isLoading) {
    return (
      <p className="font-mono text-[13px] text-fg-muted">
        <Trans>Loading…</Trans>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-sp-3">
      <div className="flex items-center">
        <BevelButton variant="mint" onClick={openCreate}>
          <Trans>⊕ ADD LABEL</Trans>
        </BevelButton>
      </div>

      {rows.length === 0 ? (
        <RetroEmptyState
          eyebrow={<Trans>Taxonomy</Trans>}
          glyph="◇"
          heading={<Trans>NO LABELS YET</Trans>}
          body={
            <Trans>
              Create a label to tag items across categories — like “Fragile” or
              “Loaned out”.
            </Trans>
          }
          action={{
            label: <Trans>⊕ ADD LABEL</Trans>,
            onClick: openCreate,
          }}
        />
      ) : (
        <ul className="flex flex-col gap-px border-2 border-border-ink bg-border-ink">
          {rows.map((label) => (
            <li
              key={label.id}
              className={`flex items-center gap-sp-3 bg-bg-panel px-sp-3 py-sp-2 ${
                label.is_archived ? "text-fg-muted" : ""
              }`}
            >
              {/* swatch: 16×16, MANDATORY 1px ink border (cue #3) */}
              <span
                aria-hidden="true"
                className="h-[16px] w-[16px] flex-none border border-border-ink"
                style={{
                  backgroundColor: label.color || "var(--bg-panel-2)",
                }}
              />
              <span className="text-[14px] font-semibold text-fg-ink">
                {label.name}
              </span>
              {label.description && (
                <span className="truncate text-[13px] text-fg-muted">
                  {label.description}
                </span>
              )}
              {label.is_archived && (
                <RetroBadge variant="neutral">
                  <Trans>ARCHIVED</Trans>
                </RetroBadge>
              )}

              <span className="ml-auto flex flex-none items-center gap-sp-2">
                {label.is_archived ? (
                  <BevelButton
                    variant="mint"
                    onClick={() =>
                      restoreLabel({ id: label.id, name: label.name })
                    }
                  >
                    <Trans>RESTORE</Trans>
                  </BevelButton>
                ) : (
                  <>
                    <BevelButton
                      variant="neutral"
                      aria-label={t`Edit ${label.name}`}
                      onClick={() => openEdit(label)}
                    >
                      <Trans>EDIT</Trans>
                    </BevelButton>
                    <BevelButton
                      variant="neutral"
                      aria-label={t`Archive ${label.name}`}
                      onClick={() =>
                        archiveLabel({ id: label.id, name: label.name })
                      }
                    >
                      <span aria-hidden="true">⊟</span>
                    </BevelButton>
                  </>
                )}
                <BevelButton
                  variant="danger"
                  aria-label={t`Delete ${label.name}`}
                  onClick={() => setDeleteTarget(label)}
                >
                  <span aria-hidden="true">⌫</span>
                </BevelButton>
              </span>
            </li>
          ))}
        </ul>
      )}

      <LabelFormDialog
        open={form.open}
        label={form.label}
        onClose={closeForm}
      />

      {/* Delete = plain pink confirm (no-count copy — labels have no client
          attached-count fetch this phase, so the removal clause is omitted). */}
      <RetroConfirmDialog
        open={deleteTarget !== null}
        title={<Trans>DELETE LABEL?</Trans>}
        titlebarVariant="pink"
        confirmVariant="danger"
        confirmLabel={<Trans>DELETE</Trans>}
        cancelLabel={<Trans>Cancel</Trans>}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        onClose={() => setDeleteTarget(null)}
      >
        <span>
          {t`Delete "${deleteTarget?.name ?? ""}"? This can't be undone.`}
        </span>
      </RetroConfirmDialog>
    </div>
  );
}
