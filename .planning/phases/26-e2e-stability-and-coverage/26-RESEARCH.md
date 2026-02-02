# Phase 26: E2E Stability and Coverage - Research

**Researched:** 2026-01-31
**Domain:** Playwright E2E Testing, Authentication, Test Stability
**Confidence:** HIGH

## Summary

The E2E test suite is well-structured with Page Object Models, fixture-based authentication, and comprehensive navigation tests. However, there are significant stability issues stemming from:

1. **Auth setup timing issues** - The `auth.setup.ts` uses a hardcoded `waitForTimeout(2000)` which is unreliable
2. **Excessive use of `waitForTimeout`** - Found 85+ instances across the test suite, creating flakiness
3. **Missing inventory page tests** - No `inventory.spec.ts` despite the page existing with full CRUD capabilities
4. **Missing full CRUD flow tests** - Existing tests check UI elements but don't complete actual create/update/delete operations

**Primary recommendation:** Replace hardcoded timeouts with proper auto-wait assertions and add comprehensive CRUD flow tests.

## Current Test Infrastructure

### Configuration Analysis

**playwright.config.ts** (HIGH confidence - direct code review):
```typescript
// Good: Project dependencies for auth
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },
  {
    name: 'chromium',
    use: { storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],
  },
  // ... firefox, webkit similar
]

// Good: Non-auth tests separated
{
  name: 'chromium-no-auth',
  testMatch: [/marketing\.spec\.ts/, /auth\/.*\.spec\.ts/, /smoke\.spec\.ts/],
}
```

| Setting | Value | Assessment |
|---------|-------|------------|
| timeout | 30000ms | Reasonable |
| retries | 2 (CI), 0 (local) | Good |
| workers | 1 (CI), undefined (local) | Conservative |
| trace | on-first-retry | Good for debugging |
| screenshot | only-on-failure | Appropriate |

### Auth Setup Analysis

**Current auth.setup.ts** (HIGH confidence - direct code review):
```typescript
// PROBLEM: Hardcoded timeout creates flakiness
await page.waitForTimeout(2000);

// PROBLEM: Conditional login fallback without proper waiting
if (!page.url().includes("/dashboard")) {
  await page.goto("/en/login");
  // ...login flow
}
```

**Issues identified:**
1. Uses `waitForTimeout(2000)` after registration - arbitrary delay
2. URL check without waiting for navigation to complete
3. No verification that user is actually authenticated before saving state
4. Registration may succeed but redirect slowly, causing false fallback to login

### Fixtures Architecture

**Three fixture levels** (HIGH confidence - code review):

| Fixture | Purpose | Auth Method |
|---------|---------|-------------|
| `fixtures/test.ts` | Non-authenticated tests | None |
| `fixtures/authenticated.ts` | Standard authenticated tests | storageState |
| `fixtures/roles.ts` | Role-based tests (admin/member/viewer) | Dynamic auth per role |

**Role fixture issues:**
- Authenticates dynamically per role, which can race with auth setup
- Uses try/catch for storageState existence - fragile pattern
- No session expiration handling

## Standard Stack

### Current Libraries

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| @playwright/test | latest | E2E testing framework | Installed |
| Page Object Model | custom | Page abstractions | 23 pages implemented |

### Recommended Patterns

