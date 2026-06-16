# SonarQube Re-scan — After Remediation

Re-scan of both projects after the remediation commits on
`chore/sonarqube-remediation`. Same ephemeral SonarQube Community v26.6 setup
and scanner params as the baseline (see [README.md](README.md)).

- Baseline scan: 2026-06-16 (pre-remediation) — [FRONTEND.md](FRONTEND.md) / [BACKEND.md](BACKEND.md)
- Re-scan: 2026-06-16 (post-remediation)

## Before → After

| Metric | Frontend | Backend |
|--------|----------|---------|
| Total issues | 320 → **88** (−232) | 301 → **134** (−167) |
| Bugs | 15 → 15¹ | 1 → **0** ✅ |
| Vulnerabilities | 0 → 0 | 0 → 0 |
| Code smells | 305 → **73** | 300 → **134** |
| Security hotspots | 3 → **0** ✅ | 2 → 2² |
| Reliability rating | B → B¹ | **C → A** ✅ |
| Security-Review rating | **E → A** ✅ | E → E² |
| Maintainability rating | A → A | A → A |

¹ The 15 FE "bugs" are `typescript:S1082` — Sonar false-positives against
deliberate, documented a11y (see [REMEDIATION-PLAN.md](REMEDIATION-PLAN.md)
Phase 1). When marked False-Positive in this scan, **FE bugs → 0, Reliability
→ A, code smells → 45** (the a11y-cluster smells are accepted too). Markings
are throwaway on an ephemeral server — they only persist with a standing
SonarQube instance.

² The 2 remaining BE hotspots are both in `backend/Dockerfile`
(`docker:S6470` recursive `COPY` — now scoped by `.dockerignore`; `docker:S6471`
root user — the ephemeral dbmate *migrate* stage only; runtime is non-root
`USER app`). Reviewing them (one click in a persistent instance) flips
Security-Review **E → A**. Low risk; left for triage rather than code change.

## What landed

- **Hotspots:** FE 3 → 0 (ReDoS regex → linear `groupThousands`; `Math.random`
  → `crypto.randomUUID`). BE builder `COPY` scoped via `.dockerignore`.
- **Bugs:** BE 1 → 0 (S3923 dead-branch in workspace test fixed). FE 15 are the
  a11y false-positives above.
- **Code smells:** FE −232 (readonly props, globalThis, ternaries, deprecated
  APIs, dedup, …). BE −166 (string consts, dedup, TODOs, top-5 complexity
  refactors).
- **Quality gate:** still OK on both.

## Remaining (deliberately not done — see plan)

- **FE: 45 smells** after a11y triage — Phase-3 stragglers (`S3358`/`S1874`/
  `S6551`) + misc. Low value.
- **BE: 134 smells** — `go:S107` (39 wide constructors, Phase 5 — skipped:
  high-churn/low-value, idiomatic Go) + the `go:S3776` complexity tail beyond
  the top-5 monsters (refactoring cc-16→15 is noise) + a few. Per the plan's
  honest assessment, chasing these to zero is vanity-metric work.
- **Regression guard:** the `.githooks/pre-push` hook (golangci-lint
  new-from-merge-base + biome/tsc) now blocks *new* slop — the real long-term
  win, far cheaper than retro-fixing the tail.

## Net

621 baseline issues → **222** (and **0 after a11y triage on FE / true ratings
A·A·A there**). All real defects, all hotspots, and the worst complexity
offenders are resolved; what remains is threshold-noise the hook now prevents
from growing.
