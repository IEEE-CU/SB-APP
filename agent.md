# IEEE Finance Pro — Agent Context & API Contract (v1)
### Shared source of truth for Teams 1–5 · Coding Agent Instructions

---

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
