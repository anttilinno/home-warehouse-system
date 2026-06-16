import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import {
  Window,
  BevelButton,
  RetroInput,
  RetroTextarea,
  RetroCombobox,
  RetroConfirmDialog,
  type RetroComboboxOption,
} from "@/components/retro";
import {
  categoryApi,
  type Category,
  type CreateCategoryBody,
} from "@/lib/api/category";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import {
  categorySchema,
  type CategoryFormInput,
  type CategoryFormValues,
} from "../schema";
import { useCategoriesQuery } from "../hooks/useCategoriesQuery";
import {
  useCategoryMutations,
  type UpdateCategoryArg,
} from "../hooks/useCategoryMutations";
import { buildTree, type TreeNode } from "@/features/taxonomy/lib/buildTree";

// Phase 10 Plan 02 — the category create/edit form (TAX-01). Despite the
// "Dialog" name it is a ROUTED blue Window (the InventoryFormPage / BorrowerForm
// idiom): /taxonomy/categories/new + /taxonomy/categories/:id/edit. RHF + zod
// (categorySchema). Fields name / description / parent (RetroCombobox of
// flattened categories EXCLUDING self + descendants — no cycles; empty = root).
// On submit it create/update.mutateAsync then navigates back to
// /taxonomy?tab=categories. Cancel with a dirty form opens the butter DISCARD
// confirm. Render-loop guard: destructure the stable .mutateAsync handlers.

export interface CategoryFormDialogProps {
  mode: "create" | "edit";
}

const EMPTY_DEFAULTS: CategoryFormInput = {
  name: "",
  parent_category_id: "",
  description: "",
};

function categoryToDefaults(c: Category): CategoryFormInput {
  return {
    name: c.name,
    parent_category_id: c.parent_category_id ?? "",
    description: c.description ?? "",
  };
}

// Flatten the category tree into combobox options, EXCLUDING `excludeId` and all
// of its descendants (cycle prevention). Indent label by depth so the hierarchy
// reads in the flat list.
function flattenExcluding(
  nodes: TreeNode<Category>[],
  excludeId: string | undefined,
  out: RetroComboboxOption[],
): RetroComboboxOption[] {
  for (const n of nodes) {
    if (excludeId && n.node.id === excludeId) continue; // skip self + subtree
    const prefix = n.depth > 0 ? `${"  ".repeat(n.depth)}` : "";
    out.push({ value: n.node.id, label: `${prefix}${n.node.name}` });
    flattenExcluding(n.children, excludeId, out);
  }
  return out;
}

export function CategoryFormDialog({ mode }: Readonly<CategoryFormDialogProps>) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { currentWorkspaceId: wsId } = useWorkspace();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = mode === "edit";

  const { rows } = useCategoriesQuery();

  // Edit mode: load the category under the detail prefix so the mutation
  // invalidate (["categories", wsId]) covers it.
  const catQuery = useQuery({
    queryKey: ["categories", wsId, "detail", id],
    queryFn: () => categoryApi.get(wsId as string, id as string),
    enabled: isEdit && Boolean(wsId) && Boolean(id),
  });

  const { create, update } = useCategoryMutations();
  const createCategory = create.mutateAsync;
  const updateCategory = update.mutateAsync;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isDirty, isSubmitting, isSubmitSuccessful },
  } = useForm<CategoryFormInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  // Create mode: seed the parent from ?parent= (the row ⊕ add-child deep link).
  useEffect(() => {
    if (!isEdit) {
      const parent = searchParams.get("parent");
      if (parent) setValue("parent_category_id", parent);
    }
  }, [isEdit, searchParams, setValue]);

  // Edit mode: reset the form to the loaded category.
  useEffect(() => {
    if (isEdit && catQuery.data) {
      reset(categoryToDefaults(catQuery.data));
    }
  }, [isEdit, catQuery.data, reset]);

  // Parent options: the flattened tree EXCLUDING self + descendants (cycles).
  const parentOptions = useMemo(() => {
    const tree = buildTree(rows, (c) => c.parent_category_id);
    return flattenExcluding(tree, isEdit ? id : undefined, []);
  }, [rows, isEdit, id]);

  const parentValue = watch("parent_category_id") ?? "";

  // Dirty-form navigation guard.
  const [pendingLeave, setPendingLeave] = useState<string | null>(null);
  const guardActive = isDirty && !isSubmitSuccessful;

  useEffect(() => {
    if (!guardActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      // preventDefault() alone triggers the browser's unsaved-changes prompt
      // (the legacy returnValue assignment is deprecated).
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [guardActive]);

  function attemptLeave(to: string) {
    if (guardActive) setPendingLeave(to);
    else navigate(to);
  }

  async function onSubmit(raw: CategoryFormInput) {
    const values: CategoryFormValues = categorySchema.parse(raw);
    // OMIT-EMPTY: a blank optional is never sent as "".
    const body: CreateCategoryBody = { name: values.name };
    if (values.parent_category_id)
      body.parent_category_id = values.parent_category_id;
    if (values.description) body.description = values.description;

    try {
      if (isEdit && id) {
        const arg: UpdateCategoryArg = { id, body };
        await updateCategory(arg);
      } else {
        await createCategory(body);
      }
      navigate("/taxonomy?tab=categories");
    } catch {
      setError("root", { message: t`Couldn't save this category.` });
    }
  }

  const titleText = isEdit ? t`EDIT CATEGORY` : t`NEW CATEGORY`;
  const submitLabel = isEdit ? t`Save changes` : t`Save category`;

  return (
    <div className="mx-auto max-w-[560px]">
      <Window title={titleText} titlebarVariant="blue">
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
            <RetroCombobox
              label={<Trans>Parent category</Trans>}
              options={parentOptions}
              value={parentValue}
              onChange={(v) =>
                setValue("parent_category_id", v, { shouldDirty: true })
              }
              placeholder={t`(Root — no parent)`}
              error={errors.parent_category_id?.message}
            />
            <p className="text-12 text-fg-muted">
              <Trans>Leave empty to create a top-level category.</Trans>
            </p>
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

          <div className="flex justify-end gap-sp-2 border-t-2 border-border-ink pt-sp-3">
            <BevelButton
              type="button"
              variant="neutral"
              onClick={() => attemptLeave("/taxonomy?tab=categories")}
            >
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
      </Window>

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
