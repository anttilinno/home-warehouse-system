"use client";

import { useState, useRef, useEffect } from "react";
import { Check, X, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

interface InlineEditSelectOption {
  value: string;
  label: string;
}

interface InlineEditSelectProps {
  value: string;
  options: InlineEditSelectOption[];
  onSave: (newValue: string) => Promise<void>;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  renderValue?: (value: string, option?: InlineEditSelectOption) => React.ReactNode;
}

export function InlineEditSelect({
  value,
  options,
  onSave,
  className,
  triggerClassName,
  disabled = false,
  renderValue,
}: InlineEditSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset edit value when value prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleStartEdit = () => {
    if (!disabled) {
      setIsEditing(true);
      setError(null);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    // Don't save if value hasn't changed
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      // Keep in edit mode on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleValueChange = (newValue: string) => {
    setEditValue(newValue);
    // Auto-save when value changes
    setIsSaving(true);
    setError(null);
    onSave(newValue)
      .then(() => {
        setIsEditing(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to save");
        // Revert to original value on error
        setEditValue(value);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const currentOption = options.find((opt) => opt.value === value);

  if (!isEditing) {
    return (
      <div
        onClick={handleStartEdit}
        className={cn(
          "cursor-pointer rounded px-2 py-1 hover:bg-muted/50 transition-colors inline-flex items-center gap-1",
          disabled && "cursor-not-allowed opacity-60",
          className
        )}
        title={disabled ? undefined : "Click to edit"}
      >
        {renderValue ? renderValue(value, currentOption) : currentOption?.label || value}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Select
        value={editValue}
        onValueChange={handleValueChange}
        disabled={isSaving}
        open={isEditing}
        onOpenChange={(open) => {
          if (!open && !isSaving) {
            handleCancel();
          }
        }}
      >
        <SelectTrigger className={cn("h-8 px-2 w-auto", triggerClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
