---
status: complete
phase: 41-frontend-oauth-flow-and-connected-accounts
source: 41-01-SUMMARY.md, 41-02-SUMMARY.md
started: 2026-02-22T18:10:00Z
updated: 2026-02-22T18:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. SocialLogin Button Click (Google)
expected: On the login page, clicking "Continue with Google" navigates the browser to the backend OAuth initiate URL ({API_URL}/auth/oauth/google). The page performs a full redirect (not client-side navigation).
result: pass

### 2. SocialLogin Button Click (GitHub)
expected: On the login page, clicking "Continue with GitHub" navigates the browser to the backend OAuth initiate URL ({API_URL}/auth/oauth/github). The page performs a full redirect (not client-side navigation).
result: pass

### 3. OAuth Callback Success
expected: After completing OAuth authorization with a provider, the browser lands on /auth/callback with a code parameter. The page shows a loading spinner, exchanges the code for JWT tokens, loads user data, and redirects to the dashboard.
result: skipped
reason: User will test full OAuth flow later with live credentials

### 4. OAuth Callback Error
expected: If OAuth callback receives an error parameter (e.g., user cancelled authorization), the page redirects to /login with oauth_error in the URL, and the OAuthErrorHandler displays a user-friendly error message.
result: skipped
reason: User will test full OAuth flow later with live credentials

### 5. ReturnTo Redirect Preservation
expected: If the user was on a specific page before being redirected to login, after completing OAuth the browser returns to that original page instead of the dashboard.
result: skipped
reason: User will test full OAuth flow later with live credentials

### 6. Connected Accounts in Security Settings
expected: In Security settings, a "Connected Accounts" section appears between Password and Sessions. It shows linked OAuth providers (Google/GitHub) with their email and linked date.
result: skipped
reason: User will test full OAuth flow later with live credentials

### 7. Link New Provider
expected: Clicking "Link Account" on an unlinked provider navigates to the backend OAuth URL and after completing authorization, redirects back to Security settings (not dashboard).
result: skipped
reason: User will test full OAuth flow later with live credentials

### 8. Unlink Provider
expected: Clicking "Unlink" on a linked provider removes it from the list with a success toast notification.
result: skipped
reason: User will test full OAuth flow later with live credentials

### 9. Lockout Guard
expected: When only one OAuth provider is linked and the user has no password set, the Unlink button is disabled and a warning message explains that a password must be set first.
result: skipped
reason: User will test full OAuth flow later with live credentials

### 10. Set Password for OAuth-only User
expected: An OAuth-only user (no password set) sees "Set Password" form in Security settings without a "Current Password" field. After setting a password, the form switches to "Change Password" mode with the current password field.
result: skipped
reason: User will test full OAuth flow later with live credentials

## Summary

total: 10
passed: 2
issues: 0
pending: 0
skipped: 8

## Gaps

[none yet]
