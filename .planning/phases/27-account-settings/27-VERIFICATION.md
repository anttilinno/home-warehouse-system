---
phase: 27-account-settings
verified: 2026-02-03T21:45:00Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "Date format preference is applied throughout the application"
    status: partial
    reason: "Date formatting only applied in loans page, not in items detail page, items list CSV export, inventory, borrowers, containers, declutter, imports, and analytics pages"
    artifacts:
      - path: "frontend/app/[locale]/(dashboard)/dashboard/items/[id]/page.tsx"
        issue: "Lines 413, 417 use toLocaleDateString() instead of useDateFormat"
      - path: "frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx"
        issue: "Lines 780-781 CSV export formatter uses toLocaleDateString()"
      - path: "frontend/app/[locale]/(dashboard)/dashboard/inventory/page.tsx"
        issue: "Lines 915-916 CSV export formatter uses toLocaleDateString()"
      - path: "frontend/app/[locale]/(dashboard)/dashboard/borrowers/page.tsx"
        issue: "Lines 347-348 CSV export formatter uses toLocaleDateString()"
      - path: "frontend/app/[locale]/(dashboard)/dashboard/containers/page.tsx"
        issue: "Lines 585-586 CSV export formatter uses toLocaleDateString()"
      - path: "frontend/app/[locale]/(dashboard)/dashboard/declutter/page.tsx"
        issue: "Line 179 uses hardcoded yyyy-MM-dd format"
    missing:
      - "Import useDateFormat hook in items/[id]/page.tsx and use formatDate for created_at/updated_at display"
      - "Consider if CSV export columns should use user format or keep ISO (acceptable design decision)"
---

# Phase 27: Account Settings Verification Report

**Phase Goal:** Users can manage their profile and personalize their experience
**Verified:** 2026-02-03T21:45:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view and edit their full name from the settings page | VERIFIED | AccountSettings component (123 lines) at frontend/components/settings/account-settings.tsx with full_name field, zod validation, and authApi.updateProfile call |
| 2 | User can change their email address from the settings page | VERIFIED | AccountSettings component has email field wired to authApi.updateProfile, backend handler.go line 351 calls UpdateEmail |
| 3 | User can upload an avatar image that displays in the app header | VERIFIED | AvatarUpload component (207 lines) with drag-drop, backend POST/GET/DELETE /users/me/avatar endpoints, user-menu.tsx line 81 uses user.avatar_url |
| 4 | User can select a date format preference that persists across sessions | VERIFIED | DateFormatSettings component (107 lines) with radio group, saves via PATCH /users/me/preferences, useDateFormat hook reads from user.date_format |
| 5 | Date format preference is applied throughout the application | PARTIAL | Only loans/page.tsx uses useDateFormat hook (lines 401, 1062, 1072). Items detail page, CSV exports, and other pages still use toLocaleDateString() |

