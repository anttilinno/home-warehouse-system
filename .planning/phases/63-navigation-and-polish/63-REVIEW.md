---
phase: 63-navigation-and-polish
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - frontend2/src/components/layout/Sidebar.tsx
  - frontend2/src/features/taxonomy/tabs/LocationsTab.tsx
  - frontend2/locales/en/messages.po
  - frontend2/locales/et/messages.po
  - frontend2/src/features/auth/AuthContext.tsx
findings:
  critical: 0
  warning: 2
  info: 12
  total: 14
status: issues_found
---

# Phase 63: Code Review Report

**Reviewed:** 2026-04-17
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files reviewed: the main Sidebar navigation component, the LocationsTab taxonomy component, both EN and ET locale catalogs, and the AuthContext. No critical security or data-loss issues were found. Two warnings were identified: a logic gap in LocationsTab where action controls are shown to users without a workspace, and a variable interpolation bug in two EN/ET catalog strings where `nodeName` is wrapped in literal single quotes and therefore never substituted. Twelve info items cover missing diacritics across a dozen Estonian translations (encoding artifacts) and minor code-quality observations.

---

## Warnings

### WR-01: `'{nodeName}'` literal quotes prevent variable interpolation in ArchiveDeleteFlow messages

**File:** `frontend2/locales/en/messages.po:1993` and `frontend2/locales/et/messages.po:1993`

**Issue:** Two Lingui message IDs use single-quoted `'{nodeName}'` syntax. Lingui treats `{nodeName}` as a placeholder only when it appears unquoted. With the surrounding single quotes these become literal characters, so the rendered string will display the text `'{nodeName}'` verbatim instead of substituting the entity name. The ET catalog has the same msgids and is equally affected.

Affected msgids (both locales):
- `"This permanently deletes '{nodeName}'. This action cannot be undone."` (en:1992, et:1992)
- `"This will hide '{nodeName}' from item pickers. You can restore it later."` (en:1996, et:1996)

**Fix:** Remove the single quotes from the msgids and msgstrs in both catalogs so the placeholders are unquoted — matching the pattern already used correctly in every other message in the catalogs:

```po
msgid "This permanently deletes {nodeName}. This action cannot be undone."
msgstr "This permanently deletes {nodeName}. This action cannot be undone."
```

```po
msgid "This will hide {nodeName} from item pickers. You can restore it later."
msgstr "This will hide {nodeName} from item pickers. You can restore it later."
```

(And correspondingly in `et/messages.po`: `msgstr "See kustutab {nodeName} jäädavalt. ..."` / `msgstr "See peidab {nodeName} esemete valikust. ..."`)

Note: the corresponding ET translations at lines 1993-1998 already render the variable correctly in the msgstr bodies — only the msgid needs updating to match.

---

### WR-02: "New Location" button and archived-count checkbox render when `workspaceId` is null

**File:** `frontend2/src/features/taxonomy/tabs/LocationsTab.tsx:104-115`

**Issue:** The top-bar controls (the "Show archived" checkbox and the "+ NEW LOCATION" button) are rendered unconditionally, outside any `workspaceId &&` guard. All data panels below (loading, error, empty-state, tree) are correctly gated on `workspaceId`, but the action controls are not. A user who has authenticated but has no workspace can see and click "+ NEW LOCATION", causing the EntityPanel to open and any subsequent save to fail with an API error rather than a clear "no workspace" message.

```tsx
// Lines 104-115 — rendered even when workspaceId is null
return (
  <div className="flex flex-col gap-md">
    <div className="flex items-center justify-between gap-md flex-wrap">
      <RetroCheckbox                   // always shown
        label={`${t`Show archived`} (${archivedItems.length})`}
        ...
      />
      <RetroButton variant="primary" onClick={handleNew}>  // always shown
        <Plus size={14} aria-hidden="true" />
        {t`+ NEW LOCATION`}
      </RetroButton>
    </div>
```

**Fix:** Wrap the action bar in the same `workspaceId` guard used for the data panels, or disable the button when `workspaceId` is null:

```tsx
<RetroButton
  variant="primary"
  onClick={handleNew}
  disabled={!workspaceId}
>
```

Or gate the entire top bar:

```tsx
{workspaceId && (
  <div className="flex items-center justify-between gap-md flex-wrap">
    ...
  </div>
)}
```

---

## Info

### IN-01: Estonian translation missing diacritics — "Connection failed" message

**File:** `frontend2/locales/et/messages.po:446`

**Issue:** `"Uhendus ebaonnestus. Kontrolli vorguuhendust ja proovi uuesti."` — missing Estonian diacritics. Should be `"Ühendus ebaõnnestus. Kontrolli võrguühendust ja proovi uuesti."` This appears to be a copy-paste or encoding artifact.

**Fix:** Update msgstr to: `"Ühendus ebaõnnestus. Kontrolli võrguühendust ja proovi uuesti."`

---

### IN-02: Estonian translation missing diacritics — "Full name" placeholder and label

**File:** `frontend2/locales/et/messages.po:947` and `frontend2/locales/et/messages.po:951`

