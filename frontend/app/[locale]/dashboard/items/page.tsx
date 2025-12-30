"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useMemo } from "react";
import { useTheme } from "next-themes";
import { Icon } from "@/components/icons";
import {
  itemsApi,
  categoriesApi,
  getTranslatedErrorMessage,
  Item,
  ItemCreate,
  ItemUpdate,
  Category,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { CategorySelect } from "@/components/ui/category-select";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { LinkedDocuments } from "@/components/docspell";
import { NES_RED } from "@/lib/nes-colors";
import {
  RetroPageHeader,
  RetroButton,
  RetroTable,
  RetroEmptyState,
  RetroModal,
  RetroFormGroup,
  RetroLabel,
  RetroInput,
  RetroTextarea,
  RetroCheckbox,
  RetroError,
} from "@/components/retro";

export default function ItemsPage() {
  const { isAuthenticated, isLoading: authLoading, canEdit } = useAuth();
  const router = useRouter();
  const t = useTranslations("items");
  const te = useTranslations("errors");
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");

  // Data state
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [templateItem, setTemplateItem] = useState<Item | null>(null);

  // Lookup map for category names
  const categoryMap = useMemo(
    () => new Map(categories.map((cat) => [cat.id, cat])),
    [categories]
  );

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categoryMap.get(categoryId)?.name || "Unknown";
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsData, categoriesData] = await Promise.all([
        itemsApi.list(),
        categoriesApi.list(),
      ]);
      setItems(itemsData);
      setCategories(categoriesData);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load items";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: Item) => {
    setSelectedItem(item);
    setIsEditModalOpen(true);
  };

  const handleDelete = (item: Item) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };

  const handleDuplicate = (item: Item) => {
    setTemplateItem(item);
    setIsCreateModalOpen(true);
  };

  if (authLoading || loading) {
    if (isRetro) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="retro-small uppercase font-bold animate-pulse retro-heading">
            Loading...
          </p>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    if (isRetro) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-primary mb-4 retro-body">{error}</p>
            <RetroButton variant="primary" onClick={fetchData}>
              {t("tryAgain")}
            </RetroButton>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            {t("tryAgain")}
          </button>
        </div>
      </div>
    );
  }

  // Retro NES theme
  if (isRetro) {
    return (
      <>
        {/* Header */}
        <RetroPageHeader
          title={t("title")}
          subtitle={`${items.length} ITEMS IN CATALOG`}
          actions={
            canEdit && (
              <RetroButton
                variant="secondary"
                icon="Plus"
                onClick={() => setIsCreateModalOpen(true)}
              >
                {t("addItem")}
              </RetroButton>
            )
          }
        />

        {/* Table */}
        {items.length === 0 ? (
          <RetroEmptyState
            icon="Tag"
            message={t("noItems")}
            action={
              canEdit
                ? {
                    label: t("addItem"),
                    onClick: () => setIsCreateModalOpen(true),
                    icon: "Plus",
                  }
                : undefined
            }
          />
        ) : (
          <RetroTable>
            <RetroTable.Head>
              <RetroTable.Row>
                <RetroTable.Th>{t("sku")}</RetroTable.Th>
                <RetroTable.Th>{t("name")}</RetroTable.Th>
                <RetroTable.Th>{t("category")}</RetroTable.Th>
                <RetroTable.Th align="right">{t("actions")}</RetroTable.Th>
              </RetroTable.Row>
            </RetroTable.Head>
            <RetroTable.Body>
              {items.map((item) => (
                <RetroTable.Row
                  key={item.id}
                  clickable
                  onDoubleClick={() => router.push(`/dashboard/items/${item.id}`)}
                >
                  <RetroTable.Td>
                    <span className="px-2 py-1 bg-muted border-2 border-border retro-small font-mono retro-body">
                      {item.sku}
                    </span>
                  </RetroTable.Td>
                  <RetroTable.Td>
                    <div className="flex items-center gap-2">
                      <Icon name="Tag" className="w-4 h-4 text-muted-foreground" />
                      <span className="retro-body text-foreground">
                        {item.name}
                      </span>
                    </div>
                  </RetroTable.Td>
                  <RetroTable.Td>
                    {item.category_id ? (
                      <div className="flex items-center gap-2 retro-body text-foreground">
                        <Icon name="Archive" className="w-4 h-4 text-muted-foreground" />
                        {getCategoryName(item.category_id)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground retro-body">{t("noCategory")}</span>
                    )}
                  </RetroTable.Td>
                  <RetroTable.Td align="right">
                    <div className="retro-td__actions">
                      <button
                        onClick={() => router.push(`/dashboard/items/${item.id}`)}
                        title={t("view")}
                        className="retro-icon-btn"
                      >
                        <Icon name="Eye" className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                      <FavoriteButton
                        entityType="ITEM"
                        entityId={item.id}
                        size="sm"
                        className="retro-icon-btn"
                      />
                      {item.obsidian_url && (
                        <a
                          href={item.obsidian_url}
                          title={t("openInObsidian")}
                          className="retro-icon-btn"
                        >
                          <Icon name="FileText" className="w-4 h-4 text-purple-500" />
                        </a>
                      )}
                      {canEdit && (
                        <>
                          <button
                            onClick={() => handleDuplicate(item)}
                            title={t("duplicate")}
                            className="retro-icon-btn"
                          >
                            <Icon name="Copy" className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </button>
                          <button
                            onClick={() => handleEdit(item)}
                            title={t("edit")}
                            className="retro-icon-btn"
                          >
                            <Icon name="Pencil" className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            title={t("delete")}
                            className="retro-icon-btn retro-icon-btn--danger"
                          >
                            <Icon name="Trash2" className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </RetroTable.Td>
                </RetroTable.Row>
              ))}
            </RetroTable.Body>
          </RetroTable>
        )}

        {/* Modals */}
        <CreateEditModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setTemplateItem(null);
          }}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            setTemplateItem(null);
            fetchData();
          }}
          template={templateItem}
          categories={categories}
          t={t}
          te={te}
          isRetro={isRetro}
        />

        <CreateEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedItem(null);
          }}
          onSuccess={() => {
            setIsEditModalOpen(false);
            setSelectedItem(null);
            fetchData();
          }}
          item={selectedItem}
          categories={categories}
          t={t}
          te={te}
          isRetro={isRetro}
        />

        {selectedItem && (
          <DeleteConfirmModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setSelectedItem(null);
            }}
            onSuccess={() => {
              setIsDeleteModalOpen(false);
              setSelectedItem(null);
              fetchData();
            }}
            item={selectedItem}
            t={t}
            te={te}
            isRetro={isRetro}
          />
        )}
      </>
    );
  }

  // Standard theme
  return (
    <>
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Icon name="Plus" className="w-4 h-4" />
            {t("addItem")}
          </button>
        )}
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="bg-card border rounded-lg p-12 text-center">
          <Icon name="Tag" className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t("noItems")}</p>
          {canEdit && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg inline-flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <Icon name="Plus" className="w-4 h-4" />
              {t("addItem")}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("sku")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("name")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("category")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("description")}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr
                  key={item.id}
                  onDoubleClick={() => router.push(`/dashboard/items/${item.id}`)}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-muted rounded text-xs font-mono">
                      {item.sku}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon name="Tag" className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">
                        {item.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {item.category_id ? (
                      <div className="flex items-center gap-2 text-foreground">
                        <Icon name="Archive" className="w-4 h-4 text-muted-foreground" />
                        {getCategoryName(item.category_id)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{t("noCategory")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.description || t("noDescription")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => router.push(`/dashboard/items/${item.id}`)}
                        title={t("view")}
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                      >
                        <Icon name="Eye" className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                      <FavoriteButton
                        entityType="ITEM"
                        entityId={item.id}
                        size="sm"
                        className="p-1.5"
                      />
                      {item.obsidian_url && (
                        <a
                          href={item.obsidian_url}
                          title={t("openInObsidian")}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                        >
                          <Icon name="FileText" className="w-4 h-4 text-purple-500 hover:text-purple-600" />
                        </a>
                      )}
                      {canEdit && (
                        <>
                          <button
                            onClick={() => handleDuplicate(item)}
                            title={t("duplicate")}
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                          >
                            <Icon name="Copy" className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </button>
                          <button
                            onClick={() => handleEdit(item)}
                            title={t("edit")}
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                          >
                            <Icon name="Pencil" className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            title={t("delete")}
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                          >
                            <Icon name="Trash2" className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <CreateEditModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setTemplateItem(null);
        }}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          setTemplateItem(null);
          fetchData();
        }}
        template={templateItem}
        categories={categories}
        t={t}
        te={te}
        isRetro={false}
      />

      <CreateEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedItem(null);
        }}
        onSuccess={() => {
          setIsEditModalOpen(false);
          setSelectedItem(null);
          fetchData();
        }}
        item={selectedItem}
        categories={categories}
        t={t}
        te={te}
        isRetro={false}
      />

      {selectedItem && (
        <DeleteConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedItem(null);
          }}
          onSuccess={() => {
            setIsDeleteModalOpen(false);
            setSelectedItem(null);
            fetchData();
          }}
          item={selectedItem}
          t={t}
          te={te}
          isRetro={false}
        />
      )}
    </>
  );
}

