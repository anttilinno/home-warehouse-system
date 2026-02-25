# Problem Validation -- Phase 1 Findings

**Product:** Home Warehouse System (HWS)
**Date:** 2026-02-24
**Status:** Phase 1 In Progress -- Cataloging Experiment Pending
**Interviewer:** Scout (Product Discovery Facilitator)
**Interviewee:** Product creator / sole user (n=1)

---

## Executive Summary

HWS is a feature-rich home inventory management system with zero real-world usage.
The creator has just deployed it for the first time and has not yet cataloged a single
item. Discovery interviews revealed that the product as built addresses a different
problem than the one the user actually has.

**The assumed problem:** "I need to track and find my household items."

**The actual problem:** "I have ~500 electronic components and IT hardware spread
across 3 locations. I have no overview of what I own. This kills my motivation to
start DIY projects because parts-hunting is exhausting, and I cannot declutter
because I do not know what is worth keeping."

**Critical risk:** The user abandoned simpler tools (Obsidian, Google Sheets) within
1-4 days due to friction ("too lazy to update"). HWS has significantly more data
entry steps per item than either of those tools. Without addressing the friction
problem, HWS will likely suffer the same fate.

---

## Interview Evidence (1 interview, single user)

### Signal 1: The Real Pain Is Project-Start Paralysis, Not Item Finding

