"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

interface InlineEditCellProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "number";
  disabled?: boolean;
}

export function InlineEditCell({
  value,
  onSave,
  className,
  inputClassName,
  placeholder,
  type = "text",
  disabled = false,
}: InlineEditCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset edit value when value prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <div
        onClick={handleStartEdit}
        onDoubleClick={handleStartEdit}
        className={cn(
          "cursor-pointer rounded px-2 py-1 hover:bg-muted/50 transition-colors",
          disabled && "cursor-not-allowed opacity-60",
          className
        )}
        title={disabled ? undefined : "Click to edit"}
      >
        {value || (
          <span className="text-muted-foreground italic">{placeholder || "Empty"}</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        className={cn("h-8 px-2", inputClassName)}
        disabled={isSaving}
      />
      <div className="flex items-center gap-1">
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <button
              type="button"
              onClick={handleSave}
              className="p-1 rounded hover:bg-muted text-green-600 hover:text-green-700"
              title="Save (Enter)"
              disabled={isSaving}
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 rounded hover:bg-muted text-destructive hover:text-destructive/80"
              title="Cancel (Esc)"
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
