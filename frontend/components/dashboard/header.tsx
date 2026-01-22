"use client";

import { useTranslations } from "next-intl";
import { Menu, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import { SSEStatusIndicator } from "@/components/dashboard/sse-status-indicator";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";
import { NotificationsDropdown } from "@/components/dashboard/notifications-dropdown";
import { useGlobalSearch } from "@/lib/hooks/use-global-search";
import { GlobalSearchResults } from "@/components/ui/global-search-results";
import { useWorkspace } from "@/lib/hooks/use-workspace";

interface HeaderProps {
  onMenuClick: () => void;
}

export function DashboardHeader({ onMenuClick }: HeaderProps) {
  const t = useTranslations("dashboard");
  const { workspaceId } = useWorkspace();

  // Global search state
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const {
    query,
    setQuery,
    results,
    isLoading,
    error,
    recentSearches,
    selectRecentSearch,
    clearRecent,
    selectedIndex,
    setSelectedIndex,
    allResults,
    selectedResult,
    clearSearch,
  } = useGlobalSearch({
    workspaceId: workspaceId || "",
    debounceMs: 300,
    limit: 5,
    minQueryLength: 2,
  });

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Arrow down
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < allResults.length - 1 ? prev + 1 : prev
      );
    }

    // Arrow up
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    }

    // Enter
    if (e.key === "Enter" && selectedResult) {
      e.preventDefault();
      // Navigation handled by GlobalSearchResults component
      setSearchOpen(false);
      clearSearch();
    }

    // Escape
    if (e.key === "Escape") {
      e.preventDefault();
      setSearchOpen(false);
      clearSearch();
    }
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };

    if (searchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [searchOpen]);

  // Add global keyboard shortcut: Ctrl+/
  useEffect(() => {
    const handleGlobalShortcut = (e: KeyboardEvent) => {
      if (e.key === "/" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        // Focus search input
        const input = searchRef.current?.querySelector("input");
        input?.focus();
        setSearchOpen(true);
      }
    };

    document.addEventListener("keydown", handleGlobalShortcut);
    return () => document.removeEventListener("keydown", handleGlobalShortcut);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden shrink-0"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      {/* Workspace switcher */}
      <WorkspaceSwitcher />

      {/* Global Search */}
      <div className="flex-1 max-w-md" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleKeyDown}
            className="w-full pl-8 pr-8"
            aria-label="Global search"
            aria-expanded={searchOpen}
            aria-controls="global-search-results"
          />
          {query && (
            <button
              onClick={() => clearSearch()}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Search Results Dropdown */}
          {searchOpen && (
            <GlobalSearchResults
              results={results?.results || { items: [], borrowers: [], containers: [], locations: [] }}
              totalCount={results?.totalCount || 0}
              isLoading={isLoading}
              error={error}
              query={query}
              selectedIndex={selectedIndex}
              onSelectResult={(result) => {
                console.log("Selected:", result);
                // Navigation handled by router in GlobalSearchResults
              }}
              onClose={() => {
                setSearchOpen(false);
                clearSearch();
              }}
              recentSearches={recentSearches}
              onSelectRecentSearch={selectRecentSearch}
              onClearRecent={clearRecent}
            />
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto">
        <SyncStatusIndicator />
        <SSEStatusIndicator className="mr-2" />
        <LanguageSwitcher />
        <ThemeToggle />

        {/* Notifications */}
        <NotificationsDropdown />
      </div>
    </header>
  );
}
