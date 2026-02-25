# Phase 2 Preparation -- Questions for After the Cataloging Experiment

**Status:** BLOCKED -- waiting for cataloging experiment results
**Purpose:** These questions should be asked after the user completes the first
box audit experiment and reports results.

---

## Context for Phase 2

Phase 2 (Opportunity Mapping) builds an Opportunity Solution Tree from validated
insights. We cannot build this tree until we know whether the core cataloging loop
works. The experiment results will determine which branch of the tree we explore.

---

## Questions Based on Experiment Outcomes

### If the Experiment Was Positive (user finished, wants to continue)

**Opportunity: Accelerate the cataloging-to-value loop**

1. Now that you have one box cataloged, has your mental model of the product
   changed? What does HWS "feel like" to you now -- a database, a tool, a map,
   something else?

2. Which of these would you do next: catalog another box, go back and enrich
   the items you just entered, or try to use the data for something (like
   planning a project)?

3. You mentioned the esp32 robot hand project. Can you look at your cataloged
   box and answer: "Do I have the parts I need for that project?" Does HWS
   help you answer that right now, or is something missing?

4. If you were going to order from AliExpress today, would you check HWS
   first to see if you already have the part? What would that workflow look
   like?

5. Show me how you would find "all my resistors" in HWS right now. Is it fast
   enough that you would actually do it before placing an order?

**Opportunity: Family adoption pathway**

6. Now that you have used HWS for real, would you show it to a family member
   this week? If yes, what would you show them? If no, what is holding you back?

7. Think about the book-finding problem. Would you catalog your books into HWS?
   How would that differ from cataloging IT hardware?

**Opportunity: Feature pruning**

8. Look at the sidebar navigation in HWS. Which sections did you actually use
   during cataloging? Which ones did you not touch at all?

9. If I removed everything from HWS except: items, locations, containers, and
   search -- would that cover what you just did? What would be missing?

10. Which planned features on the roadmap feel important to you NOW (not in
    theory, but based on your experience cataloging)? Which feel irrelevant?

### If the Experiment Was Negative (user quit or found it painful)

**Opportunity: Radical simplification**

1. At what exact moment did cataloging stop feeling worthwhile? What were you
   doing?

2. If you could redesign the item entry form right now, what would it look like?
   How many fields? What information?

3. Would you use a tool that ONLY did this: you take a photo of a box's contents,
   type a one-line description of each item, and tag the box's location? No
   categories, no containers, no quantities -- just photo + name + where.

4. Would voice input help? "Hey HWS, garage box 3 contains: 20 resistors, 5
   capacitors, an Arduino Mega, three USB cables."

5. What if cataloging was not item-by-item but box-by-box? You describe the
   box's contents as a whole rather than creating individual item records?

**Opportunity: Different form factor entirely**

6. Would a simple camera + AI approach work better? Take a photo of the box
   contents, AI identifies and catalogs items automatically, you just confirm
   or correct?

7. What if instead of cataloging everything, you only tracked the items you
   search for? Start with zero items, and the first time you look for something
   and find it, you log it then. Build the inventory through use rather than
   upfront effort.

8. Would a physical solution work better for you? Label maker + printed lists
   taped to boxes, no app at all?

### If the Experiment Was Ambiguous

**Opportunity: Targeted friction reduction**

1. You hit [N] friction points. Let me list them. If we fixed the top 3, would
   you try the experiment again with a second box?

2. Which friction points are product problems (HWS is hard to use) versus
   inherent problems (cataloging is inherently tedious)?

3. For the inherent tedium: what would make it tolerable? Music? A partner
   helping? Smaller sessions (10 items at a time)?

---

## Phase 2 Opportunity Domains (Preliminary)

Based on Phase 1 findings, these are the candidate opportunity domains to map
once we have experiment data:

### Domain 1: Project Planning Enablement
- "Know what I have so I can plan builds"
- "Check stock before ordering from AliExpress"
- "Reduce project-start friction"

### Domain 2: Declutter and Triage
- "Decide what to keep, sell, donate"
- "Identify donor components before discarding hardware"
- "List items for sale on osta.ee"

### Domain 3: Fast Audit (One-Time Value)
- "Get 500 items into the system without quitting"
- "Progressive detail: fast capture first, enrich later"
- "Box-by-box workflow rather than item-by-item"

### Domain 4: Family Shared Knowledge
- "Family members can find books, footwear, seasonal items"
- "Reduce 'where is X?' questions"
- Requires: low barrier to querying (not just data entry)

### Domain 5: Ongoing Maintenance (Low Confidence)
- "Keep inventory updated as things move"
- "Track new purchases"
- WARNING: All evidence suggests the user will NOT do ongoing maintenance.
  This domain should only be explored if the experiment reveals surprising
  engagement.

---

## Phase 2 Will Not Proceed Until

- [ ] Cataloging experiment completed
- [ ] Debrief questions answered
- [ ] Experiment results analyzed
- [ ] Decision made: proceed with current concept, simplify, or pivot
