import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  RetroDialog,
  BevelButton,
  RetroInput,
  RetroSelect,
  RetroTextarea,
  retroToast,
} from "@/components/retro";
import { HttpError } from "@/lib/api";
import type {
  WishlistCreate,
  WishlistItem,
  WishlistStatus,
  WishlistUpdate,
} from "@/lib/api/wishlist";
import { useWishlistMutations } from "../hooks/useWishlistMutations";

// Phase 14 Plan 03 — wishlist create/edit dialog (WISH-02). RHF + zod over the
// retro form atoms inside a RetroDialog (the CategoryFormDialog field idiom in a
// centered modal). price_estimate is the only conversion: the input is the MAJOR
// unit (e.g. 49.99) and is stored as CENTS (×100 on submit, ÷100 on load) — the
// backend owns cents (T-10b-01). The status field shows only in EDIT mode (the
// transition path for WISH-02). An illegal transition returns 409
// (ErrInvalidStatusTransition); onError reads HttpError.status === 409 and sets
// a calm form-level error rather than crashing (T-14-07).

const STATUSES: WishlistStatus[] = ["wanted", "ordered", "acquired"];

// zod schema. Strings default to "" so RHF holds controlled inputs; price/priority
// are coerced numbers. price is the MAJOR unit here (cents conversion happens at
// submit/load — kept explicit and tested).
const wishlistFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required." })
    .max(200, { message: "Name is too long (max 200)." }),
  notes: z.string().max(10000).optional().default(""),
  url: z.string().max(2000).optional().default(""),
  // Major-unit price as a string from the number input; "" → undefined (omit).
  price: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return undefined;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isNaN(n) ? undefined : n;
    })
    .pipe(
      z.number().min(0, { message: "Price can't be negative." }).optional(),
    ),
  // 3-letter ISO code or empty.
  currency_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, { message: "Use a 3-letter code (e.g. EUR)." })
    .optional()
    .or(z.literal("")),
  priority: z.coerce
    .number()
    .int()
    .min(1, { message: "Priority is 1–5." })
    .max(5, { message: "Priority is 1–5." }),
  status: z.enum(["wanted", "ordered", "acquired"]),
});

type WishlistFormInput = z.input<typeof wishlistFormSchema>;
type WishlistFormValues = z.infer<typeof wishlistFormSchema>;

export interface WishlistFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  /** The item being edited (edit mode only). */
  item?: WishlistItem;
  onClose: () => void;
}

const EMPTY_DEFAULTS: WishlistFormInput = {
  name: "",
  notes: "",
  url: "",
  price: "",
  currency_code: "",
  priority: 3,
  status: "wanted",
};

// Map a loaded item to the form input shape. price_estimate is CENTS → major unit.
function itemToDefaults(item: WishlistItem): WishlistFormInput {
  return {
    name: item.name,
    notes: item.notes ?? "",
    url: item.url ?? "",
    price:
      item.price_estimate === undefined
        ? ""
        : String(item.price_estimate / 100),
    currency_code: item.currency_code ?? "",
    priority: item.priority,
    status: item.status,
  };
}

export function WishlistFormDialog({
  open,
  mode,
  item,
  onClose,
}: WishlistFormDialogProps) {
  const { t } = useLingui();
  const isEdit = mode === "edit";
  const { create, update } = useWishlistMutations();
  const createItem = create.mutateAsync;
  const updateItem = update.mutateAsync;

  const defaultValues = useMemo<WishlistFormInput>(
    () => (isEdit && item ? itemToDefaults(item) : EMPTY_DEFAULTS),
    [isEdit, item],
  );

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WishlistFormInput>({
    resolver: zodResolver(wishlistFormSchema),
    defaultValues,
  });

  // Re-seed when the edited item changes (or the dialog re-opens).
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  async function onSubmit(raw: WishlistFormInput) {
    const values: WishlistFormValues = wishlistFormSchema.parse(raw);
    // Build the wire body. price (major unit) → CENTS. Empty optionals omitted.
    const base: WishlistCreate = {
      name: values.name,
      priority: values.priority,
    };
    if (values.notes) base.notes = values.notes;
    if (values.url) base.url = values.url;
    if (values.price !== undefined) {
      base.price_estimate = Math.round(values.price * 100);
    }
    if (values.currency_code) base.currency_code = values.currency_code;

    try {
      if (isEdit && item) {
        const body: WishlistUpdate = { ...base, status: values.status };
        await updateItem({ id: item.id, body });
        retroToast.success(t`Wishlist item saved.`);
      } else {
        const body: WishlistCreate & { status: WishlistStatus } = {
          ...base,
          status: values.status,
        };
        await createItem(body);
        retroToast.success(t`Added to wishlist.`);
      }
      onClose();
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) {
        // Illegal status transition — surface calmly, never crash (T-14-07).
        setError("root", { message: t`That status change isn't allowed.` });
      } else {
        retroToast.error(t`Couldn't save this wishlist item.`);
        setError("root", { message: t`Couldn't save this wishlist item.` });
      }
    }
  }

  const titleText = isEdit ? t`EDIT WISHLIST ITEM` : t`ADD TO WISHLIST`;
  const submitLabel = isEdit ? t`Save changes` : t`Add item`;

  return (
    <RetroDialog
      open={open}
      onClose={onClose}
      title={titleText}
      titlebarVariant="blue"
      footer={
        <>
          <BevelButton type="button" variant="neutral" onClick={onClose}>
            <Trans>Cancel</Trans>
          </BevelButton>
          <BevelButton
            type="submit"
            form="wishlist-form"
            variant="primary"
            disabled={isSubmitting}
          >
            {submitLabel}
          </BevelButton>
        </>
      }
    >
      <form
        id="wishlist-form"
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

        <RetroInput
          label={<Trans>URL</Trans>}
          mono
          error={errors.url?.message}
          {...register("url")}
        />

        <div className="grid grid-cols-2 gap-sp-3">
          <RetroInput
            label={<Trans>Price estimate</Trans>}
            type="number"
            min={0}
            step="0.01"
            mono
            error={errors.price?.message}
            {...register("price")}
          />
          <RetroInput
            label={<Trans>Currency</Trans>}
            mono
            placeholder="EUR"
            error={errors.currency_code?.message}
            {...register("currency_code")}
          />
        </div>

        <div className="grid grid-cols-2 gap-sp-3">
          <RetroSelect
            label={<Trans>Priority</Trans>}
            error={errors.priority?.message}
            {...register("priority")}
          >
            {[1, 2, 3, 4, 5].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </RetroSelect>
          {/* Status drives the WISH-02 transition — shown in edit mode only. */}
          {isEdit && (
            <RetroSelect
              label={<Trans>Status</Trans>}
              error={errors.status?.message}
              {...register("status")}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "wanted"
                    ? t`Wanted`
                    : s === "ordered"
                      ? t`Ordered`
                      : t`Acquired`}
                </option>
              ))}
            </RetroSelect>
          )}
        </div>

        <RetroTextarea
          label={<Trans>Notes</Trans>}
          error={errors.notes?.message}
          {...register("notes")}
        />
      </form>
    </RetroDialog>
  );
}