**Evidence (user's words):**
- "The mental energy to start a DIY project now is enormous, just go parts hunting
  and then you are fed up and bury the project"
- "I have numerous esp32 projects, that have parts but I feel like first step is to
  know what I have and how much. Do I need more resistors etc."
- "I have some ideas in Obsidian but parts are mostly purchased from aliexpress, so
  I have no idea, what and how much I have"

**Implication:** The value proposition is not "find your stuff" -- it is "know what
you have so you can start building." The trigger for opening the app should be
project planning, not item search.

### Signal 2: Preventing Duplicate Purchases

**Evidence (user's words):**
- "Do I need more resistors etc." -- the user wants to check stock before ordering
- Parts purchased from AliExpress (long shipping times = high cost of ordering wrong)

**Implication:** If a 2-week AliExpress shipment arrives and the user already had the
part, that is a tangible waste of time and money. Inventory accuracy for electronic
components has a clear ROI tied to purchase prevention.

### Signal 3: Declutter as Secondary Driver

**Evidence (user's words):**
- "I need to get rid of unnecessary items, that means I need to sort things I can
  sell and things I want to use"
- "I became aware that I have too much of dead hardware, that could be sold or
  donated. But before that, I could get some donor components. Or the 5 keyboards
  that I have but don't use"
- "About hundred euros" in sellable hardware (low financial value, more about
  space/clarity)

**Implication:** Declutter is real but secondary. The financial motivation is low
(~100 EUR). The real motivation is mental clarity and reclaiming space.

### Signal 4: The 50-Item Barrier

**Evidence (user's words):**
- "If I can push past 50, I might finish it"
- Abandoned Obsidian/Sheets in 1-4 days
- "I was too lazy to update the sheet"
- "It was in the lines of 'I'll do it later' and that later never happened"
- Phone was "uncomfortable" for data entry

**Implication:** The system has approximately 50 items of runway before the user
quits. Every unnecessary form field, every extra click, every moment of confusion
accelerates abandonment. Speed of data entry is not a nice-to-have -- it is the
difference between a useful product and shelfware.

### Signal 5: Progressive Detail Is the Right Model

**Evidence (user's words):**
- When asked about minimal fields (name, location, keep/sell/unsure): "That is first
  part and then for important parts, start adding more information"

**Implication:** The user explicitly validated a two-phase approach:
1. Fast capture: get everything into the system with minimal data
2. Enrichment: add detail to items that matter

This is the opposite of HWS's current design, which asks for rich data upfront
(category, container, labels, photos, purchase info, warranty, etc.)

### Signal 6: Builder Motivation Dominates

**Evidence (user's words):**
- "40% I need this tool vs 60% I can build this"

**Implication:** The feature scope was driven more by "interesting to build" than
"needed by users." Features like approval pipelines, multi-user workspaces with
role-based access, Docspell integration, and the planned TUI client reflect builder
interest, not validated user need. This is normal for side projects but means every
feature should be treated as an assumption.

---

## Assumption Tracker

| # | Assumption | Impact | Uncertainty | Risk Score | Status |
|---|-----------|--------|-------------|------------|--------|
| A1 | Users will maintain inventory after initial cataloging | 5 | 5 | **25** | NEGATIVE SIGNAL -- abandoned simpler tools in 1-4 days |
| A2 | Initial cataloging effort is worth the ongoing value | 5 | 4 | **20** | REFRAMED -- value is in one-time audit, not ongoing maintenance |
| A3 | Family members will adopt the system | 4 | 5 | **20** | UNTESTED -- never discussed with family |
| A4 | Finding items is the core pain | 4 | 2 | **8** | INVALIDATED -- real pain is project-start paralysis and declutter |
| A5 | Self-hosted deployment is an advantage | 3 | 3 | **9** | UNTESTED |
| A6 | HWS is better than simpler tools for a single user | 4 | 4 | **16** | AT RISK -- simpler tools already failed on friction |
| A7 | QR codes / barcode scanning add value for home use | 3 | 4 | **12** | UNTESTED |
| A8 | Phone/mobile data entry is viable for cataloging | 5 | 3 | **15** | NEGATIVE SIGNAL -- phone was "uncomfortable" for sheets |
| A9 | IT hardware / electronic components is the primary use case | 4 | 2 | **8** | VALIDATED -- strongest pain, ~500 items, concrete stories |
| A10 | Book finding is a family-shared pain | 3 | 3 | **9** | WEAK POSITIVE -- monthly occurrence, low urgency |
| A11 | Real value is reducing project-start friction | 5 | 2 | **10** | STRONG SIGNAL -- emotionally charged language |
| A12 | Declutter/triage is a core need | 4 | 2 | **8** | STRONG SIGNAL -- explicit need articulated |
| A13 | System must work for one-time audit, not just ongoing tracking | 5 | 2 | **10** | STRONG SIGNAL -- all evidence converges here |
| A14 | The 50-item barrier determines success or failure | 5 | 2 | **10** | STRONG SIGNAL -- user self-identified this threshold |

---

## Gate G1 Evaluation

### Criteria and Status

| Criterion | Threshold | Actual | Status |
|-----------|-----------|--------|--------|
| Interviews conducted | 5+ | 1 | FAIL |
| Pain confirmation rate | >60% | N/A (n=1) | FAIL |
| Problem in customer words | Yes | Yes | PASS |

**G1 Status: NOT MET**

We have one deeply honest interview with the product creator. The problem is
articulated clearly in the user's own words. However, we have n=1 and that person
has 60% builder motivation. We cannot pass G1 until we have:

- The user's own cataloging experiment results (testing A1, A2, A6, A8, A14)
- At minimum 4 more signals from distinct sources (family members, self-hosted
  community feedback, or similar users in maker/electronics communities)

### What We Can Say

- The problem space is real but narrower than assumed
- The specific pain (project-start paralysis due to parts chaos) is genuine and
  emotionally charged
- The existential risk is friction/abandonment, not missing features
- Electronic components inventory is a validated use case segment

### What We Cannot Say Yet

- Whether anyone besides the creator would use this
- Whether the creator will actually use it past 50 items
- Whether the feature set as built adds or detracts from the core value
- Whether family adoption is realistic

---

## Recommended Next Steps

1. **Immediate:** Fix the inventory bug so basic cataloging works
2. **Immediate:** Run the Cataloging Experiment (see experiment protocol below)
3. **After experiment:** Resume Phase 1 with experiment results
4. **After experiment:** Begin informal discovery conversations with family members
5. **After experiment:** Assess whether to proceed to Phase 2 or pivot the product
   concept

---

## Cataloging Experiment Protocol

See separate section in this document for the full experiment design.

### Experiment: First Box Audit

**Hypothesis:** A motivated user can catalog the contents of one physical box of
IT hardware using HWS in under 30 minutes and find the experience worthwhile
enough to continue to a second box.

**Method:**
1. Choose one box of IT/electronic hardware (20-40 items)
2. Set a timer
3. Catalog every item in that box using HWS
4. Record every friction point (see tracking template below)
5. After completing the box, answer the debrief questions

**Friction Point Tracking Template:**

For each friction point, note:
- Timestamp (how many minutes in)
- What you were trying to do
- What went wrong or felt slow
- Severity: BLOCKER (could not proceed) / ANNOYING (slowed down) / MINOR (noticed it)
- Did you find a workaround?

**Debrief Questions (answer immediately after finishing):**

1. How long did cataloging the box take? (wall clock time)
2. How many items did you catalog?
3. What was the average time per item?
4. At what point (if any) did you want to quit?
5. What was the most frustrating moment?
6. What was the most satisfying moment?
7. Did you use phone or desktop? Why?
8. Which fields did you actually fill in for most items?
9. Which fields did you skip because they felt like too much work?
10. Now that the box is cataloged, does it feel useful? Would you open the app
    to check what is in that box, or would you just open the box?
11. Are you motivated to do the next box, or does it feel like a chore?
12. What one change would make the biggest difference in speed?

---

## Key Quotes (Verbatim)

- "The mental energy to start a DIY project now is enormous, just go parts hunting
  and then you are fed up and bury the project"
- "I have no idea, what and how much I have"
- "I was too lazy to update the sheet"
- "It was in the lines of 'I'll do it later' and that later never happened"
- "If I can push past 50, I might finish it"
- "That is first part and then for important parts, start adding more information"
- "40% I need this tool vs 60% I can build this"
- "Let's hear the honest opinion, I can always refactor or discard suggestions"
