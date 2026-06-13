import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import {
  Window,
  BevelButton,
  RetroInput,
  RetroBadge,
  RetroFormField,
  RetroCombobox,
  RetroTextarea,
  RetroConfirmDialog,
} from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { itemsApi } from "@/lib/api/items";
import type { Item } from "@/lib/types";
import {
  itemFormSchema,
  type ItemFormInput,
  type ItemFormValues,
} from "./schema";
import {
  useItemFormMutations,
  type DirtyMap,
} from "./hooks/useItemFormMutations";

// Phase 7 Plan 05 — create/edit item form (ITEM-03 + ITEM-04).
//
// One blue Window (ADD ITEM / EDIT ITEM), centered max-w-[560px], RHF + zod.
// /items/new?barcode= prefills the Barcode field with a FROM SCAN affordance;
// /items/:id/edit loads the item and saves via PATCH with cleared string fields
// sent as "" (Pitfall 4 — the dirty-fields PATCH builder lives in
// useItemFormMutations). A dirty form prompts a butter DISCARD CHANGES? confirm
// before navigating away (react-router useBlocker). On success → invalidate +
// navigate to the detail route. (Route registration is owned by Plan 06.)

// RHF default values. Strings default to "" so dirtyFields tracking is
// meaningful (Pitfall 4). minStock is held as a string (the number input value).
const EMPTY_DEFAULTS: ItemFormInput = {
  name: "",
  description: "",
  barcode: "",
  category: "",
  location: "",
  minStock: "",
};

// Map a loaded Item to the form's INPUT shape (edit mode reset).
function itemToDefaults(item: Item): ItemFormInput {
  return {
    name: item.name,
    description: item.description ?? "",
    barcode: item.barcode ?? "",
    // category_id is a uuid with no name lookup yet (no taxonomy hook) — leave
    // the display field blank rather than show a raw uuid. Stub (see schema.ts).
    category: "",
    location: "",
    minStock:
      item.min_stock_level === undefined ? "" : String(item.min_stock_level),
  };
}

