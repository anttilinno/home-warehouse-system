"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CollapsibleSearchProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Search input that collapses to a magnifying glass icon on mobile.
 * Tapping the icon expands to a full-width input that overlays the row.
 * On sm+ screens, always shows the full input inline.
 */
export function CollapsibleSearch({
  placeholder,
  value,
  onChange,
}: CollapsibleSearchProps) {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [expanded]);

  const isOpen = expanded || value.length > 0;

  return (
    <>
      {/* Mobile collapsed: just an icon */}
      {!isOpen && (
        <Button
          variant="outline"
          size="icon"
          className="sm:hidden shrink-0"
          onClick={() => setExpanded(true)}
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Button>
      )}

      {/* Mobile expanded: absolute overlay covering the parent row */}
      {isOpen && (
        <div
          ref={wrapperRef}
          className="sm:hidden absolute inset-0 z-10 flex items-center bg-background"
        >
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => {
                // Delay to allow click on X button
                setTimeout(() => {
                  if (!value && !wrapperRef.current?.contains(document.activeElement)) {
                    setExpanded(false);
                  }
                }, 150);
              }}
              className="pl-9 pr-9 w-full"
            />
            <button
              onClick={() => {
                onChange("");
                setExpanded(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Desktop: always show full input */}
      <div className="relative flex-1 hidden sm:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9"
        />
      </div>
    </>
  );
}
