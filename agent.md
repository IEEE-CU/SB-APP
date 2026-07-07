# IEEE Finance Pro — Agent Context & API Contract (v1)
### Shared source of truth for Teams 1–5 · Coding Agent Instructions

---

---

## System Prompt Prefix (paste before every task you give your agent)

```
Before doing anything else, locate and read `agent.md` in this repository (root, or `/docs/agent.md`). Treat everything in it as binding project context that applies to all work in this repo, not just this one task:

- Section 2 (Locked API Contract): every route you write or modify must match these envelopes, field names, status codes, and error codes exactly. Never invent an alternate shape.
- Section 3 (RBAC integration): any route that touches protected data must import and apply `requirePermission` / `attachScope` from Team 5's middleware — never write your own inline role check.
- Section 5 (Verification & Quality Gates): before you consider any task done, make sure it satisfies the pre-merge checklist — contract compliance, negative-path tests, RBAC matrix check if relevant, `/health` still passing.
- Section 6 (Security Checkpoints): apply these by default on every route you touch — input validation, no mass assignment, no IDOR, rate limiting on auth-adjacent routes, no secrets or stack traces in responses — even if my task prompt below doesn't mention security explicitly.

Now complete the task below, fully consistent with agent.md. If the task conflicts with anything in agent.md, or requires something agent.md doesn't cover (a new field, a new module, a new error code), stop and flag the conflict/gap to me before proceeding — do not silently resolve it by guessing, since other teams are working against the same file in parallel.

---
TASK:
[your actual task goes here]
```


## 🤖 1. Instructions for Your Coding Agent (Claude, Cursor, Gemini, etc.)

If you are a coding agent working on this repository, you **MUST** follow these rules without exception:
1. **Locked API Contract**: Follow the request/response envelopes, field names, and status codes in Section 2. Do not invent alternate schemas or return raw un-enveloped arrays/objects, as doing so will break front-to-back integration.
2. **Framework & Dependencies**:
   - Backend: Node.js, Express, MongoDB/Mongoose.
   - Frontend: React 19, TypeScript, TailwindCSS, Vite.
3. **Route Prefix**: All endpoints MUST reside under `/api/v1/...`.
4. **Git Branching**: Commit only to your team's designated branch (e.g., Team 5 works and commits on `T5` branch).


---

## 📜 2. Locked API Contract

### 2.1 Base URL
```
https://<host>/api/v1/...
```

### 2.2 Success Response Envelope (Strict)
Every successful API response must use this envelope:
```json
{
  "success": true,
  "data": { },
  "meta": { }
}
```
* `data`: An object or array containing the payload.
* `meta`: Optional object for pagination and metadata.

### 2.3 Error Response Envelope (Strict)
Every failed request must return the correct HTTP status code and this envelope:
```json
{
  "success": false,
  "error": {
    "code": "CODE_NAME",
    "message": "Human-readable description.",
    "details": { }
  }
}
```

### 2.4 Pagination Format
List endpoints must accept `?page=1&limit=20` and return:
```json
{
  "success": true,
  "data": [ ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 134,
    "totalPages": 7
  }
}
```

### 2.5 ID & Timestamps
- MongoDB ObjectIds must be returned as `"id"` (not `"_id"`) in every API response. Do this using Mongoose toJSON transforms.
- Timestamps must be ISO 8601 UTC strings: `"2026-07-07T10:32:00.000Z"`.

### 2.6 Standard Error Codes Reference
* `VALIDATION_ERROR` (400): Request body failed validation.
* `UNAUTHENTICATED` (401): Missing or invalid token.
* `TOKEN_EXPIRED` (401): Expired token.
* `PERMISSION_DENIED` (403): Authenticated but lacks permissions (RBAC).
* `NOT_FOUND` (404): Resource not found.
* `DUPLICATE_RESOURCE` (409): Unique constraint violation.
* `INVALID_STATE` (422): Operation invalid for current state.
* `RATE_LIMITED` (429): Too many requests.
* `INTERNAL_ERROR` (500): Server error.

---

## 🛠️ 3. How to Integrate Team 5's RBAC Module

Team 5 has built the core RBAC and scoping middleware. Other teams should import and use them as follows:

### 3.1 Gating Routes by Permission
Import the `requirePermission` middleware to secure route endpoints.

