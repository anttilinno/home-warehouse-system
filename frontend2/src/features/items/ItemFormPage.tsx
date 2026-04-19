// Phase 65 LOOK-02 + LOOK-03 page orchestrator — /items/new.
//
// Composes:
//   - ?barcode= URL param pre-fill (D-01, D-02)
//   - ItemForm (D-05, wraps FormProvider post Plan 65-05 Task 1)
//   - UpcSuggestionBanner on top (D-13..D-16 + D-23 brand target)
//   - RetroConfirmDialog dirty-guard on CANCEL (D-03)
//   - Pitfall #7 scanKeys.lookup(barcode) invalidation alongside
//     useCreateItem.onSuccess's itemKeys.all invalidation (D-04)
//
// Route registration lives in Plan 65-07; this plan only ships the page
// component + happy-path tests. Plan 65-07 will register
// <Route path="items/new" element={<ItemFormPage />} /> in routes/index.tsx.
import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import {
  RetroButton,
  RetroConfirmDialog,
  type RetroConfirmDialogHandle,
} from "@/components/retro";
import { ItemForm } from "./forms/ItemForm";
import { generateSku, type ItemCreateValues } from "./forms/schemas";
import { useCreateItem } from "./hooks/useItemMutations";
import { useBarcodeEnrichment } from "./hooks/useBarcodeEnrichment";
import { UpcSuggestionBanner } from "./UpcSuggestionBanner";
import { scanKeys } from "@/lib/api/scan";

/**
 * ItemFormPage — /items/new page component.
 *
 * Reads ?barcode= from useSearchParams, lazily generates one SKU per mount,
 * renders an opt-in UpcSuggestionBanner on top of ItemForm when the
 * enrichment API returns a hit, invalidates both itemKeys.all (via
 * useCreateItem.onSuccess) AND scanKeys.lookup(barcode) (page-level, D-04)
 * on successful create, and navigates to /items/{id}.
 *
 * Dirty-guard: CANCEL on a clean form navigates back via navigate(-1);
 * CANCEL on a dirty form opens a RetroConfirmDialog with verbatim copy
 * from the SlideOverPanel precedent ("DISCARD CHANGES?" / "Your edits
 * will be lost." / "← BACK" / "DISCARD").
 */
export function ItemFormPage() {
  const { t } = useLingui();
  const [searchParams] = useSearchParams();
  const barcode = searchParams.get("barcode");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const formId = useId();
  const discardRef = useRef<RetroConfirmDialogHandle>(null);

  // Lazy initializer — generateSku() fires exactly once per mount.
  const [generatedSku] = useState(() => generateSku());
  const [isDirty, setIsDirty] = useState(false);

  const createMutation = useCreateItem();
  const enrichment = useBarcodeEnrichment(barcode);

  // Pitfall #5: keep defaultValues referentially stable while the input
  // params are stable — useMemo keyed on [generatedSku, barcode].
  const defaultValues = useMemo(
    (): Partial<ItemCreateValues> => ({
      name: "",
      sku: generatedSku,
      barcode: barcode ?? "",
      brand: "",
      description: "",
      category_id: "",
    }),
    [generatedSku, barcode],
  );

  const onSubmit = useCallback(
    async (values: ItemCreateValues) => {
      const created = await createMutation.mutateAsync(values);
      if (barcode) {
        // Pitfall #7 (D-04): invalidate scan lookup so a rescan of the same
        // barcode after successful create reflects the new item. useCreateItem
        // already invalidates itemKeys.all via its own onSuccess — D-04
        // requires BOTH.
        qc.invalidateQueries({ queryKey: scanKeys.lookup(barcode) });
      }
      navigate(`/items/${created.id}`);
    },
    [barcode, createMutation, navigate, qc],
  );

  const handleCancel = useCallback(() => {
    if (isDirty) {
      discardRef.current?.open();
      return;
    }
    navigate(-1);
  }, [isDirty, navigate]);

  const isPending = createMutation.isPending;

  return (
    <div className="max-w-[720px] mx-auto p-lg flex flex-col gap-lg">
      <h1 className="text-[20px] font-bold uppercase tracking-wider text-retro-ink">
        {t`NEW ITEM`}
      </h1>
      <ItemForm
        formId={formId}
        onSubmit={onSubmit}
        onDirtyChange={setIsDirty}
        defaultValues={defaultValues}
        beforeForm={
          enrichment.data?.found ? (
            <UpcSuggestionBanner data={enrichment.data} />
          ) : null
        }
      />
      <div className="flex gap-sm justify-end">
        <RetroButton
          variant="neutral"
          type="button"
          onClick={handleCancel}
        >
          {t`CANCEL`}
        </RetroButton>
        <RetroButton
          variant="primary"
          type="submit"
          form={formId}
          disabled={isPending}
        >
          {isPending ? t`WORKING…` : t`CREATE ITEM`}
        </RetroButton>
      </div>
      <RetroConfirmDialog
        ref={discardRef}
        variant="destructive"
        title={t`DISCARD CHANGES?`}
        body={t`Your edits will be lost.`}
        escapeLabel={t`← BACK`}
        destructiveLabel={t`DISCARD`}
        onConfirm={() => navigate(-1)}
      />
    </div>
  );
}
