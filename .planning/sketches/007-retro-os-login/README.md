---
sketch: 007
name: retro-os-login
question: "Does the retro-os form chrome work — sunken (inverted-bevel) inputs, beveled press-state buttons, an in-window error treatment — and does a single centered window on the cream desktop feel premium rather than empty?"
winner: "★ Single variant — validated in browser 2026-06-11: sunken inputs + error treatment + status bar read clean; watermark stays subordinate; primary vs OAuth hierarchy clear"
tags: [login, forms, theme, retro-os, pastel, frontend2]
---

# Sketch 007: Retro OS Pastel Login

Centered login window on the dithered cream desktop, with a faint oversized
`WAREHOUSE.SYS` watermark behind it for atmosphere.

## Design Question

Forms are where bevel chrome usually dies. Under test:

- **Sunken inputs** — inverted bevel (shade top-left, light bottom-right)
  to read as "engraved". Focus ring = 3px pastel-blue outline; visible
  enough for keyboard users?
- **Press states** — primary button inverts its bevel and translates 1px on
  `:active`. Tactile or gimmicky?
- **Error treatment** — danger-bordered banner inside the window body +
  `input--error` (danger border + blush fill). AA-checked: `--danger`
  #b73348 on `--danger-bg` #fbe3e8 ≈ 4.8:1.
- **Status bar** — bottom strip (caps-lock hint + clock) borrowed from
  classic file-manager windows. Keep or drop?

## Auth Contract (real)

Binds to `POST /api/auth/login` (email + password → `{token,
refresh_token}` + httpOnly cookie). The page also needs the OAuth
"Sign in with Google" secondary button — present in the sketch to test
visual hierarchy against the primary action (existing e2e specs target a
`^LOG IN$` exact-match submit button, so the two must stay visually and
semantically distinct).

## How to View

```
open .planning/sketches/007-retro-os-login/index.html
```

## What to Look For

- Mono input text (`input--mono`) for email — nice terminal nod or
  inconsistent with Plex Sans labels?
- Watermark at 4.5% ink — visible on a calibrated display without stealing
  contrast from the form?
- Title bar uses the default powder-blue pinstripe; should the login use
  pink/butter instead to differentiate from in-app windows?

## Theme

`../themes/retro-os.css`.
