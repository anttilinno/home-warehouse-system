import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLingui } from "@lingui/react/macro";
import {
  RetroFormField,
  RetroInput,
  RetroCombobox,
  RetroTextarea,
  type RetroOption,
} from "@/components/retro";
import {
  categoryCreateSchema,
  type CategoryCreateValues,
} from "./schemas";

// Wrap zodResolver(categoryCreateSchema) to coerce empty strings -> undefined
// for optional UUID/text fields so zod's .uuid() validator doesn't fire on
// empty controlled inputs.
const baseResolver = zodResolver(categoryCreateSchema);
const resolver: typeof baseResolver = (values, ctx, opts) => {
  const v = values as Record<string, unknown>;
  const cleaned = {
    ...v,
    parent_category_id:
      v.parent_category_id === "" ? undefined : v.parent_category_id,
    description: v.description === "" ? undefined : v.description,
  };
  return baseResolver(cleaned as CategoryCreateValues, ctx, opts);
};

export interface CategoryFormProps {
  defaultValues?: Partial<CategoryCreateValues>;
  parentOptions: RetroOption[];
  onSubmit: (values: CategoryCreateValues) => void | Promise<void>;
  onDirtyChange?: (isDirty: boolean) => void;
  formId?: string;
}

export function CategoryForm({
  defaultValues,
  parentOptions,
  onSubmit,
  onDirtyChange,
  formId,
}: CategoryFormProps) {
  const { t } = useLingui();
  const { control, handleSubmit, formState } = useForm<CategoryCreateValues>({
    resolver,
    defaultValues: {
      name: defaultValues?.name ?? "",
      parent_category_id: defaultValues?.parent_category_id ?? "",
      description: defaultValues?.description ?? "",
    } as CategoryCreateValues,
    mode: "onBlur",
  });

  useEffect(() => {
    onDirtyChange?.(formState.isDirty);
  }, [formState.isDirty, onDirtyChange]);

  const submit = handleSubmit((values) => {
    const cleaned: CategoryCreateValues = {
      name: values.name,
      parent_category_id: values.parent_category_id || undefined,
      description: values.description || undefined,
    };
    return onSubmit(cleaned);
  });

  return (
    <form id={formId} onSubmit={submit} className="flex flex-col gap-md">
      <RetroFormField name="name" control={control} label={t`NAME`}>
        <RetroInput autoFocus />
      </RetroFormField>
      <RetroFormField
        name="parent_category_id"
        control={control}
        label={t`PARENT CATEGORY`}
      >
        <RetroCombobox
          options={parentOptions}
          placeholder={t`Search categories…`}
        />
      </RetroFormField>
      <RetroFormField
        name="description"
        control={control}
        label={t`DESCRIPTION`}
      >
        <RetroTextarea rows={3} />
      </RetroFormField>
    </form>
  );
}
