"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Package, MapPin, Box, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// EntityType mirrors the backend shortlink package
// (TypeItem/TypeContainer/TypeLocation). Since the warehouse.short_codes
// registry (migration 005) made codes globally unique, the resolver returns
// at most one match and redirects straight to it — this page is only ever
// reached for a genuinely unclaimed code, so it only offers create targets.
type EntityType = "item" | "container" | "location";

export default function ClaimPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("claim");

  const code = decodeURIComponent((params.code as string) ?? "");

  // Create targets — wiring is LIVE (quick task 260607-vdf):
  // - Items: /dashboard/items/new reads ?short_code= (and ?barcode=) via
  //   useSearchParams and prefills the CreateItemWizard's short_code field.
  // - Locations & Containers: there is NO /new route — creation is a local
  //   dialog on the list page. Those pages now read ?create=1&short_code= and
  //   auto-open their create dialog with the short_code prefilled. We navigate
  //   to the list page carrying the contract; the dialog opens prefilled. The
  //   next-intl middleware prefixes the active locale automatically.
  const encodedCode = encodeURIComponent(code);
  const createTargets: {
    type: EntityType;
    label: string;
    icon: typeof Package;
    href: string;
  }[] = [
    {
      type: "item",
      label: t("createItem"),
      icon: Package,
      href: `/dashboard/items/new?short_code=${encodedCode}`,
    },
    {
      type: "location",
      label: t("createLocation"),
      icon: MapPin,
      href: `/dashboard/locations?create=1&short_code=${encodedCode}`,
    },
    {
      type: "container",
      label: t("createContainer"),
      icon: Box,
      href: `/dashboard/containers?create=1&short_code=${encodedCode}`,
    },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <QrCode className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("codeLabel")}
            </span>
            <Badge variant="outline" className="font-mono text-base">
              {code}
            </Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("noMatch")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {createTargets.map((target) => {
              const Icon = target.icon;
              return (
                <Button
                  key={target.type}
                  variant="outline"
                  className="h-auto flex-col gap-2 py-6"
                  onClick={() => router.push(target.href)}
                >
                  <Icon className="h-6 w-6" />
                  <span>{target.label}</span>
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t("createHint")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
