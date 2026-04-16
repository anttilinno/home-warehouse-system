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
import { ItemForm } from "../forms/ItemForm";
import { generateSku, type ItemCreateValues } from "../forms/schemas";
import { useCreateItem, useUpdateItem } from "../hooks/useItemMutations";
import type { Item } from "@/lib/api/items";

export interface ItemPanelHandle {
  open: (mode: "create" | "edit", item?: Item) => void;
  close: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const ItemPanel = forwardRef<ItemPanelHandle, {}>(
  function ItemPanel(_props, ref) {
    const { t } = useLingui();
    const panelRef = useRef<SlideOverPanelHandle>(null);
    const [mode, setMode] = useState<"create" | "edit">("create");
    const [item, setItem] = useState<Item | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    // When the panel opens in create mode we generate a SKU once per open
    // and thread it through defaultValues.sku. Storing in state prevents
    // regeneration on every re-render — the user sees a single stable value.
    const [generatedSku, setGeneratedSku] = useState<string>("");
    const formId = useId();

    const createMutation = useCreateItem();
    const updateMutation = useUpdateItem();

    useImperativeHandle(ref, () => ({
      open: (m, i) => {
        setMode(m);
        setItem(i ?? null);
        setIsDirty(false);
        if (m === "create") {
          setGeneratedSku(generateSku());
        } else {
          setGeneratedSku("");
        }
        panelRef.current?.open();
      },
      close: () => panelRef.current?.close(),
    }));

    const closePanel = useCallback(() => {
      panelRef.current?.closeImmediate();
    }, []);

    const isPending = createMutation.isPending || updateMutation.isPending;
    const title = mode === "create" ? t`NEW ITEM` : t`EDIT ITEM`;
    const submitLabel = isPending
      ? t`WORKING…`
      : mode === "create"
        ? t`CREATE ITEM`
        : t`SAVE ITEM`;

    const onSubmit = async (values: ItemCreateValues) => {
      try {
        if (mode === "create") {
          await createMutation.mutateAsync(values);
        } else if (item) {
          await updateMutation.mutateAsync({ id: item.id, input: values });
        }
        closePanel();
      } catch {
        // Keep the panel open on error — the mutation's onError emits a
        // toast with an actionable message (e.g. SKU collision). The user
        // can edit the SKU and retry without re-entering other fields.
      }
    };

    const defaultValues: Partial<ItemCreateValues> | undefined =
      mode === "edit" && item
        ? {
            name: item.name,
            sku: item.sku,
            barcode: item.barcode ?? "",
            description: item.description ?? "",
            category_id: item.category_id ?? "",
          }
        : mode === "create"
          ? { sku: generatedSku }
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
        <ItemForm
          formId={formId}
          onSubmit={onSubmit}
          onDirtyChange={setIsDirty}
          defaultValues={defaultValues}
        />
      </SlideOverPanel>
    );
  },
);

ItemPanel.displayName = "ItemPanel";

export { ItemPanel };