```js
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../rbac/middleware/rbac');

// Secure endpoint: requires 'finance:create' permission
router.post('/expenses',
  authenticate,
  requirePermission('finance', 'create'),
  financeController.createExpense
);
```

### 3.2 Dynamic Data Scoping (Isolation)
For society-scoped roles (e.g. Society Treasurer, Society Chair), their access is restricted to their assigned society. Use `attachScope(fieldName)` to auto-inject the correct Mongoose query filter into `req.scopeFilter`.

```js
const { attachScope } = require('../rbac/middleware/rbac');

// Route definition:
router.get('/events',
  authenticate,
  requirePermission('events', 'view'),
  attachScope('societyId'), // Injects filter mapping the 'societyId' database field
  eventsController.listEvents
);

// Controller code:
const listEvents = async (req, res) => {
  // Spread req.scopeFilter directly into your find query!
  const events = await Event.find({ ...req.scopeFilter });
  res.json({
    success: true,
    data: events
  });
};
```

---

## 🗃️ 4. Shared Data Models

* **`User`** (`server/models/User.js`): Shared placeholder model.
* **`Society`** (`server/models/Society.js`): Shared placeholder model.
* **`Role` / `Permission` / `RolePermission`**: Managed via the RBAC matrices.
* **`AuditLog`**: Stored in MongoDB. Can be written to using the helper:
  ```js
  const { logAudit } = require('../rbac/services/auditLogger');
  ```
---

## ✅ 5. Verification & Quality Gates

A route matching the contract's shape is not the same as a route that *behaves* correctly. These checks catch behavioral bugs (wrong data, RBAC leaks, silent failures) before they reach integration day — every team runs these against their own module before merging.

### 5.1 Runtime contract-compliance guard (dev/staging only)
Wrap every response so a malformed envelope fails loudly in dev instead of quietly reaching another team's frontend.

```js
// middleware/contractGuard.js — mount this globally, dev/staging only
function contractGuard(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof body !== 'object' || body === null || typeof body.success !== 'boolean') {
        throw new Error(`[CONTRACT VIOLATION] ${req.method} ${req.originalUrl} did not return {success, data|error} envelope`);
      }
      if (body.success && !('data' in body)) {
        throw new Error(`[CONTRACT VIOLATION] ${req.method} ${req.originalUrl} success:true missing "data"`);
      }
      if (!body.success && (!body.error || !body.error.code || !body.error.message)) {
        throw new Error(`[CONTRACT VIOLATION] ${req.method} ${req.originalUrl} error missing code/message`);
      }
    }
    return originalJson(body);
  };
  next();
}
module.exports = contractGuard;
```

### 5.2 Shared Postman/Newman contract collection
- One shared collection lives at `/tests/postman/ieee-finance-pro.postman_collection.json`.
- Every team adds a request per endpoint they own, with **tests** asserting: status code, `success` boolean, envelope shape, and any field this endpoint promises in Section 3.
- Run locally: `npm run test:contract` (wraps `newman run tests/postman/ieee-finance-pro.postman_collection.json --environment tests/postman/local.postman_environment.json`).
- **This collection is a shared file** — pulling latest before you add to it and resolving merge conflicts is part of "done," not optional.

### 5.3 RBAC compliance matrix test (owner: Team 5, run by everyone)
A script that impersonates every role and asserts real behavior matches Section 4's matrix — this is the test most likely to catch a silent permission leak.

```js
// scripts/verify-rbac-matrix.js
// Usage: node scripts/verify-rbac-matrix.js --baseUrl=http://localhost:5000
const axios = require('axios');
const expectedMatrix = require('../docs/rbac-matrix.json'); // mirrors Section 4 table

async function run(baseUrl) {
  const failures = [];
  for (const [role, modules] of Object.entries(expectedMatrix)) {
    const token = await getTestTokenForRole(role); // seeded test users per role
    for (const [module, expectedLevel] of Object.entries(modules)) {
      const res = await axios.post(`${baseUrl}/api/v1/access/check`,
        { module, action: 'view' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const actual = res.data.data.accessLevel;
      if (actual !== expectedLevel) {
        failures.push(`${role} → ${module}: expected "${expectedLevel}", got "${actual}"`);
      }
    }
  }
  if (failures.length) {
    console.error('❌ RBAC MATRIX MISMATCH:\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('✅ RBAC matrix matches expected access levels for all roles/modules');
}
run(process.argv[2]?.split('=')[1] || 'http://localhost:5000');
```

