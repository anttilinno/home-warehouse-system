"use client";

import { useRouter } from "next/navigation";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchResult, SearchResultsByType } from "@/lib/api/search";

interface GlobalSearchResultsProps {
  results: SearchResultsByType;
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  query: string;
  selectedIndex: number;
  onSelectResult: (result: SearchResult) => void;
  onClose: () => void;
  recentSearches?: string[];
  onSelectRecentSearch?: (query: string) => void;
  onClearRecent?: () => void;
}

export function GlobalSearchResults({
  results,
  totalCount,
  isLoading,
  error,
  query,
  selectedIndex,
  onSelectResult,
  onClose,
  recentSearches = [],
  onSelectRecentSearch,
  onClearRecent,
}: GlobalSearchResultsProps) {
  const router = useRouter();

  // Show nothing if no query and no recent searches
  if (!query && recentSearches.length === 0) {
    return null;
  }

  // Show recent searches if no query
  if (!query && recentSearches.length > 0) {
    return (
      <div className="absolute top-full mt-2 w-full bg-popover border rounded-md shadow-lg z-50 max-h-[400px] overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-xs font-medium text-muted-foreground">
            Recent Searches
          </span>
          <button
            onClick={onClearRecent}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
        <div className="py-1">
          {recentSearches.map((recent, index) => (
            <button
              key={index}
              onClick={() => onSelectRecentSearch?.(recent)}
              className="w-full min-h-[44px] px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-3 touch-manipulation"
            >
              <div className="flex items-center justify-center min-w-[44px] min-h-[44px] -my-2 -ml-1">
                <LucideIcons.History className="h-4 w-4 text-muted-foreground" />
              </div>
              <span>{recent}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="absolute top-full mt-2 w-full bg-popover border rounded-md shadow-lg z-50 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LucideIcons.Loader2 className="h-4 w-4 animate-spin" />
          <span>Searching...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="absolute top-full mt-2 w-full bg-popover border rounded-md shadow-lg z-50 p-4">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <LucideIcons.AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // Show no results
  if (totalCount === 0) {
    return (
      <div className="absolute top-full mt-2 w-full bg-popover border rounded-md shadow-lg z-50 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LucideIcons.SearchX className="h-4 w-4" />
          <span>No results found for &ldquo;{query}&rdquo;</span>
        </div>
      </div>
    );
  }

  // Flatten results for indexing
  const allResults: SearchResult[] = [
    ...results.items,
    ...results.borrowers,
    ...results.containers,
    ...results.locations,
  ];

  const handleResultClick = (result: SearchResult) => {
    onSelectResult(result);
    router.push(result.url);
    onClose();
  };

  return (
    <div className="absolute top-full mt-2 w-full bg-popover border rounded-md shadow-lg z-50 max-h-[500px] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-medium text-muted-foreground">
          {totalCount} result{totalCount !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
        </span>
        <span className="text-xs text-muted-foreground">
          ↑↓ navigate • ↵ select • esc close
        </span>
      </div>

      {/* Results grouped by type */}
      <div className="py-1">
        {/* Items */}
        {results.items.length > 0 && (
          <SearchResultGroup
            title="Items"
            icon="Package"
            results={results.items}
            startIndex={0}
            selectedIndex={selectedIndex}
            onSelect={handleResultClick}
          />
        )}

        {/* Borrowers */}
        {results.borrowers.length > 0 && (
          <SearchResultGroup
            title="Borrowers"
            icon="User"
            results={results.borrowers}
            startIndex={results.items.length}
            selectedIndex={selectedIndex}
            onSelect={handleResultClick}
          />
        )}

        {/* Containers */}
        {results.containers.length > 0 && (
          <SearchResultGroup
            title="Containers"
            icon="Box"
            results={results.containers}
            startIndex={results.items.length + results.borrowers.length}
            selectedIndex={selectedIndex}
            onSelect={handleResultClick}
          />
        )}

        {/* Locations */}
        {results.locations.length > 0 && (
          <SearchResultGroup
            title="Locations"
            icon="MapPin"
            results={results.locations}
            startIndex={
              results.items.length +
              results.borrowers.length +
              results.containers.length
            }
            selectedIndex={selectedIndex}
            onSelect={handleResultClick}
          />
        )}
      </div>
    </div>
  );
}

interface SearchResultGroupProps {
  title: string;
  icon: keyof typeof LucideIcons;
  results: SearchResult[];
  startIndex: number;
  selectedIndex: number;
  onSelect: (result: SearchResult) => void;
}

function SearchResultGroup({
  title,
  icon,
  results,
  startIndex,
  selectedIndex,
  onSelect,
}: SearchResultGroupProps) {
  const Icon = LucideIcons[icon] as LucideIcons.LucideIcon;

  return (
    <div className="py-1">
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" />
        <span>{title}</span>
      </div>
      {results.map((result, index) => {
        const globalIndex = startIndex + index;
        const isSelected = globalIndex === selectedIndex;
        const ResultIcon = LucideIcons[
          result.icon as keyof typeof LucideIcons
        ] as LucideIcons.LucideIcon;

        return (
          <button
            key={result.id}
            onClick={() => onSelect(result)}
            className={cn(
              "w-full min-h-[44px] px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-3 transition-colors touch-manipulation",
              isSelected && "bg-accent"
            )}
          >
            <div className="flex items-center justify-center min-w-[44px] min-h-[44px] -my-2 -ml-1 flex-shrink-0">
              <ResultIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{result.title}</div>
              {result.subtitle && (
                <div className="text-xs text-muted-foreground truncate">
                  {result.subtitle}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
