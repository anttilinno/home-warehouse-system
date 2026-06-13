---
phase: 13b-analytics
plan: 05
type: execute
wave: 2
depends_on: [13b-01, 13b-02, 13b-03, 13b-04]
files_modified:
  - frontend2/src/routes/index.tsx
  - frontend2/vite.config.ts
  - frontend2/src/components/layout/Sidebar.tsx
otmf_note: "Wave 2. This is the WIRING plan — it owns the SINGLE-WRITER trio: routes/index.tsx (React.lazy /analytics route + Suspense), vite.config.ts (the `charts` manualChunk branch), and components/layout/Sidebar.tsx (the disabled Analytics NavItem gets `to=/analytics`). Each of these three files is touched by EXACTLY ONE plan in Phase 13b — this one — so routes/index.tsx has a single writer (the orchestrator's mandate). DISJOINT from its Wave-2 sibling 13b-04, which owns ONLY features/analytics/AnalyticsPage.tsx (no overlap with the trio). Depends on 13b-04 (the AnalyticsPage export must exist for the React.lazy import to tsc-check) and 13b-02 (recharts must be installed for the `charts` manualChunk to have anything to isolate + for the build gate to assert against)."
autonomous: true
requirements: [ANL-03]
must_haves:
  truths:
    - "/analytics is a React.lazy route under the authenticated AppShell, mirroring the /scan lazy+Suspense idiom"
    - "vite's manualChunks function returns \"charts\" for recharts (+ its d3 deps) so the chart vendor is isolated like the scanner chunk"
    - "the disabled Analytics NavItem in the Sidebar now navigates to /analytics"
    - "after `bun run build`, the MAIN/vendor chunk gzip carries ZERO charting bytes — recharts lives ONLY in the charts chunk (and the lazy analytics page chunk); non-analytics routes are unaffected"
  artifacts:
    - path: frontend2/src/routes/index.tsx
      provides: "lazy AnalyticsPage const + <Route path=analytics> in a Suspense boundary under the AppShell layout route"
      contains: "AnalyticsPage"
    - path: frontend2/vite.config.ts
      provides: "manualChunks: recharts/d3 → \"charts\" branch alongside the existing scanner branch"
      contains: "charts"
    - path: frontend2/src/components/layout/Sidebar.tsx
      provides: "Analytics NavItem wired `to=/analytics` (no longer disabled)"
      contains: "to=\"/analytics\""
  key_links:
    - from: frontend2/src/routes/index.tsx
      to: frontend2/src/features/analytics/AnalyticsPage.tsx
      via: "const AnalyticsPage = lazy(() => import(\"@/features/analytics/AnalyticsPage\").then(m => ({default: m.AnalyticsPage})))"
      pattern: "lazy\\(\\(\\) => import\\(\"@/features/analytics/AnalyticsPage\""
    - from: frontend2/vite.config.ts
      to: "recharts"
      via: "manualChunks (id) => id.includes(recharts/d3 module) ? \"charts\" : …"
      pattern: "\"charts\""
    - from: frontend2/src/components/layout/Sidebar.tsx
      to: "/analytics"
      via: "the Overview-group Analytics NavItem gains `to=\"/analytics\"`"
      pattern: "Analytics</Trans>} to=\"/analytics\""
---

<objective>
The wiring (ANL-03 — the lazy-load + bundle-budget requirement): mount `/analytics` as a React.lazy
route, isolate recharts into its own `charts` manualChunk, and wire the Sidebar's disabled Analytics
NavItem to `/analytics`. This plan owns the THREE single-writer files so routes/index.tsx,
vite.config.ts, and Sidebar.tsx each have exactly one Phase-13b writer.

ANL-03 is the HARD gate: recharts must be DYNAMIC-imported so non-analytics routes carry zero
charting weight. Two mechanisms, both mirroring the Phase 11 scanner precedent:
1. `/analytics` is a React.lazy route (the AnalyticsPage import is dynamic → recharts, which the page
   transitively imports, auto-lands in the analytics page chunk).
2. an explicit `charts` manualChunk isolates the recharts (+ d3) vendor so it is a SEPARATE file that
   loads only when /analytics is visited.
DONE-CRITERION (VALIDATION): after `bun run build`, the MAIN chunk gzip carries ZERO charting bytes —
grep the build output / manifest to assert recharts only appears in the `charts` chunk + the analytics
page chunk, and document the main-chunk gzip before/after (must be ~unchanged).

Purpose: ANL-03 — lazy-load recharts behind /analytics, isolate it in a charts chunk, prove the main
bundle is unaffected, and surface the page in the nav.
Output: the lazy /analytics route + Suspense, the `charts` manualChunk branch, the wired Sidebar NavItem.

