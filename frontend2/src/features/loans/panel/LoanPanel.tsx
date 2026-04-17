import {
  forwardRef,
  useCallback,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useLingui } from "@lingui/react/macro";
import { RetroButton } from "@/components/retro";
import {
  SlideOverPanel,
  type SlideOverPanelHandle,
} from "@/features/taxonomy/panel/SlideOverPanel";
import { LoanForm } from "../forms/LoanForm";
import {
  useCreateLoan,
  useUpdateLoan,
} from "../hooks/useLoanMutations";
import type { Loan } from "@/lib/api/loans";
import type {
  LoanCreateValues,
  LoanEditValues,
} from "../forms/schemas";

export interface LoanPanelHandle {
  open: (mode: "create" | "edit", loan?: Loan) => void;
  close: () => void;
}

/**
 * LoanPanel — slide-over panel for loan create + edit flows.
 *
 * Mirrors BorrowerPanel / ItemPanel structure:
 *   - forwardRef + useImperativeHandle exposes .open(mode, loan?) and .close()
 *   - LoanForm is the form substrate; formId links the form <-> footer submit
 *   - SlideOverPanel owns the unsaved-changes guard; we just bubble isDirty
 *   - onSubmit wraps the mutation in try/catch — closes on success, keeps
 *     the panel open on error (the mutation hook's onError fires the toast)
 *
 * Title and submit labels come from the UI-SPEC copywriting contract.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const LoanPanel = forwardRef<LoanPanelHandle, {}>(
  function LoanPanel(_props, ref) {
    const { t } = useLingui();
    const panelRef = useRef<SlideOverPanelHandle>(null);
    const [mode, setMode] = useState<"create" | "edit">("create");
    const [loan, setLoan] = useState<Loan | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const formId = useId();

    const createMutation = useCreateLoan();
    const updateMutation = useUpdateLoan();

    useImperativeHandle(ref, () => ({
      open: (m, l) => {
        setMode(m);
        setLoan(l ?? null);
        setIsDirty(false);
        panelRef.current?.open();
      },
      close: () => panelRef.current?.close(),
    }));

    const closeImmediate = useCallback(() => {
      panelRef.current?.closeImmediate();
    }, []);

    const isPending = createMutation.isPending || updateMutation.isPending;
    const title = mode === "create" ? t`NEW LOAN` : t`EDIT LOAN`;
    const submitLabel = isPending
      ? t`WORKING…`
      : mode === "create"
        ? t`CREATE LOAN`
        : t`SAVE LOAN`;

    const onSubmit = async (values: LoanCreateValues | LoanEditValues) => {
      try {
        if (mode === "create") {
          await createMutation.mutateAsync(values as LoanCreateValues);
        } else if (loan) {
          await updateMutation.mutateAsync({
            id: loan.id,
            input: values as LoanEditValues,
          });
        }
        closeImmediate();
      } catch {
        // Mutation hook toasts; keep the panel open so the user can retry.
      }
    };

    return (
      <SlideOverPanel
        ref={panelRef}
        title={title}
        isDirty={isDirty}
        onClose={() => setIsDirty(false)}
        footer={
          <>
            <RetroButton
              variant="neutral"
              type="button"
              onClick={() => panelRef.current?.close()}
            >
              {t`← BACK`}
            </RetroButton>
            <RetroButton
              variant="primary"
              type="submit"
              disabled={isPending}
              form={formId}
            >
              <span className={isPending ? "font-mono" : ""}>
                {submitLabel}
              </span>
            </RetroButton>
          </>
        }
      >
        <LoanForm
          formId={formId}
          mode={mode}
          loan={loan ?? undefined}
          onSubmit={onSubmit}
          onDirtyChange={setIsDirty}
        />
      </SlideOverPanel>
    );
  },
);

LoanPanel.displayName = "LoanPanel";

export { LoanPanel };
