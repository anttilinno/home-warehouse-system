"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  ScanLine,
  Package,
  HandCoins,
  Plus,
  Box,
  MapPin,
  ClipboardList,
} from "lucide-react";
import type { FABAction } from "@/components/fab";

/**
 * Returns context-aware FAB actions based on current route
 *
 * Route-specific behavior:
 * - /dashboard/items: Add Item as primary action
 * - /dashboard/inventory: Quick Count as primary action
 * - /dashboard/containers: Add Container as primary action
 * - /dashboard/locations: Add Location as primary action
 * - /dashboard/loans: Log Loan as primary action
 * - Default: Scan, Add Item, Log Loan
 */
export function useFABActions(): FABAction[] {
  const pathname = usePathname();
  const router = useRouter();

  return useMemo(() => {
    // Base actions available on most screens
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

    const logLoanAction: FABAction = {
      id: "log-loan",
      icon: <HandCoins className="h-5 w-5" />,
      label: "Log loan",
      onClick: () => router.push("/dashboard/loans/new"),
    };

    const addContainerAction: FABAction = {
      id: "add-container",
      icon: <Box className="h-5 w-5" />,
      label: "Add container",
      onClick: () => router.push("/dashboard/containers/new"),
    };

    const addLocationAction: FABAction = {
      id: "add-location",
      icon: <MapPin className="h-5 w-5" />,
      label: "Add location",
      onClick: () => router.push("/dashboard/locations/new"),
    };

    const quickCountAction: FABAction = {
      id: "quick-count",
      icon: <ClipboardList className="h-5 w-5" />,
      label: "Quick count",
      onClick: () => router.push("/dashboard/inventory/count"),
    };

    // Default actions (3 items - scan, add item, log loan)
    const defaultActions = [scanAction, addItemAction, logLoanAction];

    // Route-specific customization
    // Items page: Add Item as first action
    if (
      pathname === "/dashboard/items" ||
      pathname.startsWith("/dashboard/items/")
    ) {
      return [
        { ...addItemAction, icon: <Plus className="h-5 w-5" /> },
        scanAction,
        logLoanAction,
      ];
    }

    // Inventory page: Quick Count as first action
    if (
      pathname === "/dashboard/inventory" ||
      pathname.startsWith("/dashboard/inventory/")
    ) {
      return [quickCountAction, scanAction, addItemAction, logLoanAction].slice(
        0,
        4
      );
    }

    // Containers page: Add Container as first action
    if (
      pathname === "/dashboard/containers" ||
      pathname.startsWith("/dashboard/containers/")
    ) {
      return [addContainerAction, scanAction, addItemAction].slice(0, 4);
    }

    // Locations page: Add Location as first action
    if (
      pathname === "/dashboard/locations" ||
      pathname.startsWith("/dashboard/locations/")
    ) {
      return [addLocationAction, scanAction, addItemAction].slice(0, 4);
    }

    // Loans page: Log Loan as first action
    if (
      pathname === "/dashboard/loans" ||
      pathname.startsWith("/dashboard/loans/")
    ) {
      return [
        { ...logLoanAction, icon: <Plus className="h-5 w-5" /> },
        scanAction,
        addItemAction,
      ];
    }

    // Scan page: Hide FAB (return empty to let consumer decide)
    if (pathname === "/dashboard/scan") {
      return [];
    }

    return defaultActions;
  }, [pathname, router]);
}
