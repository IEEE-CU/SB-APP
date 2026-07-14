# Team 5: Roles & Access Control Module (RBAC)

Welcome to the central Role-Based Access Control (RBAC) module for **IEEE Finance Pro**. This module provides a complete, data-driven, and scope-aware access-control system that gates all other modules in the application.

---

## 📂 Folder Structure

```
/server
  /modules
    /rbac
      models/          (Role, Permission, RolePermission, UserRole, AuditLog)
      controllers/     (roles, permissions, rolePermissions, auditLogs, accessCheck)
      middleware/      (rbac.js: requirePermission, requireRole, requireSuperAdmin, attachScope)
      services/        (resolvePermissions.js, auditLogger.js)
      routes/          (rbac.routes.js — mounts all 8 endpoints)
      seed/            (rbac.seed.js)
      README.md        (You are here!)
      rbac.test.js     (Integration and Unit Tests)
```

---

## 🔒 Shared Security Scaffolding

If your team is starting in parallel, we have set up the following shared components in the root `/server` directories:
* **`server/models/User.js`**: Shared placeholder User schema (Mongoose).
* **`server/models/Society.js`**: Shared placeholder Society schema (Mongoose).
* **`server/middleware/auth.js`**: Central JWT token verification (`authenticate` middleware) and token generation helper (`generateToken`).

---

## 🚀 Middleware API (How to secure your routes)

Import the RBAC middlewares from `server/modules/rbac/middleware/rbac` to gate access in your module routers:

```js
const { authenticate } = require('../../middleware/auth');
const { requirePermission, attachScope, auditLogger } = require('../rbac/middleware/rbac');
```

### 1. Require Fine-Grained Permissions
Use `requirePermission(module, action)` to restrict access to users who have permissions on a specific module and action.

* **Supported Modules**: `'finance'`, `'events'`, `'projects'`, `'reports'`, `'community_hub'`, `'members'`, `'announcements'`, `'dashboard'`, `'settings'`, `'roles_access'`
* **Supported Actions**: `'view'`, `'create'`, `'edit'`, `'delete'`, `'approve'`, `'export'`, `'manage_settings'`

**Example Integration (Finance Module Route):**
```js
// POST /api/finance/expenses
router.post('/expenses',
  authenticate,
  requirePermission('finance', 'create'),
  financeController.createExpense
);
```

### 2. Auto-Inject Scoping Filters
For society-scoped roles, their access is restricted to their assigned society. Use `attachScope(fieldName)` to auto-inject a MongoDB filter query into `req.scopeFilter` based on the user's role scope:
* If the user's role scope is `society`, `req.scopeFilter` becomes `{ [fieldName]: userSocietyId }`.
* If the user's role scope is `global` or `student_branch`, `req.scopeFilter` is `{}` (no filter).

**Example Integration (Events Controller):**
```js
// route file:
router.get('/events',
  authenticate,
  requirePermission('events', 'view'),
  attachScope('society'), // Inject filter mapping 'society' parameter
  eventsController.listEvents
);

// controller file:
const listEvents = async (req, res) => {
  // Simply spread req.scopeFilter into your Mongoose query!
  const events = await Event.find({ ...req.scopeFilter });
  res.json({ data: events });
};
```

### 3. Shortcut Middlewares
* **`requireSuperAdmin`**: Shorthand for restricting endpoints solely to the SB Faculty Advisor (Super Admin).
* **`requireRole(...roleNames)`**: Shorthand for checking coarse-grained role-name access directly.
* **`auditLogger(actionDescription, moduleName)`**: An Express middleware you can chain to write successful activity logs.

---

## 📡 Programmatic Access Check (Internal Service)

To perform access checks programmatically without making an HTTP request:

```js
const { resolvePermissions } = require('../services/resolvePermissions');

const checkUserPermission = async (userId, targetModule, targetAction) => {
  const resolved = await resolvePermissions(userId);
  const permKey = `${targetModule}:${targetAction}`;
  const accessLevel = resolved.permissions[permKey] || 'none';
  
  const allowed = accessLevel !== 'none';
  return { allowed, accessLevel };
};
```

### Response Object Format from `resolvePermissions`
```json
{
  "role": "society_treasurer",
  "scope": {
    "type": "society",
    "societyId": "651f8a8bb2a7925c276a6f1d"
  },
  "permissions": {
    "finance:view": "limited_own_scope",
    "finance:create": "limited_own_scope",
    "finance": "limited_own_scope",
    "settings:view": "none",
    "settings": "none"
  }
}
```

---

## 🌐 API Routes

All endpoints require JWT authorization and return consistent `{ error: { code, message } }` format on failures.

| Method | Route | Description | Required Privilege |
|---|---|---|---|
| **GET** | `/api/roles` | Paginated and filterable list of roles | `roles_access:view` |
| **POST** | `/api/roles` | Create a new custom role | `roles_access:create` |
| **GET** | `/api/permissions` | Get all permissions grouped by module | Authenticated |
| **POST** | `/api/permissions` | Create a new module permission | `requireSuperAdmin` |
| **GET** | `/api/role-permissions` | Get full permission matrix (Filter: `?role=`, `?module=`) | Authenticated |
| **POST** | `/api/role-permissions` | Assign/update (upsert) access level for role-perm pair | Advisor level + |
| **GET** | `/api/user/permissions` | Get resolved permission set for current user (or `?userId=`) | Authenticated (userId query: Advisor +) |
| **GET** | `/api/audit-logs` | Filterable, paginated audit logs trail | `roles_access:view` (Advisor +) |
| **POST** | `/api/access/check` | Programmatic access verification endpoint (rate limited) | Authenticated |

---

## 🌱 Seeding and Installation

### 1. Database Seeding
To seed all system roles, permissions, and a functional starting default matrix, run:
```bash
npm run seed
```
This script is **idempotent** (re-runnable) and will not overwrite existing custom modifications.

### 2. Run Tests
To execute the unit and integration tests covering security, scopes, overrides, matrix changes, and audit logging:
```bash
npm test
```
