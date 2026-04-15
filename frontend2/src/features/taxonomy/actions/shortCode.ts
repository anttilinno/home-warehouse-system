import { useEffect, useState } from "react";

/**
 * Derive a human-readable short_code preview from a name.
 * Format: `PREFIX-NNN` where PREFIX is up to 3 uppercase alphanumerics
 * from the name, and NNN is a random 3-digit suffix (100-999).
 * Returns `""` when no alphanumerics are present in the input.
 *
 * NOTE: Backend enforces per-workspace uniqueness on short_code and
 * auto-generates a guaranteed-unique 8-char code when the field is
 * omitted. This 3-digit preview is only a UX suggestion — form submit
 * handlers strip short_code from the payload when the auto-link is
 * still intact, letting the backend pick a collision-free value.
 */
export function deriveShortCode(name: string): string {
  const prefix = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  if (prefix.length === 0) return "";
  const suffix = Math.floor(100 + Math.random() * 900); // 3-digit 100-999
  return `${prefix}-${suffix}`;
}

/**
 * Debounced (300ms) auto-derivation of short_code from name.
 * Returns { onManualEdit, autoLinked } — caller must invoke onManualEdit
 * when the user types directly into the short_code field to sever the
 * auto-link for the lifetime of this hook instance.
 */
export function useAutoShortCode(
  name: string,
  setShortCode: (v: string) => void,
): { onManualEdit: (v: string) => void; autoLinked: boolean } {
  const [autoLinked, setAutoLinked] = useState(true);

  useEffect(() => {
    if (!autoLinked) return;
    const handle = setTimeout(() => setShortCode(deriveShortCode(name)), 300);
    return () => clearTimeout(handle);
  }, [name, autoLinked, setShortCode]);

  const onManualEdit = (v: string) => {
    setAutoLinked(false);
    setShortCode(v);
  };

  return { onManualEdit, autoLinked };
}
