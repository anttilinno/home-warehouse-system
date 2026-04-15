import { useEffect } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
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
  containerCreateSchema,
  type ContainerCreateValues,
} from "./schemas";
import { useAutoShortCode } from "../actions/shortCode";

// Wrap zodResolver(containerCreateSchema) to coerce empty strings -> undefined
// for optional UUID/text fields. location_id is required so left as-is.
const baseResolver = zodResolver(containerCreateSchema);
const resolver: typeof baseResolver = (values, ctx, opts) => {
  const v = values as Record<string, unknown>;
  const cleaned = {
    ...v,
    short_code: v.short_code === "" ? undefined : v.short_code,
    description: v.description === "" ? undefined : v.description,
  };
  return baseResolver(cleaned, ctx, opts);
};

export interface ContainerFormProps {
  defaultValues?: Partial<ContainerCreateValues>;
  locationOptions: RetroOption[];
  onSubmit: (values: ContainerCreateValues) => void | Promise<void>;
  onDirtyChange?: (isDirty: boolean) => void;
  formId?: string;
}

export function ContainerForm({
  defaultValues,
  locationOptions,
  onSubmit,
  onDirtyChange,
  formId,
}: ContainerFormProps) {
  const { t } = useLingui();
  const { control, handleSubmit, formState, setValue } =
    useForm<ContainerCreateValues>({
      resolver,
      defaultValues: {
        name: defaultValues?.name ?? "",
        short_code: defaultValues?.short_code ?? "",
        location_id: defaultValues?.location_id ?? "",
        description: defaultValues?.description ?? "",
      } as ContainerCreateValues,
      mode: "onBlur",
    });

  useEffect(() => {
    onDirtyChange?.(formState.isDirty);
  }, [formState.isDirty, onDirtyChange]);

  const nameValue = useWatch({ control, name: "name" }) ?? "";
  const { onManualEdit, autoLinked } = useAutoShortCode(nameValue, (v) =>
    setValue("short_code", v, { shouldDirty: false }),
  );

  const submit = handleSubmit((values) => {
    const cleaned: ContainerCreateValues = {
      name: values.name,
      short_code: autoLinked ? undefined : values.short_code || undefined,
      location_id: values.location_id,
      description: values.description || undefined,
    };
    return onSubmit(cleaned);
  });

  return (
    <form id={formId} onSubmit={submit} className="flex flex-col gap-md">
      <RetroFormField name="name" control={control} label={t`NAME`}>
        <RetroInput autoFocus />
      </RetroFormField>
      <Controller
        name="short_code"
        control={control}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-xs">
            <label
              htmlFor={field.name}
              className="text-[14px] font-semibold uppercase tracking-wide text-retro-ink"
            >
              {t`SHORT CODE`}
            </label>
            <RetroInput
              id={field.name}
              name={field.name}
              value={field.value ?? ""}
              onBlur={field.onBlur}
              onChange={(e) => {
                field.onChange(e);
                onManualEdit(e.target.value);
              }}
              ref={field.ref}
              className="font-mono"
              error={fieldState.error?.message}
            />
          </div>
        )}
      />
      <RetroFormField
        name="location_id"
        control={control}
        label={t`LOCATION`}
      >
        <RetroCombobox
          options={locationOptions}
          placeholder={t`Search locations…`}
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
