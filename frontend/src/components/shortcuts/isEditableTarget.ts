/**
 * Returns true when a keyboard event target is an editable surface — an
 * `<input>`, `<textarea>`, `<select>`, a `contenteditable` element, or any
 * node nested inside a `contenteditable="true"` ancestor (rich-text editors).
 *
 * The shortcut dispatcher calls this before matching any single-letter key so
 * that typing (e.g. an "N" into a search box) never triggers a navigation
 * shortcut (BAR-03). This is a UX-correctness guard, not a security control.
 *
 * Pure and DOM-only: safe to call with any `EventTarget` or `null`.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable ||
    // Nested rich-text: the event may fire on a child of the editable root
    // (CONTEXT.md §specifics — cover nested contenteditable via closest).
    target.closest('[contenteditable="true"]') !== null
  );
}
