"use client";

import { useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Package, MapPin, Box, ArrowRight, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// EntityType + ParsedMatch mirror the backend shortlink package
// (TypeItem/TypeContainer/TypeLocation). The backend emits the multi-match list
// as a comma-joined list of "type:id" triples in the `matches` query param —
// keep this decoder in sync with shortlink.encodeMatches (handler.go).
type EntityType = "item" | "container" | "location";

interface ParsedMatch {
  type: EntityType;
  id: string;
}

function parseMatches(raw: string | null): ParsedMatch[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((triple) => {
      const idx = triple.indexOf(":");
      if (idx === -1) return null;
      const type = triple.slice(0, idx) as EntityType;
      const id = triple.slice(idx + 1);
      if (
        (type !== "item" && type !== "container" && type !== "location") ||
        !id
      ) {
        return null;
      }
      return { type, id };
    })
    .filter((m): m is ParsedMatch => m !== null);
}

// entityHref maps a match to its dashboard destination. Mirrors the backend
// redirect mapping: item -> detail route; container/location -> list page with
// a `focus` query param (neither has an [id] detail route).
function entityHref(match: ParsedMatch): string {
  switch (match.type) {
    case "item":
      return `/dashboard/items/${match.id}`;
    case "container":
      return `/dashboard/containers?focus=${match.id}`;
    case "location":
      return `/dashboard/locations?focus=${match.id}`;
  }
}

export default function ClaimPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("claim");

  const code = decodeURIComponent((params.code as string) ?? "");
  const matches = useMemo(
    () => parseMatches(searchParams.get("matches")),
    [searchParams]
  );

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

  const isMultiMatch = matches.length > 0;

  const typeLabel = (type: EntityType): string => {
    switch (type) {
      case "item":
        return t("typeItem");
      case "container":
        return t("typeContainer");
      case "location":
        return t("typeLocation");
    }
  };

  const typeIcon = (type: EntityType) => {
    switch (type) {
      case "item":
        return Package;
      case "container":
        return Box;
      case "location":
        return MapPin;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <QrCode className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isMultiMatch ? t("multiTitle") : t("title")}
          </h1>
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

      {isMultiMatch ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("multiTitle")}</CardTitle>
            <CardDescription>{t("multiSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {matches.map((match) => {
              const Icon = typeIcon(match.type);
              return (
                <button
                  key={`${match.type}:${match.id}`}
                  type="button"
                  onClick={() => router.push(entityHref(match))}
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex flex-col">
                      <span className="font-medium">{typeLabel(match.type)}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {match.id}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    {t("open")}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      ) : (
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
      )}
    </div>
  );
}
