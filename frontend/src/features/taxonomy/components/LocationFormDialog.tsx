import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  RetroInput,
  RetroTextarea,
  RetroCombobox,
  RetroConfirmDialog,
  RetroDialog,
  type RetroComboboxOption,
} from "@/components/retro";
import { type Location, type CreateLocationBody } from "@/lib/api/location";
import {
  locationSchema,
  type LocationFormInput,
  type LocationFormValues,
} from "../schema";
import { useLocationsQuery } from "../hooks/useLocationsQuery";
import {
  useLocationMutations,
  type UpdateLocationArg,
} from "../hooks/useLocationMutations";
import { buildTree, type TreeNode } from "@/features/taxonomy/lib/buildTree";

// Phase 10 Plan 03 — the location create/edit form (TAX-03). Unlike the routed
// CategoryFormDialog, this is an INLINE RetroDialog (no route — the W2
// form-routing decision: only category forms are routed; location/container/
// label forms are inline dialogs). RHF + zod (locationSchema). Fields name /
// description / parent (RetroCombobox of flattened locations EXCLUDING self +
// descendants — no cycles; empty = root) / short_code (optional). On submit
// create/update.mutateAsync then closes. Cancel with a dirty form opens the
// butter DISCARD confirm.
//
// Render-loop guard: destructure the stable .mutateAsync handlers.

export interface LocationFormDialogProps {
  open: boolean;
  /** Edit mode: the location being edited. Create mode: undefined. */
  location?: Location;
  /** Create mode: pre-select this parent (the row ⊕ add-child deep link). */
  parentId?: string;
  onClose: () => void;
}

const EMPTY_DEFAULTS: LocationFormInput = {
  name: "",
  parent_location: "",
  description: "",
  short_code: "",
};

function locationToDefaults(l: Location): LocationFormInput {
  return {
    name: l.name,
    parent_location: l.parent_location ?? "",
    description: l.description ?? "",
    short_code: l.short_code ?? "",
  };
}

// Flatten the location tree into combobox options, EXCLUDING `excludeId` and all
// of its descendants (cycle prevention). Indent label by depth.
function flattenExcluding(
  nodes: TreeNode<Location>[],
  excludeId: string | undefined,
  out: RetroComboboxOption[],
): RetroComboboxOption[] {
  for (const n of nodes) {
    if (excludeId && n.node.id === excludeId) continue; // skip self + subtree
    const prefix = n.depth > 0 ? `${"  ".repeat(n.depth)}` : "";
    out.push({ value: n.node.id, label: `${prefix}${n.node.name}` });
    flattenExcluding(n.children, excludeId, out);
  }
  return out;
}

export function LocationFormDialog({
  open,
  location,
  parentId,
  onClose,
}: LocationFormDialogProps) {
  const { t } = useLingui();
  const isEdit = Boolean(location);

  const { rows } = useLocationsQuery();

  const { create, update } = useLocationMutations();
  const createLocation = create.mutateAsync;
  const updateLocation = update.mutateAsync;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<LocationFormInput>({
    resolver: zodResolver(locationSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  // Reset the form whenever the dialog opens (edit → loaded location; create →
  // empty defaults seeded with the optional parent deep link).
  useEffect(() => {
    if (!open) return;
    if (location) {
      reset(locationToDefaults(location));
    } else {
      reset({ ...EMPTY_DEFAULTS, parent_location: parentId ?? "" });
    }
  }, [open, location, parentId, reset]);

  // Parent options: the flattened tree EXCLUDING self + descendants (cycles).
  const parentOptions = useMemo(() => {
    const tree = buildTree(rows, (l) => l.parent_location);
    return flattenExcluding(tree, isEdit ? location?.id : undefined, []);
  }, [rows, isEdit, location?.id]);

  const parentValue = watch("parent_location") ?? "";

  // Dirty-form close guard.
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  function attemptClose() {
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  }

  async function onSubmit(raw: LocationFormInput) {
    const values: LocationFormValues = locationSchema.parse(raw);
    // OMIT-EMPTY: a blank optional is never sent as "".
    const body: CreateLocationBody = { name: values.name };
    if (values.parent_location) body.parent_location = values.parent_location;
    if (values.description) body.description = values.description;
    if (values.short_code) body.short_code = values.short_code;

    try {
      if (isEdit && location) {
        const arg: UpdateLocationArg = { id: location.id, body };
        await updateLocation(arg);
      } else {
        await createLocation(body);
      }
      onClose();
    } catch {
      setError("root", { message: t`Couldn't save this location.` });
    }
  }

  const titleText = isEdit ? t`EDIT LOCATION` : t`NEW LOCATION`;
  const submitLabel = isEdit ? t`Save changes` : t`Save location`;

  return (
    <>
      <RetroDialog
        open={open}
        onClose={attemptClose}
        title={titleText}
        titlebarVariant="blue"
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-sp-4"
        >
          {errors.root?.message && (
            <div
              role="alert"
              className="border-2 border-border-ink bg-danger-bg p-sp-3 text-14 text-danger"
            >
              <span aria-hidden="true">✕ </span>
              {errors.root.message}
            </div>
          )}

          <RetroInput
            label={<Trans>Name</Trans>}
            required
            aria-required="true"
            error={errors.name?.message}
            {...register("name")}
          />

          <div className="flex flex-col gap-sp-2">
            <RetroCombobox
              label={<Trans>Parent location</Trans>}
              options={parentOptions}
              value={parentValue}
              onChange={(v) =>
                setValue("parent_location", v, { shouldDirty: true })
              }
              placeholder={t`(Root — no parent)`}
              error={errors.parent_location?.message}
            />
            <p className="text-12 text-fg-muted">
              <Trans>Leave empty to create a top-level location.</Trans>
            </p>
          </div>

          <div className="flex flex-col gap-sp-2">
            <RetroTextarea
              label={<Trans>Description</Trans>}
              error={errors.description?.message}
              {...register("description")}
            />
            <p className="text-12 text-fg-muted">
              <Trans>Optional.</Trans>
            </p>
          </div>

          <div className="flex flex-col gap-sp-2">
            <RetroInput
              label={<Trans>Short code</Trans>}
              error={errors.short_code?.message}
              {...register("short_code")}
            />
            <p className="text-12 text-fg-muted">
              <Trans>Optional — auto-generated if left blank.</Trans>
            </p>
          </div>

          <div className="flex justify-end gap-sp-2 border-t-2 border-border-ink pt-sp-3">
            <BevelButton type="button" variant="neutral" onClick={attemptClose}>
              <Trans>Cancel</Trans>
            </BevelButton>
            <BevelButton
              type="submit"
              variant="primary"
              disabled={isSubmitting}
            >
              {submitLabel}
            </BevelButton>
          </div>
        </form>
      </RetroDialog>

      <RetroConfirmDialog
        open={confirmDiscard}
        title={<Trans>DISCARD CHANGES?</Trans>}
        titlebarVariant="butter"
        confirmVariant="neutral"
        confirmLabel={<Trans>Discard</Trans>}
        cancelLabel={<Trans>Keep editing</Trans>}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onCancel={() => setConfirmDiscard(false)}
        onClose={() => setConfirmDiscard(false)}
      >
        <Trans>Your edits will be lost.</Trans>
      </RetroConfirmDialog>
    </>
  );
}
