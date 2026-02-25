"use client";

import { ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { EditItemWizard } from "@/components/items/edit-item-wizard";

export default function EditItemPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("items.edit");
  const itemId = params.id as string;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/dashboard/items/${itemId}`)}
          className="min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {/* Wizard */}
      <EditItemWizard itemId={itemId} />
    </div>
  );
}
