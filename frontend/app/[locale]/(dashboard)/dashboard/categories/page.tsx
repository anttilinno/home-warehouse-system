"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Upload,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryListSkeleton } from "@/components/dashboard/category-skeleton";
import { EmptyState, EmptyStateList, EmptyStateBenefits } from "@/components/ui/empty-state";
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
import { ImportDialog, type ImportResult } from "@/components/ui/import-dialog";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { categoriesApi, importExportApi, type Category } from "@/lib/api";
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

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!hasChildren) return;

    switch (e.key) {
      case "ArrowRight":
        if (!category.expanded) {
          e.preventDefault();
          onToggle(category.id);
        }
        break;
      case "ArrowLeft":
        if (category.expanded) {
          e.preventDefault();
          onToggle(category.id);
        }
        break;
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-lg group",
          level > 0 && "ml-6",
          isDragging && "cursor-grabbing"
        )}
        {...attributes}
        role="treeitem"
        aria-expanded={hasChildren ? category.expanded : undefined}
        aria-level={level + 1}
      >
        <div
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100"
          style={{ marginLeft: level * 24 }}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>

        <button
          onClick={() => hasChildren && onToggle(category.id)}
          onKeyDown={handleKeyDown}
          className={cn(
            "p-1 rounded hover:bg-muted",
            !hasChildren && "invisible"
          )}
          aria-label={
            hasChildren
              ? `${category.expanded ? "Collapse" : "Expand"} ${category.name}`
              : undefined
          }
          tabIndex={hasChildren ? 0 : -1}
        >
          {category.expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
              aria-label={`Actions for ${category.name}`}
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

      {category.expanded && category.children.length > 0 && (
        <div role="group">
          {category.children.map((child) => (
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
        </div>
      )}
    </>
  );
}

export default function CategoriesPage() {
  const t = useTranslations("categories");
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Drag & drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formParentId, setFormParentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Memoize category tree computation for performance
  const tree = useMemo(() => {
    if (categories.length === 0) return [];

    const treeData = buildCategoryTree(categories);

    // Apply expansion state from expandedIds Set
    const applyExpansion = (items: CategoryTreeItem[]): CategoryTreeItem[] => {
      return items.map((item) => ({
        ...item,
        expanded: expandedIds.has(item.id),
        children: applyExpansion(item.children),
      }));
    };

    return applyExpansion(treeData);
  }, [categories, expandedIds]);

  const loadCategories = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setIsLoading(true);
      const data = await categoriesApi.list(workspaceId);
      setCategories(data);
      // Initialize all categories as expanded by default
      setExpandedIds(new Set(data.map((cat) => cat.id)));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load categories";
      toast.error("Failed to load categories", {
        description: errorMessage,
      });
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
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
        toast.success("Category updated", {
          description: `"${formName.trim()}" has been updated successfully`,
        });
      } else {
        await categoriesApi.create(workspaceId, {
          name: formName.trim(),
          description: formDescription.trim() || null,
          parent_category_id: formParentId,
        });
        toast.success("Category created", {
          description: `"${formName.trim()}" has been created successfully`,
        });
      }
      await loadCategories();
      setDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save category";
      toast.error(editingCategory ? "Failed to update category" : "Failed to create category", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!workspaceId || !deletingCategory) return;

    setIsSaving(true);
    try {
      await categoriesApi.delete(workspaceId, deletingCategory.id);
      toast.success("Category deleted", {
        description: `"${deletingCategory.name}" has been deleted successfully`,
      });
      await loadCategories();
      setDeleteDialogOpen(false);
      setDeletingCategory(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete category";
      toast.error("Failed to delete category", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async (file: File): Promise<ImportResult> => {
    if (!workspaceId) {
      throw new Error("No workspace selected");
    }

    try {
      const result = await importExportApi.import(workspaceId, "category", file);

      // Refresh the categories list after successful import
      if (result.successful_imports > 0) {
        loadCategories();
      }

      return {
        success: result.successful_imports,
        failed: result.failed_imports,
        errors: result.errors.map((e) => ({
          row: e.row_number,
          message: e.error,
        })),
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Import failed");
    }
  };

  // Flatten tree for drag & drop context
  const flattenTree = (items: CategoryTreeItem[]): string[] => {
    const ids: string[] = [];
    const flatten = (items: CategoryTreeItem[]) => {
      items.forEach((item) => {
        ids.push(item.id);
        if (item.children.length > 0) {
          flatten(item.children);
        }
      });
    };
    flatten(items);
    return ids;
  };

  // Drag & drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id || !workspaceId) return;

    const draggedCategory = categories.find((c) => c.id === active.id);
    const targetCategory = categories.find((c) => c.id === over.id);

    if (!draggedCategory || !targetCategory) return;

    // Prevent dropping a parent onto its own descendant
    const isDescendant = (parentId: string, childId: string): boolean => {
      const children = categories.filter((c) => c.parent_category_id === parentId);
      if (children.some((c) => c.id === childId)) return true;
      return children.some((c) => isDescendant(c.id, childId));
    };

    if (isDescendant(draggedCategory.id, targetCategory.id)) {
      toast.error("Cannot move a category into its own descendant");
      return;
    }

    try {
      // Update the dragged category's parent to the target category
      await categoriesApi.update(workspaceId, draggedCategory.id, {
        name: draggedCategory.name,
        description: draggedCategory.description || null,
        parent_category_id: targetCategory.id,
      });
      toast.success(`Moved "${draggedCategory.name}" under "${targetCategory.name}"`);
      await loadCategories();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to move category";
      toast.error("Failed to move category", {
        description: errorMessage,
      });
    }
  };

  // Filter categories by search - memoized for performance
  const filteredTree = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return tree;
    }

    const filterTree = (items: CategoryTreeItem[]): CategoryTreeItem[] => {
      return items.reduce<CategoryTreeItem[]>((acc, item) => {
        const matchesSearch =
          item.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

        const filteredChildren = item.children.length > 0
          ? filterTree(item.children)
          : [];

        if (matchesSearch || filteredChildren.length > 0) {
          acc.push({
            ...item,
            children: filteredChildren.length > 0 ? filteredChildren : item.children,
          });
        }

        return acc;
      }, []);
    };

    return filterTree(tree);
  }, [tree, debouncedSearchQuery]);

  const allCategoryIds = flattenTree(filteredTree);

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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              {t("add")}
            </Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("search")}
            className="pl-8"
            value=""
            disabled
          />
        </div>

        <CategoryListSkeleton />
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportDialogOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {t("add")}
          </Button>
        </div>
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
            searchQuery ? (
              <EmptyState
                icon={FolderTree}
                title={t("noResults")}
                description="Try adjusting your search terms"
              />
            ) : (
              <EmptyState
                icon={FolderTree}
                title={t("empty")}
                description="Organize your items with custom categories. Create hierarchies to keep everything structured."
                action={{
                  label: t("add"),
                  onClick: openCreateDialog,
                }}
              >
                <div className="mb-4">
                  <p className="font-medium mb-3 text-foreground">Examples:</p>
                  <EmptyStateList
                    items={[
                      "Electronics → Cables → USB-C",
                      "Tools → Power Tools → Drills",
                      "Home → Kitchen → Appliances",
                      "Sports → Outdoor → Camping Gear",
                    ]}
                  />
                </div>
                <div>
                  <p className="font-medium mb-3 text-foreground">Benefits:</p>
                  <EmptyStateBenefits
                    benefits={[
                      "Quick filtering and search",
                      "Better organization",
                      "Faster item lookup",
                      "Hierarchical structure",
                    ]}
                  />
                </div>
              </EmptyState>
            )
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={allCategoryIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-1" role="tree" aria-label="Category hierarchy">
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
              </SortableContext>
            </DndContext>
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

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        entityType="category"
        onImport={handleImport}
        title="Import Categories from CSV"
        description="Upload a CSV file to import categories. The file should include columns for name, description, and parent category."
      />
    </div>
  );
}
