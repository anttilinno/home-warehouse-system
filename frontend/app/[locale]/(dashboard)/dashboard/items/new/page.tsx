"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { CreateItemWizard } from "@/components/items/create-item-wizard";
import type { CreateItemFormData } from "@/components/items/create-item-wizard/schema";

export default function NewItemPage() {
  const router = useRouter();
  const t = useTranslations("items");
  const searchParams = useSearchParams();

  // Prefill from the s.go claim / scan flow contract:
  //   /dashboard/items/new?short_code=<code>   (claim wizard)
  //   /dashboard/items/new?barcode=<code>       (scan not-found → create)
  // Short codes are case-sensitive (locked design) — pass through verbatim,
  // only trimming surrounding whitespace.
  const initialValues: Partial<CreateItemFormData> = {};
  const shortCode = searchParams.get("short_code")?.trim();
  if (shortCode) initialValues.short_code = shortCode;
  const barcode = searchParams.get("barcode")?.trim();
  if (barcode) initialValues.barcode = barcode;

  // Prefill from the wishlist acquire flow:
  //   /dashboard/items/new?name=...&category_id=...&description=...&wishlist_id=...
  // After the item is created the wizard PATCHes the wishlist row with
  // acquired_item_id (status -> acquired), closing it.
  const name = searchParams.get("name")?.trim();
  if (name) initialValues.name = name;
  const categoryId = searchParams.get("category_id")?.trim();
  if (categoryId) initialValues.category_id = categoryId;
  const description = searchParams.get("description")?.trim();
  if (description) initialValues.description = description;
  const wishlistId = searchParams.get("wishlist_id")?.trim();

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/items")}
          className="min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("create.title")}
          </h1>
          <p className="text-muted-foreground">{t("create.subtitle")}</p>
        </div>
      </div>

      {/* Wizard */}
      <CreateItemWizard initialValues={initialValues} wishlistId={wishlistId || undefined} />
    </div>
  );
}
