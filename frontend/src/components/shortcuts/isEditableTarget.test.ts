import { afterEach, describe, expect, it } from "vitest";
import { isEditableTarget } from "./isEditableTarget";

/**
 * BAR-03 headline regression suite — the four editable surfaces plus nested
 * contenteditable plus the negative cases. Single-letter shortcuts must NEVER
 * fire while focus is in any of these. This suite ships in the FIRST
 * keydown-wiring commit of the phase (Success Criterion 3 / Wave 0).
 */
describe("isEditableTarget", () => {
  // Mount real nodes so `instanceof HTMLElement`, `isContentEditable`, and
  // `closest()` all exercise the real DOM, not a synthetic stub.
  const mounted: HTMLElement[] = [];
  const mount = <T extends HTMLElement>(el: T): T => {
    document.body.appendChild(el);
    mounted.push(el);
    return el;
  };

  afterEach(() => {
    while (mounted.length) mounted.pop()!.remove();
  });

  it("returns true for an <input> target", () => {
    expect(isEditableTarget(mount(document.createElement("input")))).toBe(true);
  });

  it("returns true for a <textarea> target", () => {
    expect(isEditableTarget(mount(document.createElement("textarea")))).toBe(
      true,
    );
  });

  it("returns true for a <select> target", () => {
    expect(isEditableTarget(mount(document.createElement("select")))).toBe(
      true,
    );
  });

  it('returns true for an element with contenteditable="true"', () => {
    const el = document.createElement("div");
    el.setAttribute("contenteditable", "true");
    expect(isEditableTarget(mount(el))).toBe(true);
  });

  it("returns true for a child node inside a contenteditable ancestor (via closest)", () => {
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    const child = document.createElement("span");
    child.textContent = "nested rich text";
    editor.appendChild(child);
    mount(editor);
    expect(isEditableTarget(child)).toBe(true);
  });

  it("returns false for a plain <div>", () => {
    expect(isEditableTarget(mount(document.createElement("div")))).toBe(false);
  });

  it("returns false for document.body", () => {
    expect(isEditableTarget(document.body)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isEditableTarget(null)).toBe(false);
  });
});
