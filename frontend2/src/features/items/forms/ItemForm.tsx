import { useEffect, useMemo } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import {
  RetroFormField,
  RetroInput,
  RetroTextarea,
  RetroCombobox,
  type RetroOption,
} from "@/components/retro";
import { categoriesApi, categoryKeys } from "@/lib/api/categories";
import { useAuth } from "@/features/auth/AuthContext";
import { itemCreateSchema, type ItemCreateValues } from "./schemas";

export interface ItemFormProps {
  formId: string;
  onSubmit: (values: ItemCreateValues) => void | Promise<void>;
  onDirtyChange?: (isDirty: boolean) => void;
  defaultValues?: Partial<ItemCreateValues>;
}

// Coerce empty strings -> undefined before zod parses, so the UUID / pattern
// validators don't fire on empty controlled inputs. Mirrors the pattern used
// in BorrowerForm and CategoryForm.
const baseResolver = zodResolver(itemCreateSchema);
const resolver: typeof baseResolver = (values, ctx, opts) => {
  const v = values as Record<string, unknown>;
  const cleaned = {
    ...v,
    barcode: v.barcode === "" ? undefined : v.barcode,
    brand: v.brand === "" ? undefined : v.brand,
    description: v.description === "" ? undefined : v.description,
    category_id: v.category_id === "" ? undefined : v.category_id,
  };
  return baseResolver(cleaned as ItemCreateValues, ctx, opts);
};

/**
 * ItemForm — react-hook-form + zod + RetroFormField.
 *
 * Five fields: name (required), sku (required, auto-gen by caller),
 * barcode, description, category_id.
 *
 * Empty strings coerce to undefined both before resolve AND before submit
 * (belt-and-suspenders): zod's .or(z.literal("")) accepts "" without running
 * the UUID / pattern validators, while the submit coercion guarantees the
 * server receives undefined — not "" — for correct NULL semantics.
 */
export function ItemForm({
  formId,
  onSubmit,
  onDirtyChange,
  defaultValues,
}: ItemFormProps) {
  const { t } = useLingui();
  const { workspaceId } = useAuth();

  const methods = useForm<ItemCreateValues>({
    resolver,
    defaultValues: {
      name: defaultValues?.name ?? "",
      sku: defaultValues?.sku ?? "",
      barcode: defaultValues?.barcode ?? "",
      brand: defaultValues?.brand ?? "",
      description: defaultValues?.description ?? "",
      category_id: defaultValues?.category_id ?? "",
    } as ItemCreateValues,
    mode: "onSubmit",
  });
  const { control, handleSubmit, formState } = methods;

  useEffect(() => {
    onDirtyChange?.(formState.isDirty);
  }, [formState.isDirty, onDirtyChange]);

  // Category combobox — picker excludes archived (Pitfall 7). The list /
  // detail name resolver includes archived so we can still render the label
  // for an already-assigned archived category, but new picks are limited to
  // non-archived.
  const categoriesParams = { page: 1, limit: 100, archived: false } as const;
  const categoriesQuery = useQuery({
    queryKey: categoryKeys.list(categoriesParams),
    queryFn: () => categoriesApi.list(workspaceId!, categoriesParams),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
  const categoryOptions: RetroOption[] = useMemo(
    () =>
      (categoriesQuery.data?.items ?? []).map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [categoriesQuery.data],
  );

  const submit = handleSubmit((values) => {
    const cleaned: ItemCreateValues = {
      name: values.name,
      sku: values.sku,
      barcode: values.barcode || undefined,
      brand: values.brand || undefined,
      description: values.description || undefined,
      category_id: values.category_id || undefined,
    };
    return onSubmit(cleaned);
  });

  const isEditMode = !!defaultValues?.name;

  return (
    <FormProvider {...methods}>
      <form id={formId} onSubmit={submit} className="flex flex-col gap-md">
        <RetroFormField name="name" control={control} label={t`NAME`}>
          <RetroInput
            autoFocus={!isEditMode}
            placeholder={t`e.g. Cordless Drill`}
          />
        </RetroFormField>

        <RetroFormField
          name="sku"
          control={control}
          label={t`SKU`}
          helper={t`Auto-generated — editable`}
        >
          <RetroInput className="font-mono" />
        </RetroFormField>

        <RetroFormField
          name="barcode"
          control={control}
          label={t`BARCODE`}
          helper={t`Optional`}
        >
          <RetroInput
            className="font-mono"
            placeholder={t`0123456789012`}
            inputMode="text"
          />
        </RetroFormField>

        <RetroFormField
          name="brand"
          control={control}
          label={t`BRAND`}
          helper={t`Optional`}
        >
          <RetroInput placeholder={t`e.g. DeWalt`} />
        </RetroFormField>

        <RetroFormField
          name="description"
          control={control}
          label={t`DESCRIPTION`}
          helper={t`Optional — up to 2000 characters`}
        >
          <RetroTextarea
            rows={4}
            placeholder={t`What's in the box, condition, accessories, etc.`}
          />
        </RetroFormField>

        <RetroFormField
          name="category_id"
          control={control}
          label={t`CATEGORY`}
          helper={t`Optional`}
        >
          <RetroCombobox
            options={categoryOptions}
            placeholder={t`Search categories…`}
          />
        </RetroFormField>
      </form>
    </FormProvider>
  );
}
