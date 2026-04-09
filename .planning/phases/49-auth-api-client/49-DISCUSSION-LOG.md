# Phase 49: Auth & API Client - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 49-auth-api-client
**Areas discussed:** Auth form layout, Social OAuth buttons, Error & validation style, API client approach

---

## Auth Form Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Tab toggle | Single page with Login/Register tabs -- matches BAM ref 5 exactly | ✓ |
| Separate pages | Dedicated /login and /register routes with link to switch | |
| You decide | Claude picks best approach | |

**User's choice:** Tab toggle
**Notes:** Matches BAM reference image 5 with two tabs at top and form content switching below.

### Follow-up: Guest Mode

| Option | Description | Selected |
|--------|-------------|----------|
| No guest mode | Only LOGIN/REGISTER actions -- app requires auth | |
| You decide | Claude decides based on backend support and phase scope | ✓ |

**User's choice:** You decide
**Notes:** Claude decided: no guest mode (app requires authentication).

### Follow-up: Close Button

| Option | Description | Selected |
|--------|-------------|----------|
| No close button | Auth page is entry point -- nowhere to close to | |
| Keep as decoration | Show red X for retro aesthetic, non-functional | ✓ |

**User's choice:** Keep as decoration
**Notes:** Red X present for BAM aesthetic fidelity.

---

## Social OAuth Buttons

| Option | Description | Selected |
|--------|-------------|----------|
| Include OAuth buttons | Add Google + GitHub below email/password form, backend support exists | ✓ |
| Email/password only | Keep phase focused, OAuth later | |
| Placeholder buttons | Disabled OAuth buttons with 'Coming soon' | |

**User's choice:** Include OAuth buttons
**Notes:** Backend already supports full OAuth flow. Avoids separate phase just for OAuth UI.

### Follow-up: OAuth Callback

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated callback route | /auth/callback route handles code exchange and redirect | ✓ |
| You decide | Claude picks best approach for SPA | |

**User's choice:** Dedicated callback route
**Notes:** Matches frontend1 pattern with one-time Redis code exchange.

---

## Error & Validation Style

| Option | Description | Selected |
|--------|-------------|----------|
| Inline banner | Colored text inside form panel (red errors, green success) | ✓ |
| Per-field inline errors | Red text under each invalid field | |
| Both combined | Per-field for format errors, banner for server errors | |

**User's choice:** Inline banner
**Notes:** Matches BAM ref 5 message format. Single error line between fields and submit button.

---

## API Client Approach

**User's choice (pre-selected):** Build a lighter fetch wrapper
**Notes:** User decided without discussion. Online-only SPA doesn't need frontend1's class-based ApiClient complexity.

---

## Claude's Discretion

- Guest mode: no guest mode (app requires auth)
- Token refresh mechanism
- Auth context/provider architecture
- Route guard implementation
- Form state management
- Register form field set

## Deferred Ideas

None -- discussion stayed within phase scope
