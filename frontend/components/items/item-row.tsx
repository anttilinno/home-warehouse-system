"use client";

import { memo } from "react";
import {
  MoreHorizontal,
  Pencil,
  Archive,
  ArchiveRestore,
  Cloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PhotoPlaceholder } from "@/components/items/photo-placeholder";
import { cn } from "@/lib/utils";
import type { Item } from "@/lib/types/items";

export type ItemRowPhoto = {
  urls: { small: string; medium: string; original: string; large: string };
} | null;

export interface ItemRowProps {
  item: Item & { _pending?: boolean };
  /** undefined = still loading, null = no photo */
  photo: ItemRowPhoto | undefined;
  photoCount: number;
  isSelected: boolean;
  categoryName: string;
  minStockDisplay: string;
  /** Virtual row geometry */
  size: number;
  start: number;
  onRowClick: (item: Item & { _pending?: boolean }) => void;
  onToggleSelection: (id: string) => void;
  onEdit: (item: Item) => void;
  onArchive: (item: Item) => void;
}

/**
 * Memoized virtual table row for the items page. Re-renders only when the
 * item, its photo, selection state, or virtual position changes — keeps
 * search-typing from re-rendering every visible row.
 */
export const ItemRow = memo(function ItemRow({
  item,
  photo,
  photoCount,
  isSelected,
  categoryName,
  minStockDisplay,
  size,
  start,
  onRowClick,
  onToggleSelection,
  onEdit,
  onArchive,
}: ItemRowProps) {
  const isPending = Boolean(item._pending);

  return (
    <TableRow
      className={cn(
        "cursor-pointer hover:bg-muted/50 flex items-center",
        isPending && "bg-amber-50/50 dark:bg-amber-900/10"
      )}
      onClick={() => onRowClick(item)}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: `${size}px`,
        transform: `translateY(${start}px)`,
      }}
    >
      <TableCell className="w-[50px] flex-none" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(item.id)}
          aria-label={`Select ${item.name}`}
        />
      </TableCell>
      <TableCell className="w-[60px] flex-none">
        <div className="relative">
          {photo?.urls ? (
            <div className="h-12 w-12 overflow-hidden rounded-md border">
              <img
                src={photo.urls.small}
                alt={item.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : photo === null ? (
            <PhotoPlaceholder size="sm" ariaLabel={`No photo for ${item.name}`} />
          ) : (
            <div className="h-12 w-12 animate-pulse rounded-md bg-muted" />
          )}
          {photoCount > 1 && (
            <Badge
              variant="secondary"
              className="absolute -bottom-1 -right-1 h-5 min-w-5 px-1 text-xs"
            >
              {photoCount}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="flex-1 min-w-0 sm:w-[140px] sm:flex-none font-mono text-sm">
        {item.sku}
        {item.short_code && (
          <Badge variant="outline" className="ml-2 text-xs">
            {item.short_code}
          </Badge>
        )}
      </TableCell>
      <TableCell className="flex-1 min-w-0 hidden sm:flex">
        <div className="truncate">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{item.name}</span>
            {isPending && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 shrink-0">
                <Cloud className="w-3 h-3 mr-1 animate-pulse" />
                Pending
              </Badge>
            )}
          </div>
          {item.description && (
            <div className="text-sm text-muted-foreground truncate">
              {item.description}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="w-[120px] flex-none hidden sm:flex">{categoryName}</TableCell>
      <TableCell className="w-[100px] flex-none hidden sm:flex">{item.brand || "-"}</TableCell>
      <TableCell className="w-[100px] flex-none hidden sm:flex">{item.model || "-"}</TableCell>
      <TableCell className="w-[90px] flex-none hidden sm:flex">{minStockDisplay}</TableCell>
      <TableCell className="w-[50px] flex-none" onClick={(e) => e.stopPropagation()}>
        {!isPending && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${item.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onArchive(item)}>
                {item.is_archived ? (
                  <>
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    Restore
                  </>
                ) : (
                  <>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
});
