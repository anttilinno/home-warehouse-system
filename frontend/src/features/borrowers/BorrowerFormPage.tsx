import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import {
  Window,
  BevelButton,
  RetroInput,
  RetroTextarea,
  RetroConfirmDialog,
} from "@/components/retro";
import {
  borrowersApi,
  type Borrower,
  type CreateBorrowerBody,
} from "@/lib/api/borrowers";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import {
  borrowerFormSchema,
  type BorrowerFormInput,
  type BorrowerFormValues,
} from "./schema";
import {
  useBorrowerMutations,
  type UpdateBorrowerArg,
} from "./hooks/useBorrowerMutations";

// Phase 9 Plan 03 — the borrower create/edit form (BORR-02 create, BORR-04
// edit). MIRRORS LoanFormPage / InventoryFormPage: one blue Window
// (NEW BORROWER / EDIT BORROWER), centered max-w-[560px], RHF + zod, a dirty
// navigation guard, the form-level error banner, and a pinned footer.
//
// Mode is driven by useParams: create when there is no :id, edit when present.
// Edit mode fetches the borrower via borrowersApi.get and reset()s the form to
// it when the query resolves (mirror InventoryFormPage entryToDefaults).
//
// OMIT-EMPTY (binding override #4 / Pitfall 6): optional fields default to ""
// in the schema so dirtyFields stays meaningful; onSubmit builds the wire body
// with `if (v.field) body.field = v.field` — a blank optional is NEVER sent as
// "". Email is validated only when supplied (schema refinement).
//
// Navigation on success: create → /borrowers/:newId (where the loan panels
// mount), edit → /borrowers/:id.

const EMPTY_DEFAULTS: BorrowerFormInput = {
  name: "",
  email: "",
  phone: "",
  notes: "",
};

// Map a loaded borrower to the form's INPUT shape (edit-mode reset). Missing
// optionals become "" so the OMIT-EMPTY discipline + dirtyFields hold.
function borrowerToDefaults(b: Borrower): BorrowerFormInput {
  return {
    name: b.name,
    email: b.email ?? "",
    phone: b.phone ?? "",
    notes: b.notes ?? "",
  };
}

export function BorrowerFormPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { currentWorkspaceId: wsId } = useWorkspace();
  const { id } = useParams();
  const isEdit = Boolean(id);

  // Edit mode: load the borrower under the detail prefix so the mutation
  // invalidate (["borrowers", wsId]) covers it.
  const borrowerQuery = useQuery({
    queryKey: ["borrowers", wsId as string, "detail", id],
    queryFn: () => borrowersApi.get(wsId as string, id as string),
    enabled: isEdit && Boolean(wsId) && Boolean(id),
  });

  const { create, update } = useBorrowerMutations();
  // RQ v5 returns a fresh mutation object per render but .mutateAsync identity
  // is stable — destructure the stable fns (render-loop guard).
  const createBorrower = create.mutateAsync;
  const updateBorrower = update.mutateAsync;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting, isSubmitSuccessful },
  } = useForm<BorrowerFormInput>({
    resolver: zodResolver(borrowerFormSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  // When the edit borrower loads, reset the form to it (keeps dirtyFields
  // meaningful) — verbatim InventoryFormPage pattern.
  useEffect(() => {
    if (isEdit && borrowerQuery.data) {
      reset(borrowerToDefaults(borrowerQuery.data));
    }
  }, [isEdit, borrowerQuery.data, reset]);

  // Dirty-form navigation guard (form pattern — no useBlocker in
  // declarative-router mode). attemptLeave opens the butter confirm when dirty;
  // a beforeunload listener catches reload/tab-close.
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
    if (guardActive) {
      setPendingLeave(to);
    } else {
      navigate(to);
    }
  }

  async function onSubmit(raw: BorrowerFormInput) {
    const values: BorrowerFormValues = borrowerFormSchema.parse(raw);
    // Build the wire body OMITTING empty optionals — never zero-inject "".
    const body: CreateBorrowerBody = { name: values.name };
    if (values.email) body.email = values.email;
    if (values.phone) body.phone = values.phone;
    if (values.notes) body.notes = values.notes;

    try {
      if (isEdit && id) {
        const arg: UpdateBorrowerArg = { id, body };
        await updateBorrower(arg);
        navigate(`/borrowers/${id}`);
      } else {
        const created = await createBorrower(body);
        navigate(`/borrowers/${created.id}`);
      }
    } catch {
      setError("root", { message: t`Couldn't save this borrower.` });
    }
  }

  function handleCancel() {
    attemptLeave(isEdit && id ? `/borrowers/${id}` : "/borrowers");
  }

  const titleText = isEdit ? t`EDIT BORROWER` : t`NEW BORROWER`;
  const submitLabel = isEdit ? t`Save changes` : t`Save borrower`;

  return (
    <div className="mx-auto max-w-[560px]">
      <Window title={titleText} titlebarVariant="blue">
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-sp-4"
        >
          {/* Form-level error banner (submit/server failure). */}
          {errors.root?.message && (
            <div
              role="alert"
              className="border-2 border-border-ink bg-danger-bg p-sp-3 text-14 text-danger"
            >
              <span aria-hidden="true">✕ </span>
              {errors.root.message}
            </div>
          )}

          {/* Name (required). */}
          <RetroInput
            label={<Trans>Name</Trans>}
            required
            aria-required="true"
            error={errors.name?.message}
            {...register("name")}
          />

          {/* Email (optional — validated only when supplied). */}
          <div className="flex flex-col gap-sp-2">
            <RetroInput
              label={<Trans>Email</Trans>}
              type="email"
              mono
              error={errors.email?.message}
              {...register("email")}
            />
            <p className="text-12 text-fg-muted">
              <Trans>Optional — used to identify the borrower.</Trans>
            </p>
          </div>

          {/* Phone (optional). */}
          <div className="flex flex-col gap-sp-2">
            <RetroInput
              label={<Trans>Phone</Trans>}
              mono
              error={errors.phone?.message}
              {...register("phone")}
            />
            <p className="text-12 text-fg-muted">
              <Trans>Optional.</Trans>
            </p>
          </div>

          {/* Notes (optional). */}
          <div className="flex flex-col gap-sp-2">
            <RetroTextarea
              label={<Trans>Notes</Trans>}
              error={errors.notes?.message}
              {...register("notes")}
            />
            <p className="text-12 text-fg-muted">
              <Trans>Optional.</Trans>
            </p>
          </div>

          {/* Footer — pinned action row. */}
          <div className="flex justify-end gap-sp-2 border-t-2 border-border-ink pt-sp-3">
            <BevelButton type="button" variant="neutral" onClick={handleCancel}>
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
        <Trans>Your changes will be lost.</Trans>
      </RetroConfirmDialog>
    </div>
  );
}
