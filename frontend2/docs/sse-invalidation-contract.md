# SSE Invalidation Contract (SSOT)

**Status:** Canonical for Phases 6-10.
**Code mirror:** `frontend2/src/features/sse/invalidationMap.ts`
**Established:** Phase 6 Plan 06-01 (PROV-02).

This is the single source of truth for how server-sent events map to TanStack
Query cache invalidation. The `.ts` map is the executable mirror; this doc is the
human contract. When a feature phase wires a new entity, it appends a row to
**both** this doc and `INVALIDATION_MAP`.

---

## 1. Backend wire contract (VERIFIED live 2026-06-13)

| Property | Value |
|----------|-------|
| URL (frontend) | `GET /api/workspaces/{workspace_id}/sse` |
| Auth | HttpOnly `access_token` **cookie** — `EventSource(url, { withCredentials: true })`. **NEVER** `?token=`/JWT in the URL (leaks via access logs / Referer). |
| On open | `event: connected` / `data: {"client_id":"<uuid>"}` |
| Domain frame | `event: <type>` / `data: <full event JSON>` where `<type>` = e.g. `category.created` (NAMED events — there is no `event: message`, so `onmessage` is dead code) |
| Keepalive | `: keepalive` comment every 30 s (ignored by EventSource) |
| Scoping | Backend `Broadcaster` fans events only to clients registered under that `workspace_id`. |

### Event JSON shape (`data:` payload)

```jsonc
{
  "type": "category.created",     // "<entity>.<action>" — also the event name
  "entity_id": "019ebe36-...",     // omitempty
  "entity_type": "category",       // the invalidation key (see §2)
  "workspace_id": "1021170e-...",
  "user_id": "94987c25-...",
  "timestamp": "2026-06-12T23:41:27.914Z",
  "data": { "id": "...", "name": "..." }  // omitempty, entity-shaped
}
```

---

## 2. The invalidation rule (prefix convention)

**Every workspace-scoped query MUST key as `[entityPlural, wsId, ...rest]`.**

On a domain event the dispatcher lowercases `entity_type`, looks up the prefix
list, and for each prefix fires:

```ts
queryClient.invalidateQueries({ queryKey: [...prefix, wsId] });
```

TanStack Query v5 invalidation is **prefix-matching by default** (`exact: false`),
so `["items", wsId]` also invalidates `["items", wsId, { filters }]`,
`["items", wsId, "detail", id]`, etc. Feature phases therefore only need their
query keys to START with `[entityPlural, wsId]` — trailing filter/detail segments
are covered automatically.

### ITEM uppercase normalization

One backend publish site emits `entity_type: "ITEM"` (uppercase outlier). The
dispatcher calls `entity_type.toLowerCase()` before the map lookup, so map keys
are **lowercase only** — never add an uppercase key.

### Unknown entity_type → no-op

An `entity_type` absent from the map resolves to `[]` (no invalidation). This is
forward-compatible: a new backend event type does not break the client; it simply
does nothing until a phase registers it.

---

## 3. Registered rows (current)

| `entity_type` (lowercase) | invalidates query-key prefix(es) | registered by |
|---------------------------|----------------------------------|---------------|
| `category` | `["categories"]` | Phase 6 (06-01) |
| `location` | `["locations"]` | Phase 6 (06-01) |
| `container` | `["containers"]` | Phase 6 (06-01) |
| `item` (and `ITEM` outlier) | `["items"]` | Phase 6 (06-01) |
| `inventory` | `["inventory"]` | Phase 6 (06-01) |
| `loan` | `["loans"]` | Phase 6 (06-01) |
| `borrower` | `["borrowers"]` | Phase 6 (06-01) |

> The above are the bootstrap rows so the dispatcher is exercised from day one.
> Phases 7-10 confirm their hook key shapes match `[entityPlural, wsId]` and
> append any additional entity rows (company, label, maintenance, pendingchange,
> repairlog, etc.) as those features land.

---

## 4. Procedure: adding a new entity

1. Append a row to `INVALIDATION_MAP` in
   `frontend2/src/features/sse/invalidationMap.ts` keyed by the **lowercase**
   `entity_type`, value = array of query-key-prefix arrays.
2. If the backend emits a new event NAME (`type`), add it to
   `KNOWN_EVENT_TYPES` in the same file so `SSEProvider` registers a listener.
3. Append a matching row to the table in §3 of this doc (with the phase that
   added it).
4. Ensure the feature's query hooks key as `[entityPlural, wsId, ...rest]` so the
   prefix match in §2 hits.

---

## 5. Canonical provider order (PROV-01 SSOT)

Resolved against the shipped tree (RESEARCH §1). Phase 6 **appends** `RetroToaster`
(App root) and `SSEProvider` (inside `WorkspaceProvider`); it does NOT reorder the
existing `I18n > Router > Query > Shortcuts > ModalStack` chain.

```
I18nProvider (lingui)
└─ BrowserRouter
   └─ QueryClientProvider
      ├─ RetroToaster              ← mounted at App root (survives route changes)
      └─ ShortcutsProvider
         └─ ModalStackProvider
            └─ <Routes>
               ├─ /login /register /auth/callback   (public)
               └─ RequireAuth
                  └─ AppShell
                     └─ WorkspaceProvider
                        └─ SSEProvider   ← needs wsId; authed-only
                           └─ [shell chrome + <Outlet/>]
```

Notes:
- There is **no `AuthProvider`** — auth is cookie-JWT in `api.ts` + the
  `RequireAuth` guard.
- `SSEProvider` MUST be a descendant of `WorkspaceProvider` (it reads
  `useWorkspace().currentWorkspaceId` for the stream URL and reopen-on-switch).
- `RetroToaster` mounts at the App root (NOT inside `AppShell`) so a toast fired
  from `/login` still renders.
