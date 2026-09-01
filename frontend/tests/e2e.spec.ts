import { test, expect } from '@playwright/test';

test.describe('IEEE SB-APP Full End-to-End Tests', () => {

  // We assume the app is running on localhost:5173 
  const BASE_URL = 'http://localhost:5173';

  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto(BASE_URL);
  });

  test('1. Landing Page renders and navigates to Login', async ({ page }) => {
    await expect(page).toHaveTitle(/IEEE/i); // Assuming the title contains IEEE
    const loginLink = page.getByRole('link', { name: /login/i }).first();
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/.*login/);
  });

  test('2. Registration Flow (Invalid & Valid)', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    
    // Test Invalid Registration
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/email is required/i)).toBeVisible();
    
    // Test Valid Registration (Mock user)
    const testEmail = `testuser_${Date.now()}@ieee.org`;
    await page.getByLabel(/full name/i).fill('Test E2E User');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill('TestPass123!');
    
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should navigate to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByText(/Test E2E User/i).first()).toBeVisible();
  });

  test('3. Login, Logout, and Session Persistence', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Assuming backend seed has an admin
    await page.getByLabel(/email/i).fill('admin@ieee.org');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Dashboard verification
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    
    // Refresh persistence
    await page.reload();
    await expect(page).toHaveURL(/.*dashboard/);

    // Logout
    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page).toHaveURL(/.*login/);
    
    // Verify protected route block
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/.*login/);
  });

  test('4. Events CRUD Lifecycle', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel(/email/i).fill('admin@ieee.org');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Navigate to Events
    await page.getByRole('link', { name: /events/i }).click();
    
    // Create Event
    await page.getByRole('button', { name: /create event/i }).click();
    await page.getByLabel(/title/i).fill('E2E Test Event');
    await page.getByLabel(/description/i).fill('This is an E2E testing event.');
    await page.getByLabel(/date/i).fill('2026-12-31');
    await page.getByRole('button', { name: /save/i }).click();
    
    // Verify Event Creation
    await expect(page.getByText('E2E Test Event')).toBeVisible();
  });

  test('5. Responsive Layout Checks (Mobile View)', async ({ page }) => {
    // Set viewport to iPhone size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/`);
    
    // Check for mobile menu hamburger
    const mobileMenuBtn = page.getByRole('button', { name: /menu/i });
    if (await mobileMenuBtn.isVisible()) {
      await mobileMenuBtn.click();
      await expect(page.getByRole('link', { name: /login/i }).first()).toBeVisible();
    }
  });

});
