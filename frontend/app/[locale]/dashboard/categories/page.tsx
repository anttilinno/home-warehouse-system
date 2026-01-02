"use client";

import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { useEffect, useState, useMemo } from "react";
import {
  categoriesApi,
  getTranslatedErrorMessage,
  Category,
  CategoryCreate,
  CategoryUpdate,
} from "@/lib/api";
import { Icon } from "@/components/icons";
import { TreeView } from "@/components/ui/tree-view";
import { CategorySelect } from "@/components/ui/category-select";
import { buildCategoryTree, type CategoryNode } from "@/lib/category-utils";
import { useToast } from "@/components/ui/use-toast";
import { useThemed, useThemedClasses, type ThemedComponents } from "@/lib/themed";

export default function CategoriesPage() {
  const { isAuthenticated, isLoading: authLoading, canEdit } = useAuth();
  const t = useTranslations("categories");
  const te = useTranslations("errors");
  const { toast } = useToast();
  const themed = useThemed();
  const classes = useThemedClasses();

  const { PageHeader, Button, EmptyState } = themed;

  // Data state
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  // Build category tree for TreeView
  const categoryTree = useMemo(
    () => buildCategoryTree(categories),
    [categories]
  );

  const handleAddChild = (parentId: string) => {
    setDefaultParentId(parentId);
    setIsCreateModalOpen(true);
  };

  const handleCreateNew = () => {
    setDefaultParentId(null);
    setIsCreateModalOpen(true);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const categoriesData = await categoriesApi.list();
      setCategories(categoriesData);
      setError(null);
    } catch (e) {
      const err = e as Error;
      const errorMessage = err.message
        ? getTranslatedErrorMessage(err.message, te)
        : te("UNKNOWN_ERROR");
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: CategoryNode | Category) => {
    setSelectedCategory(category as Category);
    setIsEditModalOpen(true);
  };

  const handleDelete = (category: CategoryNode | Category) => {
    setSelectedCategory(category as Category);
    setIsDeleteModalOpen(true);
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
        subtitle={t("subtitle")}
        actions={
          canEdit && (
            <Button
              variant={classes.isRetro ? "secondary" : "primary"}
              icon="Plus"
              onClick={handleCreateNew}
            >
              {t("addCategory")}
            </Button>
          )
        }
      />

      {/* Category Tree */}
      {categories.length === 0 ? (
        <EmptyState
          icon="FolderTree"
          message={t("noCategories")}
          action={
            canEdit
              ? {
                  label: t("addCategory"),
                  onClick: handleCreateNew,
                  icon: "Plus",
                }
              : undefined
          }
        />
      ) : (
        <div className={classes.isRetro ? "retro-card retro-card--shadow overflow-hidden" : "bg-card shadow-sm overflow-hidden"}>
          <TreeView
            items={categoryTree}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddChild={handleAddChild}
            disabled={!canEdit}
          />
        </div>
      )}

      {/* Modals */}
      <CreateEditModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setDefaultParentId(null);
        }}
        onSuccess={(name: string) => {
          setIsCreateModalOpen(false);
          setDefaultParentId(null);
          fetchData();
          toast({ title: t("created"), description: name });
        }}
        categories={categories}
        defaultParentId={defaultParentId}
        t={t}
        te={te}
        themed={themed}
      />

      <CreateEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCategory(null);
        }}
        onSuccess={(name: string) => {
          setIsEditModalOpen(false);
          setSelectedCategory(null);
          fetchData();
          toast({ title: t("updated"), description: name });
        }}
        category={selectedCategory}
        categories={categories}
        t={t}
        te={te}
        themed={themed}
      />

      {selectedCategory && (
        <DeleteConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedCategory(null);
          }}
          onSuccess={(deletedName: string) => {
            setIsDeleteModalOpen(false);
            setSelectedCategory(null);
            fetchData();
            toast({ title: t("deleted"), description: deletedName });
          }}
          category={selectedCategory}
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
  category,
  categories,
  defaultParentId,
  t,
  te,
  themed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
  category?: Category | null;
  categories: Category[];
  defaultParentId?: string | null;
  t: (key: string) => string;
  te: (key: string) => string;
  themed: ThemedComponents;
}) {
  const { Modal, Button, FormGroup, Label, Input, Textarea, Error } = themed;
  const isEdit = !!category;

  const [formData, setFormData] = useState<CategoryCreate>({
    name: "",
    parent_category_id: null,
    description: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // IDs to exclude from parent dropdown (current category and its descendants)
  const excludeIds = useMemo(() => {
    if (!category) return [];
    return [category.id];
  }, [category]);

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        parent_category_id: category.parent_category_id,
        description: category.description,
      });
    } else {
      setFormData({
        name: "",
        parent_category_id: defaultParentId || null,
        description: null,
      });
    }
    setError(null);
  }, [category, defaultParentId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (isEdit && category) {
        const updateData: CategoryUpdate = {
          name: formData.name,
          parent_category_id: formData.parent_category_id,
          description: formData.description,
        };
        await categoriesApi.update(category.id, updateData);
      } else {
        await categoriesApi.create(formData);
      }
      onSuccess(formData.name);
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
      <Modal.Header title={isEdit ? t("editCategory") : t("addCategory")} />
      <Modal.Body>
        <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className={themed.isRetro ? "retro-card p-3" : "p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"}>
              <Error>{error}</Error>
            </div>
          )}

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
            <Label htmlFor="parent">{t("parentCategory")}</Label>
            <CategorySelect
              categories={categories}
              value={formData.parent_category_id ?? null}
              onChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  parent_category_id: value,
                }))
              }
              excludeIds={excludeIds}
              placeholder={t("selectParent")}
              allowNone={true}
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value || null,
                }))
              }
              placeholder={t("descriptionPlaceholder")}
              rows={3}
            />
          </FormGroup>
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          variant="primary"
          type="submit"
          form="category-form"
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
  category,
  t,
  te,
  themed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
  category: Category;
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
      await categoriesApi.delete(category.id);
      onSuccess(category.name);
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
          <p className={themed.isRetro ? "retro-heading" : "font-medium"}>{category.name}</p>
          {category.description && (
            <p className={`text-sm text-muted-foreground ${themed.isRetro ? "retro-body" : ""}`}>
              {category.description}
            </p>
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
