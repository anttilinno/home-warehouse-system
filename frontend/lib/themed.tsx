"use client";

import { useTheme } from "next-themes";

// Import unified themed components
import {
  Button,
  Card,
  PageHeader,
  EmptyState,
  ActionsMenu,
  Badge,
  Tag,
  Status,
  LabelTag,
  Count,
  ConditionBadge,
  LoanStatusBadge,
  Chip,
  Form,
  FormGroup,
  FormRow,
  Label,
  Input,
  Textarea,
  Select,
  Checkbox,
  Error,
  Hint,
  FormDivider,
  Modal,
  Table,
} from "@/components/themed";

// Re-export component types for convenience
export type { ActionItem } from "@/components/themed";

// Define the component set type
export interface ThemedComponents {
  // Layout & Display
  Button: typeof Button;
  Card: typeof Card;
  PageHeader: typeof PageHeader;
  EmptyState: typeof EmptyState;
  ActionsMenu: typeof ActionsMenu;

  // Table
  Table: typeof Table;

  // Modal
  Modal: typeof Modal;

  // Form
  Form: typeof Form;
  FormGroup: typeof FormGroup;
  FormRow: typeof FormRow;
  Label: typeof Label;
  Input: typeof Input;
  Textarea: typeof Textarea;
  Select: typeof Select;
  Checkbox: typeof Checkbox;
  Error: typeof Error;
  Hint: typeof Hint;
  FormDivider: typeof FormDivider;

  // Badge
  Badge: typeof Badge;
  Tag: typeof Tag;
  Status: typeof Status;
  LabelTag: typeof LabelTag;
  Count: typeof Count;
  ConditionBadge: typeof ConditionBadge;
  LoanStatusBadge: typeof LoanStatusBadge;
  Chip: typeof Chip;

  // Theme info (for conditional content, not styling)
  isRetro: boolean;
}

// Single component set (components are now pure CSS themed)
const themedComponents: Omit<ThemedComponents, "isRetro"> = {
  Button,
  Card,
  PageHeader,
  EmptyState,
  ActionsMenu,
  Table,
  Modal,
  Form,
  FormGroup,
  FormRow,
  Label,
  Input,
  Textarea,
  Select,
  Checkbox,
  Error,
  Hint,
  FormDivider,
  Badge,
  Tag,
  Status,
  LabelTag,
  Count,
  ConditionBadge,
  LoanStatusBadge,
  Chip,
};

/**
 * Hook to get themed components.
 * Components now use pure CSS theming - no JS conditionals needed.
 * The `isRetro` flag is still provided for cases where you need
 * to conditionally render different content (not styles).
 *
 * @example
 * ```tsx
 * function MyPage() {
 *   const { Button, Card, Table, isRetro } = useThemed();
 *
 *   return (
 *     <Card title="My Card">
 *       <Table>...</Table>
 *       <Button variant="primary">Click me</Button>
 *       {isRetro && <p>Retro content here</p>}
 *     </Card>
 *   );
 * }
 * ```
 */
export function useThemed(): ThemedComponents {
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro") ?? false;

  return { ...themedComponents, isRetro };
}

/**
 * Get themed CSS classes for loading states and other common patterns.
 * Use this for elements that don't need a full component but need theme-aware styling.
 */
export function useThemedClasses() {
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro") ?? false;

  return {
    isRetro,
    // Loading text
    loadingText: isRetro
      ? "retro-small uppercase font-bold animate-pulse retro-heading"
      : "text-muted-foreground",
    // Error text
    errorText: isRetro ? "retro-body" : "text-red-500",
    // Body text
    bodyText: isRetro ? "retro-body" : "text-sm",
    // Small text
    smallText: isRetro ? "retro-small" : "text-xs text-muted-foreground",
    // Heading
    heading: isRetro ? "retro-heading" : "font-semibold",
  };
}
