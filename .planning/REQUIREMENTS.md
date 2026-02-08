# Requirements: Home Warehouse System

**Defined:** 2026-02-08
**Core Value:** Reliable inventory access anywhere -- online or offline -- with seamless sync

## v1.6 Requirements

Requirements for Format Personalization milestone. Each maps to roadmap phases.

### Date Format Consistency

- [ ] **DATE-01**: Date displays in all tables use user's format
- [ ] **DATE-02**: Date displays in all cards/lists use user's format
- [ ] **DATE-03**: Date displays in detail pages use user's format
- [ ] **DATE-04**: Date input placeholders reflect user's format
- [ ] **DATE-05**: Date pickers parse input according to user's format
- [ ] **DATE-06**: Date pickers output dates in user's format
- [ ] **DATE-07**: DateTime displays format date portion per user's preference
- [ ] **DATE-08**: Form validation messages reference user's chosen format
- [ ] **DATE-09**: CSV/export downloads format dates per user's preference
- [ ] **DATE-10**: Date parsing interprets user input per their chosen format

### Time Format

- [ ] **TIME-01**: User can set time format preference (12-hour or 24-hour)
- [ ] **TIME-02**: Time format preference persists in users table
- [ ] **TIME-03**: All timestamps display per user's time format preference
- [ ] **TIME-04**: Time inputs adapt to user's format (AM/PM vs 24hr)
- [ ] **TIME-05**: Time format settings UI with live preview

### Number Format

- [ ] **NUM-01**: User can set thousand separator preference (comma/period/space)
- [ ] **NUM-02**: User can set decimal separator preference (period/comma)
- [ ] **NUM-03**: Number format preferences persist in users table
- [ ] **NUM-04**: Inventory counts display using user's number format
- [ ] **NUM-05**: Quantities display using user's number format
- [ ] **NUM-06**: Prices display using user's number format
- [ ] **NUM-07**: Statistics display using user's number format
- [ ] **NUM-08**: Number inputs parse values according to user's format
- [ ] **NUM-09**: Number format settings UI with live preview

### Settings UI

- [ ] **SETTINGS-01**: Date format settings enhanced in user settings page
- [ ] **SETTINGS-02**: Time format settings section in user settings page
- [ ] **SETTINGS-03**: Number format settings section in user settings page
- [ ] **SETTINGS-04**: Live previews for each format setting
- [ ] **SETTINGS-05**: Format hooks exported (useTimeFormat, useNumberFormat)

## Future Requirements

Deferred to later milestones.

### Locale Presets

- **LOCALE-01**: Preset locale bundles (US, UK, EU, etc.)
- **LOCALE-02**: "Apply locale preset" quick action

### Advanced Number Formats

- **NUM-10**: Currency symbol preference
- **NUM-11**: Negative number format (parentheses vs minus)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automatic locale detection | User choice more explicit, avoids assumptions |
| Right-to-left (RTL) support | Not needed for current user base |
| Currency conversion | Exchange rates add complexity, out of scope |
| Regional date names | "January" vs "Januar" - translation out of scope |
| Week start day preference | Not critical for warehouse use case |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATE-01 | Phase 32 | Pending |
| DATE-02 | Phase 32 | Pending |
| DATE-03 | Phase 32 | Pending |
| DATE-04 | Phase 32 | Pending |
| DATE-05 | Phase 32 | Pending |
| DATE-06 | Phase 32 | Pending |
| DATE-07 | Phase 32 | Pending |
| DATE-08 | Phase 32 | Pending |
| DATE-09 | Phase 32 | Pending |
| DATE-10 | Phase 32 | Pending |
| TIME-01 | Phase 30 | Pending |
| TIME-02 | Phase 30 | Pending |
| TIME-03 | Phase 33 | Pending |
| TIME-04 | Phase 33 | Pending |
| TIME-05 | Phase 31 | Pending |
| NUM-01 | Phase 30 | Pending |
| NUM-02 | Phase 30 | Pending |
| NUM-03 | Phase 30 | Pending |
| NUM-04 | Phase 34 | Pending |
| NUM-05 | Phase 34 | Pending |
| NUM-06 | Phase 34 | Pending |
| NUM-07 | Phase 34 | Pending |
| NUM-08 | Phase 34 | Pending |
| NUM-09 | Phase 31 | Pending |
| SETTINGS-01 | Phase 31 | Pending |
| SETTINGS-02 | Phase 31 | Pending |
| SETTINGS-03 | Phase 31 | Pending |
| SETTINGS-04 | Phase 31 | Pending |
| SETTINGS-05 | Phase 30 | Pending |

**Coverage:**
- v1.6 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0

---
*Requirements defined: 2026-02-08*
*Last updated: 2026-02-08 after roadmap created with phase traceability*
