---
phase: quick-260607-uzt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/internal/domain/shortlink/handler.go
  - backend/internal/domain/shortlink/handler_test.go
  - backend/internal/infra/postgres/shortlink_repository.go
  - backend/internal/api/router.go
  - docker/angie/angie.conf
  - frontend/app/[locale]/(dashboard)/dashboard/claim/[code]/page.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Scanning s.go/{code} for an entity the user owns lands on that entity's dashboard page"
    - "Scanning a code with no match lands on a claim wizard with the short_code prefilled"
    - "Scanning a code matched in >1 of the user's workspaces lands on the claim/disambiguation picker"
    - "An unauthenticated scan redirects to login with a next param that resumes the redirect"
  artifacts:
    - path: "backend/internal/domain/shortlink/handler.go"
      provides: "GET /r/{code} chi handler: cookie auth, workspace scoping, UNION lookup, 302 routing"
    - path: "backend/internal/infra/postgres/shortlink_repository.go"
      provides: "UNION query items->containers->locations WHERE short_code=$1 AND workspace_id = ANY($2)"
    - path: "docker/angie/angie.conf"
      provides: "server_name s.go block rewriting /{code} -> backend /r/{code}"
    - path: "frontend/app/[locale]/(dashboard)/dashboard/claim/[code]/page.tsx"
      provides: "Claim wizard: Item/Location/Container create with short_code prefilled + multi-match picker"
  key_links:
    - from: "docker/angie/angie.conf (s.go server)"
      to: "backend /r/{code}"
      via: "rewrite + proxy_pass http://backend"
      pattern: "rewrite.*\\/r\\/"
    - from: "backend/internal/api/router.go"
      to: "shortlink.Handler.Redirect"
      via: "r.Get(\"/r/{code}\", ...) registered OUTSIDE the protected/workspace groups"
      pattern: "/r/\\{code\\}"
---

<objective>
Build the `s.go/<hash>` QR shortlink redirect feature end-to-end: a public Go
backend handler `GET /r/{code}` that authenticates via the `access_token`
cookie, scopes lookup to all of the authed user's workspaces, resolves the
short_code across items/containers/locations, and 302-redirects to the matching
dashboard page (or a claim wizard when there is no match / more than one match);
an Angie `s.go` virtual host that rewrites `s.go/{code}` -> backend `/r/{code}`;
and a Next.js claim wizard page that offers Item/Location/Container creation
with the short_code prefilled, plus a disambiguation picker when multiple
workspaces matched.

Purpose: Printed QR labels already encode `s.go/<short_code>`; today nothing
resolves them. This makes one scannable label scheme land on the entity or let
the user claim an unassigned hash.

Output: One backend handler + repository + route registration + Go test, one
Angie server block, one Next.js claim page.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# LOCKED design decisions — do NOT revisit
@/home/antti/.claude/projects/-home-antti-Repos-Misc-home-warehouse-system/memory/project_shortlink_resolver_design.md

# Existing spec — NOTE: it wrongly assumes Litestar/Python + Traefik.
# Real backend is Go; real proxy is Angie. Use it only for the redirect-mapping table.
@docs/QR-URL-SHORTENING.md

# Route registration patterns — note the public vs protected vs workspace-scoped groups
@backend/internal/api/router.go

<interfaces>
<!-- Extracted from the codebase. Executor should use these directly. -->

Short code format (backend/cmd/seed/main.go:997 generateShortCode):
  - VARCHAR(8) NOT NULL, UNIQUE per (workspace_id, short_code) on items/containers/locations.
  - Seeded alphabet "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6 chars. NOT hex — codes are
    case-sensitive alphanumeric. Do not lowercase. Treat the path segment verbatim.
  - DB columns confirmed: warehouse.items.short_code, warehouse.containers.short_code,
    warehouse.locations.short_code (001_initial_schema.sql:390/417/492).

JWT cookie auth (backend/internal/api/middleware/auth.go + backend/internal/shared/jwt):
  - Cookie name constant: "access_token" (HttpOnly, Path "/").
  - jwt.Service.ValidateToken(tokenString) (*jwt.Service is created in router.go as
    jwtService := jwt.NewService(cfg.JWTSecret, cfg.JWTExpirationHours)).
  - Returns (*jwt.Claims, error); jwt.Claims has UserID uuid.UUID. err == jwt.ErrExpiredToken
    or other -> treat as unauthenticated.
  - DO NOT mount this handler behind appMiddleware.JWTAuth — that middleware returns a JSON
    401 instead of a browser-friendly login redirect. Read+validate the cookie inline.

