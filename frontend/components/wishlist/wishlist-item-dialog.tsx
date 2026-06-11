"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { wishlistApi, categoriesApi, type Category } from "@/lib/api";
import type { WishlistItem } from "@/lib/types/wishlist";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE_CATEGORY = "__none__";
const CURRENCIES = ["EUR", "USD", "GBP", "SEK", "NOK", "DKK"];
const PRIORITIES = [1, 2, 3, 4, 5];

interface WishlistItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing item to edit; null = create */
  item: WishlistItem | null;
  onSaved: () => void;
}

/**
 * Create/edit dialog for wishlist items. Price is entered in major units
 * (e.g. 129.99) and stored as cents.
 */
export function WishlistItemDialog({ open, onOpenChange, item, onSaved }: WishlistItemDialogProps) {
  const t = useTranslations("wishlist.dialog");
  const { workspaceId } = useWorkspace();

  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [priority, setPriority] = useState("3");
  const [categoryId, setCategoryId] = useState(NONE_CATEGORY);
  const [notes, setNotes] = useState("");

  // Seed form state when the dialog opens
  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setUrl(item?.url ?? "");
    setPrice(
      item?.price_estimate !== null && item?.price_estimate !== undefined
        ? (item.price_estimate / 100).toFixed(2)
        : ""
    );
    setCurrency(item?.currency_code ?? "EUR");
    setPriority(String(item?.priority ?? 3));
    setCategoryId(item?.desired_category_id ?? NONE_CATEGORY);
    setNotes(item?.notes ?? "");
  }, [open, item]);

  // Load categories for the desired-category select
  useEffect(() => {
    if (!open || !workspaceId) return;
    categoriesApi
      .list(workspaceId)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [open, workspaceId]);

  const parsePriceCents = (): number | undefined => {
    const trimmed = price.trim();
    if (!trimmed) return undefined;
    const parsed = Number.parseFloat(trimmed.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0) return undefined;
    return Math.round(parsed * 100);
  };

  const handleSubmit = async () => {
    if (!workspaceId || !name.trim()) return;

    const priceCents = parsePriceCents();
    const payload = {
      name: name.trim(),
      notes: notes.trim() || undefined,
      url: url.trim() || undefined,
      price_estimate: priceCents,
      currency_code: priceCents !== undefined ? currency : undefined,
      priority: Number.parseInt(priority, 10),
      desired_category_id: categoryId === NONE_CATEGORY ? undefined : categoryId,
    };

    setSaving(true);
    try {
      if (item) {
        await wishlistApi.update(workspaceId, item.id, payload);
        toast.success(t("toasts.updated"));
      } else {
        await wishlistApi.create(workspaceId, payload);
        toast.success(t("toasts.created"));
      }
      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error("Failed to save wishlist item:", error);
      toast.error(t("toasts.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wishlist-name">{t("nameLabel")}</Label>
            <Input
              id="wishlist-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wishlist-url">{t("urlLabel")}</Label>
            <Input
              id="wishlist-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wishlist-price">{t("priceLabel")}</Label>
              <Input
                id="wishlist-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("currencyLabel")}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("priorityLabel")}</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {t(`priorities.p${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("categoryLabel")}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_CATEGORY}>{t("noCategory")}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wishlist-notes">{t("notesLabel")}</Label>
            <Textarea
              id="wishlist-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim()}>
            {item ? t("save") : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
