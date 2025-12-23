import type { Location } from './api';

export interface LocationNode extends Location {
  children: LocationNode[];
  depth: number;
}

export interface FlatLocationWithDepth extends Location {
  depth: number;
}

/**
 * Build a tree structure from a flat array of locations
 */
export function buildLocationTree(locations: Location[]): LocationNode[] {
  const locationMap = new Map<string, LocationNode>();
  const roots: LocationNode[] = [];

  // First pass: create nodes with empty children
  for (const loc of locations) {
    locationMap.set(loc.id, { ...loc, children: [], depth: 0 });
  }

  // Second pass: build parent-child relationships
  for (const loc of locations) {
    const node = locationMap.get(loc.id)!;
    if (loc.parent_location_id) {
      const parent = locationMap.get(loc.parent_location_id);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  // Third pass: calculate depths
  function setDepth(nodes: LocationNode[], depth: number) {
    for (const node of nodes) {
      node.depth = depth;
      setDepth(node.children, depth + 1);
    }
  }
  setDepth(roots, 0);

  // Sort children alphabetically at each level
  function sortChildren(nodes: LocationNode[]) {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) {
      sortChildren(node.children);
    }
  }
  sortChildren(roots);

  return roots;
}

/**
 * Flatten a location tree with depth information (for indented selects)
 */
export function flattenWithDepth(locations: Location[]): FlatLocationWithDepth[] {
  const tree = buildLocationTree(locations);
  const result: FlatLocationWithDepth[] = [];

  function traverse(nodes: LocationNode[]) {
    for (const node of nodes) {
      // Spread all Location properties and add depth
      const { children, ...locationProps } = node;
      result.push({
        ...locationProps,
      });
      traverse(node.children);
    }
  }

  traverse(tree);
  return result;
}

/**
 * Get all descendant IDs of a location (for exclusion in dropdowns)
 */
export function getDescendantIds(locationId: string, locations: Location[]): string[] {
  const descendants: string[] = [];
  const childMap = new Map<string, Location[]>();

  // Build parent -> children map
  for (const loc of locations) {
    if (loc.parent_location_id) {
      const children = childMap.get(loc.parent_location_id) || [];
      children.push(loc);
      childMap.set(loc.parent_location_id, children);
    }
  }

  // Recursively collect descendants
  function collect(id: string) {
    const children = childMap.get(id) || [];
    for (const child of children) {
      descendants.push(child.id);
      collect(child.id);
    }
  }

  collect(locationId);
  return descendants;
}

/**
 * Generate indent prefix for a given depth level
 */
export function getIndentPrefix(depth: number): string {
  if (depth === 0) return '';
  return '\u00A0\u00A0'.repeat(depth) + '└ ';
}
