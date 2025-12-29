"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState, useMemo } from "react";
import {
  categoriesApi,
  getTranslatedErrorMessage,
  Category,
  CategoryCreate,
  CategoryUpdate,
} from "@/lib/api";
import { Icon } from "@/components/icons";
import { Plus, X, FolderTree } from "lucide-react";
import { TreeView } from "@/components/ui/tree-view";
import { CategorySelect } from "@/components/ui/category-select";
import { buildCategoryTree, type CategoryNode } from "@/lib/category-utils";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { NES_GREEN, NES_BLUE, NES_RED } from "@/lib/nes-colors";

export default function CategoriesPage() {
  const { isAuthenticated, isLoading: authLoading, canEdit } = useAuth();
  const router = useRouter();
  const t = useTranslations("categories");
  const te = useTranslations("errors");
  const { toast } = useToast();
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");

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
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load categories";
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
      <div className={cn(
        "flex items-center justify-center min-h-[400px]",
        isRetro && "retro-body"
      )}>
        <div className={cn(
          "text-muted-foreground",
          isRetro && "retro-small uppercase"
        )}>{t("loading")}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className={cn(
        "flex items-center justify-center min-h-[400px]",
        isRetro && "retro-body"
      )}>
        <div className="text-center">
          <p className={cn(
            "text-red-500 mb-4",
            isRetro && "retro-small uppercase"
          )} style={isRetro ? { color: NES_RED } : undefined}>{error}</p>
          <button
            onClick={fetchData}
            className={cn(
              isRetro
                ? "px-4 py-2 border-4 border-border bg-primary text-white retro-small uppercase retro-shadow hover:retro-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                : "px-4 py-2 bg-primary text-primary-foreground rounded-lg"
            )}
          >
            {t("tryAgain")}
          </button>
        </div>
      </div>
    );
  }

  // Retro theme UI
  if (isRetro) {
    return (
      <>
        {/* Header */}
        <div className="mb-8 bg-primary p-4 border-4 border-border retro-shadow">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold text-white uppercase retro-heading">
                {t("title")}
              </h1>
              <p className="text-white/80 retro-body retro-small uppercase mt-1">
                {t("subtitle")}
              </p>
            </div>
            {canEdit && (
              <button
                onClick={handleCreateNew}
                className="px-3 py-2 bg-background text-foreground border-4 border-border retro-small uppercase font-bold retro-body retro-shadow hover:retro-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-2"
              >
                <Icon name="Plus" className="w-4 h-4" />
                {t("addCategory")}
              </button>
            )}
          </div>
        </div>

        {/* Empty State or Tree */}
        {categories.length === 0 ? (
          <div className="bg-card border-4 border-border p-12 text-center retro-shadow">
            <Icon name="FolderTree" className="w-12 h-12 mx-auto mb-4" style={{ color: NES_BLUE }} />
            <p className="retro-small uppercase font-bold retro-body text-muted-foreground">
              {t("noCategories")}
            </p>
            {canEdit && (
              <button
                onClick={handleCreateNew}
                className="mt-4 px-4 py-2 bg-primary text-white border-4 border-border retro-small uppercase font-bold retro-body retro-shadow hover:retro-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] transition-all inline-flex items-center gap-2"
              >
                <Icon name="Plus" className="w-4 h-4" />
                {t("addCategory")}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-card retro-shadow overflow-hidden">
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
          isRetro={isRetro}
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
          isRetro={isRetro}
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
            isRetro={isRetro}
          />
        )}
      </>
    );
  }

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
            onClick={handleCreateNew}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("addCategory")}
          </button>
        )}
      </div>

      {/* Category Tree */}
      {categories.length === 0 ? (
        <div className="bg-card border rounded-lg p-12 text-center">
          <FolderTree className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t("noCategories")}</p>
          {canEdit && (
            <button
              onClick={handleCreateNew}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg inline-flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("addCategory")}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card shadow-sm overflow-hidden">
          <TreeView
            items={categoryTree}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddChild={handleAddChild}
            disabled={!canEdit}
          />
        </div>
      )}

      {/* Create Modal */}
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
          toast({
            title: t("created"),
            description: name,
          });
        }}
        categories={categories}
        defaultParentId={defaultParentId}
        t={t}
        te={te}
        isRetro={false}
      />

      {/* Edit Modal */}
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
          toast({
            title: t("updated"),
            description: name,
          });
        }}
        category={selectedCategory}
        categories={categories}
        t={t}
        te={te}
        isRetro={false}
      />

      {/* Delete Confirmation Modal */}
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
            toast({
              title: t("deleted"),
              description: deletedName,
            });
          }}
          category={selectedCategory}
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
  category,
  categories,
  defaultParentId,
  t,
  te,
  isRetro,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
  category?: Category | null;
  categories: Category[];
  defaultParentId?: string | null;
  t: (key: string) => string;
  te: (key: string) => string;
  isRetro: boolean;
}) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className={cn(
          "relative z-10 w-full max-w-md m-4 bg-background",
          isRetro
            ? "border-4 border-border retro-shadow"
            : "border rounded-lg shadow-xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn(
          "flex items-center justify-between p-4",
          isRetro ? "border-b-4 border-border bg-primary" : "border-b"
        )}>
          <h2 className={cn(
            isRetro
              ? "text-sm font-bold text-white uppercase retro-heading"
              : "text-lg font-semibold"
          )}>
            {isEdit ? t("editCategory") : t("addCategory")}
          </h2>
          <button onClick={onClose} className={cn(
            isRetro
              ? "p-1 border-2 border-white/50 hover:bg-white/20"
              : "p-1 rounded hover:bg-muted"
          )}>
            {isRetro ? <Icon name="X" className="w-5 h-5 text-white" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className={cn(
              "p-3",
              isRetro
                ? "border-4 border-border bg-background"
                : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
            )}>
              <p className={cn(
                isRetro
                  ? "retro-small uppercase font-bold retro-body"
                  : "text-sm text-red-600 dark:text-red-400"
              )} style={isRetro ? { color: NES_RED } : undefined}>{error}</p>
            </div>
          )}

          <div>
            <label className={cn(
              "block mb-2",
              isRetro
                ? "retro-small uppercase font-bold retro-body text-foreground"
                : "text-sm font-medium text-foreground"
            )}>
              {t("name")}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder={t("namePlaceholder")}
              className={cn(
                "w-full px-3 py-2 bg-background text-foreground",
                isRetro
                  ? "border-4 border-border retro-body retro-small uppercase focus:outline-none"
                  : "border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              )}
              required
            />
          </div>

          <div>
            <label className={cn(
              "block mb-2",
              isRetro
                ? "retro-small uppercase font-bold retro-body text-foreground"
                : "text-sm font-medium text-foreground"
            )}>
              {t("parentCategory")}
            </label>
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
          </div>

          <div>
            <label className={cn(
              "block mb-2",
              isRetro
                ? "retro-small uppercase font-bold retro-body text-foreground"
                : "text-sm font-medium text-foreground"
            )}>
              {t("description")}
            </label>
            <textarea
              value={formData.description || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value || null,
                }))
              }
              placeholder={t("descriptionPlaceholder")}
              rows={3}
              className={cn(
                "w-full px-3 py-2 bg-background text-foreground resize-none",
                isRetro
                  ? "border-4 border-border retro-body retro-small focus:outline-none"
                  : "border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              )}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                isRetro
                  ? "px-4 py-2 border-4 border-border bg-muted text-foreground retro-small uppercase font-bold retro-body retro-shadow-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  : "px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              )}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                isRetro
                  ? "px-4 py-2 border-4 border-border bg-primary text-white retro-small uppercase font-bold retro-body retro-shadow-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50"
                  : "px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              )}
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
  category,
  t,
  te,
  isRetro,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
  category: Category;
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
      await categoriesApi.delete(category.id);
      onSuccess(category.name);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className={cn(
          "relative z-10 w-full max-w-md m-4 bg-background",
          isRetro
            ? "border-4 border-border retro-shadow"
            : "border rounded-lg shadow-xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn(
          "flex items-center justify-between p-4",
          isRetro ? "border-b-4 border-border" : "border-b"
        )} style={isRetro ? { backgroundColor: NES_RED } : undefined}>
          <h2 className={cn(
            isRetro
              ? "text-sm font-bold text-white uppercase retro-heading"
              : "text-lg font-semibold text-destructive"
          )}>
            {t("deleteConfirmTitle")}
          </h2>
          <button onClick={onClose} className={cn(
            isRetro
              ? "p-1 border-2 border-white/50 hover:bg-white/20"
              : "p-1 rounded hover:bg-muted"
          )}>
            {isRetro ? <Icon name="X" className="w-5 h-5 text-white" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className={cn(
              "p-3",
              isRetro
                ? "border-4 border-border bg-background"
                : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
            )}>
              <p className={cn(
                isRetro
                  ? "retro-small uppercase font-bold retro-body"
                  : "text-sm text-red-600 dark:text-red-400"
              )} style={isRetro ? { color: NES_RED } : undefined}>{error}</p>
            </div>
          )}

          <p className={cn(
            "text-muted-foreground",
            isRetro && "retro-small uppercase retro-body"
          )}>{t("deleteConfirmMessage")}</p>

          <div className={cn(
            "p-3",
            isRetro
              ? "border-4 border-border bg-muted"
              : "bg-muted rounded-md"
          )}>
            <p className={cn(
              "font-medium",
              isRetro && "retro-small uppercase font-bold retro-body"
            )}>{category.name}</p>
            {category.description && (
              <p className={cn(
                "text-muted-foreground",
                isRetro ? "retro-small retro-body" : "text-sm"
              )}>{category.description}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                isRetro
                  ? "px-4 py-2 border-4 border-border bg-muted text-foreground retro-small uppercase font-bold retro-body retro-shadow-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  : "px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              )}
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className={cn(
                isRetro
                  ? "px-4 py-2 border-4 border-border text-white retro-small uppercase font-bold retro-body retro-shadow-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50"
                  : "px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50"
              )}
              style={isRetro ? { backgroundColor: NES_RED } : undefined}
            >
              {submitting ? t("deleting") : t("deleteConfirmButton")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