### 5.4 Mandatory `/health` endpoint
Every service (backend, and each external integration Team 4 wraps) must expose:
```
GET /api/v1/health → { "success": true, "data": { "status": "ok", "uptime": 1234, "version": "1.0.0" } }
```
Staging deploys are not marked healthy until this returns 200 — wire it into whatever deploy step you use (Render/Railway health check, or a GitHub Actions post-deploy curl).

### 5.5 Negative-path tests are mandatory, not optional
For every protected route, write at minimum:
- ✅ Correct role + correct scope → 200/201
- ❌ No token → 401
- ❌ Valid token, wrong role → 403 `PERMISSION_DENIED`
- ❌ Valid token, correct role, wrong society (cross-scope) → 403 or filtered empty result (per Section 3's scoping rules)

A PR that only tests the happy path does not pass review.

### 5.6 Pre-merge checklist (put this in the PR template)
```markdown
- [ ] All new/changed endpoints match Section 3's contract exactly (envelope, fields, status codes)
- [ ] `npm run test:contract` passes locally against this branch
- [ ] Negative-path tests included (401/403/404 cases, not just happy path)
- [ ] If this touches a protected route: verified `requirePermission`/`attachScope` applied correctly
- [ ] If this touches RBAC matrix: `node scripts/verify-rbac-matrix.js` passes
- [ ] `/api/v1/health` still returns 200 after this change
- [ ] No hardcoded role/permission checks bypassing Team 5's middleware
```

### 5.7 CI gate (GitHub Actions)
```yaml
# .github/workflows/pr-checks.yml
name: PR Checks
on: [pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:unit
      - run: npm run start:test-server &  # boots app against seeded test DB
      - run: npx wait-on http://localhost:5000/api/v1/health
      - run: npm run test:contract       # Newman against shared Postman collection
      - run: node scripts/verify-rbac-matrix.js --baseUrl=http://localhost:5000
```

### 5.8 Daily staging smoke run
Schedule the same Postman collection (5.2) against the live staging URL every few hours (a simple GitHub Actions `schedule:` cron works), posting pass/fail to your team channel — this surfaces "someone's change broke staging" hours before the review, not during it.


---

## 🔐 6. Security Checkpoints (Non-Negotiable)

Every team is responsible for its own module passing this section — this is not just Team 5's job. A permission check (Section 3) is worthless if the request that reaches it was already exploitable at a lower layer.

### 6.1 Secrets & environment variables
- **No secret ever committed to the repo** — JWT signing key, MongoDB URI, SendGrid/Gemini keys, Cloudinary/S3 credentials all live in `.env` (git-ignored) locally and in Render/Netlify/Railway's secret manager in deployed environments.
- Add a pre-commit check: `.env` and `*.pem`/`*.key` must be in `.gitignore` from commit #1, not added after a leak.
- Never `console.log` a full request/response object on auth or payment-adjacent routes — it's the most common way a token or password ends up in logs.

### 6.2 Password & JWT security
```js
// Hashing — never store or compare plaintext passwords
const bcrypt = require('bcrypt');
const passwordHash = await bcrypt.hash(password, 12); // cost factor 12, not 10
const isValid = await bcrypt.compare(password, user.passwordHash);
```
```js
// JWT — short-lived access token + explicit algorithm (prevents alg-confusion attacks)
const token = jwt.sign(
  { userId, roleId, societyId },
  process.env.JWT_SECRET,
  { expiresIn: '2h', algorithm: 'HS256' }
);
// Verification must pin the algorithm too:
jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
```
- Never accept `roleId`/`societyId`/`isAdmin` from the request body on register or profile-update routes — these are server-assigned only, never client-writable (see 6.4, mass assignment).

### 6.3 NoSQL injection & input validation
Mongoose does not automatically stop operator injection (`{ "email": { "$ne": null } }` in a login body). Sanitize and validate every input.
```js
// app.js — strips any key starting with $ or containing . from req.body/query/params
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize());
```
```js
// Every route validates its body against a schema before touching the DB — use zod or joi, not manual if-checks
const { z } = require('zod');
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: result.error.flatten() }
      });
    }
    req.body = result.data;
    next();
  };
}
```

### 6.4 Mass assignment protection
Never do `Model.create(req.body)` or `Model.findByIdAndUpdate(id, req.body)` directly — an attacker can slip `roleId`, `isActive`, `societyId`, `accessLevel` into the body and self-promote.
```js
// WRONG — attacker-controlled fields pass straight through
await User.findByIdAndUpdate(req.params.id, req.body);

// RIGHT — explicit allow-list per route
const { name, avatarUrl } = req.body;
await User.findByIdAndUpdate(req.params.id, { name, avatarUrl });
```

### 6.5 Authorization / IDOR (Broken Object-Level Access)
The most common "it works but it's insecure" bug: a route checks the user is *logged in*, but never checks the user *owns or is scoped to* the specific `:id` they're requesting.
- Every route touching a specific resource (`/reports/:id`, `/events/:id`) must apply `requirePermission` **and** `attachScope` (Section 3) — never just the first one.
- Rule of thumb: if a route accepts an `:id` in the URL, ask "what stops a Society Treasurer from society A from passing society B's report ID here?" — if the answer isn't "the scope filter", it's an IDOR.

### 6.6 File upload security (Team 4, and anywhere Multer is used)
```js
const multer = require('multer');
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — tune per use case, never unlimited
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('INVALID_FILE_TYPE'));
    }
    cb(null, true);
  }
});
```
- Never trust the client-supplied filename or extension — generate a new filename server-side (e.g. `${uuid()}.${safeExt}`).
- Store uploads in Cloudinary/S3, not on the app server's local disk — an uploaded file must never be directly executable by the server.
- Serve uploaded files back via signed/expiring URLs where the content is sensitive (finance attachments, reports) — not a permanently public bucket.

### 6.7 Rate limiting & brute force protection
```js
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later.' } } });
router.post('/auth/login', authLimiter, validate(loginSchema), authController.login);
```
Apply a stricter limiter on `/auth/login`, `/auth/register`, `/auth/change-password` than on general API routes.

### 6.8 Security headers & CORS
```js
const helmet = require('helmet');
app.use(helmet());

const cors = require('cors');
app.use(cors({
  origin: [process.env.FRONTEND_URL], // explicit allow-list, never origin: '*' once auth cookies/tokens are in play
  credentials: true
}));
```

### 6.9 XSS / output encoding
- React escapes text content by default — **never** use `dangerouslySetInnerHTML` on any user-generated content (Community Hub messages, report descriptions, announcements) without sanitizing first:
```js
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userGeneratedHtml);
```
- Treat every field that can contain user-authored text (Community Hub, Reports, Announcements) as untrusted on both write (validate/sanitize) and read (escape/sanitize before render).

### 6.10 Error responses must not leak internals
```js
// Global error handler — last middleware
app.use((err, req, res, next) => {
  console.error(err); // full detail to server logs only
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message
      // never include err.stack in the client-facing response
    }
  });
});
```

### 6.11 Dependency vulnerability scanning
- Enable GitHub Dependabot on the repo (Settings → Security → Dependabot alerts + version updates).
- CI fails on high/critical vulnerabilities:
```yaml
- run: npm audit --audit-level=high
```

### 6.12 Security pre-merge checklist (add to PR template, alongside Section 5.6)
```markdown
- [ ] No secrets, keys, or `.env` values committed in this PR
- [ ] All new routes use explicit field allow-lists (no `Model.create(req.body)` / `findByIdAndUpdate(id, req.body)`)
- [ ] All new inputs validated with a schema (zod/joi) before hitting the DB
- [ ] All routes with an `:id` param apply both `requirePermission` and `attachScope`
- [ ] Any new file-upload route enforces mimetype + size limits and stores server-generated filenames
- [ ] Any new user-generated content is sanitized before render (no raw `dangerouslySetInnerHTML`)
- [ ] Rate limiting applied to any new auth-adjacent route
- [ ] Error responses don't leak stack traces or internal details in production mode
- [ ] `npm audit --audit-level=high` passes
```

### 6.13 CI security gate (append to `.github/workflows/pr-checks.yml`)
```yaml
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm audit --audit-level=high
      - name: Check for committed secrets
        uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified
```

### 6.14 Security checkpoints tied to the 3-day sprint
- **End of Day 1**: helmet, CORS allow-list, mongo-sanitize, rate limiter on auth routes, and the global error handler are in place on the base Express app — before any team builds routes on top of it.
- **End of Day 2**: every route merged so far has been checked against 6.12's checklist — do a 15-minute group pass, not a solo one, since IDOR/scope bugs are easiest to catch when someone other than the author reviews.
- **Day 3 (integration)**: run `npm audit` and the Trufflehog secret scan against the full merged codebase once, not per-branch, to catch anything that slipped through individual PRs.


---

## 🧩 7. Team-Specific Instructions

Every agent reads all of Sections 1–6 (shared contract), but only needs to act on its own subsection below. **Read your team's block, then treat every other team's block as read-only context** — don't "helpfully" fix or restructure another team's module even if something looks off; flag it instead (see Section 5's PR process).

Branch convention: each team commits only to its own branch — `T1`, `T2`, `T3`, `T4`, `T5` — merging into `develop` daily, never direct to `main`.

---

### 7.1 Team 1 — Frontend
- **Branch**: `T1`
- **Owns**: All UI/UX, React state, routing, form handling, Socket.io client, calling backend APIs per Section 3.
- **Depends on**: Team 2's API contract (not Team 2's finished code) and Team 5's `/user/permissions` shape.
- **Do**:
  - Build against a mock server generated from Section 3 (Prism/json-server) until Team 2's real endpoints are live on staging — never block on Team 2 finishing.
  - Gate UI elements (buttons, menus, routes) using the `accessLevel` values returned by `GET /user/permissions` — never hardcode `if (role === 'society_chair')` in components. Roles change; access levels are the contract.
  - Sanitize any user-generated content before rendering (Section 6.9) — Community Hub messages, report descriptions, announcements.
- **Do NOT**:
  - Call `/api/v1/services/*` (Team 4) directly — always go through a Team 2 route.
  - Invent a response shape different from Section 3 because "it's easier for this component" — raise it as a contract change instead.

### 7.2 Team 2 — Backend API
- **Branch**: `T2`
- **Owns**: Section 3's REST controllers (Auth, Users, Societies, Events, Projects, Reports, Announcements, Community Hub), the base Express app, JWT issuing/verification, and the Day-1 security baseline in Section 6.14.
- **Depends on**: Team 3's schemas (build against the frozen contract, not finished code — stub models day 1), Team 5's RBAC middleware (import the Day-1 stub, swap for the real one day 2), Team 4's services (call server-to-server only).
- **Do**:
  - Ship `authenticate` middleware and the global error handler (Section 6.10) before any other route is written — everything else depends on it.
  - Import `requirePermission` / `attachScope` on every protected route — never write an inline `if (req.user.role !== ...)` check.
  - Apply input validation (Section 6.3) and explicit field allow-lists (Section 6.4) on every write route.
- **Do NOT**:
  - Reimplement permission logic inline "just for this one route" — that's exactly the drift Team 5 exists to prevent.
  - Expose Team 4's provider API keys (Gemini, SendGrid, Cloudinary) through any response — those stay server-side only.

### 7.3 Team 3 — Database & Storage
- **Branch**: `T3`
- **Owns**: All Mongoose schemas, indexes, relationships, seed scripts (`npm run seed`), backup/recovery strategy, migration scripts.
- **Depends on**: Nothing — this is a true Day-1 starting point.
- **Blocks**: Team 2 (models) and Team 5 (User/Role schema fields).
- **Do**:
  - Freeze every schema referenced in Section 2 by end of Day 1 morning. Any field addition/rename after that is a PR against this file, tagged `Team 2` and `Team 5`.
  - Make seed scripts idempotent — safe to re-run without duplicating data, so every team's local/staging environment stays consistent.
- **Do NOT**:
  - Add fields to `User`/`Role`/`Society` unilaterally after the freeze — Team 5's permission resolution and Team 2's auth both read these directly.

### 7.4 Team 4 — External Services
- **Branch**: `T4`
- **Owns**: Section 3.10 routes only — file storage, email, PDF generation, AI (Gemini) integration, backups, cron jobs/webhooks.
- **Depends on**: Nothing functionally — this module is self-contained and should be fully demoable in isolation.
- **Do**:
  - Wrap every third-party provider (Cloudinary/S3, SendGrid, Gemini) behind the exact routes in Section 3.10 — Team 2 calls these, nothing else does.
  - Apply file upload security (Section 6.6) — mimetype/size limits, server-generated filenames, no direct execution paths.
- **Do NOT**:
  - Expose these routes to be called directly from the frontend — auth/audit for these must flow through Team 2.
  - Let provider keys leave the server — no key ever appears in a client-facing response, log, or error message.

### 7.5 Team 5 — Roles & Access Control
- **Branch**: `T5`
- **Owns**: Section 3.4's full RBAC module — Role/Permission/RolePermission models, `requirePermission`/`attachScope`/`requireSuperAdmin` middleware, `/access/check` and `/user/permissions` endpoints, audit logging, the Section 4 access matrix, and the RBAC verification script (Section 5.3).
- **Depends on**: Team 3's `User`/`Role` schema (coordinate the freeze in 7.3).
- **Blocks**: Team 2 (every protected route needs this middleware to exist before it can be wired in).
- **Do**:
  - Ship a **stub** version of `requirePermission`/`attachScope` on Day 1 (always allows, logs a warning) purely so Team 2 isn't blocked — swap in the real logic Day 2 without changing the function signature Team 2 already imported.
  - Own tuning the Section 4 matrix via seed data and the `/role-permissions` endpoint — it must stay data-driven, never hardcoded per-route.
  - Write and maintain the RBAC integration README (usage examples other teams copy from) and the matrix verification script every team runs pre-merge.
- **Do NOT**:
  - Change the stub's function signature between Day 1 and Day 2 — Team 2 is importing it by name/shape from hour one; a signature change breaks their routes silently.

---

## 🧷 8. Techstack

  ### 📱 1. Frontend (Team 1) — Web App Interface

  • React 19 & TypeScript: Provides a robust, type-safe environment for building interactive user interfaces.
  • Vite: A modern, extremely fast build tool that replaces slower tools like Webpack.
  • Tailwind CSS: A utility-first CSS framework for fast styling.
  • Zustand: A lightweight, fast, and simple state management library (simpler than Redux).
  • Axios: A helper library to make HTTP/API calls to the backend.
  • DOMPurify: Sanitizes HTML to prevent Cross-Site Scripting (XSS) attacks when displaying user-generated messages.
  • Socket.io-client: Enables real-time, bi-directional communication (crucial for instant messaging/updates in the
  Community Hub).
  ──────
  ### 🔌 2. Backend API (Team 2) — Main Web Server

  • Node.js & Express: The foundation runtime and framework for serving the API routes.
  • JWT ( jsonwebtoken ): Generates secure tokens for user session management (authentication) without needing
  stateful sessions.
  • Security Middleware ( helmet ,  cors ,  mongo-sanitize ):
      •  helmet : Sets secure HTTP headers to prevent attacks.
      •  cors : Controls which external domains can talk to the backend.
      •  mongo-sanitize : Prevents NoSQL Injection attacks.
  • Jest & Supertest: Used for writing automated tests to verify that API endpoints respond correctly.
  ──────
  ### 🗄️ 3. Database & Storage (Team 3) — Data Management

  • MongoDB: A NoSQL document database ideal for flexible data schemas.
  • Mongoose: A library that maps MongoDB documents to JavaScript objects and enforces schemas.
  • Idempotent Seeding Scripts: Populate the database with default roles, permissions, and settings safely (without
  duplicates) when the server starts.
  • MongoDB Memory Server: Runs a temporary database completely in memory. This is highly useful for unit tests so
  they run fast and don't overwrite real data.
  ──────
  ### ☁️ 4. External Services (Team 4) — Heavy Integrations

  • Cloudinary / AWS S3: Offloads file hosting (e.g., invoices, profile pictures, receipts) to cloud storage.
  • SendGrid: Sends emails (e.g., password resets, financial statements).
  • Gemini AI ( @google/generative-ai ): Powers smart assistant features, like scanning financial receipts or
  summarizing budgets.
  • Multer: Middleware that securely parses uploaded files and restricts allowed file sizes/types.
  • PDFKit: Generates dynamic PDF downloads (e.g., generating a PDF invoice or report).
  ──────
  ### 🛡️ 5. Roles & Access Control (Team 5) — Security & RBAC

  • Custom Middleware ( requirePermission ,  attachScope ): Express functions that intercept incoming requests to
  ensure the authenticated user has the permissions needed to perform that action.
  • Mongoose RBAC Models: Schemas ( Role ,  Permission ,  RolePermission ) stored in the database to map what each
  user role is allowed to do dynamically.
