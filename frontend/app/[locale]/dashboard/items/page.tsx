"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useMemo } from "react";
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
import { CategorySelect } from "@/components/ui/category-select";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { LinkedDocuments } from "@/components/docspell";
import { useThemed, useThemedClasses } from "@/lib/themed";
import type { ThemedComponents } from "@/lib/themed";

export default function ItemsPage() {
  const { isAuthenticated, isLoading: authLoading, canEdit } = useAuth();
  const router = useRouter();
  const t = useTranslations("items");
  const te = useTranslations("errors");
  const themed = useThemed();
  const classes = useThemedClasses();

  const { PageHeader, Button, Table, EmptyState, ActionsMenu } = themed;

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
    } catch (e) {
      const err = e as Error;
      const errorMessage = err.message || "Failed to load items";
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className={classes.loadingText}>
          {classes.isRetro ? "Loading..." : t("loading")}
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className={`${classes.errorText} mb-4`}>{error}</p>
          <Button variant="primary" onClick={fetchData}>
            {t("tryAgain")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <PageHeader
        title={t("title")}
        subtitle={classes.isRetro ? `${items.length} ITEMS IN CATALOG` : t("subtitle")}
        actions={
          canEdit && (
            <Button
              variant={classes.isRetro ? "secondary" : "primary"}
              icon="Plus"
              onClick={() => setIsCreateModalOpen(true)}
            >
              {t("addItem")}
            </Button>
          )
        }
      />

      {/* Table */}
      {items.length === 0 ? (
        <EmptyState
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
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.Th>{t("sku")}</Table.Th>
              <Table.Th>{t("name")}</Table.Th>
              <Table.Th>{t("category")}</Table.Th>
              {!classes.isRetro && <Table.Th>{t("description")}</Table.Th>}
              <Table.Th align="right" className="w-0">{t("actions")}</Table.Th>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {items.map((item) => (
              <Table.Row
                key={item.id}
                clickable
                onDoubleClick={() => router.push(`/dashboard/items/${item.id}`)}
              >
                <Table.Td>
                  <span className={classes.isRetro
                    ? "px-2 py-1 bg-muted border-2 border-border retro-small font-mono retro-body"
                    : "px-2 py-1 bg-muted rounded text-xs font-mono"
                  }>
                    {item.sku}
                  </span>
                </Table.Td>
                <Table.Td>
                  <div className="flex items-center gap-2">
                    <Icon name="Tag" className="w-4 h-4 text-muted-foreground" />
                    <span className={classes.isRetro ? "retro-body text-foreground" : "font-medium text-foreground"}>
                      {item.name}
                    </span>
                  </div>
                </Table.Td>
                <Table.Td>
                  {item.category_id ? (
                    <div className={`flex items-center gap-2 text-foreground ${classes.bodyText}`}>
                      <Icon name="Archive" className="w-4 h-4 text-muted-foreground" />
                      {getCategoryName(item.category_id)}
                    </div>
                  ) : (
                    <span className={`text-muted-foreground ${classes.bodyText}`}>{t("noCategory")}</span>
                  )}
                </Table.Td>
                {!classes.isRetro && (
                  <Table.Td muted>
                    {item.description || t("noDescription")}
                  </Table.Td>
                )}
                <Table.Td align="right" className="w-0">
                  <ActionsMenu
                    actions={[
                      {
                        icon: "Eye",
                        label: t("view"),
                        onClick: () => router.push(`/dashboard/items/${item.id}`),
                      },
                      {
                        icon: "FileText",
                        label: t("openInObsidian"),
                        onClick: () => item.obsidian_url && window.open(item.obsidian_url, "_blank"),
                        hidden: !item.obsidian_url,
                      },
                      {
                        icon: "Copy",
                        label: t("duplicate"),
                        onClick: () => handleDuplicate(item),
                        hidden: !canEdit,
                      },
                      {
                        icon: "Pencil",
                        label: t("edit"),
                        onClick: () => handleEdit(item),
                        hidden: !canEdit,
                      },
                      {
                        icon: "Trash2",
                        label: t("delete"),
                        onClick: () => handleDelete(item),
                        variant: "danger",
                        hidden: !canEdit,
                      },
                    ]}
                  >
                    <FavoriteButton
                      entityType="ITEM"
                      entityId={item.id}
                      size="sm"
                      className={classes.isRetro ? "retro-icon-btn" : "p-1.5"}
                    />
                  </ActionsMenu>
                </Table.Td>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
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
        themed={themed}
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
        themed={themed}
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
          themed={themed}
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
  themed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item?: Item | null;
  template?: Item | null;
  categories: Category[];
  t: (key: string) => string;
  te: (key: string) => string;
  themed: ThemedComponents;
}) {
  const { Modal, Button, FormGroup, Label, Input, Textarea, Checkbox, Error } = themed;
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
    } catch (e) {
      const err = e as Error;
      const errorMessage = err.message
        ? getTranslatedErrorMessage(err.message, te)
        : te("UNKNOWN_ERROR");
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} size="lg">
      <Modal.Header title={getModalTitle()} />
      <Modal.Body>
        <form id="item-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className={themed.isRetro ? "retro-card p-3" : "p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"}>
              <Error>{error}</Error>
            </div>
          )}

          <FormGroup>
            <Label htmlFor="sku" required>{t("sku")}</Label>
            <Input
              id="sku"
              type="text"
              value={formData.sku}
              onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
              placeholder={t("skuPlaceholder")}
              required
              disabled={isEdit}
              mono
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="name" required>{t("name")}</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t("namePlaceholder")}
              required
            />
          </FormGroup>

          <FormGroup>
            <Label>{t("category")}</Label>
            <CategorySelect
              categories={categories}
              value={formData.category_id ?? null}
              onChange={(value) => setFormData((prev) => ({ ...prev, category_id: value }))}
              placeholder={t("selectCategory")}
              allowNone={true}
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value || null }))}
              placeholder={t("descriptionPlaceholder")}
              rows={2}
            />
          </FormGroup>

          {/* Brand, Model, Manufacturer row */}
          <div className="grid grid-cols-3 gap-3">
            <FormGroup>
              <Label htmlFor="brand">{t("brand")}</Label>
              <Input
                id="brand"
                type="text"
                value={formData.brand || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value || null }))}
                placeholder={t("brandPlaceholder")}
              />
            </FormGroup>
            <FormGroup>
              <Label htmlFor="model">{t("model")}</Label>
              <Input
                id="model"
                type="text"
                value={formData.model || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value || null }))}
                placeholder={t("modelPlaceholder")}
              />
            </FormGroup>
            <FormGroup>
              <Label htmlFor="manufacturer">{t("manufacturer")}</Label>
              <Input
                id="manufacturer"
                type="text"
                value={formData.manufacturer || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, manufacturer: e.target.value || null }))}
                placeholder={t("manufacturerPlaceholder")}
              />
            </FormGroup>
          </div>

          {/* Serial Number */}
          <FormGroup>
            <Label htmlFor="serial_number">{t("serialNumber")}</Label>
            <Input
              id="serial_number"
              type="text"
              value={formData.serial_number || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, serial_number: e.target.value || null }))}
              placeholder={t("serialNumberPlaceholder")}
              mono
            />
          </FormGroup>

          {/* Warranty & Insurance */}
          <div className={themed.isRetro ? "border-t-4 border-border pt-4 space-y-3" : "border-t pt-4 space-y-3"}>
            <Checkbox
              id="is_insured"
              label={t("isInsured")}
              checked={formData.is_insured || false}
              onChange={(e) => setFormData((prev) => ({ ...prev, is_insured: e.target.checked }))}
            />
            <Checkbox
              id="lifetime_warranty"
              label={t("lifetimeWarranty")}
              checked={formData.lifetime_warranty || false}
              onChange={(e) => setFormData((prev) => ({ ...prev, lifetime_warranty: e.target.checked }))}
            />
            <FormGroup>
              <Label htmlFor="warranty_details">{t("warrantyDetails")}</Label>
              <Textarea
                id="warranty_details"
                value={formData.warranty_details || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, warranty_details: e.target.value || null }))}
                placeholder={t("warrantyDetailsPlaceholder")}
                rows={2}
              />
            </FormGroup>
          </div>

          {/* Docspell Linked Documents - only show in edit mode */}
          {isEdit && item && (
            <div className={themed.isRetro ? "border-t-4 border-border pt-4 mt-4" : "border-t pt-4 mt-4"}>
              <LinkedDocuments itemId={item.id} itemName={item.name} />
            </div>
          )}
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          variant="primary"
          type="submit"
          form="item-form"
          loading={submitting}
        >
          {t("save")}
        </Button>
      </Modal.Footer>
    </Modal>
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
  themed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: Item;
  t: (key: string) => string;
  te: (key: string) => string;
  themed: ThemedComponents;
}) {
  const { Modal, Button, Error } = themed;
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
    } catch (e) {
      const err = e as Error;
      const errorMessage = err.message
        ? getTranslatedErrorMessage(err.message, te)
        : te("UNKNOWN_ERROR");
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} size="md">
      <Modal.Header title={t("deleteConfirmTitle")} variant="danger" />
      <Modal.Body>
        {error && (
          <div className={themed.isRetro ? "retro-card p-3 mb-4" : "p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-4"}>
            <Error>{error}</Error>
          </div>
        )}

        <p className={themed.isRetro ? "retro-body text-muted-foreground mb-4" : "text-muted-foreground mb-4"}>
          {t("deleteConfirmMessage")}
        </p>

        <Modal.Preview>
          <div className="flex items-center gap-2 mb-1">
            <span className={themed.isRetro
              ? "px-2 py-0.5 bg-background border-2 border-border retro-small font-mono retro-body"
              : "px-2 py-0.5 bg-background rounded text-xs font-mono"
            }>
              {item.sku}
            </span>
          </div>
          <p className={themed.isRetro ? "retro-heading" : "font-medium"}>{item.name}</p>
          {item.description && (
            <p className={`text-sm text-muted-foreground mt-1 ${themed.isRetro ? "retro-body" : ""}`}>{item.description}</p>
          )}
        </Modal.Preview>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          variant="danger"
          onClick={handleDelete}
          loading={submitting}
        >
          {t("deleteConfirmButton")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
