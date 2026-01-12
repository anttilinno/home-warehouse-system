"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Search,
  FolderTree,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { categoriesApi, type Category } from "@/lib/api";
import { cn } from "@/lib/utils";

interface CategoryTreeItem extends Category {
  children: CategoryTreeItem[];
  expanded?: boolean;
}

function buildCategoryTree(categories: Category[]): CategoryTreeItem[] {
  const map = new Map<string, CategoryTreeItem>();
  const roots: CategoryTreeItem[] = [];

  // Create map of all categories with empty children
  categories.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [], expanded: true });
  });

  // Build tree structure
  categories.forEach((cat) => {
    const item = map.get(cat.id)!;
    if (cat.parent_category_id && map.has(cat.parent_category_id)) {
      map.get(cat.parent_category_id)!.children.push(item);
    } else {
      roots.push(item);
    }
  });

  // Sort alphabetically
  const sortTree = (items: CategoryTreeItem[]): CategoryTreeItem[] => {
    items.sort((a, b) => a.name.localeCompare(b.name));
    items.forEach((item) => sortTree(item.children));
    return items;
  };

  return sortTree(roots);
}

function CategoryRow({
  category,
  level,
  onEdit,
  onDelete,
  onToggle,
  t,
}: {
  category: CategoryTreeItem;
  level: number;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onToggle: (id: string) => void;
  t: ReturnType<typeof useTranslations<"categories">>;
}) {
  const hasChildren = category.children.length > 0;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-lg group",
          level > 0 && "ml-6"
        )}
        style={{ marginLeft: level * 24 }}
      >
        <button
          onClick={() => hasChildren && onToggle(category.id)}
          className={cn(
            "p-1 rounded hover:bg-muted",
            !hasChildren && "invisible"
          )}
        >
          {category.expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <FolderTree className="h-4 w-4 text-muted-foreground shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{category.name}</div>
          {category.description && (
            <div className="text-sm text-muted-foreground truncate">
              {category.description}
            </div>
          )}
        </div>

        {hasChildren && (
          <span className="text-xs text-muted-foreground">
            {t("subcategories", { count: category.children.length })}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(category)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(category)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {category.expanded &&
        category.children.map((child) => (
          <CategoryRow
            key={child.id}
            category={child}
            level={level + 1}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggle={onToggle}
            t={t}
          />
        ))}
    </>
  );
}

export default function CategoriesPage() {
  const t = useTranslations("categories");
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();

  const [categories, setCategories] = useState<Category[]>([]);
  const [tree, setTree] = useState<CategoryTreeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formParentId, setFormParentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setIsLoading(true);
      const data = await categoriesApi.list(workspaceId);
      setCategories(data);
      setTree(buildCategoryTree(data));
    } catch (error) {
      console.error("Failed to load categories:", error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      loadCategories();
    }
  }, [workspaceId, loadCategories]);

  const handleToggle = (id: string) => {
    const toggleInTree = (items: CategoryTreeItem[]): CategoryTreeItem[] => {
      return items.map((item) => {
        if (item.id === id) {
          return { ...item, expanded: !item.expanded };
        }
        return { ...item, children: toggleInTree(item.children) };
      });
    };
    setTree(toggleInTree(tree));
  };

  const openCreateDialog = () => {
    setEditingCategory(null);
    setFormName("");
    setFormDescription("");
    setFormParentId(null);
    setDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormName(category.name);
    setFormDescription(category.description || "");
    setFormParentId(category.parent_category_id);
    setDialogOpen(true);
  };

  const openDeleteDialog = (category: Category) => {
    setDeletingCategory(category);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!workspaceId || !formName.trim()) return;

    setIsSaving(true);
    try {
      if (editingCategory) {
        await categoriesApi.update(workspaceId, editingCategory.id, {
          name: formName.trim(),
          description: formDescription.trim() || null,
          parent_category_id: formParentId,
        });
      } else {
        await categoriesApi.create(workspaceId, {
          name: formName.trim(),
          description: formDescription.trim() || null,
          parent_category_id: formParentId,
        });
      }
      await loadCategories();
      setDialogOpen(false);
    } catch (error) {
      console.error("Failed to save category:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!workspaceId || !deletingCategory) return;

    setIsSaving(true);
    try {
      await categoriesApi.delete(workspaceId, deletingCategory.id);
      await loadCategories();
      setDeleteDialogOpen(false);
      setDeletingCategory(null);
    } catch (error) {
      console.error("Failed to delete category:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter categories by search
  const filteredTree = searchQuery
    ? tree.filter((cat) => {
        const matchesSearch = (item: CategoryTreeItem): boolean => {
          const matches =
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchQuery.toLowerCase());
          return matches || item.children.some(matchesSearch);
        };
        return matchesSearch(cat);
      })
    : tree;

  // Get available parent categories (exclude self and descendants when editing)
  const getAvailableParents = (): Category[] => {
    if (!editingCategory) return categories;

    const excludeIds = new Set<string>();
    const collectDescendants = (id: string) => {
      excludeIds.add(id);
      categories
        .filter((c) => c.parent_category_id === id)
        .forEach((c) => collectDescendants(c.id));
    };
    collectDescendants(editingCategory.id);

    return categories.filter((c) => !excludeIds.has(c.id));
  };

  if (workspaceLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-10">
            <div className="flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          {t("add")}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("search")}
          className="pl-8"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Categories List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>
            {categories.length > 0
              ? `${categories.length} ${t("title").toLowerCase()}`
              : t("emptyDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTree.length === 0 ? (
            <div className="py-10 text-center">
              <FolderTree className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">
                {searchQuery ? t("noResults") : t("empty")}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery ? "" : t("emptyDescription")}
              </p>
              {!searchQuery && (
                <Button className="mt-4" onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("add")}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTree.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  level={0}
                  onEdit={openEditDialog}
                  onDelete={openDeleteDialog}
                  onToggle={handleToggle}
                  t={t}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t("edit") : t("add")}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? t("edit")
                : t("emptyDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                id="name"
                placeholder={t("namePlaceholder")}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("description")}</Label>
              <Input
                id="description"
                placeholder={t("descriptionPlaceholder")}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent">{t("parent")}</Label>
              <Select
                value={formParentId || "none"}
                onValueChange={(v) => setFormParentId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("parentPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("parentPlaceholder")}</SelectItem>
                  {getAvailableParents().map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formName.trim()}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete")}</DialogTitle>
            <DialogDescription>{t("deleteConfirm")}</DialogDescription>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">{t("deleteWarning")}</p>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving}
            >
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
