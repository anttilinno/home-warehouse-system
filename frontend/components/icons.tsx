"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, ComponentType } from "react";
import * as LucideIcons from "lucide-react";
import * as PhosphorIcons from "@phosphor-icons/react";

// Map Lucide icon names to Phosphor equivalents
const iconMap: Record<string, string> = {
  // Navigation & Layout
  Home: "House",
  Package: "Package",
  Tag: "Tag",
  Archive: "Archive",
  MapPin: "MapPin",
  Box: "Cube",
  HandCoins: "HandCoins",
  Contact: "AddressBook",
  BarChart3: "ChartBar",
  Settings: "Gear",
  Bell: "Bell",
  User: "User",
  Users: "Users",
  Layers: "Stack",
  Warehouse: "Warehouse",

  // Chevrons
  ChevronUp: "CaretUp",
  ChevronDown: "CaretDown",
  ChevronRight: "CaretRight",
  ChevronLeft: "CaretLeft",

  // Actions
  Plus: "Plus",
  Search: "MagnifyingGlass",
  X: "X",
  Pencil: "Pencil",
  Trash2: "Trash",
  Copy: "Copy",
  Check: "Check",

  // Auth
  LogIn: "SignIn",
  LogOut: "SignOut",
  Globe: "Globe",

  // Dashboard
  DollarSign: "CurrencyDollar",
  AlertTriangle: "Warning",
  AlertCircle: "WarningCircle",
  Clock: "Clock",
  Shield: "Shield",

  // Misc
  Palette: "Palette",
  Moon: "Moon",
  Sun: "Sun",
  Gamepad2: "GameController",
  MoreVertical: "DotsThreeVertical",
  MoreHorizontal: "DotsThree",
  ExternalLink: "ArrowSquareOut",
  Eye: "Eye",
  EyeOff: "EyeSlash",
  Filter: "Funnel",
  Download: "Download",
  Upload: "Upload",
  Loader2: "CircleNotch",
  RefreshCw: "ArrowsClockwise",
  Building2: "Buildings",
  Crown: "Crown",
  UserPlus: "UserPlus",
};

interface IconProps {
  name: keyof typeof LucideIcons;
  className?: string;
  size?: number;
}

export function Icon({ name, className, size }: IconProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get the Lucide icon
  const LucideIcon = LucideIcons[name] as ComponentType<{ className?: string; size?: number }>;

  // Before mounting, render Lucide to avoid hydration mismatch
  if (!mounted || !LucideIcon) {
    if (LucideIcon) {
      return <LucideIcon className={className} size={size} />;
    }
    return null;
  }

  const isRetro = theme?.startsWith("retro");

  if (isRetro) {
    const phosphorName = iconMap[name as string] || name;
    const PhosphorIcon = (PhosphorIcons as unknown as Record<string, ComponentType<{ className?: string; size?: number; weight?: string }>>)[phosphorName];

    if (PhosphorIcon) {
      return <PhosphorIcon className={className} size={size} weight="bold" />;
    }
  }

  return <LucideIcon className={className} size={size} />;
}

// Export individual themed icons for convenience
export function createThemedIcon(lucideName: keyof typeof LucideIcons) {
  return function ThemedIcon(props: Omit<IconProps, "name">) {
    return <Icon name={lucideName} {...props} />;
  };
}

// Pre-built themed icons for common usage
export const ThemedPackage = createThemedIcon("Package");
export const ThemedHome = createThemedIcon("Home");
export const ThemedSettings = createThemedIcon("Settings");
export const ThemedUser = createThemedIcon("User");
export const ThemedBell = createThemedIcon("Bell");