**Authentication State Management** (HIGH confidence - [Playwright Docs](https://playwright.dev/docs/auth)):
```typescript
// Use waitForURL instead of waitForTimeout
await page.waitForURL(/\/dashboard/, { timeout: 10000 });

// Verify auth state before saving
await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
await page.context().storageState({ path: authFile });
```

**Reliable Waits** (HIGH confidence - [BrowserStack Guide](https://www.browserstack.com/guide/playwright-waitfortimeout)):
```typescript
// BAD: Arbitrary timeout
await page.waitForTimeout(500);

// GOOD: Condition-based wait
await expect(page.locator('.skeleton')).toBeHidden();
await expect(page.getByRole('table')).toBeVisible();
```

## Architecture Patterns

### Page Object Model Structure

**Current structure** (well-implemented):
```
e2e/
├── pages/           # 23 Page Object classes
│   ├── BasePage.ts  # Base class with locale support
│   └── *Page.ts     # Domain-specific pages
├── fixtures/        # Test fixtures
│   ├── test.ts      # Base fixture
│   ├── authenticated.ts  # Auth fixture
│   └── roles.ts     # Role-based fixture
├── helpers/         # Utility functions
├── dashboard/       # Dashboard tests (20 files)
├── auth/            # Auth flow tests
├── offline/         # Offline/sync tests (Chromium only)
└── features/        # Feature tests
```

### Recommended Test Organization

**Test file pattern for CRUD flows:**
```typescript
test.describe("Entity CRUD", () => {
  test.describe.configure({ mode: "serial" }); // CRUD tests often need order

  test("creates entity with all fields", async ({ page }) => {
    // Full create flow with verification
  });

  test("reads entity details", async ({ page }) => {
    // Verify created entity
  });

  test("updates entity", async ({ page }) => {
    // Edit and verify changes
  });

  test("deletes entity", async ({ page }) => {
    // Delete and verify removal
  });
});
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Waiting for data | `waitForTimeout(N)` | `expect(locator).toBeVisible()` | Built-in retry with timeout |
| Waiting for navigation | `waitForTimeout(N)` | `waitForURL(/pattern/)` | Proper navigation detection |
| Waiting for network | `waitForTimeout(N)` | `waitForLoadState('networkidle')` | Network-aware waiting |
| Element exists check | `.isVisible().catch()` | `expect(locator).toBeVisible({ timeout })` | Proper assertions |

## Common Pitfalls

### Pitfall 1: waitForTimeout Proliferation

**What goes wrong:** Tests pass locally but fail in CI due to timing differences
**Why it happens:** Developers add timeouts to "fix" flaky tests without understanding root cause
**How to avoid:**
- Replace ALL `waitForTimeout` with condition-based waits
- Use Playwright's auto-wait and assertion retries
- Only use timeout for debugging, never in committed code

**Found in codebase:** 85+ instances across 30+ files

### Pitfall 2: Auth Setup Racing

**What goes wrong:** First test fails because auth isn't ready
**Why it happens:** Auth setup saves state before authentication is verified
**How to avoid:**
- Wait for dashboard URL explicitly
- Verify user-specific content is visible
- Add explicit auth state verification before saving

**Current auth.setup.ts issues:**
- Line 22: `waitForTimeout(2000)` - arbitrary delay
- Line 26: URL check without proper wait

### Pitfall 3: Missing Assertions After Actions

**What goes wrong:** Tests pass even when actions fail silently
**Why it happens:** Click actions don't wait for side effects
**How to avoid:**
```typescript
// BAD
await button.click();
await page.waitForTimeout(500);

// GOOD
await button.click();
await expect(page.getByRole('dialog')).toBeVisible();
```

### Pitfall 4: Conditional Test Logic Without Verification

**What goes wrong:** Tests skip branches without verifying conditions
**Found pattern:**
```typescript
const hasTable = await table.isVisible().catch(() => false);
if (hasTable) {
  // ... test code
}
// If hasTable is false, test passes doing nothing
```

**How to avoid:**
```typescript
// Skip test explicitly if precondition not met
const rowCount = await rows.count();
if (rowCount === 0) {
  test.skip();
  return;
}
```

### Pitfall 5: SSE Connection Preventing networkidle

**What goes wrong:** `waitForLoadState('networkidle')` hangs forever
**Why it happens:** SSE connections keep network active
**Current solution in codebase:**
```typescript
// Good pattern already in navigation.spec.ts
await page.waitForLoadState("domcontentloaded");
await expect(shell.sidebar).toBeVisible();
```

## Code Examples

### Fixed Auth Setup Pattern

```typescript
// Source: Playwright best practices
import { test as setup, expect } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? "playwright@test.local";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? "TestPassword123!";
const AUTH_FILE = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  // Try registration first
  await page.goto("/en/register");
  await page.getByLabel(/full name/i).fill("Playwright Test User");
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.getByLabel(/confirm password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /create account/i }).click();

  // Wait for either success redirect OR error (user exists)
  await Promise.race([
    page.waitForURL(/\/dashboard/, { timeout: 10000 }),
    expect(page.getByText(/already exists|already registered/i)).toBeVisible({ timeout: 10000 })
      .catch(() => {}),
  ]);

  // If not on dashboard, user exists - login instead
  if (!page.url().includes("/dashboard")) {
    await page.goto("/en/login");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  }

  // CRITICAL: Verify authentication before saving state
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator('[data-testid="user-menu"]').or(
    page.getByRole('button', { name: /account|user|profile/i })
  )).toBeVisible({ timeout: 5000 });

  // Save authenticated state
  await page.context().storageState({ path: AUTH_FILE });
});
```

### CRUD Flow Test Pattern

```typescript
// Source: Playwright best practices
import { test, expect } from "../fixtures/authenticated";
import { InventoryPage } from "../pages/InventoryPage";

