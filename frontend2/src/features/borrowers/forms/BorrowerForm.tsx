import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLingui } from "@lingui/react/macro";
import {
  RetroFormField,
  RetroInput,
  RetroTextarea,
} from "@/components/retro";
import {
  borrowerCreateSchema,
  type BorrowerCreateValues,
} from "./schemas";

// Coerce empty strings → undefined before zod parses, so `.email()` on
// optional email doesn't fire for empty controlled inputs. Mirrors the
// pattern used in CategoryForm.
const baseResolver = zodResolver(borrowerCreateSchema);
const resolver: typeof baseResolver = (values, ctx, opts) => {
  const v = values as Record<string, unknown>;
  const cleaned = {
    ...v,
    email: v.email === "" ? undefined : v.email,
    phone: v.phone === "" ? undefined : v.phone,
    notes: v.notes === "" ? undefined : v.notes,
  };
  return baseResolver(cleaned as BorrowerCreateValues, ctx, opts);
};

export interface BorrowerFormProps {
  defaultValues?: Partial<BorrowerCreateValues>;
  onSubmit: (values: BorrowerCreateValues) => void | Promise<void>;
  onDirtyChange?: (isDirty: boolean) => void;
  formId?: string;
}

export function BorrowerForm({
  defaultValues,
  onSubmit,
  onDirtyChange,
  formId,
}: BorrowerFormProps) {
  const { t } = useLingui();
  const { control, handleSubmit, formState } = useForm<BorrowerCreateValues>({
    resolver,
    defaultValues: {
      name: defaultValues?.name ?? "",
      email: defaultValues?.email ?? "",
      phone: defaultValues?.phone ?? "",
      notes: defaultValues?.notes ?? "",
    } as BorrowerCreateValues,
    mode: "onBlur",
  });

  useEffect(() => {
    onDirtyChange?.(formState.isDirty);
  }, [formState.isDirty, onDirtyChange]);

  const submit = handleSubmit((values) => {
    const cleaned: BorrowerCreateValues = {
      name: values.name,
      email: values.email || undefined,
      phone: values.phone || undefined,
      notes: values.notes || undefined,
    };
    return onSubmit(cleaned);
  });

  return (
    <form id={formId} onSubmit={submit} className="flex flex-col gap-md">
      <RetroFormField name="name" control={control} label={t`NAME`}>
        <RetroInput autoFocus placeholder={t`e.g. Alice Smith`} />
      </RetroFormField>
      <RetroFormField name="email" control={control} label={t`EMAIL`}>
        <RetroInput type="email" placeholder={t`alice@example.com`} />
      </RetroFormField>
      <RetroFormField name="phone" control={control} label={t`PHONE`}>
        <RetroInput type="tel" placeholder={t`+372 555 0101`} />
      </RetroFormField>
      <RetroFormField name="notes" control={control} label={t`NOTES`}>
        <RetroTextarea
          rows={4}
          placeholder={t`Pickup preferences, shared items, etc.`}
        />
      </RetroFormField>
    </form>
  );
}