Workspace membership lookup (already exists, USE IT — do not invent):
  - workspace.Service.GetUserWorkspaces(ctx, userID uuid.UUID) ([]*WorkspaceWithRole, error)
    (backend/internal/domain/auth/workspace/service.go:114) backed by
    WorkspaceRepository.FindByUserID (workspace_repository.go:102).
  - WorkspaceWithRole embeds/exposes the workspace ID — confirm the field at build time and
    collect the []uuid.UUID to pass as ANY($2).

Chi redirect handler pattern (backend/internal/domain/auth/oauth/handler.go):
  - func (h *Handler) Initiate(w http.ResponseWriter, r *http.Request) { provider := chi.URLParam(r, "provider"); ... http.Redirect(w, r, authURL, http.StatusTemporaryRedirect) }
  - Mirror this signature/style. Use http.StatusFound (302) per the design doc.

Next.js items/new prefill (frontend/app/[locale]/(dashboard)/dashboard/items/new/page.tsx):
  - "use client" page; uses next/navigation useRouter + next-intl useTranslations.
  - Renders <CreateItemWizard /> from @/components/items/create-item-wizard.
  - There is NO /new route for locations or containers — their create is triggered
    on the list page (frontend/.../locations/page.tsx and containers/page.tsx),
    almost certainly via a modal/dialog. The executor MUST verify this at build time
    (see Task 3 action) before choosing claim-page button targets.

Confirmed real dashboard routes (exist today):
  - items/[id] (detail), items/new, items/quick-capture
  - containers/page.tsx (LIST only — no [id]), locations/page.tsx (LIST only — no [id])