test.describe("Inventory CRUD", () => {
  test.describe.configure({ mode: "serial" });

  let inventoryPage: InventoryPage;
  let createdId: string;

  test("creates inventory entry", async ({ page }) => {
    inventoryPage = new InventoryPage(page);
    await inventoryPage.goto();
    await inventoryPage.waitForPageLoaded();

    // Open create dialog
    await inventoryPage.openCreateDialog();
    await expect(inventoryPage.createDialog).toBeVisible();

    // Fill form
    await inventoryPage.selectItem("first"); // Select first available
    await inventoryPage.selectLocation("first");
    await inventoryPage.setQuantity(5);
    await inventoryPage.setCondition("GOOD");

    // Submit and verify
    await inventoryPage.submitForm();
    await expect(inventoryPage.createDialog).toBeHidden();

    // Verify toast or table update
    await expect(page.getByText(/created|success/i)).toBeVisible({ timeout: 5000 });
  });

  test("updates inventory quantity inline", async ({ page }) => {
    inventoryPage = new InventoryPage(page);
    await inventoryPage.goto();
    await inventoryPage.waitForPageLoaded();

    // Find first row and edit quantity
    const firstRow = inventoryPage.getAllRows().first();
    await firstRow.locator('[data-testid="quantity-cell"]').click();

    // Inline edit
    await page.keyboard.selectAll();
    await page.keyboard.type("10");
    await page.keyboard.press("Enter");

    // Verify update
    await expect(page.getByText(/updated|saved/i)).toBeVisible({ timeout: 5000 });
  });
});
```

### Replacing waitForTimeout Pattern

```typescript
// BEFORE (flaky)
async waitForItemsLoaded(): Promise<void> {
  await this.page.waitForSelector('[class*="skeleton"]', { state: "hidden", timeout: 10000 }).catch(() => {});
  await this.pageTitle.waitFor({ state: "visible" });
}

