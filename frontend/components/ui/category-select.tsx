'use client';

import { useMemo } from 'react';
import type { Category } from '@/lib/api';
import { flattenWithDepth, getDescendantIds, getIndentPrefix } from '@/lib/category-utils';

interface CategorySelectProps {
  categories: Category[];
  value: string | null;
  onChange: (value: string | null) => void;
  excludeIds?: string[];
  placeholder?: string;
  allowNone?: boolean;
  className?: string;
  required?: boolean;
}

export function CategorySelect({
  categories,
  value,
  onChange,
  excludeIds = [],
  placeholder = 'Select category...',
  allowNone = true,
  className = '',
  required = false,
}: CategorySelectProps) {
  // Flatten categories with depth and filter out excluded IDs and their descendants
  const options = useMemo(() => {
    // Get all IDs to exclude (including descendants of excluded items)
    const allExcludedIds = new Set<string>();
    for (const id of excludeIds) {
      allExcludedIds.add(id);
      for (const descendantId of getDescendantIds(id, categories)) {
        allExcludedIds.add(descendantId);
      }
    }

    return flattenWithDepth(categories).filter(
      (cat) => !allExcludedIds.has(cat.id)
    );
  }, [categories, excludeIds]);

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={`w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${className}`}
      required={required}
    >
      {allowNone && <option value="">{placeholder}</option>}
      {options.map((cat) => (
        <option key={cat.id} value={cat.id}>
          {getIndentPrefix(cat.depth)}{cat.name}
        </option>
      ))}
    </select>
  );
}
