#!/usr/bin/env bash
# Autonomous per-phase driver for the v3.0 frontend2 parity milestone.
#
# Each iteration spawns a FRESH `claude -p` headless session (= fresh context, the
# "start fresh / terminate session" of your loop), pointed at .planning/automation/
# phase-prompt.md. That session orchestrates exactly ONE phase — the first unchecked
# `- [ ] **Phase N:**` in the v3.0 section of ROADMAP.md — then flips it to [x],
# updates .continue-here.md, commits, and stops. The driver then runs the acceptance
# gate and advances. Crash-safe: phase is re-derived from ROADMAP.md every loop.
#
# Usage:
#   .planning/automation/run-phases.sh            # run until no unchecked phases
#   MAX_PHASES=1 .planning/automation/run-phases.sh   # one phase then stop
#   DRY_RUN=1 .planning/automation/run-phases.sh      # show the next phase, don't invoke
set -uo pipefail

# ---- locate the repo root (this script lives in .planning/automation/) ----
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

ROADMAP=".planning/ROADMAP.md"
PROMPT_FILE=".planning/automation/phase-prompt.md"
LOG_DIR=".planning/automation/logs"
mkdir -p "$LOG_DIR"

MAX_PHASES="${MAX_PHASES:-20}"        # runaway cap
MAX_TURNS="${MAX_TURNS:-400}"         # per-session turn cap
MODEL="${MODEL:-opus}"
CLAUDE_FLAGS="${CLAUDE_FLAGS:---dangerously-skip-permissions}"  # sandbox autonomy

# Acceptance gate — the loop's source of truth (NOT the model's self-report).
frontend_gate() { ( cd frontend2 && bun run lint:tsc && bun run test && bun run build && bun run lint:imports ); }
backend_gate()  { ( cd backend && go build ./... && go test ./... ); }

# Extract the first unchecked phase id (e.g. "14b") from the v3.0 ACTIVE section only,
# bounded by the "### v3.0 ... ACTIVE" header and the next "## " header. Empty = done.
next_phase() {
  awk '
    /^### v3\.0 Retro-OS Pastel Frontend.*ACTIVE/ {inv3=1; next}
    inv3 && /^## / {exit}
    inv3 && /^- \[ \] \*\*Phase / {
      match($0, /\*\*Phase ([0-9]+[a-z]?):/, m); print m[1]; exit
    }
  ' "$ROADMAP"
}

phase_title() {  # $1 = phase id
  grep -E "^- \[ \] \*\*Phase $1:" "$ROADMAP" | head -1 | sed -E 's/^- \[ \] \*\*Phase [0-9a-z]+: ([^*]+)\*\*.*/\1/'
}

for ((i=0; i<MAX_PHASES; i++)); do
  PHASE="$(next_phase)"
  if [ -z "$PHASE" ]; then echo "✅ No unchecked v3.0 phases left — milestone done."; exit 0; fi
  TITLE="$(phase_title "$PHASE")"
  echo "============================================================"
  echo "  PHASE $PHASE — $TITLE   ($(date '+%H:%M'))"
  echo "============================================================"

  if [ "${DRY_RUN:-0}" = "1" ]; then echo "(dry run) would orchestrate phase $PHASE"; exit 0; fi

  # working tree must be clean before a phase (each phase commits its own work)
  if [ -n "$(git status --porcelain)" ]; then
    echo "✋ working tree dirty before phase $PHASE — commit/stash first."; git status --short; exit 1
  fi

  LOG="$LOG_DIR/phase-${PHASE}-$(date '+%Y%m%d-%H%M%S').log"
  echo "→ fresh claude session (model=$MODEL, log=$LOG)"

  # FRESH context per phase: a new `claude -p` process that runs to completion + exits.
  claude -p "$(cat "$PROMPT_FILE")" \
      --model "$MODEL" \
      --max-turns "$MAX_TURNS" \
      $CLAUDE_FLAGS \
    2>&1 | tee "$LOG"
  SESS_RC=${PIPESTATUS[0]}
  echo "→ session exited rc=$SESS_RC"

  # ---- acceptance gate (the loop owns truth) ----
  echo "→ frontend gate…"; if ! frontend_gate; then echo "❌ FRONTEND GATE FAILED (phase $PHASE) — halting for human."; exit 2; fi
  echo "→ backend gate…";  if ! backend_gate;  then echo "❌ BACKEND GATE FAILED (phase $PHASE) — halting for human.";  exit 2; fi

  # ---- progress check: the phase MUST now be [x], else the session stalled ----
  STILL="$(next_phase)"
  if [ "$STILL" = "$PHASE" ]; then
    echo "❌ phase $PHASE still unchecked after the session — no progress. Halting (avoids infinite loop)."
    exit 3
  fi

  # ---- belt-and-suspenders: ensure nothing uncommitted lingers ----
  if [ -n "$(git status --porcelain)" ]; then
    echo "⚠ uncommitted changes after phase $PHASE — committing as a safety net."
    git add -A && git commit -m "chore(driver): safety commit after phase $PHASE" \
      -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  fi

  echo "✔ phase $PHASE done — advancing."
done

echo "⏹ MAX_PHASES=$MAX_PHASES reached — stopping (re-run to continue)."
