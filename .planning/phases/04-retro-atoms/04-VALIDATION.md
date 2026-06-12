---
phase: 4
slug: retro-atoms
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
---

# Phase 4 — Validation Strategy

> Build-on-infrastructure phase: ModalStack + Shortcuts SSOT solved in Phase 3.
> Dominant risk = re-solving solved problems inconsistently. See 04-RESEARCH.md
> Validation Architecture for the per-atom map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + RTL (per-atom specs); Playwright (demo-page smoke optional) |
| **Config file** | `frontend2/vitest.config.ts` |
| **Quick run command** | `cd frontend2 && bun run test src/components/retro/` |
| **Full suite command** | `cd frontend2 && bun run test && bun run build && bun run lint:imports && bun run lint:tsc` |
| **Estimated runtime** | ~15s unit · ~35s full |

---

## Sampling Rate

- **After every task commit:** affected atom specs minimum
- **After every plan wave:** full suite + build + lint:imports + lint:tsc
- **Before phase verification:** full suite green; bundle delta checked (sonner is the only new dep — note gzip delta)
- **Max feedback latency:** 35 seconds

---

## Per-Requirement Verification Map

| Requirement | Behavior to prove | Test Type |
|-------------|-------------------|-----------|
| TUI-02 | ESC across stacked dialog → drawer → menu pops topmost only; logout unreachable (INTEGRATION spec across overlay types — Phase 3 unit tests cover the provider, this phase proves the composition) | unit/integration |
| TUI-03 | RetroStatusDot renders `sse: ● live` text + blinking dot (steps(1,end)); props-driven, reduced-motion aware | unit |
| TUI-04 | Status pills OK/WARN/INFO/DANGER render locked token classes; RetroTable numeric columns carry tabular-nums | unit |
| TUI-06 | useTableSelection: click select, Shift+Click range (id-keyed, sort/filter-safe), Ctrl toggle; bulk-actions group registers in shortcuts SSOT; Bottombar surfaces chips when selection non-empty | unit |
| ATOM-FB-01..04 | FilterBar/FilterPopover/BulkActionBar/SavedFilters render + interact per UI-SPEC; SavedFilters localStorage round-trip | unit |
| SC-1 (demo) | /demo renders every atom family (smoke render test, route registered, unlisted) | unit |
| All form atoms | a11y contract specs: combobox aria-activedescendant flow, native select skinned, checkbox/file/textarea/formfield label+error wiring | unit |

---

## Wave 0 Requirements

- [ ] RetroDialog EXTRACTED from F1HelpDialog first (the proven overlay recipe: scrim + Window + useModalStack + focus-trap) — every other overlay builds on it
- [ ] `bun add sonner@2.0.7` — APPROVED by orchestrator (registry-verified zero-dep); pin exact version
- [ ] Selection model unit tests land with the hook (id-keyed contract guarded from first commit)

---

## Manual-Only Verifications

| Behavior | Why Manual | Instructions |
|----------|------------|--------------|
| /demo visual pass vs sketches 006-008 | rendering is visual | open /demo, eyeball every family |
| Toast stacking/pause-on-hover feel | timing/visual | fire several toasts on /demo |
| Combobox keyboard flow feel | interaction nuance beyond RTL | arrow/type/select on /demo |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 35s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
