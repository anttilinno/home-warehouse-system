# Layout & Navigation — Retro OS Pastel

Validated in sketch 006.

## Page structure

```
┌──────────────────────────────────────────────────────────────┐
│ MENUBAR  WAREHOUSE.SYS · File Edit View Special · mono clock │  sticky
├────────────┬─────────────────────────────────────────────────┤
│ NAVIGATOR  │ quick actions (bevel buttons)                   │
│ (window)   │ stat windows (4-up grid)                        │
│            │ substat strip (5-up bevel chips)                │
│ Overview   │ ┌ activity window ────────┐ ┌ attention window ┐│
│ Inventory  │ │ table                   │ │ alert rows       ││
│ System     │ └─────────────────────────┘ └──────────────────┘│
│ ── user ── │                                                 │
└────────────┴─────────────────────────────────────────────────┘
```

- Frame: `grid-template-columns: 232px 1fr`, max-width 1280px, 24px gaps.
- Breakpoints: ≤1180px stats 2-up / substats 3-up / panes stack;
  ≤820px sidebar stacks above main. All grid children `min-width: 0`
  (Silkscreen values overflow otherwise — bitten in 006).

## Menu bar

White strip, 2px ink bottom border + inset shade. Brand in Silkscreen with
pink-deep accent suffix. File/Edit/View/Special items are atmosphere for
now — build-phase decision: wire to command palette or drop. Mono clock
right-aligned.

## Navigator sidebar

A `.window` with plain titlebar ("Navigator"). Grouped nav (carried over,
direction-agnostic): **Overview / Inventory / System**, group headings
10px uppercase muted with dotted underline. Items 13px Plex Sans 600 with
mono right-aligned counts. Active item: pastel-blue fill + 1px ink border
+ 2px ink hard shadow. User identity in window footer (avatar = pastel
square with Silkscreen initial, name + muted email) — frontend1 pattern.

## Main pane

- Quick actions: bevel buttons row (primary = scan, mint = add).
- Stat windows: titlebar color is semantic (blue items / mint loans /
  pink overdue / butter low-stock).
- Activity + attention: `1fr 320px` two-pane grid, stacks ≤1180px.
