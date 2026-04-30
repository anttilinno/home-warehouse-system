---
status: complete
phase: 59-borrowers-crud
source: [59-01-SUMMARY.md, 59-02-SUMMARY.md, 59-03-SUMMARY.md, 59-04-SUMMARY.md]
started: 2026-04-16T13:00:00Z
updated: 2026-04-16T17:52:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Borrowers list page loads
expected: Navigate to /borrowers. Page shows "BORROWERS" heading, "+ NEW BORROWER" button, "Show archived" checkbox, and a NAME/EMAIL/PHONE/ACTIONS table (or "NO BORROWERS YET" empty state if empty).
result: pass

### 2. Create a new borrower
expected: Click "+ NEW BORROWER". A slide-over panel opens with title "NEW BORROWER" and fields for Name (required), Email, Phone, Notes. Fill in at least a name and submit with "CREATE BORROWER". The panel closes and the new borrower appears in the list.
result: pass

### 3. Missing email/phone shows em-dash
expected: A borrower created without email or phone shows — (em-dash) in those table columns rather than being blank. On the borrower's detail page, the missing fields also show —.
result: pass

### 4. Edit a borrower
expected: Click EDIT on an active borrower row. The slide-over opens with title "EDIT BORROWER" and fields pre-filled with that borrower's data. Change a field and click "SAVE BORROWER". The panel closes and the list reflects the updated data.
result: pass

### 5. Archive a borrower
expected: Click ARCHIVE on an active borrower row. A confirmation dialog appears with title "ARCHIVE BORROWER" and a "HIDES FROM LOAN PICKERS" badge. Confirm — the borrower disappears from the active list.
result: issue
reported: "Dialog title is 'CONFIRM ARCHIVE' not 'ARCHIVE BORROWER'"
severity: cosmetic

### 6. Show archived toggle reveals archived borrowers
expected: Check the "Show archived" checkbox. Previously archived borrowers appear in the table with strikethrough (line-through) text, a grey colour, and an ARCHIVED badge. RESTORE and DELETE buttons appear instead of EDIT/ARCHIVE.
result: issue
reported: "Archived rows are greyed (rgb(139,139,139)) but have no strikethrough — text-decoration is 'none'. Badge, grey colour, and RESTORE/DELETE buttons all correct."
severity: minor

### 7. Restore a borrower
expected: In archived view (toggle on), click RESTORE on an archived row. The borrower moves back to the active list immediately (no confirmation dialog). Uncheck "Show archived" — the borrower is visible and active again.
result: pass

### 8. Delete a borrower (archive-first flow)
expected: In archived view, click DELETE on an archived borrower. The archive-first dialog opens. Follow the secondary "delete permanently" link. A destructive confirmation dialog appears ("DELETE BORROWER"). Confirm — the borrower is permanently removed and no longer appears even with the archived toggle on.
result: pass

### 9. Delete blocked by active loans
expected: Try to permanently delete a borrower who has active loans. After confirming the delete dialog, a toast appears: "Cannot delete: this borrower has active loans." The borrower remains in the system.
result: pass

### 10. Borrower detail page — contact info
expected: Click a borrower's name link in the list. Navigation goes to /borrowers/:id. The detail page shows a back link "← BORROWERS", the borrower's name as a heading, a CONTACT section with EMAIL / PHONE / NOTES rows (showing values or — for missing), and two empty-state sections: "ACTIVE LOANS" and "LOAN HISTORY" (both showing placeholder copy like "Loan data will be available soon.").
result: pass

### 11. Borrower not found
expected: Navigate directly to /borrowers/<invalid-or-nonexistent-id>. The page shows a "BORROWER NOT FOUND" error state with a "BACK TO BORROWERS" link. Clicking the link returns to /borrowers.
result: pass

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0

## Gaps

None — all issues resolved in commit eca91c2.