**Score:** 4/5 truths verified (1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/internal/domain/auth/user/handler.go` | Avatar endpoints | VERIFIED | 1116 lines, includes uploadAvatar (line 585), serveAvatar (line 713), deleteAvatar (line 770), updateMe with email (line 351) |
| `backend/internal/domain/auth/user/entity.go` | avatarPath field | VERIFIED | 196 lines, avatarPath *string field (line 23), AvatarPath() getter (line 115), UpdateAvatar() method (line 182), UpdateEmail() method (line 188) |
| `backend/internal/domain/auth/user/service.go` | UpdateAvatar, UpdateEmail | VERIFIED | 235 lines, ServiceInterface includes methods (lines 23-24), implementations at lines 214-234 |
| `backend/internal/domain/auth/user/avatar_storage.go` | AvatarStorageAdapter | VERIFIED | 49 lines, wraps GenericStorage for avatar operations |
| `backend/internal/api/router.go` | Avatar storage wiring | VERIFIED | Line 258-260 creates adapter and sets on handler |
| `frontend/lib/api/auth.ts` | Avatar API functions | VERIFIED | 93 lines, User type includes avatar_url (line 11), updateProfile (line 79), uploadAvatar (line 83), deleteAvatar (line 89) |
| `frontend/lib/api/client.ts` | postForm method | VERIFIED | 186 lines, postForm method at line 126 for multipart uploads |
| `frontend/components/settings/account-settings.tsx` | Profile form | VERIFIED | 123 lines, uses react-hook-form with zod, full_name/email fields, calls authApi.updateProfile |
| `frontend/components/settings/avatar-upload.tsx` | Avatar upload UI | VERIFIED | 207 lines, drag-drop handling, file validation (type + 2MB size), authApi.uploadAvatar/deleteAvatar calls |
| `frontend/components/settings/date-format-settings.tsx` | Date format selector | VERIFIED | 107 lines, RadioGroup with 3 options, live preview, saves via PATCH /users/me/preferences |
| `frontend/lib/hooks/use-date-format.ts` | Date formatting hook | VERIFIED | 90 lines, exports useDateFormat hook, formatDate, formatDateTime functions |
| `frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx` | Settings page integration | VERIFIED | 72 lines, imports and renders AccountSettings (line 50), DateFormatSettings (line 53) |
| `frontend/components/dashboard/user-menu.tsx` | Avatar in header | VERIFIED | 126 lines, AvatarImage src={user.avatar_url || undefined} at line 81 |
| `backend/db/queries/users.sql` | Avatar/email queries | VERIFIED | 65 lines, UpdateUserAvatar (line 54), UpdateUserEmail (line 60), all queries include avatar_path |
| `frontend/messages/en.json` | Translations | VERIFIED | settings.account (lines 604-626), settings.dateFormat (lines 631-636) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| account-settings.tsx | lib/api/auth.ts | authApi.updateProfile | WIRED | Line 56: `await authApi.updateProfile(data)` |
| avatar-upload.tsx | lib/api/auth.ts | authApi.uploadAvatar/deleteAvatar | WIRED | Lines 46, 60: `await authApi.uploadAvatar(file)`, `await authApi.deleteAvatar()` |
| settings/page.tsx | account-settings.tsx | import + render | WIRED | Lines 9, 50: import and `<AccountSettings />` |
| settings/page.tsx | date-format-settings.tsx | import + render | WIRED | Lines 10, 53: import and `<DateFormatSettings />` |
| user-menu.tsx | User.avatar_url | AvatarImage src | WIRED | Line 81: `src={user.avatar_url || undefined}` |
| loans/page.tsx | use-date-format.ts | useDateFormat hook | WIRED | Lines 23, 401: import and use, formatDate at lines 1062, 1072 |
| date-format-settings.tsx | backend | PATCH /users/me/preferences | WIRED | Lines 48-58: fetch with PATCH to preferences endpoint |
| handler.go | service.go | h.svc.UpdateAvatar/UpdateEmail | WIRED | Lines 351, 697, 799: service method calls |
| router.go | handler.go | SetAvatarStorage | WIRED | Line 259: `userHandler.SetAvatarStorage(avatarStorageAdapter)` |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| ACCT-01 (Profile management) | SATISFIED | Name/email editing working |
| ACCT-02 (Avatar upload) | SATISFIED | Upload/display/delete working |
| ACCT-03 (Date format preference) | PARTIAL | Preference saves/loads but not applied throughout app |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| items/[id]/page.tsx | 413, 417 | toLocaleDateString() | Warning | Dates ignore user preference |
| items/page.tsx | 780-781 | toLocaleDateString() | Info | CSV export ignores preference (may be intentional) |
| inventory/page.tsx | 915-916 | toLocaleDateString() | Info | CSV export ignores preference |
| borrowers/page.tsx | 347-348 | toLocaleDateString() | Info | CSV export ignores preference |
| containers/page.tsx | 585-586 | toLocaleDateString() | Info | CSV export ignores preference |
| declutter/page.tsx | 179 | format(parseISO(value), "yyyy-MM-dd") | Warning | Hardcoded format ignores preference |
| imports/[jobId]/page.tsx | 313, 318 | format(new Date(), "PPpp") | Info | Timestamp format (may be intentional) |

### Human Verification Required

#### 1. Avatar Upload End-to-End
**Test:** Log in, go to Settings, upload an avatar image (JPG/PNG/WebP under 2MB)
**Expected:** Avatar appears in the settings preview and in the header user menu
**Why human:** Requires actual file upload and visual verification

#### 2. Avatar Persistence
**Test:** Upload avatar, refresh page, log out and log back in
**Expected:** Avatar persists across sessions
**Why human:** Tests backend storage and retrieval

#### 3. Date Format Change
**Test:** Go to Settings > Date Format, select "DD/MM/YYYY", navigate to Loans page
**Expected:** Dates show in DD/MM/YYYY format (e.g., "03/02/2026" not "2026-02-03")
**Why human:** Requires visual verification of format change

#### 4. Profile Update
**Test:** Change full name in Account settings, save, check header user menu
**Expected:** Name updates in header dropdown
**Why human:** Requires visual verification

### Gaps Summary

**1 gap found blocking full goal achievement:**

The date format preference feature is implemented but not fully applied. The useDateFormat hook exists and works, but it's only used in the loans page. Other pages with date displays (notably items/[id]/page.tsx showing "Created" and "Last Updated") still use browser-default toLocaleDateString().

The SUMMARY for plan 27-03 incorrectly claimed "only loans/page.tsx has absolute date displays" -- items/[id]/page.tsx clearly displays Created and Last Updated dates in the UI.

**CSV export columns** (items/page.tsx, inventory/page.tsx, etc.) using toLocaleDateString may be a design choice -- exports often prefer machine-readable formats. This is noted but not necessarily a gap.

**Critical missing integration:**
- `frontend/app/[locale]/(dashboard)/dashboard/items/[id]/page.tsx` lines 413, 417 should use useDateFormat hook

---

*Verified: 2026-02-03T21:45:00Z*
*Verifier: Claude (gsd-verifier)*
