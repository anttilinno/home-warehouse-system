import {
  forwardRef,
  useCallback,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useLingui } from "@lingui/react/macro";
import { RetroButton, type RetroOption } from "@/components/retro";
import {
  SlideOverPanel,
  type SlideOverPanelHandle,
} from "./SlideOverPanel";
import { CategoryForm } from "../forms/CategoryForm";
import { LocationForm } from "../forms/LocationForm";
import { ContainerForm } from "../forms/ContainerForm";
import {
  useCreateCategory,
  useUpdateCategory,
} from "../hooks/useCategoryMutations";
import {
  useCreateLocation,
  useUpdateLocation,
} from "../hooks/useLocationMutations";
import {
  useCreateContainer,
  useUpdateContainer,
} from "../hooks/useContainerMutations";
import type { CategoryCreateValues } from "../forms/schemas";
import type { LocationCreateValues } from "../forms/schemas";
import type { ContainerCreateValues } from "../forms/schemas";

export type EntityKind = "category" | "location" | "container";

interface NodeWithId {
  id: string;
  [key: string]: unknown;
}

export interface EntityPanelProps {
  kind: EntityKind;
  parentOptions?: RetroOption[];
  locationOptions?: RetroOption[];
}

export interface EntityPanelHandle {
  open: (mode: "create" | "edit", node?: unknown) => void;
  close: () => void;
}

const EntityPanel = forwardRef<EntityPanelHandle, EntityPanelProps>(
  function EntityPanel(
    { kind, parentOptions = [], locationOptions = [] },
    ref,
  ) {
    const { t } = useLingui();
    const panelRef = useRef<SlideOverPanelHandle>(null);
    const [mode, setMode] = useState<"create" | "edit">("create");
    const [node, setNode] = useState<NodeWithId | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const formId = useId();

    // Mutations — instantiate all (cheap) so render branches stay simple
    const createCategory = useCreateCategory();
    const updateCategory = useUpdateCategory();
    const createLocation = useCreateLocation();
    const updateLocation = useUpdateLocation();
    const createContainer = useCreateContainer();
    const updateContainer = useUpdateContainer();

    useImperativeHandle(ref, () => ({
      open: (m, n) => {
        setMode(m);
        setNode((n as NodeWithId | undefined) ?? null);
        setIsDirty(false);
        panelRef.current?.open();
      },
      close: () => panelRef.current?.close(),
    }));

    const closePanel = useCallback(() => {
      panelRef.current?.closeImmediate();
    }, []);

    const titles: Record<EntityKind, { create: string; edit: string }> = {
      category: { create: t`NEW CATEGORY`, edit: t`EDIT CATEGORY` },
      location: { create: t`NEW LOCATION`, edit: t`EDIT LOCATION` },
      container: { create: t`NEW CONTAINER`, edit: t`EDIT CONTAINER` },
    };
    const submitLabels: Record<EntityKind, { create: string; edit: string }> = {
      category: { create: t`CREATE CATEGORY`, edit: t`SAVE CATEGORY` },
      location: { create: t`CREATE LOCATION`, edit: t`SAVE LOCATION` },
      container: { create: t`CREATE CONTAINER`, edit: t`SAVE CONTAINER` },
    };

    const isPending =
      createCategory.isPending ||
      updateCategory.isPending ||
      createLocation.isPending ||
      updateLocation.isPending ||
      createContainer.isPending ||
      updateContainer.isPending;

    const submitLabel = isPending
      ? t`WORKING…`
      : submitLabels[kind][mode];
    const title = titles[kind][mode];

    const onCategorySubmit = async (values: CategoryCreateValues) => {
      if (mode === "create") {
        await createCategory.mutateAsync(values);
      } else if (node) {
        await updateCategory.mutateAsync({ id: node.id, input: values });
      }
      closePanel();
    };
    const onLocationSubmit = async (values: LocationCreateValues) => {
      if (mode === "create") {
        await createLocation.mutateAsync(values);
      } else if (node) {
        await updateLocation.mutateAsync({ id: node.id, input: values });
      }
      closePanel();
    };
    const onContainerSubmit = async (values: ContainerCreateValues) => {
      if (mode === "create") {
        await createContainer.mutateAsync(values);
      } else if (node) {
        await updateContainer.mutateAsync({ id: node.id, input: values });
      }
      closePanel();
    };

    const formNode =
      kind === "category" ? (
        <CategoryForm
          formId={formId}
          parentOptions={parentOptions}
          onSubmit={onCategorySubmit}
          onDirtyChange={setIsDirty}
          defaultValues={
            mode === "edit" && node
              ? (node as unknown as Partial<CategoryCreateValues>)
              : undefined
          }
        />
      ) : kind === "location" ? (
        <LocationForm
          formId={formId}
          parentOptions={parentOptions}
          onSubmit={onLocationSubmit}
          onDirtyChange={setIsDirty}
          defaultValues={
            mode === "edit" && node
              ? (node as unknown as Partial<LocationCreateValues>)
              : undefined
          }
        />
      ) : (
        <ContainerForm
          formId={formId}
          locationOptions={locationOptions}
          onSubmit={onContainerSubmit}
          onDirtyChange={setIsDirty}
          defaultValues={
            mode === "edit" && node
              ? (node as unknown as Partial<ContainerCreateValues>)
              : undefined
          }
        />
      );

    return (
      <SlideOverPanel
        ref={panelRef}
        title={title}
        isDirty={isDirty}
        onClose={() => {
          setIsDirty(false);
        }}
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
        {formNode}
      </SlideOverPanel>
    );
  },
);

EntityPanel.displayName = "EntityPanel";

export { EntityPanel };
