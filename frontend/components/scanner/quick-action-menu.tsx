/**
 * QuickActionMenu Component
 *
 * Post-scan action menu that displays context-aware actions based on entity type.
 * For items: view, loan, move, repair
 * For containers/locations: view, move
 * For not found: create new item option
 *
 * Designed to overlay on top of scanner without unmounting it (iOS PWA compatibility).
 */
"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Package,
  MapPin,
  Box,
  Wrench,
  ArrowRight,
  Eye,
  Plus,
  ScanLine,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EntityMatch } from "@/lib/scanner";

export interface QuickActionMenuProps {
  /** The entity match result from scan lookup */
  match: EntityMatch;
  /** Called when user selects an action */
  onAction: (action: QuickAction) => void;
  /** Called when user wants to scan again */
  onClose: () => void;
  /** Additional CSS classes */
  className?: string;
}

export type QuickAction =
  | "view"
  | "loan"
  | "move"
  | "repair"
  | "create"
  | "scan-again";

const ENTITY_ICONS = {
  item: Package,
  container: Box,
  location: MapPin,
  not_found: ScanLine,
} as const;

const ACTION_ICONS = {
  view: Eye,
  loan: ArrowRight,
  move: MapPin,
  repair: Wrench,
  create: Plus,
  "scan-again": ScanLine,
} as const;

export function QuickActionMenu({
  match,
  onAction,
  onClose,
  className,
}: QuickActionMenuProps) {
  const t = useTranslations("scanner");
  const router = useRouter();

  // Get icon for entity type
  const EntityIcon = ENTITY_ICONS[match.type];

  // Determine available actions based on entity type
  const getActions = (): QuickAction[] => {
    switch (match.type) {
      case "item":
        return ["view", "loan", "move", "repair"];
      case "container":
      case "location":
        return ["view", "move"];
      case "not_found":
        return ["create"];
    }
  };

  // Handle action selection
  const handleAction = (action: QuickAction) => {
    // For view action, navigate directly
    if (action === "view" && match.type !== "not_found") {
      const url = getEntityUrl(match);
      if (url) {
        router.push(url);
        return;
      }
    }

    // For create action, navigate to items create with barcode pre-filled
    if (action === "create" && match.type === "not_found") {
      router.push(
        `/dashboard/items/new?barcode=${encodeURIComponent(match.code)}`
      );
      return;
    }

    // For other actions, delegate to parent
    onAction(action);
  };

  // Get navigation URL for entity
  function getEntityUrl(match: EntityMatch): string | null {
    switch (match.type) {
      case "item":
        return `/dashboard/items/${match.entity.id}`;
      case "container":
        return `/dashboard/containers?selected=${match.entity.id}`;
      case "location":
        return `/dashboard/locations?selected=${match.entity.id}`;
      case "not_found":
        return null;
    }
  }

  const actions = getActions();

  // Not found state
  if (match.type === "not_found") {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <EntityIcon className="h-5 w-5 text-muted-foreground" />
              {t("notFound.title")}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
              aria-label={t("close")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("notFound.description", { code: match.code })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              <ScanLine className="h-4 w-4 mr-2" />
              {t("actions.scanAgain")}
            </Button>
            <Button onClick={() => handleAction("create")} className="flex-1">
              <Plus className="h-4 w-4 mr-2" />
              {t("actions.createItem")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Found entity state
  const entityName = match.entity.name;
  const entityShortCode =
    "short_code" in match.entity ? match.entity.short_code : null;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <EntityIcon className="h-5 w-5 text-primary" />
              {entityName}
            </CardTitle>
            <p className="text-sm text-muted-foreground capitalize mt-0.5">
              {match.type}
              {entityShortCode && ` \u2022 ${entityShortCode}`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label={t("close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => {
            const ActionIcon = ACTION_ICONS[action];
            return (
              <Button
                key={action}
                variant="outline"
                onClick={() => handleAction(action)}
                className="justify-start h-11"
              >
                <ActionIcon className="h-4 w-4 mr-2" />
                {t(`actions.${action}`)}
              </Button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          onClick={onClose}
          className="w-full mt-3 text-muted-foreground"
        >
          <ScanLine className="h-4 w-4 mr-2" />
          {t("actions.scanAgain")}
        </Button>
      </CardContent>
    </Card>
  );
}

export default QuickActionMenu;
