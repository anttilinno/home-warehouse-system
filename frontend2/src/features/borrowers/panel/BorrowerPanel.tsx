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
import { BorrowerForm } from "../forms/BorrowerForm";
import {
  useCreateBorrower,
  useUpdateBorrower,
} from "../hooks/useBorrowerMutations";
import type { BorrowerCreateValues } from "../forms/schemas";
import type { Borrower } from "@/lib/api/borrowers";

export interface BorrowerPanelHandle {
  open: (mode: "create" | "edit", borrower?: Borrower) => void;
  close: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const BorrowerPanel = forwardRef<BorrowerPanelHandle, {}>(
  function BorrowerPanel(_props, ref) {
    const { t } = useLingui();
    const panelRef = useRef<SlideOverPanelHandle>(null);
    const [mode, setMode] = useState<"create" | "edit">("create");
    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const formId = useId();

    const createMutation = useCreateBorrower();
    const updateMutation = useUpdateBorrower();

    useImperativeHandle(ref, () => ({
      open: (m, b) => {
        setMode(m);
        setBorrower(b ?? null);
        setIsDirty(false);
        panelRef.current?.open();
      },
      close: () => panelRef.current?.close(),
    }));

    const closePanel = useCallback(() => {
      panelRef.current?.closeImmediate();
    }, []);

    const isPending = createMutation.isPending || updateMutation.isPending;
    const title = mode === "create" ? t`NEW BORROWER` : t`EDIT BORROWER`;
    const submitLabel = isPending
      ? t`WORKING…`
      : mode === "create"
        ? t`CREATE BORROWER`
        : t`SAVE BORROWER`;

    const onSubmit = async (values: BorrowerCreateValues) => {
      if (mode === "create") {
        await createMutation.mutateAsync(values);
      } else if (borrower) {
        await updateMutation.mutateAsync({ id: borrower.id, input: values });
      }
      closePanel();
    };

    const defaultValues: Partial<BorrowerCreateValues> | undefined =
      mode === "edit" && borrower
        ? {
            name: borrower.name,
            email: borrower.email ?? "",
            phone: borrower.phone ?? "",
            notes: borrower.notes ?? "",
          }
        : undefined;

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
        <BorrowerForm
          formId={formId}
          onSubmit={onSubmit}
          onDirtyChange={setIsDirty}
          defaultValues={defaultValues}
        />
      </SlideOverPanel>
    );
  },
);

BorrowerPanel.displayName = "BorrowerPanel";

export { BorrowerPanel };
