"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { CreateItemWizard } from "@/components/items/create-item-wizard";

export default function NewItemPage() {
  const router = useRouter();
  const t = useTranslations("items");

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
      <CreateItemWizard />
    </div>
  );
}
