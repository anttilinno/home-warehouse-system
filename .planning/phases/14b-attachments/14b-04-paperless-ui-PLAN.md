---
phase: 14b-attachments
plan: 04
type: execute
wave: 2
depends_on: ["14b-02"]
files_modified:
  - frontend2/src/lib/api/paperless.ts
  - frontend2/src/features/settings/PaperlessPage.tsx
  - frontend2/src/features/settings/PaperlessPage.test.tsx
  - frontend2/src/features/settings/hooks/usePaperlessSettings.ts
  - frontend2/src/features/items/components/PaperlessLinkDialog.tsx
  - frontend2/src/features/items/components/PaperlessLinkDialog.test.tsx
autonomous: true
requirements: [PPL-01, PPL-02, PPL-03]
must_haves:
  truths:
    - "User can view/save/delete Paperless connection settings from a Settings page"
    - "User can search Paperless documents from within the app"
    - "User can link a found Paperless document to an item (it appears in the item's attachment list)"
  artifacts:
    - path: "frontend2/src/lib/api/paperless.ts"
      provides: "Paperless API client (settings get/put/delete + search + resolve)"
      contains: "/paperless/"
    - path: "frontend2/src/features/settings/PaperlessPage.tsx"
      provides: "PPL-01 settings page + PPL-02 document search"
    - path: "frontend2/src/features/items/components/PaperlessLinkDialog.tsx"
      provides: "PPL-03 link-a-document-to-item (creates an attachment)"
  key_links:
    - from: "PaperlessLinkDialog"
      to: "POST /items/{itemId}/attachments"
      via: "create attachment with external_doc_id + dms_type=paperless"
      pattern: "external_doc_id"
    - from: "PaperlessPage"
      to: "GET/PUT/DELETE /paperless/settings + GET /paperless/search"
      via: "usePaperlessSettings + search query"
      pattern: "/paperless/settings"
---

<objective>
Build the GREENFIELD Paperless-ngx UI. The backend already exists (settings
GET/PUT/DELETE, search, document resolve). This plan adds: a Settings-hub
PaperlessPage (PPL-01 connection settings + PPL-02 document search) and a
PaperlessLinkDialog (PPL-03) that links a found document to an item by creating
an attachment with `external_doc_id` + `dms_type="paperless"` (the existing
create-attachment endpoint — NO new backend route).

Purpose: PPL-01/02/03. Output: paperless api client + settings hook + settings
page (with embedded search) + link dialog + types.

This plan does NOT register the route or the Settings-landing row, and does NOT
mount the link dialog on the item page — those single-writer edits are in plan
14b-05. PaperlessPage and PaperlessLinkDialog are exported self-contained for
14b-05 to wire.

Paperless backend is already live, so this plan has NO hard dependency on 14b-02;
it can run in parallel with 14b-03 (disjoint files).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/14b-attachments/14b-CONTEXT.md
@.planning/phases/14b-attachments/14b-VALIDATION.md

<interfaces>
<!-- Backend contracts VERIFIED in backend/internal/domain/paperless/handler.go -->
GET    /api/workspaces/{ws}/paperless/settings  → 200 always
  SettingsResponse { configured: bool, base_url?, is_enabled, sync_tags_enabled, has_token, last_sync_at?, updated_at? }
  // when configured=false the workspace has no row yet (NOT an error)
PUT    /api/workspaces/{ws}/paperless/settings
  body { base_url: string(1..500), api_token?: string  /* OMIT to keep stored token — write-only, never returned */, is_enabled: bool, sync_tags_enabled: bool }
  → 200 SettingsResponse  (400 invalid url / token required; 503 encryption key missing)
DELETE /api/workspaces/{ws}/paperless/settings → 204
GET    /api/workspaces/{ws}/paperless/search?query=&page=&page_size=
  → { count: number, results: DocumentResponse[] }
  DocumentResponse { id: number, title: string, created?: string, original_file_name?: string }
  // 409 not-configured/not-enabled; 502 bad token/instance unavailable; 400 empty query