**Issue:** `"Taisnimi"` and `"TAISNIMI"` — should be `"Täisnimi"` and `"TÄISNIMI"`.

**Fix:** Update both msgstrs.

---

### IN-03: Estonian translation missing diacritics — "Invalid email or password"

**File:** `frontend2/locales/et/messages.po:1009`

**Issue:** `"Vale e-post voi parool..."` — `voi` should be `või`.

**Fix:** `"Vale e-post või parool. Kontrolli oma andmeid ja proovi uuesti."`

---

### IN-04: Estonian translation missing diacritics — "LOGOUT"

**File:** `frontend2/locales/et/messages.po:1224`

**Issue:** `"LOGI VALJA"` — should be `"LOGI VÄLJA"`.

**Fix:** `msgstr "LOGI VÄLJA"`

---

### IN-05: Estonian translation missing diacritics — "No workspace found"

**File:** `frontend2/locales/et/messages.po:1396`

**Issue:** `"Toopinda ei leitud. Alustamiseks loo toopind."` — should be `"Tööpinda ei leitud. Alustamiseks loo tööpind."` (tööpind = workspace).

**Fix:** `msgstr "Tööpinda ei leitud. Alustamiseks loo tööpind."`

---

### IN-06: Estonian translation missing diacritics — "OR"

**File:** `frontend2/locales/et/messages.po:1478`

**Issue:** `"VOI"` — should be `"VÕI"`.

**Fix:** `msgstr "VÕI"`

---

### IN-07: Estonian translation missing diacritics — "Skip to main content"

**File:** `frontend2/locales/et/messages.po:1867`

**Issue:** `"Liigu pohisisu juurde"` — should be `"Liigu põhisisu juurde"`.

**Fix:** `msgstr "Liigu põhisisu juurde"`

---

### IN-08: Estonian translation missing diacritics — "Something went wrong" (two strings)

**File:** `frontend2/locales/et/messages.po:1877` and `frontend2/locales/et/messages.po:1882`

**Issue:**
- `"Midagi laks valesti. Minge tagasi avakuvale voi laadige leht uuesti."` — `läks`, `või`
- `"Midagi laks valesti. Proovi hetke parast uuesti."` — `läks`, `pärast`

**Fix:**
- `"Midagi läks valesti. Minge tagasi avakuvale või laadige leht uuesti."`
- `"Midagi läks valesti. Proovi hetke pärast uuesti."`

---

### IN-09: Estonian translation missing diacritics — "WORKSPACE SETUP"

**File:** `frontend2/locales/et/messages.po:2098`

**Issue:** `"TOOPINNA SEADISTAMINE"` — should be `"TÖÖPINNA SEADISTAMINE"`.

**Fix:** `msgstr "TÖÖPINNA SEADISTAMINE"`

---

### IN-10: Stale obsolete entries left in EN catalog (archive/delete flow old-style msgids)

**File:** `frontend2/locales/en/messages.po:633-635` and multiple `#~` blocks

**Issue:** The catalog contains several `#~` (obsolete) entries throughout both locale files — entries that were previously used but have since been replaced. While Lingui treats these as comments and they do not affect runtime, they add noise to the catalog and may confuse translators. The old-style `'{nodeName}'`-quoted variants (now marked `#~`) at lines 1531-1533, 2001-2002 are already obsoleted, which is correct.

**Fix:** Run `yarn lingui compile` / `yarn lingui extract --clean` to prune obsolete entries from the catalogs once all translation updates are finalized.

---

### IN-11: Named function expression in `useMemo` flatMap walk could be extracted

**File:** `frontend2/src/features/taxonomy/tabs/LocationsTab.tsx:67-70`

**Issue:** The tree-walk helper is defined inline as a named function expression inside a `useMemo` callback. While valid, it makes the code harder to read at a glance and the `ReturnType<typeof buildTree<Location>>` annotation is verbose.

```tsx
const editingNode = activeRoots
  .flatMap(function walk(n): ReturnType<typeof buildTree<Location>> {
    return [n, ...n.children.flatMap(walk)];
  })
  .find((n) => n.node.id === editingId);
```

**Fix:** Extract the walk helper outside the component or as a typed top-level function so it does not get re-created on every call (even though inside `useMemo` it is cheap, co-locating a named recursive function in a closure is a subtle anti-pattern).

---

### IN-12: `isAuthenticated` computed from `user` — consider documenting the invariant

**File:** `frontend2/src/features/auth/AuthContext.tsx:114`

**Issue:** `isAuthenticated: !!user` is derived at render time from `user`. This is correct and intentional, but there is no comment noting that `workspaceId` can be `null` even when `isAuthenticated` is `true` (user exists but has no workspace). Consumers like `LocationsTab` do guard on `workspaceId` separately — the implicit contract could be made explicit.

**Fix:** Add a brief JSDoc or inline comment near the `AuthContextValue` interface clarifying that `isAuthenticated === true` does not imply `workspaceId !== null`:

```ts
/**
 * workspaceId may be null even when isAuthenticated is true
 * (user has no workspaces yet — see SetupPage).
 */
workspaceId: string | null;
```

---

_Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