This plan is Wave 2, depends on 13b-04 (AnalyticsPage export must exist for the lazy import to
tsc-check) + 13b-02 (recharts installed), and is DISJOINT from its Wave-2 sibling 13b-04 (which owns
AnalyticsPage.tsx — not in this plan's file list).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/13b-analytics/13b-CONTEXT.md
@.planning/phases/13b-analytics/13b-VALIDATION.md
@.planning/phases/13b-analytics/13b-02-SUMMARY.md
@.planning/phases/13b-analytics/13b-04-SUMMARY.md

# The three single-writer files to edit + the lazy/chunk idioms to mirror EXACTLY:
@frontend2/src/routes/index.tsx
@frontend2/vite.config.ts
@frontend2/src/components/layout/Sidebar.tsx

<interfaces>
<!-- Verified from source this planning session. Use directly; no exploration needed. -->

routes/index.tsx — the /scan lazy idiom to mirror (lines 30-37 + 163-170):
```tsx
const ScanPage = lazy(() =>
  import("@/features/scan/ScanPage").then((m) => ({ default: m.ScanPage })),
);
…
<Route path="scan" element={<Suspense fallback={null}><ScanPage /></Suspense>} />
```
`lazy` + `Suspense` are already imported (line 1). Add the `AnalyticsPage` lazy const next to ScanPage
and an `<Route path="analytics" element={<Suspense fallback={null}><AnalyticsPage /></Suspense>} />`
INSIDE the authenticated `<Route element={<RequireAuth><AppShell/></RequireAuth>}>` block (a sibling of
the `index`/`items`/`scan` child routes — e.g. right after the `scan` route, before `claim/:code`).
`analytics` is a literal segment with no param → ordering vs the `*` wildcard is the only constraint
(it sits inside the AppShell layout route, well above the top-level `*`). The lazy AnalyticsPage import
is what auto-chunks recharts.

vite.config.ts — the manualChunks FUNCTION (lines 57-67, Vite 8/rolldown — MUST stay a function
`(id) => string | undefined`, NOT a record): the existing body has a `scannerModules` array + a
`scanner` return. ADD a parallel `chartModules` array (`["recharts", "d3-", "victory-vendor"]` —
recharts bundles its own d3 sub-packages prefixed `d3-…` and the `victory-vendor` shim; include the
prefixes that appear in the resolved tree — confirm the exact module ids from the build manifest /
node_modules after 13b-02's install) and an `if (chartModules.some((mod) => id.includes(mod))) return
"charts";` branch BEFORE the final `return undefined`. Keep the data-structure-as-membership style +
the explanatory comment (mirror the scanner block's comment shape — note ANL-03 + the POL-04 budget).

Sidebar.tsx — the disabled Analytics NavItem (~line 137, Overview group):
```tsx
<NavItem glyph="▤" label={<Trans>Analytics</Trans>} />
```
→ add `to="/analytics"` (becomes `<NavItem glyph="▤" label={<Trans>Analytics</Trans>} to="/analytics" />`).
This is the ONLY edit to Sidebar.tsx — do NOT touch any other NavItem (Settings stays disabled here;
it is wired by its own phase).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: lazy /analytics route + charts manualChunk + Sidebar NavItem (single-writer trio)</name>
  <files>frontend2/src/routes/index.tsx, frontend2/vite.config.ts, frontend2/src/components/layout/Sidebar.tsx</files>
  <action>
    SINGLE-WRITER edits — this plan is the sole Phase-13b writer of all three files.
    routes/index.tsx: add `const AnalyticsPage = lazy(() => import("@/features/analytics/AnalyticsPage")
    .then((m) => ({ default: m.AnalyticsPage })));` next to the ScanPage lazy const (with a short comment:
    "/analytics is React.lazy so recharts lands in its own `charts` manualChunk (13b-05) and loads only
    when /analytics is visited — ANL-03 / POL-04 budget. Mirrors the /scan idiom."). Add a
    `<Route path="analytics" element={<Suspense fallback={null}><AnalyticsPage /></Suspense>} />` inside
    the authenticated AppShell layout route (sibling of the `scan` route — place it right after `scan`,
    before `claim/:code`). Minimal diff — do not reorder unrelated routes.
    vite.config.ts: inside the existing `manualChunks` function, add a `chartModules` array
    (`["recharts", "victory-vendor", "d3-shape", "d3-scale", "d3-array", "d3-time", "d3-format",
    "d3-interpolate", "d3-color", "d3-path", "d3-time-format", "d3-ease"]` — recharts' resolved d3
    sub-deps; VERIFY against `node_modules`/the build manifest after install and trim/extend to the ids
    actually present) and an `if (chartModules.some((mod) => id.includes(mod))) return "charts";` branch
    BEFORE `return undefined`, AFTER the scanner branch. Keep the comment style (note ANL-03 + the
    scanner precedent). Do NOT convert the function to a record (rolldown requires the function form).
    Sidebar.tsx: add `to="/analytics"` to the Overview-group Analytics NavItem (the one-line edit at
    ~line 137). Touch nothing else.
  </action>
  <verify>
    <automated>cd frontend2 && bun run lint:tsc && grep -q 'import("@/features/analytics/AnalyticsPage")' src/routes/index.tsx && grep -q '"charts"' vite.config.ts && grep -q 'Analytics</Trans>} to="/analytics"' src/components/layout/Sidebar.tsx</automated>
  </verify>
  <done>tsc -b clean; the lazy AnalyticsPage import + /analytics route present; the `charts` manualChunk branch present; the Sidebar Analytics NavItem links to /analytics.</done>
</task>

<task type="auto">
  <name>Task 2: ANL-03 build gate — assert recharts is NOT in the main/vendor chunk</name>
  <files>frontend2/vite.config.ts</files>
  <action>
    NO source edit in this task (vite.config.ts is in the file list only because Task 1 already owns it
    and this task may need a tiny tweak to the `chartModules` membership if the build manifest reveals a
    leaked d3 id). Run the build and PROVE ANL-03's hard gate:
    1. `cd frontend2 && bun run build` (clean build).
    2. Identify the MAIN entry chunk + any vendor chunk (the largest non-lazy `assets/*.js` that loads
       on every route) and the `charts` chunk (the recharts isolate). Assert: NO main/vendor chunk file
       contains recharts/d3 marker strings, and a SEPARATE `charts-*.js` (or the analytics page chunk)
       DOES — e.g. grep the emitted bundle: the recharts marker (a stable recharts identifier such as a
       recharts export name / the `recharts` package banner) must appear ONLY in the charts/analytics
       chunk, NEVER in the entry chunk. Practical assertion:
       `grep -lR "recharts" dist/assets/*.js` returns the charts/analytics chunk(s) and NOT the main
       entry chunk; equivalently confirm the entry chunk gzip size is ~unchanged vs before recharts
       (document the before/after — VALIDATION requires the main-chunk gzip to be ~unchanged).
    3. If recharts/d3 bytes leak into the main chunk, EXTEND the `chartModules` membership in
       vite.config.ts (Task 1's array) with the leaked id(s) and rebuild until the gate is clean.
    Record the gate evidence (which chunk holds recharts, main-chunk gzip before/after) in the SUMMARY.
    This is the ANL-03 done-criterion — do not declare the plan done until the grep proves zero
    charting bytes in the main chunk.
  </action>
  <verify>
    <automated>cd frontend2 && bun run build && test -n "$(grep -lR recharts dist/assets/*.js)" && ! grep -l recharts dist/assets/index-*.js</automated>
  </verify>
  <done>Build green; recharts appears in a charts/analytics chunk but NOT in the largest (entry) chunk; main-chunk gzip ~unchanged vs pre-recharts (documented).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| build pipeline → shipped bundle | the manualChunks rule decides which bytes land in the always-loaded entry chunk vs the lazy charts chunk; a misrule would inflate every route's download (the POL-04 budget surface) |
| nav → /analytics route | a client-side route added under the authenticated AppShell layout — guarded by RequireAuth like every other child route |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13b-09 | DoS | recharts bytes leaking into the main bundle (every route pays) | mitigate | React.lazy /analytics + the explicit `charts` manualChunk isolate recharts; Task 2's build gate greps the emitted bundle to PROVE the entry chunk carries zero charting bytes (ANL-03 hard gate) — the plan is not done until that assertion is green |
| T-13b-10 | Elevation of Privilege | unauthenticated access to /analytics | mitigate | the route is added INSIDE the `<RequireAuth><AppShell/></RequireAuth>` layout block (sibling of every other gated child) — unauth visits redirect to /login like the rest of the app |
| T-13b-SC | Tampering | npm installs | mitigate | none — this plan installs NO packages (recharts was installed + lockfile-pinned by 13b-02 behind its legitimacy gate); this plan only chunks the already-vetted dep |
</threat_model>

<verification>
- `cd frontend2 && bun run lint:tsc` clean (tsc -b — the lazy AnalyticsPage import resolves the 13b-04 export).
- Phase gate (run before declaring the phase done): `cd frontend2 && bun run lint:tsc && bun run test &&
  bun run build && bun run lint:imports` all green.
- ANL-03 build gate: `grep -lR recharts dist/assets/*.js` → the charts/analytics chunk(s) only; the
  largest entry chunk does NOT contain recharts; main-chunk gzip ~unchanged (documented before/after).
- The Sidebar Analytics NavItem navigates to /analytics; the route renders the lazy AnalyticsPage.
- Run `bun run i18n:extract` so the new analytics msgids land in the catalogs (CONTEXT OQ5 — keep
  catalogs honest; Phase 15 does the full gap-fill).
</verification>

<success_criteria>
- ANL-03: recharts is dynamic-imported via the React.lazy /analytics route + isolated in a `charts`
  manualChunk; the main/vendor chunk gzip carries ZERO charting bytes (build-grep proven); non-analytics
  routes unaffected; the Sidebar surfaces the now-enabled Analytics nav entry.
</success_criteria>

<output>
Create `.planning/phases/13b-analytics/13b-05-SUMMARY.md` when done (record the final `charts`
manualChunk membership list, the build-gate evidence — which chunk holds recharts + main-chunk gzip
before/after — and the /analytics route placement so the live E2E spec + the gsd-verifier bind to
verified facts).
</output>
