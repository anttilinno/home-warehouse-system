import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trans, useLingui } from "@lingui/react/macro";
import { RetroDialog, BevelButton } from "@/components/retro";
import type { Label } from "@/lib/types";
import type { CreateLabelBody } from "@/lib/api/labels";
import {
  labelSchema,
  type LabelFormInput,
  type LabelFormValues,
} from "../schema";
import {
  useLabelMutations,
  type UpdateLabelArg,
} from "../hooks/useLabelMutations";
import { ColorSwatchPicker } from "./ColorSwatchPicker";
import { DiscardChangesDialog, FormRootError } from "./TaxonomyDialogForm";
import { DescriptionField, NameField } from "./TaxonomyFormFields";

// Phase 10 Plan 04 — the label create/edit form. Unlike the routed
// category/location/container forms, the label form is an INLINE RetroDialog (no
// route — UI-SPEC OQ4: labels are lightweight name+color). RHF + zod
// (labelSchema). Fields: name (RetroInput), color (ColorSwatchPicker storing
// hex), optional description. On submit create/update.mutateAsync then close.
// Cancel with a dirty form opens the butter DISCARD CHANGES? confirm.
//
// Render-loop guard: destructure the stable .mutateAsync handlers; tRef pins the
// lingui `t` for stable closures.

export interface LabelFormDialogProps {
  open: boolean;
  /** Editing an existing label, or null/undefined to create a new one. */
  label?: Label | null;
  onClose: () => void;
}

const EMPTY_DEFAULTS: LabelFormInput = {
  name: "",
  color: "",
  description: "",
};

function labelToDefaults(l: Label): LabelFormInput {
  return {
    name: l.name,
    color: l.color ?? "",
    description: l.description ?? "",
  };
}

export function LabelFormDialog({
  open,
  label,
  onClose,
}: Readonly<LabelFormDialogProps>) {
  const { t } = useLingui();
  const isEdit = Boolean(label);

  const { create, update } = useLabelMutations();
  const createLabel = create.mutateAsync;
  const updateLabel = update.mutateAsync;

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<LabelFormInput>({
    resolver: zodResolver(labelSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  // Re-seed the form whenever the dialog (re)opens for a different target.
  useEffect(() => {
    if (!open) return;
    reset(label ? labelToDefaults(label) : EMPTY_DEFAULTS);
  }, [open, label, reset]);

  const [discardOpen, setDiscardOpen] = useState(false);

  function attemptClose() {
    if (isDirty) setDiscardOpen(true);
    else onClose();
  }

  async function onSubmit(raw: LabelFormInput) {
    const values: LabelFormValues = labelSchema.parse(raw);
    // OMIT-EMPTY: a blank optional is never sent as "".
    const body: CreateLabelBody = { name: values.name };
    if (values.color) body.color = values.color;
    if (values.description) body.description = values.description;

    try {
      if (isEdit && label) {
        const arg: UpdateLabelArg = { id: label.id, body };
        await updateLabel(arg);
      } else {
        await createLabel(body);
      }
      onClose();
    } catch {
      setError("root", { message: t`Couldn't save this label.` });
    }
  }

  const titleText = isEdit ? t`EDIT LABEL` : t`NEW LABEL`;
  const submitLabel = isEdit ? t`Save changes` : t`Save label`;

  return (
    <>
      <RetroDialog
        open={open}
        onClose={attemptClose}
        title={titleText}
        titlebarVariant="blue"
        footer={
          <>
            <BevelButton type="button" variant="neutral" onClick={attemptClose}>
              <Trans>Cancel</Trans>
            </BevelButton>
            <BevelButton
              type="submit"
              form="label-form"
              variant="primary"
              disabled={isSubmitting}
            >
              {submitLabel}
            </BevelButton>
          </>
        }
      >
        <form
          id="label-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-sp-4"
        >
          <FormRootError message={errors.root?.message} />

          <NameField register={register("name")} error={errors.name?.message} />

          <div className="flex flex-col gap-sp-2">
            <span className="text-11 font-bold uppercase tracking-8 text-fg-muted">
              <Trans>Color</Trans>
            </span>
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <ColorSwatchPicker
                  label={t`Color`}
                  value={field.value}
                  onChange={(hex) => field.onChange(hex ?? "")}
                />
              )}
            />
            {errors.color?.message && (
              <p className="text-12 text-danger">{errors.color.message}</p>
            )}
            <p className="text-12 text-fg-muted">
              <Trans>Optional — pick an on-palette color, or none.</Trans>
            </p>
          </div>

          <DescriptionField
            register={register("description")}
            error={errors.description?.message}
          />
        </form>
      </RetroDialog>

      <DiscardChangesDialog
        open={discardOpen}
        onConfirm={() => {
          setDiscardOpen(false);
          onClose();
        }}
        onCancel={() => setDiscardOpen(false)}
      />
    </>
  );
}
