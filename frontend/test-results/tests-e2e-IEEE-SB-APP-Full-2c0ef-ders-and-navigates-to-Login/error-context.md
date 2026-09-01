# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e.spec.ts >> IEEE SB-APP Full End-to-End Tests >> 1. Landing Page renders and navigates to Login
- Location: tests\e2e.spec.ts:13:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('link', { name: /login/i }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('link', { name: /login/i }).first()

```

```yaml
- banner:
  - text: IEEE IEEE Campus Community Hub
  - navigation:
    - link "Features":
      - /url: "#features"
    - link "Societies":
      - /url: "#societies"
    - link "Roles":
      - /url: "#roles"
    - link "FAQ":
      - /url: "#faq"
  - button "Toggle theme":
    - img
  - link "Log in":
    - /url: /login
    - img
    - text: Log in
  - link "Get started":
    - /url: /register
    - button "Get started"
- img
- img
- text: IEEE Student Branch · Christ University Kengeri Campus
- heading "One platform for every society, every report, every conversation" [level=1]
- paragraph: IEEE Campus Community Hub replaces scattered spreadsheets, WhatsApp threads, and Discord servers with a single, role-aware workspace built for the real IEEE hierarchy — from general members to the SB Faculty Advisor.
- link "Get Started":
  - /url: /register
  - button "Get Started"
- link "Explore Features":
  - /url: "#features"
  - button "Explore Features"
- text: ieee-sb-kengeri.org/dashboard SB IEEE SB Kengeri
- navigation:
  - img
  - text: Dashboard
  - img
  - text: Finance
  - img
  - text: Events
  - img
  - text: Projects
  - img
  - text: Community
  - img
  - text: Reports
- text: RBAC SECURED · v1.0
- heading "Campus Events & Workshops" [level=3]
- paragraph: IEEE Student Branch · Unified Activity Tracker
- text: Calendar + Create Event Total Events 24 Upcoming 8 Registrations 1,240 Date Event Title Status 2026-08-15 Annual Tech Summit 2026 Upcoming 2026-08-10 Autonomous Robotics Workshop Registration Open 2026-08-02 Women in Tech Hackathon Completed Syncing across 49 Societies Unified Calendar Connected Platform Modules
- heading "Everything your Student Branch needs, in one place." [level=2]
- paragraph: Built for the real structure of IEEE Student Branches — society-wise management, built-in community hub, financial analytics, event and project workflows, and a smart report clearance system.
- img
- heading "Unified Events & Workshops" [level=3]
- paragraph: Schedule flagship tech summits, hands-on workshops, venue bookings, and speaker sessions across 49 engineering chapters seamlessly.
- text: Unified Calendar Sync
- img
- heading "Event Management" [level=3]
- paragraph: Create and schedule events, track speakers and attendees, manage budget vs. actuals, generate certificates, and view a calendar.
- text: Budget vs. actuals tracking
- img
- heading "Project Management" [level=3]
- paragraph: Register projects, track grants and scholarships, manage milestones and deliverables, and attach supporting documents.
- text: Milestone & grant tracking
- img
- heading "Community Hub" [level=3]
- paragraph: Our in-house replacement for Discord. Society-wise channels, threaded discussions, announcements, file sharing, polls, and reactions.
- text: No Discord needed Interactive Showcase
- heading "Role-aware access across every module" [level=3]
- paragraph: Each user sees exactly what their IEEE role permits — nothing more, nothing less. The UI adapts automatically to role and society scope without any manual configuration.
- button "Events Queue"
- button "Project Grants"
- button "Community Hub"
- button "Analytics"
- list:
  - listitem:
    - img
    - strong: "Society-scoped isolation:"
    - text: Treasurers access only their society's data.
  - listitem:
    - img
    - strong: "Clearance workflows:"
    - text: Every report moves through a defined approval chain.
- text: Report Clearance Queue 2 Pending Review Annual Tech Summit — Event Report Submitted by Secretary · 2026-07-06 ₹42,050 📄 event_report_techsummit.pdf (1.8 MB) Preview
- button "Request Changes"
- button "Approve Report"
- text: IEEE Societies
- heading "Every society gets its own space" [level=2]
- paragraph: Each society manages its own finances, events, projects, and community channels — scoped and isolated by role. The SB retains full oversight and audit capabilities across all societies.
- text: IEEE-CS
- heading "Computer Society" [level=4]
- paragraph: Hackathons, programming bootcamps, developer workshops, and technical certification drives.
- text: IEEE-RAS
- heading "Robotics & Automation" [level=4]
- paragraph: Robocon teams, sensor arrays, drone projects, lab procurement, and automation research.
- text: IEEE-WIE
- heading "Women in Engineering" [level=4]
- paragraph: Leadership panels, diversity mixers, mentorship programs, and international conference participation.
- text: IEEE-PES
- heading "Power & Energy Society" [level=4]
- paragraph: Clean energy projects, grid simulations, solar cell research, and industry site visits.
- text: Role Hierarchy
- heading "Your IEEE role is your access key" [level=2]
- paragraph: The platform mirrors the real IEEE organizational structure. Every user's access is derived from their actual IEEE role — no manual configuration, no guesswork.
- text: Faculty Advisors
- paragraph: SB Faculty Advisor and Society Faculty Advisors with full or society-scoped administrative access.
- separator
- list:
  - listitem:
    - img
    - text: Full platform access (SB FA) or society-scoped admin (Society FA)
  - listitem:
    - img
    - text: Approve reports & finances
  - listitem:
    - img
    - text: Send global announcements
  - listitem:
    - img
    - text: AI-powered analytics dashboard
- link "Register as Faculty Advisor":
  - /url: /register
  - button "Register as Faculty Advisor"
- text: Primary Users Office Bearers
- paragraph: Society OBs (Chair, Vice Chair, Secretary, Treasurer, Webmaster) and SB OBs — the core operators of the platform.
- separator
- list:
  - listitem:
    - img
    - strong: Role-specific access
    - text: — Chair, Treasurer, Secretary all see different scopes
  - listitem:
    - img
    - text: Manage events, projects, and reports
  - listitem:
    - img
    - text: Submit reports for clearance workflow
  - listitem:
    - img
    - text: Full Community Hub access
  - listitem:
    - img
    - text: Real-time notifications & announcements
- link "Get Started":
  - /url: /register
  - button "Get Started"
- text: IEEE Members
- paragraph: General IEEE members and society members with access to their society's community and relevant announcements.
- separator
- list:
  - listitem:
    - img
    - text: Access society community channels
  - listitem:
    - img
    - text: View events and project updates
  - listitem:
    - img
    - text: Receive announcements & notifications
  - listitem:
    - img
    - text: Participate in polls and discussions
- link "Join as IEEE Member":
  - /url: /register
  - button "Join as IEEE Member"
- text: Got Questions?
- heading "Frequently Asked Questions" [level=2]
- button "What is IEEE Campus Community Hub?":
  - text: What is IEEE Campus Community Hub?
  - img
- button "Who can use this platform?":
  - text: Who can use this platform?
  - img
- button "How does the role-based access system work?":
  - text: How does the role-based access system work?
  - img
- button "What happens to our Discord server?":
  - text: What happens to our Discord server?
  - img
- button "How does the report clearance workflow work?":
  - text: How does the report clearance workflow work?
  - img
- paragraph: Have questions about setting up your society or configuring roles?
- link "Contact the IEEE SB Team →":
  - /url: mailto:ieee@christkengeri.edu.in
- img
- heading "Run your Student Branch the right way" [level=2]
- paragraph: No more scattered spreadsheets or informal WhatsApp approvals. IEEE Finance Pro gives every society, every OB, and every member exactly the workspace they need.
- link "Get started with IEEE Campus Community Hub":
  - /url: /register
  - button "Get started with IEEE Campus Community Hub"
- contentinfo:
  - text: IEEE IEEE Campus Community Hub
  - paragraph: The unified platform for IEEE Student Branch, Christ University Kengeri Campus — events, projects, reports, and community in one place.
  - paragraph: © 2026 IEEE SB, Christ University Kengeri. All rights reserved.
  - heading "Modules" [level=5]
  - list:
    - listitem:
      - link "Finance Management":
        - /url: "#features"
    - listitem:
      - link "Event Management":
        - /url: "#features"
    - listitem:
      - link "Project Management":
        - /url: "#features"
    - listitem:
      - link "Community Hub":
        - /url: "#features"
    - listitem:
      - link "Reports & Clearance":
        - /url: "#features"
    - listitem:
      - link "Member Management":
        - /url: "#features"
  - heading "IEEE Societies" [level=5]
  - list:
    - listitem: Computer Society (CS)
    - listitem: Robotics & Automation (RAS)
    - listitem: Women in Engineering (WIE)
    - listitem: Power & Energy (PES)
    - listitem: + More societies
  - heading "Quick Links" [level=5]
  - list:
    - listitem:
      - link "Log In":
        - /url: /login
    - listitem:
      - link "Register":
        - /url: /register
    - listitem:
      - link "Role Hierarchy":
        - /url: "#roles"
    - listitem:
      - link "FAQ":
        - /url: "#faq"
    - listitem:
      - link "Contact SB Team":
        - /url: mailto:ieee@christkengeri.edu.in
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
> 16  |     await expect(loginLink).toBeVisible();
      |                             ^ Error: expect(locator).toBeVisible() failed
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
  45  |     await page.getByLabel(/email/i).fill('admin@ieee.org');
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