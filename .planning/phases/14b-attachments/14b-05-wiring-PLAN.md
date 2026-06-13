---
phase: 14b-attachments
plan: 05
type: execute
wave: 3
depends_on: ["14b-03", "14b-04"]
files_modified:
  - frontend2/src/routes/index.tsx
  - frontend2/src/features/settings/SettingsLandingPage.tsx
  - frontend2/src/features/settings/SettingsLandingPage.test.tsx
  - frontend2/src/features/items/ItemDetailPage.tsx
  - frontend2/src/features/items/ItemDetailPage.test.tsx
autonomous: true
requirements: [ATT-01, ATT-02, PPL-01, PPL-02, PPL-03]
must_haves:
  truths:
    - "A FILES tab on the item detail page mounts the item attachment panel"
    - "The item page exposes a 'link Paperless document' action"
    - "/settings/paperless renders the Paperless page"
    - "The Settings landing shows a real Paperless row (no longer COMING SOON)"
  artifacts:
    - path: "frontend2/src/routes/index.tsx"
      provides: "Lazy /settings/paperless route"
      contains: "paperless"
    - path: "frontend2/src/features/settings/SettingsLandingPage.tsx"
      provides: "Real Paperless LinkRow to /settings/paperless"
  key_links:
    - from: "ItemDetailPage tabs"
      to: "ItemAttachmentPanel + PaperlessLinkDialog"
      via: "FILES tab + link action"
      pattern: "ItemAttachmentPanel"
    - from: "routes/index.tsx settings block"
      to: "PaperlessPage"
      via: "lazy Route path=paperless"
      pattern: "PaperlessPage"
---

<objective>
Single-writer wiring plan: mount the Wave-2 exports into the shared files that
multiple plans would otherwise contend on. This is the ONLY plan that edits
routes/index.tsx, SettingsLandingPage.tsx, and ItemDetailPage.tsx for Phase 14b.

It (1) adds a lazy `/settings/paperless` route, (2) replaces the disabled
"COMING SOON" Paperless row on the Settings landing with a real link to it,
(3) adds a FILES tab to the item detail page mounting ItemAttachmentPanel
(14b-03), and (4) adds a "Link Paperless document" action on the item page that
opens PaperlessLinkDialog (14b-04).

Purpose: deliver the user-visible surfaces for ATT-01/02 + PPL-01/02/03 by
connecting the self-contained components built in Waves 1-2.
Output: edited routes + landing + item-detail page with tests.

DEPENDS ON 14b-03 (ItemAttachmentPanel) and 14b-04 (PaperlessPage,
PaperlessLinkDialog) being merged — it imports their exports.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/14b-attachments/14b-CONTEXT.md
@.planning/phases/14b-attachments/14b-VALIDATION.md
@.planning/phases/14b-attachments/14b-03-SUMMARY.md
@.planning/phases/14b-attachments/14b-04-SUMMARY.md

<interfaces>
<!-- The shared single-writer files and the exact insertion points. -->
From frontend2/src/routes/index.tsx (settings block, lines ~225-285):
  <Route path="settings" element={<SettingsLayout />}>
    <Route index element={<SettingsLandingPage />} />
    <Route path="security" .../> <Route path="accounts" .../>
    // lazy subpages wrapped in <Suspense fallback={null}> — profile/appearance/language/formats/notifications/data/members
  // ADD: const PaperlessPage = lazy(() => import("@/features/settings/PaperlessPage").then(m => ({ default: m.PaperlessPage })))
  //      <Route path="paperless" element={<Suspense fallback={null}><PaperlessPage/></Suspense>} />

From frontend2/src/features/settings/SettingsLandingPage.tsx:
  // It currently has a PaperlessRow() = a disabled aria-disabled "COMING SOON" non-link (lines 47-68).
  // REPLACE PaperlessRow usage in the WORKSPACE Window with <LinkRow to="paperless" label={<Trans>Paperless</Trans> ...}/>
  // and DELETE the now-unused PaperlessRow component (avoid an unused-symbol lint error).

