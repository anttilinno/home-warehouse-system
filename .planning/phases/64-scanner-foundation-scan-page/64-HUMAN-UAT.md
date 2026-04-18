---
status: partial
phase: 64-scanner-foundation-scan-page
source: [64-VERIFICATION.md]
started: 2026-04-18T18:37:59Z
updated: 2026-04-18T18:37:59Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. iOS Safari real device — decode → SCAN AGAIN → second decode without permission re-prompt
expected: Two consecutive decodes on the same session, camera permission prompted at most once (SCAN-01 device truth)
result: [pending]

### 2. iOS Safari real device — first beep after cold load is audible
expected: First decode beep audible on iOS (validates D-08 AudioContext prime via pointerdown works in Safari's autoplay policy)
result: [pending]

### 3. Android Chrome torch hardware — applyConstraints turns flashlight ON/OFF
expected: Torch toggle visible on torch-capable rear camera, tap turns physical flashlight ON; tap again turns it OFF (SCAN-04 hardware wiring — visual aria-pressed already automated; this validates the device-side applyConstraints)
result: [pending]

### 4. Android Chrome — navigator.vibrate pulse felt on decode
expected: Short haptic pulse felt when a barcode decodes (SCAN-03 device truth)
result: [pending]

### 5. Real device — QR / UPC-A / EAN-13 / Code128 decode within 1s
expected: Each of the 4 supported formats decodes within 1 second under good lighting (SCAN-02 perf truth)
result: [pending]

### 6. iOS + Android — camera permission denied → panel renders + USE MANUAL ENTRY works
expected: Denying OS-level camera permission shows permission-denied ScanErrorPanel variant with platform-specific instructions; USE MANUAL ENTRY button navigates to MANUAL tab
result: [pending]

### 7. Offline / network-throttled load — library-init-fail panel + RETRY
expected: With network throttled so the scanner chunk fails to load, library-init-fail panel renders (red HazardStripe); RETRY re-runs initBarcodePolyfill via scannerKey bump and unblocks the scanner subtree once the chunk is reachable
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