// AFTER (stable)
async waitForItemsLoaded(): Promise<void> {
  // Wait for loading skeleton to disappear
  await expect(this.page.locator('[class*="skeleton"]').first()).toBeHidden({ timeout: 10000 });
  // Wait for content to be visible
  await expect(this.pageTitle).toBeVisible();
  // Wait for at least table or empty state
  await expect(
    this.itemsTable.or(this.emptyState)
  ).toBeVisible({ timeout: 10000 });
}
```

## Coverage Gap Analysis

### Existing Test Coverage

| Area | Tests | Coverage Level |
|------|-------|----------------|
| Navigation | navigation.spec.ts | HIGH - all nav items |
| Items | items.spec.ts | MEDIUM - UI only, no CRUD completion |
| Locations | locations.spec.ts | MEDIUM - UI only, no CRUD completion |
| Containers | containers.spec.ts | MEDIUM - UI only, no CRUD completion |
| Categories | categories.spec.ts | MEDIUM - UI only, no CRUD completion |
| Loans | loans.spec.ts | MEDIUM - UI only, no CRUD completion |
| Borrowers | borrowers.spec.ts | MEDIUM - UI only, no CRUD completion |
| Auth | login.spec.ts, register.spec.ts | HIGH |
| Approvals | approvals.spec.ts, approval-detail.spec.ts | MEDIUM |
| Imports | imports.spec.ts, import-detail.spec.ts | MEDIUM |
| Offline | 9 files | HIGH (Chromium only) |

### Missing Coverage

| Area | Gap | Priority |
|------|-----|----------|
| **Inventory** | No inventory.spec.ts despite full page | HIGH |
| **Item CRUD** | Tests open dialogs but don't submit | HIGH |
| **Location CRUD** | Tests open dialogs but don't submit | HIGH |
| **Container CRUD** | Tests open dialogs but don't submit | MEDIUM |
| **Loan CRUD** | Tests open dialogs but don't submit | HIGH |
| **Borrower CRUD** | Tests open dialogs but don't submit | MEDIUM |
| **Category CRUD** | Tests open dialogs but don't submit | MEDIUM |
| **Multi-entity flows** | No tests for "create loan with borrower" | MEDIUM |
| **Error handling** | Few tests for validation errors, API failures | LOW |

### Flaky Test Indicators

**Files with 3+ waitForTimeout calls** (highest risk):
- e2e/features/theme.spec.ts (7 instances)
- e2e/dashboard/categories-dnd.spec.ts (7 instances)
- e2e/dashboard/approval-detail.spec.ts (5 instances)
- e2e/auth/register.spec.ts (3 instances)
- e2e/offline/sync.spec.ts (1 instance, but critical)
- e2e/auth.setup.ts (1 instance, CRITICAL - affects all tests)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `waitForTimeout()` | `expect().toBeVisible()` | Playwright 1.20+ | Eliminates arbitrary waits |
| Global setup file | Project dependencies | Playwright 1.30+ | Better isolation |
| Manual auth per test | storageState reuse | Playwright 1.0+ | 60-80% faster tests |
| `page.$(selector)` | `page.locator()` | Playwright 1.14+ | Stricter selectors |

## Open Questions

### 1. Test Data Management

**What we know:** Tests assume data exists or handle empty state gracefully
**What's unclear:** Should tests create their own test data or rely on seed data?
**Recommendation:** For CRUD tests, create data at start, clean up at end. Use `test.describe.configure({ mode: "serial" })` for dependent tests.

### 2. Multi-Browser Offline Tests

**What we know:** Offline tests are Chromium-only due to inconsistent simulation
**What's unclear:** Is this a Playwright limitation or fixable?
**Recommendation:** Keep Chromium-only skip for now, document as known limitation

### 3. CI Performance

**What we know:** Workers set to 1 in CI for stability
**What's unclear:** Can we increase parallelization safely?
**Recommendation:** After fixing auth timing, test with workers: 2 in CI

## Sources

### Primary (HIGH confidence)
- playwright.config.ts - Direct code review
- e2e/auth.setup.ts - Direct code review
- e2e/fixtures/*.ts - Direct code review
- e2e/dashboard/*.spec.ts - Direct code review (20 files)
- [Playwright Authentication Docs](https://playwright.dev/docs/auth)

### Secondary (MEDIUM confidence)
- [BrowserStack: Why You Shouldn't Use waitForTimeout](https://www.browserstack.com/guide/playwright-waitfortimeout)
- [Better Stack: Avoiding Flaky Tests](https://betterstack.com/community/guides/testing/avoid-flaky-playwright-tests/)
- [Checkly: Authentication Management](https://www.checklyhq.com/docs/learn/playwright/authentication/)

### Tertiary (LOW confidence)
- Community patterns from web search - validated against official docs

## Metadata

**Confidence breakdown:**
- Auth setup fixes: HIGH - well-documented Playwright patterns
- waitForTimeout replacement: HIGH - official Playwright guidance
- Coverage gaps: HIGH - direct code analysis
- CRUD test patterns: MEDIUM - community patterns, needs validation

**Research date:** 2026-01-31
**Valid until:** 60 days (Playwright API stable)

## Recommendations Summary

### E2E-01: Auth Setup Timing (Priority 1)
1. Remove `waitForTimeout(2000)` from auth.setup.ts
2. Add proper `waitForURL` with timeout
3. Verify auth state before saving storageState
4. Add user menu visibility check

### E2E-02: Flaky Test Stabilization (Priority 2)
1. Replace ALL `waitForTimeout` calls with proper waits
2. Focus on files with 3+ instances first
3. Use `expect().toBeVisible()` instead of `.isVisible().catch()`
4. Add explicit assertions after actions

### E2E-03: Missing User Flow Tests (Priority 3)
1. Create inventory.spec.ts with full CRUD coverage
2. Add actual CRUD completion to existing tests
3. Test complete flows: item create -> inventory create -> loan create
4. Add validation error tests