GET    /api/workspaces/{ws}/paperless/documents/{id}
  → DocumentDetailsResponse { id, title, created?, original_file_name?, download_url, preview_url, web_url }

PPL-03 link (rides the EXISTING create-attachment endpoint):
POST   /api/workspaces/{ws}/items/{itemId}/attachments
  body { attachment_type: AttachmentType, title?, external_doc_id: string, file_id?: null, is_primary: false }
  // NOTE: backend external_doc_id is *string; Paperless doc ids are NUMBERS — STRINGIFY the id.
  // dms_type is derived server-side from external_doc_id (no need to send it; confirm in 10b create flow).

From frontend2/src/lib/api.ts: get<T>, put<T>, post<T>, del<T>, HttpError(.status)
From frontend2/src/features/settings/NotificationsPage.tsx: the settings-page shape to mirror —
  useQuery(settingsApi...) + useMutation save + Window + BevelButton + retroToast; Lingui <Trans>.
From frontend2/src/lib/types.ts: AttachmentType union (READ-ONLY reuse — do NOT edit this shared barrel; 14b-03 runs in the same wave). DEFINE PaperlessSettings + PaperlessDocument types LOCALLY in lib/api/paperless.ts (precedent: lib/api/repairs.ts exports its own types).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Paperless types + api client</name>
  <files>frontend2/src/lib/api/paperless.ts</files>
  <action>
    In api/paperless.ts EXPORT `PaperlessSettings` (configured, base_url?,
    is_enabled, sync_tags_enabled, has_token, last_sync_at?, updated_at?) and
    `PaperlessDocument` (id: number, title, created?, original_file_name?) +
    `PaperlessDocumentDetails` (adds download_url, preview_url, web_url) — define
    these LOCALLY here, NOT in the shared lib/types.ts (14b-03 runs in the same
    wave). Then add `paperlessApi`:
      getSettings(ws) → get<PaperlessSettings>(/paperless/settings)
      saveSettings(ws, body) → put<PaperlessSettings>(/paperless/settings, body)
      deleteSettings(ws) → del<void>(/paperless/settings)
      search(ws, query, page?, page_size?) → get<{count, results: PaperlessDocument[]}>(/paperless/search?query=...)
      resolve(ws, id) → get<PaperlessDocumentDetails>(/paperless/documents/{id})
    Use the `/api/workspaces/{ws}` prefix convention. URL-encode the query param.
    LANDMINE FOUND-02: no sync/idb/offline substrings — `sync_tags_enabled` is a
    BACKEND field name, fine inside an object literal/type, but do NOT create a
    file or directory whose NAME contains those substrings.
  </action>
  <verify>
    <automated>cd frontend2 && bun run lint:tsc</automated>
  </verify>
  <done>paperlessApi compiles with settings CRUD + search + resolve; Paperless types exported from lib/api/paperless.ts (NOT lib/types.ts).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: usePaperlessSettings hook + PaperlessPage (PPL-01 + PPL-02)</name>
  <files>frontend2/src/features/settings/hooks/usePaperlessSettings.ts, frontend2/src/features/settings/PaperlessPage.tsx, frontend2/src/features/settings/PaperlessPage.test.tsx</files>
  <behavior>
    - Settings query keyed ["paperless", wsId, "settings"]; save mutation
      (PUT) + delete mutation, both invalidate the key; errors toast.
    - PaperlessPage: a CONNECTION Window with base_url + api_token (write-only;
      placeholder shows "stored" when has_token, blank input keeps it) +
      is_enabled toggle + SAVE + a DISCONNECT (delete) action. A SEARCH Window
      (PPL-02): a query input + results list (title + created); search disabled
      until configured+enabled; a 409/502 surfaces a "configure/enable Paperless
      first" or "Paperless unreachable" message.
    - Page test: renders an unconfigured state, asserts SAVE calls PUT; renders a
      configured state, asserts search renders results from a mocked search.
  </behavior>
  <action>
    Mirror NotificationsPage.tsx settings-page shape (useQuery + useMutation +
    Window + BevelButton + retroToast + Lingui). Get wsId the same way the other
    settings pages do (grep MembersPage/NotificationsPage for the workspace-id
    source — likely a useActiveWorkspace/route param). The search section can
    live in the same page (a second Window) for PPL-02. Empty/loading/error
    states required. Keep PaperlessPage a default-or-named export ready for the
    14b-05 lazy route.
  </action>
  <verify>
    <automated>cd frontend2 && bun run test -- PaperlessPage</automated>
  </verify>
  <done>PaperlessPage gets/saves/deletes settings and searches documents; tests green; PPL-01 + PPL-02 covered.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: PaperlessLinkDialog (PPL-03)</name>
  <files>frontend2/src/features/items/components/PaperlessLinkDialog.tsx, frontend2/src/features/items/components/PaperlessLinkDialog.test.tsx</files>
  <behavior>
    - Dialog props {wsId, itemId, open, onClose}. Has a Paperless document search
      input → results list; selecting a result + LINK creates an attachment via
      POST /items/{itemId}/attachments with { attachment_type: "OTHER",
      title: <doc title>, external_doc_id: String(doc.id) }.
    - On success: toast + close; the item's attachment list invalidates so the
      linked doc appears (invalidate ["items", wsId, itemId, "attachments"] —
      the same key the 14b-03 hook owns).
    - On 409/502 (paperless not configured / unreachable) a contextual toast.
    - Test: mocks search → results; selecting + LINK posts the create-attachment
      with external_doc_id = String(id); asserts the attachment list key invalidates.
  </behavior>
  <action>
    Build a RetroDialog with an embedded search (reuse paperlessApi.search) and a
    LINK action that posts the create-attachment body above (STRINGIFY the numeric
    doc id into external_doc_id). Invalidate the item-attachment query key so the
    linked doc shows up in the 14b-03 panel. Import the create-attachment call
    from the item-attachment api (api/attachments.ts from 14b-03) IF it ships a
    create(...) helper; otherwise call post<...>(/items/{itemId}/attachments,...)
    directly here to avoid a cross-plan import race (api/attachments.ts is owned
    by 14b-03 in the same wave — to keep these two plans DISJOINT, this plan
    calls post() directly rather than importing 14b-03's module). Lingui copy.
    LANDMINE FOUND-02: no sync/idb/offline substrings in new names.
  </action>
  <verify>
    <automated>cd frontend2 && bun run test -- PaperlessLinkDialog</automated>
  </verify>
  <done>Linking a Paperless document creates an attachment with external_doc_id (stringified) and invalidates the item attachment list; test green; PPL-03 covered.</done>
</task>

</tasks>

<verification>
- `cd frontend2 && bun run lint:tsc` green.
- `cd frontend2 && bun run test` green.
- `cd frontend2 && bun run build` green.
- `cd frontend2 && bun run lint:imports` green (no sync/idb/offline substrings in any new file/dir name).
- Live (after 14b-05 wires the route + landing row): /settings/paperless renders, save/delete settings, search documents; link dialog (once mounted) links a doc to an item.
</verification>

<success_criteria>
PPL-01/02/03 frontend satisfied: a Settings-hub PaperlessPage manages connection settings and searches documents; PaperlessLinkDialog links a document to an item by creating an attachment with external_doc_id+dms_type=paperless. Both exported self-contained for the 14b-05 mount.
</success_criteria>

<output>
Create `.planning/phases/14b-attachments/14b-04-SUMMARY.md` when done. Record PaperlessPage + PaperlessLinkDialog import paths/props so 14b-05 can wire them.
</output>
