"use client";

import { useState } from "react";
import { Save, Star, Trash2, Check } from "lucide-react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Input } from "./input";
import { Label } from "./label";
import { Checkbox } from "./checkbox";
import type { SavedFilter } from "@/lib/hooks/use-saved-filters";
import { cn } from "@/lib/utils";

interface SavedFiltersProps {
  savedFilters: SavedFilter[];
  currentFilters: Record<string, any>;
  onApplyFilter: (filterId: string) => void;
  onSaveFilter: (name: string, isDefault: boolean) => void;
  onDeleteFilter: (filterId: string) => void;
  onSetDefault: (filterId: string) => void;
  hasActiveFilters: boolean;
}

export function SavedFilters({
  savedFilters,
  currentFilters,
  onApplyFilter,
  onSaveFilter,
  onDeleteFilter,
  onSetDefault,
  hasActiveFilters,
}: SavedFiltersProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const handleSave = () => {
    if (!filterName.trim()) return;
    onSaveFilter(filterName, isDefault);
    setFilterName("");
    setIsDefault(false);
    setSaveDialogOpen(false);
  };

  const defaultFilter = savedFilters.find((f) => f.isDefault);

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Saved Filters Dropdown */}
        {savedFilters.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Star className="mr-2 h-4 w-4" />
                Saved Filters
                {defaultFilter && <span className="ml-1">({savedFilters.length})</span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {savedFilters.map((filter) => (
                <DropdownMenuItem
                  key={filter.id}
                  className="flex items-center justify-between cursor-pointer group"
                  onSelect={(e) => {
                    e.preventDefault();
                  }}
                >
                  <button
                    className="flex-1 text-left"
                    onClick={() => onApplyFilter(filter.id)}
                  >
                    <div className="flex items-center gap-2">
                      {filter.isDefault && (
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      )}
                      <span className={cn(filter.isDefault && "font-medium")}>
                        {filter.name}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {Object.keys(filter.filters).length} filter
                      {Object.keys(filter.filters).length !== 1 ? "s" : ""}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    {!filter.isDefault && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetDefault(filter.id);
                        }}
                        className="p-1 rounded hover:bg-muted"
                        title="Set as default"
                      >
                        <Star className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFilter(filter.id);
                      }}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Save Current Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSaveDialogOpen(true)}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Filter
          </Button>
        )}
      </div>

      {/* Save Filter Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter View</DialogTitle>
            <DialogDescription>
              Save your current filter settings to quickly apply them later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filter-name">Filter Name</Label>
              <Input
                id="filter-name"
                placeholder="e.g., My Active Items"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSave();
                  }
                }}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-default"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked === true)}
              />
              <Label
                htmlFor="is-default"
                className="text-sm font-normal cursor-pointer"
              >
                Set as default filter (auto-apply on page load)
              </Label>
            </div>

            <div className="rounded-md bg-muted p-3">
              <div className="text-sm font-medium mb-2">Active Filters:</div>
              <div className="text-xs text-muted-foreground space-y-1">
                {Object.entries(currentFilters).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-2">
                    <Check className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>
                      <span className="font-medium">{key}:</span>{" "}
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!filterName.trim()}>
              Save Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
