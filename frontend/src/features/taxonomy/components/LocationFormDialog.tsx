import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trans, useLingui } from "@lingui/react/macro";
import { RetroCombobox, type RetroComboboxOption } from "@/components/retro";
import type { Location, CreateLocationBody } from "@/lib/api/location";
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
import { generateShortCode } from "../generateShortCode";
import { TaxonomyDialogForm } from "./TaxonomyDialogForm";
import {
  DescriptionField,
  NameField,
  ShortCodeField,
} from "./TaxonomyFormFields";

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
}: Readonly<LocationFormDialogProps>) {
  const { t } = useLingui();
  const isEdit = Boolean(location);

  const { rows } = useLocationsQuery();

  const { createLocation, update } = useLocationMutations();
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
      // Pre-fill a generated short code on create so the user has a code to put
      // on a label; still editable (and cleared/overwritten if they scan an
      // existing label instead). A fresh code per open.
      reset({
        ...EMPTY_DEFAULTS,
        parent_location: parentId ?? "",
        short_code: generateShortCode(),
      });
    }
  }, [open, location, parentId, reset]);

  // Parent options: the flattened tree EXCLUDING self + descendants (cycles).
  const parentOptions = useMemo(() => {
    const tree = buildTree(rows, (l) => l.parent_location);
    return flattenExcluding(tree, isEdit ? location?.id : undefined, []);
  }, [rows, isEdit, location?.id]);

  const parentValue = watch("parent_location") ?? "";

  async function onSubmit(raw: LocationFormInput) {
    const values: LocationFormValues = locationSchema.parse(raw);
    // OMIT-EMPTY: a blank optional is never sent as "".
    const body: CreateLocationBody = { name: values.name };
    if (values.parent_location) body.parent_location = values.parent_location;
    if (values.description) body.description = values.description;
    // short_code is create-only — the PATCH endpoint has no short_code field
    // (immutable; editing it would orphan printed QR labels), so sending it on
    // update trips Huma's additionalProperties → 422.
    if (!isEdit && values.short_code) body.short_code = values.short_code;

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
    <TaxonomyDialogForm
      open={open}
      title={titleText}
      submitLabel={submitLabel}
      isSubmitting={isSubmitting}
      isDirty={isDirty}
      rootError={errors.root?.message}
      onSubmit={handleSubmit(onSubmit)}
      onClose={onClose}
    >
      <NameField register={register("name")} error={errors.name?.message} />

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

      <DescriptionField
        register={register("description")}
        error={errors.description?.message}
      />

      <ShortCodeField
        register={register("short_code")}
        error={errors.short_code?.message}
        disabled={isEdit}
      />
    </TaxonomyDialogForm>
  );
}
