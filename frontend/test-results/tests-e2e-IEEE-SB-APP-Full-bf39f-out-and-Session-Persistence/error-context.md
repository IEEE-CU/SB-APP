# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e.spec.ts >> IEEE SB-APP Full End-to-End Tests >> 3. Login, Logout, and Session Persistence
- Location: tests\e2e.spec.ts:41:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel(/email/i)

```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - button "Toggle Theme" [ref=f1e4] [cursor=pointer]
  - generic [ref=f1e7]:
    - generic [ref=f1e8]:
      - generic [ref=f1e9]: IEEE
      - heading "IEEE Campus Community Hub" [level=1] [ref=f1e10]
      - paragraph [ref=f1e11]: Empowering student branches & engineering societies
    - generic [ref=f1e16]:
      - heading "Sign in" [level=2] [ref=f1e17]
      - generic [ref=f1e18]:
        - generic [ref=f1e19]:
          - generic [ref=f1e20]: Email
          - textbox "you@example.com" [ref=f1e21]
        - generic [ref=f1e22]:
          - generic [ref=f1e23]: Password
          - textbox "Min 8 characters" [ref=f1e24]
        - button "Sign in" [ref=f1e25] [cursor=pointer]
      - paragraph [ref=f1e26]:
        - text: Don't have an account?
        - link "Sign up" [ref=f1e27] [cursor=pointer]:
          - /url: /register
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('IEEE SB-APP Full End-to-End Tests', () => {
  4   | 
  5   |   // We assume the app is running on localhost:5173 
  6   |   const BASE_URL = 'http://localhost:5173';
  7   | 
  8   |   test.beforeEach(async ({ page }) => {
  9   |     // Navigate to the app before each test
  10  |     await page.goto(BASE_URL);
  11  |   });
  12  | 
  13  |   test('1. Landing Page renders and navigates to Login', async ({ page }) => {
  14  |     await expect(page).toHaveTitle(/IEEE/i); // Assuming the title contains IEEE
  15  |     const loginLink = page.getByRole('link', { name: /login/i }).first();
  16  |     await expect(loginLink).toBeVisible();
  17  |     await loginLink.click();
  18  |     await expect(page).toHaveURL(/.*login/);
  19  |   });
  20  | 
  21  |   test('2. Registration Flow (Invalid & Valid)', async ({ page }) => {
  22  |     await page.goto(`${BASE_URL}/register`);
  23  |     
  24  |     // Test Invalid Registration
  25  |     await page.getByRole('button', { name: /create account/i }).click();
  26  |     await expect(page.getByText(/email is required/i)).toBeVisible();
  27  |     
  28  |     // Test Valid Registration (Mock user)
  29  |     const testEmail = `testuser_${Date.now()}@ieee.org`;
  30  |     await page.getByLabel(/full name/i).fill('Test E2E User');
  31  |     await page.getByLabel(/email/i).fill(testEmail);
  32  |     await page.getByLabel(/password/i).fill('TestPass123!');
  33  |     
  34  |     await page.getByRole('button', { name: /create account/i }).click();
  35  |     
  36  |     // Should navigate to dashboard
  37  |     await expect(page).toHaveURL(/.*dashboard/);
  38  |     await expect(page.getByText(/Test E2E User/i).first()).toBeVisible();
  39  |   });
  40  | 
  41  |   test('3. Login, Logout, and Session Persistence', async ({ page }) => {
  42  |     await page.goto(`${BASE_URL}/login`);
  43  |     
  44  |     // Assuming backend seed has an admin
> 45  |     await page.getByLabel(/email/i).fill('admin@ieee.org');
      |                                     ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  46  |     await page.getByLabel(/password/i).fill('admin123');
  47  |     await page.getByRole('button', { name: /sign in/i }).click();
  48  |     
  49  |     // Dashboard verification
  50  |     await expect(page).toHaveURL(/.*dashboard/);
  51  |     await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  52  |     
  53  |     // Refresh persistence
  54  |     await page.reload();
  55  |     await expect(page).toHaveURL(/.*dashboard/);
  56  | 
  57  |     // Logout
  58  |     await page.getByRole('button', { name: /logout/i }).click();
  59  |     await expect(page).toHaveURL(/.*login/);
  60  |     
  61  |     // Verify protected route block
  62  |     await page.goto(`${BASE_URL}/dashboard`);
  63  |     await expect(page).toHaveURL(/.*login/);
  64  |   });
  65  | 
  66  |   test('4. Events CRUD Lifecycle', async ({ page }) => {
  67  |     // Login first
  68  |     await page.goto(`${BASE_URL}/login`);
  69  |     await page.getByLabel(/email/i).fill('admin@ieee.org');
  70  |     await page.getByLabel(/password/i).fill('admin123');
  71  |     await page.getByRole('button', { name: /sign in/i }).click();
  72  |     await expect(page).toHaveURL(/.*dashboard/);
  73  |     
  74  |     // Navigate to Events
  75  |     await page.getByRole('link', { name: /events/i }).click();
  76  |     
  77  |     // Create Event
  78  |     await page.getByRole('button', { name: /create event/i }).click();
  79  |     await page.getByLabel(/title/i).fill('E2E Test Event');
  80  |     await page.getByLabel(/description/i).fill('This is an E2E testing event.');
  81  |     await page.getByLabel(/date/i).fill('2026-12-31');
  82  |     await page.getByRole('button', { name: /save/i }).click();
  83  |     
  84  |     // Verify Event Creation
  85  |     await expect(page.getByText('E2E Test Event')).toBeVisible();
  86  |   });
  87  | 
  88  |   test('5. Responsive Layout Checks (Mobile View)', async ({ page }) => {
  89  |     // Set viewport to iPhone size
  90  |     await page.setViewportSize({ width: 375, height: 667 });
  91  |     await page.goto(`${BASE_URL}/`);
  92  |     
  93  |     // Check for mobile menu hamburger
  94  |     const mobileMenuBtn = page.getByRole('button', { name: /menu/i });
  95  |     if (await mobileMenuBtn.isVisible()) {
  96  |       await mobileMenuBtn.click();
  97  |       await expect(page.getByRole('link', { name: /login/i }).first()).toBeVisible();
  98  |     }
  99  |   });
  100 | 
  101 | });
  102 | 
```