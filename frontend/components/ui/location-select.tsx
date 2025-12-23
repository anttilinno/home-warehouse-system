'use client';

import { useMemo } from 'react';
import type { Location } from '@/lib/api';
import { flattenWithDepth, getDescendantIds, getIndentPrefix } from '@/lib/location-utils';

interface LocationSelectProps {
  locations: Location[];
  value: string | null;
  onChange: (value: string | null) => void;
  excludeIds?: string[];
  placeholder?: string;
  allowNone?: boolean;
  className?: string;
  required?: boolean;
}

export function LocationSelect({
  locations,
  value,
  onChange,
  excludeIds = [],
  placeholder = 'Select location...',
  allowNone = true,
  className = '',
  required = false,
}: LocationSelectProps) {
  // Flatten locations with depth and filter out excluded IDs and their descendants
  const options = useMemo(() => {
    // Get all IDs to exclude (including descendants of excluded items)
    const allExcludedIds = new Set<string>();
    for (const id of excludeIds) {
      allExcludedIds.add(id);
      for (const descendantId of getDescendantIds(id, locations)) {
        allExcludedIds.add(descendantId);
      }
    }

    return flattenWithDepth(locations).filter(
      (loc) => !allExcludedIds.has(loc.id)
    );
  }, [locations, excludeIds]);

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={`w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${className}`}
      required={required}
    >
      {allowNone && <option value="">{placeholder}</option>}
      {options.map((loc) => (
        <option key={loc.id} value={loc.id}>
          {getIndentPrefix(loc.depth)}{loc.name}
        </option>
      ))}
    </select>
  );
}