export function ItemFormPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { currentWorkspaceId: wsId } = useWorkspace();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);

  // ?barcode= prefill (create only). The value is bound into a controlled RHF
  // input (React-escaped — XSS-safe per threat T-07-14); zod bounds the length.
  const prefillBarcode = searchParams.get("barcode") ?? "";
  const showFromScan = !isEdit && prefillBarcode.length > 0;

  // Edit mode: load the item. enabled only when editing + wsId present.
  const itemQuery = useQuery({
    queryKey: ["items", wsId as string, "detail", id],
    queryFn: () => itemsApi.get(wsId as string, id as string),
    enabled: isEdit && Boolean(wsId) && Boolean(id),
  });

  const { create, update } = useItemFormMutations();
  // RQ v5 returns a fresh mutation object per render; the .mutateAsync identity
  // is stable. Destructure the stable fns (DemoPage/ItemsListPage pattern).
  const createItem = create.mutateAsync;
  const updateItem = update.mutateAsync;

  const defaultValues = useMemo<ItemFormInput>(
    () =>
      isEdit
        ? EMPTY_DEFAULTS
        : { ...EMPTY_DEFAULTS, barcode: prefillBarcode },
    [isEdit, prefillBarcode],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, dirtyFields, isDirty, isSubmitting, isSubmitSuccessful },
  } = useForm<ItemFormInput>({
    resolver: zodResolver(itemFormSchema),
    defaultValues,
  });

  // When the edit item loads, reset the form to it (keeps dirtyFields meaningful).
  useEffect(() => {
    if (isEdit && itemQuery.data) {
      reset(itemToDefaults(itemQuery.data));
    }
  }, [isEdit, itemQuery.data, reset]);

  // Dirty-form navigation guard.
  //
  // DEVIATION (Rule 3 — blocking): the plan/UI-SPEC name react-router
  // `useBlocker` for the guard, but `useBlocker` REQUIRES a data router
  // (createBrowserRouter/RouterProvider) and the app is declarative-mode
  // (<Routes>, AP-1 — see routes/index.tsx); calling it would throw
  // "useBlocker must be used within a data router" at runtime. So the guard is
  // wired without useBlocker: in-app navigation away (Cancel / detail link)
  // routes through `attemptLeave`, which opens the butter confirm when dirty;
  // tab-close/reload is caught by a `beforeunload` listener. If 07-06 migrates
  // the router to a data router, the cross-route blocker can be re-added.
  const [pendingLeave, setPendingLeave] = useState<string | null>(null);
  const guardActive = isDirty && !isSubmitSuccessful;

  // Native unload guard (reload / tab-close / external nav).
  useEffect(() => {
    if (!guardActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [guardActive]);

  // Attempt to leave to `to`: if the form is dirty, stage the destination and
  // open the discard confirm; otherwise navigate immediately.
  function attemptLeave(to: string) {
    if (guardActive) {
      setPendingLeave(to);
    } else {
      navigate(to);
    }
  }

  async function onSubmit(raw: ItemFormInput) {
    // raw is the INPUT shape; re-parse through zod for the RESOLVED values
    // (minStock coerced number|undefined). RHF already validated via the resolver.
    const values: ItemFormValues = itemFormSchema.parse(raw);
    try {
      if (isEdit && id) {
        const dirty = dirtyFields as DirtyMap;
        await updateItem({ id, values, dirty });
        navigate(`/items/${id}`);
      } else {
        const created = await createItem(values);
        navigate(`/items/${created.id}`);
      }
    } catch {
      // The mutation's onError already surfaced a persistent retroToast.error.
      // Render the in-window form-level banner too (UI-SPEC §3 form-level error).
      setError("root", { message: t`Couldn't save this item.` });
    }
  }

  function handleCancel() {
    // Navigating away with a dirty form trips the discard confirm; otherwise
    // this returns to the detail (edit) or the list (create).
    attemptLeave(isEdit && id ? `/items/${id}` : "/items");
  }

  const titleText = isEdit ? t`EDIT ITEM` : t`ADD ITEM`;
  const submitLabel = isEdit ? t`Save changes` : t`Save item`;

  return (
    <div className="mx-auto max-w-[560px]">
      <Window title={titleText} titlebarVariant="blue">
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-sp-4"
        >
          {/* Group 1 — Identity */}
          <div className="flex flex-col gap-sp-3">
            <RetroInput
              label={<Trans>Name</Trans>}
              required
              aria-required="true"
              error={errors.name?.message}
              {...register("name")}
            />
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <RetroCombobox
                  label={<Trans>Category</Trans>}
                  options={[]}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder={t`Type a category…`}
                />
              )}
            />
            <Controller
              control={control}
              name="location"
              render={({ field }) => (
                <RetroCombobox
                  label={<Trans>Location</Trans>}
                  options={[]}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder={t`Type a location…`}
                />
              )}
            />
          </div>

          {/* Group 2 — Quantity & code */}
          <div className="flex flex-col gap-sp-3">
            <RetroInput
              label={<Trans>Quantity</Trans>}
              type="number"
              min={0}
              mono
              error={errors.minStock?.message}
              {...register("minStock")}
            />
            {/* Barcode uses RetroFormField so the FROM SCAN badge can sit in the
                label row (right-aligned) per UI-SPEC §3. */}
            <RetroFormField
              label={
                <span className="flex items-center justify-between gap-sp-2">
                  <Trans>Barcode</Trans>
                  {showFromScan && (
                    <RetroBadge variant="info">
                      <Trans>FROM SCAN</Trans>
                    </RetroBadge>
                  )}
                </span>
              }
              hint={
                showFromScan ? (
                  <Trans>Prefilled from scan — edit if needed.</Trans>
                ) : undefined
              }
              error={errors.barcode?.message}
            >
              {(fieldId, describedBy) => (
                <input
                  id={fieldId}
                  type="text"
                  aria-invalid={errors.barcode ? true : undefined}
                  aria-describedby={describedBy}
                  className={`w-full border-2 px-[10px] py-[7px] font-mono text-[14px] text-fg-ink bevel-sunken focus:outline-3 focus:outline-offset-1 focus:outline-titlebar-blue ${
                    errors.barcode
                      ? "border-danger bg-danger-bg"
                      : "border-border-ink bg-bg-panel"
                  }`}
                  {...register("barcode")}
                />
              )}
            </RetroFormField>
          </div>

          {/* Group 3 — Notes */}
          <RetroTextarea
            label={<Trans>Description</Trans>}
            error={errors.description?.message}
            {...register("description")}
          />

          {/* Form-level error banner (submit/server failure). */}
          {errors.root?.message && (
            <div
              role="alert"
              className="border-2 border-border-ink bg-danger-bg p-sp-3 text-[14px] text-danger"
            >
              <span aria-hidden="true">✕ </span>
              {errors.root.message}
            </div>
          )}

          {/* Footer — pinned action row */}
          <div className="flex justify-end gap-sp-2 border-t-2 border-border-ink pt-sp-3">
            <BevelButton type="button" variant="neutral" onClick={handleCancel}>
              <Trans>Cancel</Trans>
            </BevelButton>
            <BevelButton type="submit" variant="primary" disabled={isSubmitting}>
              {submitLabel}
            </BevelButton>
          </div>
        </form>
      </Window>

      {/* Dirty-form discard guard (butter, non-destructive decision). */}
      <RetroConfirmDialog
        open={pendingLeave !== null}
        title={<Trans>DISCARD CHANGES?</Trans>}
        titlebarVariant="butter"
        confirmVariant="neutral"
        confirmLabel={<Trans>Discard</Trans>}
        cancelLabel={<Trans>Keep editing</Trans>}
        onConfirm={() => {
          const to = pendingLeave;
          setPendingLeave(null);
          if (to) navigate(to);
        }}
        onCancel={() => setPendingLeave(null)}
        onClose={() => setPendingLeave(null)}
      >
        <Trans>Your edits will be lost.</Trans>
      </RetroConfirmDialog>
    </div>
  );
}
