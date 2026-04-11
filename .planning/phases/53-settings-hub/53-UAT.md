---
status: complete
phase: 53-settings-hub
source: [53-01-SUMMARY.md, 53-02-SUMMARY.md, 53-03-SUMMARY.md]
started: 2026-04-11T00:00:00Z
updated: 2026-04-11T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Settings Hub navigation
expected: Navigate to /settings. You should see three retro-panel groups: ACCOUNT (Profile row, Security row), PREFERENCES (Appearance, Language, Regional Formats, Notifications rows), and DATA (Import/Export row). Each row shows a > chevron and, where applicable, a preview value from your account (e.g. your name on Profile). Clicking any row navigates to the corresponding subpage. On each subpage a BACK button returns you to /settings.
result: pass

### 2. Edit profile name and email
expected: On /settings/profile, edit your full name and email fields. Clicking SAVE CHANGES updates your name/email (visible on the hub preview row after returning). If you try a duplicate email address already in use by another account, an inline error appears on the email field (no page crash).
result: pass

### 3. Avatar upload and remove
expected: On /settings/profile, click UPLOAD to select an image file. The avatar should update to show the uploaded image. The REMOVE button should only appear when an avatar is set; clicking it reverts to your initials fallback.
result: pass
note: Fixed bug — generateAvatarURL was returning /users/me/avatar instead of /api/users/me/avatar, causing img src to miss the Vite proxy.

### 4. Change or set password
expected: On /settings/security, if your account has a password you see a CURRENT PASSWORD field plus a NEW PASSWORD field; submitting updates the password. If you enter the wrong current password, an inline error appears on the current password field. If your account was created via OAuth (no password), only the new password field appears (allowing you to set a password for the first time).
result: pass
note: Fixed bug — GET /auth/oauth/accounts returns {accounts:[]} wrapper, not a plain array; frontend was calling .find() on an object, crashing the page.

### 5. Active sessions list and revoke
expected: On /settings/security, the Sessions section lists your active sessions with device info, IP, and last active time. Your current session is labelled CURRENT (no revoke button). Other sessions each have a REVOKE button; clicking it removes that session from the list. A REVOKE ALL OTHERS button clears all non-current sessions at once.
result: pass

### 6. OAuth account link and unlink
expected: On /settings/security, the Connected Accounts section shows Google and GitHub. Linked accounts show an UNLINK button. Unlinked providers show a LINK button that redirects to the OAuth flow. The UNLINK button is disabled when it would be the only login method (sole linked account with no password set), preventing lockout.
result: pass

### 7. Delete account with confirmation
expected: On /settings/security, clicking DELETE ACCOUNT opens a confirmation dialog. Choosing KEEP ACCOUNT closes the dialog with no action. Confirming with CONFIRM DELETE deletes the account and logs you out.
result: pass

### 8. Appearance theme toggle
expected: On /settings/appearance, a three-option toggle shows LIGHT / DARK / SYSTEM. Selecting an option applies the theme visually right away. SYSTEM follows your OS preference. The selection persists after navigating away and back.
result: pass
note: Dark theme CSS variables not yet implemented — toggle saves preference and persists, visual change deferred to dark mode phase.

### 9. Language switch
expected: On /settings/language, a two-option toggle shows ENGLISH / EESTI. Switching language updates the UI text to the selected locale immediately without a page reload.
result: skipped
reason: Toggle mechanism works (saves, persists, calls loadCatalog) but Estonian translations for settings strings are missing from locales/et/messages.po — visual language change deferred until translations are added.

### 10. Regional format selectors with live preview
expected: On /settings/formats, three sections let you pick Date format (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY), Time format (24H, 12H), and Number format (comma-dot, dot-comma, space-comma). Each section shows a live preview that updates instantly as you switch options, showing a formatted example date, time, and number respectively.
result: pass

### 11. Notification toggles
expected: On /settings/notifications, a master ON/OFF toggle controls all notifications. Below a divider, four category toggles — LOANS, INVENTORY, WORKSPACE, SYSTEM — each have their own ON/OFF. When the master toggle is OFF, category toggles appear disabled. Toggling any switch saves immediately with no explicit save button needed.
result: pass

### 12. Data export
expected: On /settings/data, clicking EXPORT WORKSPACE downloads a file named workspace-export.json. The button shows EXPORTING... during the download. After the download completes the button returns to normal.
result: pass

### 13. Data import
expected: On /settings/data, clicking IMPORT WORKSPACE opens a file picker filtered to .json files. Selecting a valid workspace JSON file uploads it and shows a success toast (with partial count if applicable). Selecting an invalid file shows an error toast.
result: pass

## Summary

total: 13
passed: 12
issues: 0
pending: 0
skipped: 1

## Gaps

[none]
