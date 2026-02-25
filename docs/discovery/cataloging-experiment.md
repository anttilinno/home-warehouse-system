# Cataloging Experiment -- First Box Audit

**Date designed:** 2026-02-24
**Status:** PENDING -- awaiting inventory bug fix and execution
**Purpose:** Test whether HWS can survive the 50-item barrier

---

## Why This Experiment Matters

Every previous attempt to catalog items (Obsidian, Google Sheets) was abandoned
within 1-4 days. The user self-identified that "if I can push past 50, I might
finish it." This experiment tests whether HWS creates enough momentum to clear
that barrier, or whether it introduces even more friction than the tools that
already failed.

This single experiment will answer or inform 6 of our 14 tracked assumptions:
- A1: Will the user maintain the inventory?
- A2: Is the cataloging effort worth it?
- A6: Is HWS better than simpler tools?
- A8: Is phone/mobile data entry viable?
- A13: Does one-time audit feel valuable?
- A14: Can the user push past 50 items?

---

## Pre-Experiment Checklist

- [ ] Inventory feature is working (items can be tied to locations/containers)
- [ ] At least 2-3 locations created (matching the 3 real physical locations)
- [ ] At least 1 container created (the box being audited)
- [ ] A few basic categories created (Electronics, Cables, Components, etc.)
- [ ] App accessible on phone (test PWA or browser access)
- [ ] Timer ready

---

## Experiment Protocol

### Setup (before the timer starts)

1. Pick ONE physical box of IT/electronic hardware containing 20-40 items
2. Have the box in front of you
3. Open HWS on your preferred device
4. Ensure locations and the container for this box exist in the system
5. Open the friction tracking template (below) in a separate window or on paper

### Execution (start the timer)

1. Open the box
2. For each item, catalog it in HWS
3. Use whatever fields feel natural -- do not force yourself to fill everything
4. Note every friction point as you go (see template)
5. When the box is fully cataloged, stop the timer

### Rules

- Do not optimize your process beforehand -- use the app as-is
- Do not fix bugs mid-experiment unless they are true blockers
- If something is a blocker, note it and skip that item
- Be honest about when you want to quit

---

## Friction Point Tracking Template

Copy this table and fill it in during the experiment:

| # | Time (min) | Trying to do | What went wrong / felt slow | Severity | Workaround? |
|---|-----------|-------------|---------------------------|----------|-------------|
| 1 | | | | BLOCKER / ANNOYING / MINOR | |
| 2 | | | | BLOCKER / ANNOYING / MINOR | |
| 3 | | | | BLOCKER / ANNOYING / MINOR | |
| 4 | | | | BLOCKER / ANNOYING / MINOR | |
| 5 | | | | BLOCKER / ANNOYING / MINOR | |
| 6 | | | | BLOCKER / ANNOYING / MINOR | |
| 7 | | | | BLOCKER / ANNOYING / MINOR | |
| 8 | | | | BLOCKER / ANNOYING / MINOR | |
| 9 | | | | BLOCKER / ANNOYING / MINOR | |
| 10 | | | | BLOCKER / ANNOYING / MINOR | |

(Add more rows as needed)

---

## Post-Experiment Debrief

Answer these immediately after finishing, while the experience is fresh:

### Speed

1. Total wall-clock time for the box: _____ minutes
2. Number of items cataloged: _____
3. Average time per item: _____ seconds
4. At what point (if any) did you want to quit? Item #_____

### Friction

5. What was the single most frustrating moment?
6. How many BLOCKER-level friction points did you hit?
7. How many times did you think "this is faster in a spreadsheet"?

### Value

8. What was the most satisfying moment?
9. Now that the box is cataloged, does it feel useful?
10. Would you open the app to check what is in that box, or just open the physical box?
11. Can you answer "do I have X?" for items in this box now?

### Momentum

12. Are you motivated to do the next box? (Yes / Maybe / No)
13. If you had to catalog 10 more boxes like this, would you? Why or why not?
14. What one change would make the biggest difference in speed?

### Device

15. Did you use phone or desktop?
16. If desktop, why not phone? If phone, how was the experience?

### Progressive Detail

17. Which fields did you actually fill in for most items?
18. Which fields did you skip because they felt like too much work?
19. Did you ever wish for a field that does not exist?

---

## Success Criteria

The experiment is a **positive signal** if:
- Average time per item < 60 seconds
- User completes the entire box without quitting
- User reports motivation to continue to next box
- Fewer than 3 BLOCKER-level friction points
- User reports the cataloged box "feels useful"

The experiment is a **negative signal** if:
- Average time per item > 120 seconds
- User quits before finishing the box
- User reports it feels like a chore with no payoff
- More than 3 BLOCKER-level friction points
- User says they would rather use a spreadsheet

The experiment is **ambiguous** if results fall between these thresholds.
Ambiguous results should be followed up with a second box attempt after
addressing the top friction points.

---

## After the Experiment

Bring results back to the discovery session. Based on outcomes, we will:

1. **If positive:** Proceed to Phase 2 (Opportunity Mapping) with confidence
   in the core loop. Focus on identifying which features accelerate cataloging
   and which are friction.

2. **If negative:** Discuss whether the product concept needs fundamental
   rethinking. Options include: radical simplification, pivot to a different
   form factor, or accepting this as a portfolio project rather than a
   product with growth potential.

3. **If ambiguous:** Identify the top 2-3 friction points, fix them, and
   run the experiment again with a second box.