Angie reverse proxy (docker/angie/angie.conf):
  - upstream backend { server backend:8080; } upstream frontend { server frontend:3000; }
  - Two server blocks today (:80 and :443 ssl), server_name _. Per-path location blocks
    proxy_pass to backend or frontend. include /etc/angie/proxy_params.conf in each server.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Backend GET /r/{code} redirect handler + repository + route + Go test</name>
  <files>backend/internal/domain/shortlink/handler.go, backend/internal/domain/shortlink/handler_test.go, backend/internal/infra/postgres/shortlink_repository.go, backend/internal/api/router.go</files>
  <behavior>
    Resolve(code, workspaceIDs) repository contract (UNION, item-first priority):
    - Test: 1 item match in an owned workspace -> returns {Type:"item", ID} ; 0 others.
    - Test: 0 matches -> returns empty result (no error / sentinel not-found).
    - Test: same code present as a container in workspace A AND a location in workspace B
      (both owned) -> returns BOTH matches so the handler can disambiguate.
    - Test: item-first priority — when an item AND a container in the SAME owned workspace
      share a code, item wins for the single-match redirect.
    Redirect handler behavior (per locked design):
    - Missing/invalid/expired access_token cookie -> 302 to
      /{locale}/login?next=/r/{code} (URL-encode the next value).
    - Authed, 1 match: item -> 302 /{locale}/dashboard/items/{id};
      container -> 302 /{locale}/dashboard/containers?focus={id};
      location -> 302 /{locale}/dashboard/locations?focus={id}.
    - Authed, 0 matches -> 302 /{locale}/dashboard/claim/{code}.
    - Authed, >1 match -> 302 /{locale}/dashboard/claim/{code}?matches={encoded list}.
    - Locale resolution: NEXT_LOCALE cookie -> Accept-Language header (first tag) -> "en".
  </behavior>
  <action>
    Create package backend/internal/domain/shortlink. Add a repository method
    (in backend/internal/infra/postgres/shortlink_repository.go, following the existing
    postgres repo style: NewShortlinkRepository(pool *pgxpool.Pool), pgx) that runs a single
    UNION ALL query across warehouse.items, warehouse.containers, warehouse.locations,
    SELECTing a literal type tag + id, WHERE short_code = $1 AND workspace_id = ANY($2),
    ordered so item rows sort first. $2 is a []uuid.UUID passed via pgx — confirm the
    pgx array-binding idiom already used elsewhere in postgres/*.go (grep "= ANY(").

    Build shortlink.Handler.Redirect(w http.ResponseWriter, r *http.Request) mirroring the
    oauth.Handler.Initiate chi style. Read the access_token cookie INLINE (do NOT use
    appMiddleware.JWTAuth — it 401s as JSON; this route must redirect a browser to login).
    Validate via jwtService.ValidateToken; on missing/invalid/expired, 302 to the login
    path with an encoded next. On success, take claims.UserID, call
    workspaceSvc.GetUserWorkspaces(ctx, userID), collect the workspace IDs, call the repo,
    and branch into the redirect mapping above. Implement a small locale resolver helper
    (NEXT_LOCALE cookie -> Accept-Language -> "en"). Use http.StatusFound for all redirects.
    Implement decisions per the LOCKED memory file project_shortlink_resolver_design.md.

    Register the route in backend/internal/api/router.go. CRITICAL: register
    r.Get("/r/{code}", shortlinkHandler.Redirect) at the TOP-LEVEL chi router (next to the
    public /auth/oauth/{provider} Get), NOT inside the r.Group JWTAuth block and NOT inside
    the r.Route("/workspaces/{workspace_id}") block — it must stay off the /api workspace
    tree (locked decision). Wire dependencies from already-constructed router objects:
    reuse jwtService, workspaceSvc, and pool (construct NewShortlinkRepository(pool)).

    Write backend/internal/domain/shortlink/handler_test.go covering the <behavior> cases.
    Follow the existing handler-test conventions in backend/internal/domain/auth/oauth or
    item: a fake/mock workspace service + a fake repository (interface in the shortlink
    package so the handler depends on an interface, not the concrete postgres repo) + a real
    jwt.Service for token signing. Assert on rec.Code == 302 and the Location header value
    for each branch (login-redirect, item, container, location, not-found, multi-match).
    The repository SQL itself is exercised by the existing testdb integration harness only if
    trivial to add under //go:build integration; if not trivial within budget, cover the
    handler branches with the fake repo and leave the SQL to manual verification (note it in
    the summary). Do NOT introduce parallel test plumbing.
  </action>
  <verify>
    <automated>cd backend && go build ./... && go test ./internal/domain/shortlink/... -count=1</automated>
  </verify>
  <done>Package builds; handler test passes covering login-redirect, item/container/location single-match Location values, not-found, and multi-match branches; route registered at top level off the workspace tree.</done>
</task>

<task type="auto">
  <name>Task 2: Angie s.go virtual host rewriting /{code} -> backend /r/{code}</name>
  <files>docker/angie/angie.conf</files>
  <action>
    Add a dedicated server block (in BOTH the :80 and :443 ssl contexts, or a single new
    server keyed on server_name s.go; — match the file's existing two-server structure and
    keep TLS working for the https case) with `server_name s.go;`. In it, include
    /etc/angie/proxy_params.conf and a single location `/` that rewrites the leading-slash
    code path to the backend redirect route and proxies to the backend upstream, e.g.:
    `location / { rewrite ^/(.+)$ /r/$1 break; proxy_pass http://backend; }`. Reuse the
    existing `upstream backend { server backend:8080; }`. Do NOT touch the existing
    server_name _ blocks (the main app + API live there). The s.go block must NOT proxy
    /api or /workspaces — only the bare-code rewrite. Add a short comment noting the
    backend handler is at /r/{code} and that DNS for s.go is out of scope (see
    docs/QR-URL-SHORTENING.md DNS section).
  </action>
  <verify>
    <automated>grep -A6 'server_name s.go' docker/angie/angie.conf | grep -E 'rewrite.*\/r\/|proxy_pass http://backend'</automated>
  </verify>
  <done>angie.conf has an s.go server block that rewrites /{code} to /r/{code} and proxies to the backend upstream; existing server_name _ blocks untouched.</done>
</task>

<task type="auto">
  <name>Task 3: Next.js claim wizard page (prefilled create + multi-match picker)</name>
  <files>frontend/app/[locale]/(dashboard)/dashboard/claim/[code]/page.tsx</files>
  <action>
    FIRST verify at build time how Location and Container creation is actually triggered
    in the live Next.js app — open frontend/app/[locale]/(dashboard)/dashboard/locations/page.tsx
    and .../containers/page.tsx and trace the "create/add" affordance. There is NO /new
    route for these (confirmed), so they use a modal/dialog or a query-param-driven open
    state on the list page. Determine the exact mechanism (e.g. a `?create=1` / `?new=true`
    search param the list page reads to auto-open the dialog, or a shared create-dialog
    component) and set the claim-page prefill targets accordingly — DO NOT assume a /new
    route exists for locations/containers. For Items, target the confirmed
    /{locale}/dashboard/items/new route with the short_code passed as a prefill query param
    (verify the exact param name CreateItemWizard / items/new reads; if items/new does not
    yet read a short_code/barcode param, pass it on the URL anyway and note the wiring gap
    in the summary rather than editing the wizard).

    Build the page at app/[locale]/(dashboard)/dashboard/claim/[code]/page.tsx as a
    "use client" component matching the existing dashboard page conventions (next-intl
    useTranslations, next/navigation, the project's UI button/card components). It receives
    `code` from params and an optional `matches` search param.
    - Default (no matches): render a claim wizard offering three create actions — Item,
      Location, Container — each navigating to the create surface determined above with the
      short_code (= code) prefilled. Show the code prominently.
    - When `matches` is present (multi-workspace disambiguation): render a picker listing
      each match (type + workspace + entity) linking to that entity's dashboard target
      (item -> items/{id}, container -> containers?focus={id}, location -> locations?focus={id}),
      mirroring the backend redirect mapping. Decode the `matches` param using the same
      encoding the backend emits in Task 1 (keep the two in sync — pick a simple,
      URL-safe shape such as comma-joined `type:id` triples or a base64url JSON blob and
      use it on both sides).
    Add minimal copy via next-intl (reuse an existing namespace or add a small one);
    do not block on full i18n catalog fills — English strings are sufficient for this quick task.
  </action>
  <verify>
    <automated>cd frontend && test -f "app/[locale]/(dashboard)/dashboard/claim/[code]/page.tsx" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "claim/\[code\]" ; echo "exit=$?"</automated>
  </verify>
  <done>Claim page file exists, typechecks (no errors referencing the claim page), renders three prefilled create actions in default mode and a match picker when ?matches is set, with create-target URLs derived from the actually-verified locations/containers create mechanism (not assumed /new routes).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser scan -> Angie -> /r/{code} | untrusted URL path segment ({code}) crosses here |
| /r/{code} handler -> Postgres | code used in parameterized query; workspace scope from validated JWT |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-uzt-01 | Spoofing | /r/{code} auth | mitigate | Validate access_token via jwt.Service.ValidateToken; unauth -> login redirect (no anonymous resolution) |
| T-uzt-02 | Information Disclosure | cross-tenant short_code leak | mitigate | Lookup scoped WHERE short_code=$1 AND workspace_id = ANY($2); $2 = only the authed user's workspaces via GetUserWorkspaces |
| T-uzt-03 | Injection | {code} path segment | mitigate | Parameterized pgx query ($1); never string-concatenated into SQL |
| T-uzt-04 | Tampering | open-redirect via next/Location | mitigate | next is a fixed internal /r/{code} path built server-side (not echoed from client); entity Location values built from DB ids + fixed templates |
| T-uzt-SC | Tampering | npm/pip/cargo installs | accept | No new package installs in this plan (handler uses stdlib + existing jwt/pgx; claim page uses existing UI deps) |
</threat_model>

<verification>
- `cd backend && go build ./... && go test ./internal/domain/shortlink/...` passes.
- `grep` confirms angie.conf s.go block rewrites to /r/ and proxies to backend.
- Claim page file exists and frontend typecheck reports no errors for the claim page.
- Manual (note in summary): with the dev stack up and DNS/hosts pointing s.go at the
  proxy, scanning/visiting s.go/{ownedItemCode} 302s to the item detail page; an unknown
  code lands on the claim wizard; an unauth request redirects to login with next.
</verification>

<success_criteria>
- Backend `GET /r/{code}` resolves authed-user-scoped short codes and 302-redirects to the
  correct dashboard target (item / container?focus / location?focus), claim page on
  not-found, claim picker on multi-match, and login on unauth — all branches test-covered.
- Route is registered off the /api workspace tree at the top-level chi router.
- Angie has an s.go server block rewriting /{code} -> /r/{code} -> backend upstream.
- Claim wizard page offers prefilled Item/Location/Container create using the
  build-time-verified create mechanism, plus a multi-match picker.
</success_criteria>

<output>
Create `.planning/quick/260607-uzt-build-s-go-hash-qr-shortlink-redirect-ba/260607-uzt-SUMMARY.md` when done.
</output>
