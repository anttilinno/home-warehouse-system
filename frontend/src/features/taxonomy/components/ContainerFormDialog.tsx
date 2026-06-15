import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  RetroInput,
  RetroTextarea,
  RetroConfirmDialog,
  RetroDialog,
  type RetroComboboxOption,
} from "@/components/retro";
import { type Container, type CreateContainerBody } from "@/lib/api/container";
import {
  containerSchema,
  type ContainerFormInput,
  type ContainerFormValues,
} from "../schema";
import { useLocationsQuery } from "../hooks/useLocationsQuery";
import {
  useContainerMutations,
  type UpdateContainerArg,
} from "../hooks/useContainerMutations";
import { SearchPicker } from "./SearchPicker";

// Phase 10 Plan 03 — the container create/edit form (TAX-05). INLINE RetroDialog
// (no route — the W2 form-routing decision; only category forms are routed).
// RHF + zod (containerSchema). Fields name / location (SearchPicker domain=
// "locations", REQUIRED) / description / short_code. The location field uses the
// type-ahead SearchPicker (RetroCombobox + /locations/search) with the loaded
// locations list as the baseline. When NO locations exist the field is disabled
// with the shipped "No locations yet — add one first." hint (InventoryFormPage
// empty-source pattern). On submit create/update.mutateAsync then closes.
//
// Render-loop guard: destructure the stable .mutateAsync handlers.

export interface ContainerFormDialogProps {
  open: boolean;
  /** Edit mode: the container being edited. Create mode: undefined. */
  container?: Container;
  onClose: () => void;
}

const EMPTY_DEFAULTS: ContainerFormInput = {
  name: "",
  location_id: "",
  description: "",
  short_code: "",
};

function containerToDefaults(c: Container): ContainerFormInput {
  return {
    name: c.name,
    location_id: c.location_id ?? "",
    description: c.description ?? "",
    short_code: c.short_code ?? "",
  };
}

export function ContainerFormDialog({
  open,
  container,
  onClose,
}: ContainerFormDialogProps) {
  const { t } = useLingui();
  const isEdit = Boolean(container);

  const { rows: locationRows } = useLocationsQuery();
  const noLocations = locationRows.length === 0;

  const locationOptions = useMemo<RetroComboboxOption[]>(
    () => locationRows.map((l) => ({ value: l.id, label: l.name })),
    [locationRows],
  );

  const { create, update } = useContainerMutations();
  const createContainer = create.mutateAsync;
  const updateContainer = update.mutateAsync;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ContainerFormInput>({
    resolver: zodResolver(containerSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  // Reset the form whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (container) reset(containerToDefaults(container));
    else reset(EMPTY_DEFAULTS);
  }, [open, container, reset]);

  const locationValue = watch("location_id") ?? "";

  // Dirty-form close guard.
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  function attemptClose() {
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  }

  async function onSubmit(raw: ContainerFormInput) {
    const values: ContainerFormValues = containerSchema.parse(raw);
    const body: CreateContainerBody = {
      name: values.name,
      location_id: values.location_id,
    };
    if (values.description) body.description = values.description;
    if (values.short_code) body.short_code = values.short_code;

    try {
      if (isEdit && container) {
        const arg: UpdateContainerArg = { id: container.id, body };
        await updateContainer(arg);
      } else {
        await createContainer(body);
      }
      onClose();
    } catch {
      setError("root", { message: t`Couldn't save this container.` });
    }
  }

  const titleText = isEdit ? t`EDIT CONTAINER` : t`NEW CONTAINER`;
  const submitLabel = isEdit ? t`Save changes` : t`Save container`;

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
            <SearchPicker
              label={<Trans>Location</Trans>}
              domain="locations"
              value={locationValue}
              onChange={(v) =>
                setValue("location_id", v, { shouldDirty: true })
              }
              fallbackOptions={locationOptions}
              disabled={noLocations}
              error={errors.location_id?.message}
              placeholder={t`Search locations…`}
            />
            {noLocations ? (
              <p className="text-12 text-fg-muted">
                <Trans>No locations yet — add one first.</Trans>
              </p>
            ) : (
              <p className="text-12 text-fg-muted">
                <Trans>Required — every container lives in a location.</Trans>
              </p>
            )}
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
