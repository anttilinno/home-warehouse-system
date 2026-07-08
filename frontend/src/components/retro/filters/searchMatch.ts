// Client-side search matching for list pages whose backend has no search param
// (loans, borrowers, inventory). Mirrors the Items server contract: the live
// query and every committed term AND together — a row matches only when EACH
// fragment is found. Substring here vs plainto_tsquery lexemes on the server,
// but the same "all fragments must match" semantics.

/** Split the live query + committed terms into lowercased, non-empty fragments. */
export function searchFragments(q: string, terms: string[]): string[] {
  return [q, ...terms]
    .map((f) => f.trim().toLowerCase())
    .filter((f) => f !== "");
}

/**
 * True when EVERY fragment is a substring of the combined haystack. Empty
 * fragments (no search) match everything.
 */
export function matchesFragments(
  haystacks: Array<string | null | undefined>,
  fragments: string[],
): boolean {
  if (fragments.length === 0) return true;
  const hay = haystacks.filter(Boolean).join(" ").toLowerCase();
  return fragments.every((f) => hay.includes(f));
}
