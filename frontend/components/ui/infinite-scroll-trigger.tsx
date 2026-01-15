"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InfiniteScrollTriggerProps {
  /** Callback to load more items */
  onLoadMore: () => void;

  /** Whether currently loading more items */
  isLoading?: boolean;

  /** Whether there are more items to load */
  hasMore?: boolean;

  /** Custom loading text */
  loadingText?: string;

  /** Custom "no more items" text */
  endText?: string;

  /** Root margin for intersection observer (default: "200px") */
  rootMargin?: string;

  /** Threshold for intersection observer (default: 0.1) */
  threshold?: number;

  /** Additional className */
  className?: string;
}

/**
 * InfiniteScrollTrigger component
 *
 * Uses IntersectionObserver to detect when the user has scrolled near the bottom
 * and triggers loading more items.
 *
 * @example
 * ```tsx
 * <Table>
 *   {items.map(item => <TableRow key={item.id}>...</TableRow>)}
 * </Table>
 *
 * <InfiniteScrollTrigger
 *   onLoadMore={loadMore}
 *   isLoading={isLoadingMore}
 *   hasMore={hasMore}
 * />
 * ```
 */
export function InfiniteScrollTrigger({
  onLoadMore,
  isLoading = false,
  hasMore = true,
  loadingText = "Loading more...",
  endText = "No more items",
  rootMargin = "200px",
  threshold = 0.1,
  className,
}: InfiniteScrollTriggerProps) {
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger || !hasMore || isLoading) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      {
        root: null, // Use viewport as root
        rootMargin,
        threshold,
      }
    );

    observer.observe(trigger);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, onLoadMore, rootMargin, threshold]);

  // Don't render anything if no more items
  if (!hasMore) {
    return (
      <div
        className={cn(
          "flex items-center justify-center py-8 text-sm text-muted-foreground",
          className
        )}
      >
        {endText}
      </div>
    );
  }

  return (
    <div
      ref={triggerRef}
      className={cn(
        "flex items-center justify-center py-8",
        className
      )}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{loadingText}</span>
        </div>
      ) : (
        // Show a subtle indicator when not loading
        <div className="h-4 w-4" aria-hidden="true" />
      )}
    </div>
  );
}
