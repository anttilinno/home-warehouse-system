"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  ScanLine,
  Package,
  Plus,
  Camera,
} from "lucide-react";
import type { FABAction } from "@/components/fab";

/**
 * Returns context-aware FAB actions based on current route
 *
 * Only includes actions for pages that exist:
 * - /dashboard/scan
 * - /dashboard/items/new
 * - /dashboard/items/quick-capture
 */
export function useFABActions(): FABAction[] {
  const pathname = usePathname();
  const router = useRouter();

  return useMemo(() => {
    const scanAction: FABAction = {
      id: "scan",
      icon: <ScanLine className="h-5 w-5" />,
      label: "Scan barcode",
      onClick: () => router.push("/dashboard/scan"),
    };

    const addItemAction: FABAction = {
      id: "add-item",
      icon: <Package className="h-5 w-5" />,
      label: "Add item",
      onClick: () => router.push("/dashboard/items/new"),
    };

    const quickCaptureAction: FABAction = {
      id: "quick-capture",
      icon: <Camera className="h-5 w-5" />,
      label: "Quick capture",
      onClick: () => router.push("/dashboard/items/quick-capture"),
    };

    // Hide FAB on pages where it's not needed
    if (pathname === "/dashboard/items/quick-capture" || pathname === "/dashboard/scan") {
      return [];
    }

    // Items page: Quick Capture as first action
    if (
      pathname === "/dashboard/items" ||
      pathname.startsWith("/dashboard/items/")
    ) {
      return [
        quickCaptureAction,
        { ...addItemAction, icon: <Plus className="h-5 w-5" /> },
        scanAction,
      ];
    }

    // Default: scan, quick capture, add item
    return [scanAction, quickCaptureAction, addItemAction];
  }, [pathname, router]);
}