// Create/Edit Modal Component
function CreateEditModal({
  isOpen,
  onClose,
  onSuccess,
  item,
  template,
  categories,
  t,
  te,
  isRetro,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item?: Item | null;
  template?: Item | null;
  categories: Category[];
  t: (key: string) => string;
  te: (key: string) => string;
  isRetro: boolean;
}) {
  const isEdit = !!item;
  const isDuplicate = !isEdit && !!template;
  const [formData, setFormData] = useState<ItemCreate>({
    sku: "",
    name: "",
    description: null,
    category_id: null,
    brand: null,
    model: null,
    manufacturer: null,
    serial_number: null,
    is_insured: false,
    lifetime_warranty: false,
    warranty_details: null,
    obsidian_vault_path: null,
    obsidian_note_path: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setFormData({
        sku: item.sku,
        name: item.name,
        description: item.description,
        category_id: item.category_id,
        brand: item.brand,
        model: item.model,
        manufacturer: item.manufacturer,
        serial_number: item.serial_number,
        is_insured: item.is_insured,
        lifetime_warranty: item.lifetime_warranty,
        warranty_details: item.warranty_details,
        obsidian_vault_path: item.obsidian_vault_path,
        obsidian_note_path: item.obsidian_note_path,
      });
    } else if (template) {
      setFormData({
        sku: "",
        name: `${template.name} (Copy)`,
        description: template.description,
        category_id: template.category_id,
        brand: template.brand,
        model: template.model,
        manufacturer: template.manufacturer,
        serial_number: null,
        is_insured: template.is_insured,
        lifetime_warranty: template.lifetime_warranty,
        warranty_details: template.warranty_details,
        obsidian_vault_path: template.obsidian_vault_path,
        obsidian_note_path: template.obsidian_note_path,
      });
    } else {
      setFormData({
        sku: "",
        name: "",
        description: null,
        category_id: null,
        brand: null,
        model: null,
        manufacturer: null,
        serial_number: null,
        is_insured: false,
        lifetime_warranty: false,
        warranty_details: null,
        obsidian_vault_path: null,
        obsidian_note_path: null,
      });
    }
    setError(null);
  }, [item, template, isOpen]);

  const getModalTitle = () => {
    if (isEdit) return t("editItem");
    if (isDuplicate) return t("duplicateItem");
    return t("addItem");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (isEdit && item) {
        const updateData: ItemUpdate = {
          name: formData.name,
          description: formData.description,
          category_id: formData.category_id,
          brand: formData.brand,
          model: formData.model,
          manufacturer: formData.manufacturer,
          serial_number: formData.serial_number,
          is_insured: formData.is_insured,
          lifetime_warranty: formData.lifetime_warranty,
          warranty_details: formData.warranty_details,
          obsidian_vault_path: formData.obsidian_vault_path,
          obsidian_note_path: formData.obsidian_note_path,
        };
        await itemsApi.update(item.id, updateData);
      } else {
        await itemsApi.create(formData);
      }
      onSuccess();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? getTranslatedErrorMessage(err.message, te)
          : te("UNKNOWN_ERROR");
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Retro Modal
  if (isRetro) {
    return (
      <RetroModal open={isOpen} onClose={onClose} size="lg">
        <RetroModal.Header title={getModalTitle()} />
        <RetroModal.Body>
          <form id="item-form" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="retro-card p-3">
                <RetroError>{error}</RetroError>
              </div>
            )}

            <RetroFormGroup>
              <RetroLabel htmlFor="sku" required>{t("sku")}</RetroLabel>
              <RetroInput
                id="sku"
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                placeholder={t("skuPlaceholder")}
                required
                disabled={isEdit}
                mono
              />
            </RetroFormGroup>

            <RetroFormGroup>
              <RetroLabel htmlFor="name" required>{t("name")}</RetroLabel>
              <RetroInput
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t("namePlaceholder")}
                required
              />
            </RetroFormGroup>

            <RetroFormGroup>
              <RetroLabel>{t("category")}</RetroLabel>
              <CategorySelect
                categories={categories}
                value={formData.category_id ?? null}
                onChange={(value) => setFormData((prev) => ({ ...prev, category_id: value }))}
                placeholder={t("selectCategory")}
                allowNone={true}
              />
            </RetroFormGroup>

            <RetroFormGroup>
              <RetroLabel htmlFor="description">{t("description")}</RetroLabel>
              <RetroTextarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value || null }))}
                placeholder={t("descriptionPlaceholder")}
                rows={2}
              />
            </RetroFormGroup>

            {/* Brand, Model, Manufacturer row */}
            <div className="grid grid-cols-3 gap-3">
              <RetroFormGroup>
                <RetroLabel htmlFor="brand">{t("brand")}</RetroLabel>
                <RetroInput
                  id="brand"
                  type="text"
                  value={formData.brand || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value || null }))}
                  placeholder={t("brandPlaceholder")}
                />
              </RetroFormGroup>
              <RetroFormGroup>
                <RetroLabel htmlFor="model">{t("model")}</RetroLabel>
                <RetroInput
                  id="model"
                  type="text"
                  value={formData.model || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value || null }))}
                  placeholder={t("modelPlaceholder")}
                />
              </RetroFormGroup>
              <RetroFormGroup>
                <RetroLabel htmlFor="manufacturer">{t("manufacturer")}</RetroLabel>
                <RetroInput
                  id="manufacturer"
                  type="text"
                  value={formData.manufacturer || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, manufacturer: e.target.value || null }))}
                  placeholder={t("manufacturerPlaceholder")}
                />
              </RetroFormGroup>
            </div>

            {/* Serial Number */}
            <RetroFormGroup>
              <RetroLabel htmlFor="serial_number">{t("serialNumber")}</RetroLabel>
              <RetroInput
                id="serial_number"
                type="text"
                value={formData.serial_number || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, serial_number: e.target.value || null }))}
                placeholder={t("serialNumberPlaceholder")}
                mono
              />
            </RetroFormGroup>

            {/* Warranty & Insurance */}
            <div className="border-t-4 border-border pt-4 space-y-3">
              <RetroCheckbox
                id="is_insured"
                label={t("isInsured")}
                checked={formData.is_insured || false}
                onChange={(e) => setFormData((prev) => ({ ...prev, is_insured: e.target.checked }))}
              />
              <RetroCheckbox
                id="lifetime_warranty"
                label={t("lifetimeWarranty")}
                checked={formData.lifetime_warranty || false}
                onChange={(e) => setFormData((prev) => ({ ...prev, lifetime_warranty: e.target.checked }))}
              />
              <RetroFormGroup>
                <RetroLabel htmlFor="warranty_details">{t("warrantyDetails")}</RetroLabel>
                <RetroTextarea
                  id="warranty_details"
                  value={formData.warranty_details || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, warranty_details: e.target.value || null }))}
                  placeholder={t("warrantyDetailsPlaceholder")}
                  rows={2}
                />
              </RetroFormGroup>
            </div>

            {/* Docspell Linked Documents - only show in edit mode */}
            {isEdit && item && (
              <div className="border-t-4 border-border pt-4 mt-4">
                <LinkedDocuments itemId={item.id} itemName={item.name} />
              </div>
            )}
          </form>
        </RetroModal.Body>
        <RetroModal.Footer>
          <RetroButton variant="secondary" onClick={onClose}>
            {t("cancel")}
          </RetroButton>
          <RetroButton
            variant="primary"
            type="submit"
            form="item-form"
            loading={submitting}
          >
            {t("save")}
          </RetroButton>
        </RetroModal.Footer>
      </RetroModal>
    );
  }

  // Standard Modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-lg m-4 bg-background border rounded-lg shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{getModalTitle()}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted">
            <Icon name="X" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("sku")}</label>
            <input
              type="text"
              value={formData.sku}
              onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
              placeholder={t("skuPlaceholder")}
              className={cn(
                "w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono",
                isEdit && "bg-muted cursor-not-allowed"
              )}
              required
              disabled={isEdit}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("name")}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t("namePlaceholder")}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("category")}</label>
            <CategorySelect
              categories={categories}
              value={formData.category_id ?? null}
              onChange={(value) => setFormData((prev) => ({ ...prev, category_id: value }))}
              placeholder={t("selectCategory")}
              allowNone={true}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("description")}</label>
            <textarea
              value={formData.description || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value || null }))}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>

          {/* Brand, Model, Manufacturer row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t("brand")}</label>
              <input
                type="text"
                value={formData.brand || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value || null }))}
                placeholder={t("brandPlaceholder")}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t("model")}</label>
              <input
                type="text"
                value={formData.model || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value || null }))}
                placeholder={t("modelPlaceholder")}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t("manufacturer")}</label>
              <input
                type="text"
                value={formData.manufacturer || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, manufacturer: e.target.value || null }))}
                placeholder={t("manufacturerPlaceholder")}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Serial Number */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("serialNumber")}</label>
            <input
              type="text"
              value={formData.serial_number || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, serial_number: e.target.value || null }))}
              placeholder={t("serialNumberPlaceholder")}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Warranty & Insurance */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_insured_standard"
                checked={formData.is_insured || false}
                onChange={(e) => setFormData((prev) => ({ ...prev, is_insured: e.target.checked }))}
                className="w-4 h-4 rounded border-border bg-background accent-primary"
              />
              <label htmlFor="is_insured_standard" className="text-sm font-medium text-foreground">
                {t("isInsured")}
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="lifetime_warranty_standard"
                checked={formData.lifetime_warranty || false}
                onChange={(e) => setFormData((prev) => ({ ...prev, lifetime_warranty: e.target.checked }))}
                className="w-4 h-4 rounded border-border bg-background accent-primary"
              />
              <label htmlFor="lifetime_warranty_standard" className="text-sm font-medium text-foreground">
                {t("lifetimeWarranty")}
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t("warrantyDetails")}</label>
              <textarea
                value={formData.warranty_details || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, warranty_details: e.target.value || null }))}
                placeholder={t("warrantyDetailsPlaceholder")}
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Docspell Linked Documents - only show in edit mode */}
          {isEdit && item && (
            <div className="border-t pt-4 mt-4">
              <LinkedDocuments itemId={item.id} itemName={item.name} />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Confirmation Modal Component
function DeleteConfirmModal({
  isOpen,
  onClose,
  onSuccess,
  item,
  t,
  te,
  isRetro,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: Item;
  t: (key: string) => string;
  te: (key: string) => string;
  isRetro: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [isOpen]);

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await itemsApi.delete(item.id);
      onSuccess();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? getTranslatedErrorMessage(err.message, te)
          : te("UNKNOWN_ERROR");
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Retro Modal
  if (isRetro) {
    return (
      <RetroModal open={isOpen} onClose={onClose} size="md">
        <RetroModal.Header title={t("deleteConfirmTitle")} variant="danger" />
        <RetroModal.Body>
          {error && (
            <div className="retro-card p-3 mb-4">
              <RetroError>{error}</RetroError>
            </div>
          )}

          <p className="retro-body text-muted-foreground mb-4">
            {t("deleteConfirmMessage")}
          </p>

          <RetroModal.Preview>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-background border-2 border-border retro-small font-mono retro-body">
                {item.sku}
              </span>
            </div>
            <p className="retro-heading">{item.name}</p>
            {item.description && (
              <p className="text-sm text-muted-foreground mt-1 retro-body">{item.description}</p>
            )}
          </RetroModal.Preview>
        </RetroModal.Body>
        <RetroModal.Footer>
          <RetroButton variant="secondary" onClick={onClose}>
            {t("cancel")}
          </RetroButton>
          <RetroButton
            variant="danger"
            onClick={handleDelete}
            loading={submitting}
          >
            {t("deleteConfirmButton")}
          </RetroButton>
        </RetroModal.Footer>
      </RetroModal>
    );
  }

  // Standard Modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-md m-4 bg-background border rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-destructive">{t("deleteConfirmTitle")}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <Icon name="X" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <p className="text-muted-foreground">{t("deleteConfirmMessage")}</p>

          <div className="p-3 bg-muted rounded-md">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-background rounded text-xs font-mono">{item.sku}</span>
            </div>
            <p className="font-medium">{item.name}</p>
            {item.description && (
              <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {submitting ? t("deleting") : t("deleteConfirmButton")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