From frontend2/src/features/items/ItemDetailPage.tsx:
  // tabs: RetroTab[] array (lines ~174-220): "details" / "photos" / "history".
  // ADD a "files" tab whose content is <ItemAttachmentPanel wsId={wsId} itemId={item.id} /> (props per 14b-03-SUMMARY).
  // The titlebar actions Popover (lines ~245-287) holds ARCHIVE/RESTORE/DELETE… —
  //   ADD a "Link Paperless document" menu item that opens PaperlessLinkDialog
  //   (props {wsId, itemId: item.id, open, onClose} per 14b-04-SUMMARY); manage `open` state with useState.
  // wsId/item already in scope (wsId as string, item.id).

LANDMINE FOUND-02: bun run lint:imports substring-matches sync/idb/offline — do not introduce such names.
Use `bun run lint:tsc`, not bare tsc.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Lazy /settings/paperless route + real landing row</name>
  <files>frontend2/src/routes/index.tsx, frontend2/src/features/settings/SettingsLandingPage.tsx, frontend2/src/features/settings/SettingsLandingPage.test.tsx</files>
  <action>
    routes/index.tsx: add a `PaperlessPage` lazy import (mirror the other lazy
    settings imports) and a `<Route path="paperless" element={<Suspense
    fallback={null}><PaperlessPage/></Suspense>} />` inside the settings block.
    SettingsLandingPage.tsx: in the WORKSPACE Window replace the <PaperlessRow/>
    (disabled COMING SOON) with a real <LinkRow to="paperless"
    label={<Trans>Paperless</Trans>} /> and DELETE the unused PaperlessRow
    function + any now-unused RetroBadge import if it becomes unused. Update
    SettingsLandingPage.test.tsx: replace the "COMING SOON / aria-disabled"
    assertion with one asserting a real link row to `paperless`.
  </action>
  <verify>
    <automated>cd frontend2 && bun run test -- SettingsLandingPage</automated>
  </verify>
  <done>/settings/paperless resolves to PaperlessPage; the landing shows a real Paperless link row (no COMING SOON); landing test updated + green.</done>
</task>

<task type="auto">
  <name>Task 2: FILES tab + Paperless-link action on item detail</name>
  <files>frontend2/src/features/items/ItemDetailPage.tsx, frontend2/src/features/items/ItemDetailPage.test.tsx</files>
  <action>
    Import ItemAttachmentPanel (14b-03) and PaperlessLinkDialog (14b-04). Add a
    fourth tab `{ id: "files", label: <Trans>FILES</Trans>, content:
    <ItemAttachmentPanel wsId={wsId as string} itemId={item.id} /> }` to the
    tabs array. Add a `paperlessLinkOpen` useState; add a "Link Paperless
    document" BevelButton to the titlebar actions Popover that sets it open;
    render <PaperlessLinkDialog wsId={wsId as string} itemId={item.id}
    open={paperlessLinkOpen} onClose={() => setPaperlessLinkOpen(false)} />.
    Update ItemDetailPage.test.tsx to assert the FILES tab renders the panel and
    the menu exposes the Paperless-link action (mock the child components if the
    existing test mocks heavy children — follow the file's existing mock idiom).
    Keep the photos tab + side rail untouched.
  </action>
  <verify>
    <automated>cd frontend2 && bun run test -- ItemDetailPage</automated>
  </verify>
  <done>Item detail page shows a FILES tab mounting ItemAttachmentPanel and a "Link Paperless document" action opening PaperlessLinkDialog; test green.</done>
</task>

</tasks>

<verification>
- `cd frontend2 && bun run lint:tsc` green.
- `cd frontend2 && bun run test` green.
- `cd frontend2 && bun run build` green.
- `cd frontend2 && bun run lint:imports` green.
- Live E2E (backend rebuilt/restarted after 14b-02): on an item, the FILES tab
  uploads + lists + deletes an attachment and downloads it back; the menu links a
  Paperless document which then appears in the FILES list; /settings/paperless
  renders, saves, searches.
</verification>

<success_criteria>
All Phase-14b user surfaces are wired: FILES tab (ATT-01/02), Paperless settings
route + landing row (PPL-01/02), and the item-page Paperless link action (PPL-03).
No shared file is edited by more than this plan.
</success_criteria>

<output>
Create `.planning/phases/14b-attachments/14b-05-SUMMARY.md` when done.
</output>
