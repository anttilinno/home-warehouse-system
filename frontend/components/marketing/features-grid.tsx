"use client";

import { useTranslations } from "next-intl";
import {
  Package,
  MapPin,
  Users,
  QrCode,
  FileSpreadsheet,
  Bell,
  FolderTree,
  HandCoins,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { Card, CardContent } from "@/components/ui/card";

const featureIcons = {
  items: Package,
  locations: MapPin,
  containers: FolderTree,
  workspaces: Users,
  scanning: QrCode,
  loans: HandCoins,
  alerts: Bell,
  import: FileSpreadsheet,
};

const featureKeys = [
  "items",
  "locations",
  "containers",
  "workspaces",
  "scanning",
  "loans",
  "alerts",
  "import",
] as const;

export function FeaturesGrid() {
  const t = useTranslations("features");

  return (
    <section className="py-20 md:py-32">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featureKeys.map((key) => {
            const Icon = featureIcons[key];
            return (
              <Card
                key={key}
                className="group relative overflow-hidden transition-all hover:shadow-lg"
              >
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold">{t(`${key}.title`)}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t(`${key}.description`)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
