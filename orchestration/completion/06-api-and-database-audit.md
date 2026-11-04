# 06 - API and database audit (FIRST PASS, static) - 2026-11-01

Author: lead orchestrator. Method: a read-only script (`scripts/api-audit.js`, `scripts/api-audit-report.js`) parses `backend/src/routes/*.js` of the protected checkout (baseline 70ff8bd, NOT the uncommitted Batch 1/2 candidates) and the frontend's API call sites, then I read the handlers for every flagged row. Nothing was executed against a server and no test was run. The parser is heuristic: it reads the middleware written in the route declaration, so an inline check inside a handler is invisible to it (that is why flagged rows were read by hand). Full machine tables: `raw/api-audit-report.md`; raw extract: `raw/api-audit-extract.json`. Not reviewed by the independent reviewer.

## Counts
129 route declarations = 128 in `routes/*.js` + `GET /health` in `routes/index.js`. 124 are mounted; 4 (all of `routes/storage.js`) are not mounted (decision D-02: stays unmounted); `email.js`, `pdf.js` and the baseline `ai.js` declare no routes. 64 frontend API call sites were found.

## Authentication (route level)
- Mounted endpoints without `authenticate` in their chain: only `POST /auth/login` (rate-limited by `authLimiter`; by design) and `GET /health`. The two importer routes were flagged by the script but their `importGuards` array contains `authenticate`, `requirePermission('community_hub','create')`, the society guard and an existing-society check: false positive.
- Everything else is authenticated, either by a file-level `router.use(authenticate)` or per route.

## Mutating endpoints with no permission / admin / society guard in the route chain (12) - reviewed
| Endpoint | Where the check actually is | Verdict |
|---|---|---|
| `POST /auth/change-password` | own account only (token user) | OK by design |
| `POST /conversations`, `POST /conversations/:id/messages` | participant / recipient checks inside the handlers (AUD-033, NEW-02, earlier verified) | OK, previously tested |
| `POST /events/:id/register` | scope and eligibility inside (AUD-020; residual NEW-23) | OK, previously tested |
| `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` | query filters by `userId` of the caller (read in source) | OK |
| `PATCH /users/:id` | inline: administrator or `req.user._id === :id` (403 otherwise); updates `name` and `avatarUrl` only | OK; note `avatarUrl` is stored with no URL validation (= NEW-25) |
| `POST /access/check` | read-only permission probe, limited by `accessCheckLimiter` | OK |
| `POST /tasks`, `PUT /tasks/:id`, `DELETE /tasks/:id` | society policy / ownership / field allow-list inside (NEW-04, NEW-05) | previously tested; browser coverage still missing (NEW-05) |
| `POST /role-permissions` | inline: the caller's role level must be `super_admin` or `faculty_advisor`; no check against `roles_access:edit`; any role/permission may be changed and the change is global | **Known: NEW-15** (open decision). Confirmed by reading `rolePermissions.controller.js`. Includes society faculty advisors, which the seed gives level `faculty_advisor`. Also uses `UserRole.findOne({user})` with no ordering, so for a user with several roles the role that is examined is arbitrary. Existing tests pin this behaviour; the second point (multiple roles) is not in the register and should be added to NEW-15 |

## Authenticated GET endpoints with no route-level guard (27)
Examples: `GET /societies`, `/societies/:id`, `/societies/:id/members`, `/societies/:id/terms`, `/events`, `/projects`, `/tasks`, `/calendar`, `/announcements`, `/project-reports`, `/permissions`, `/role-permissions`, `/user/permissions`. Many carry inline scoping that earlier work verified (AUD-018, NEW-01, AUD-021, AUD-025, announcement visibility). Two are policy matters already in the register as NEW-15/NEW-16: `GET /permissions` and `GET /role-permissions` (the matrix is readable by every signed-in user) and the organisation-wide read endpoints. Each of the 27 still needs a per-endpoint negative test (AUTHZ-01); I did not read every handler.

## Frontend / backend contract
- 64 frontend call sites; 3 have no backend route in the baseline: `POST` and `DELETE /channels/:id/members` (already removed in the Batch 2 candidate, NEW-08) and **`GET /conversations/:id`** (`getConversation` in `services/conversations.ts`). The backend has no such route and **nothing calls the wrapper**. It is the same class of dead wrapper as NEW-08, so it is harmless today. NEW FINDING API-F2, P3: delete it (or add the route if a page will need it) and extend the contract test that now exists for channels to cover conversations.
- Mounted backend endpoints with no frontend call site: listed in `raw/api-audit-report.md` (Flag E). Many are the F-06 areas (dashboard, notes, sprints, transactions, boards, notifications, institution, rbac) that the pages call inline, so "no call site" there means "not called through `services/`", not "unused".

## Database models (first pass only)
31 model files. 25 declare at least one `.index(...)` or `unique: true` (Transaction has the most, 9). Models with none declared: BoardCard has one, but File, Institution, Milestone, Note, ReportSnapshot, Sprint and CommunityMessage have no index or unique declaration at all. Whether that matters (for example Note lookups by society, or duplicate Milestone rows) has not been analysed. SocietyTerm's unique `(society, academicYear)` index is the one fixed in Batch 1 (NEW-11). A real database audit (schema fields, references, sensitive fields, hooks, load order, query shapes) is NOT done.

## What this changes in the register
No new P0/P1. Added: API-F2 (dead `getConversation` wrapper, P3); NEW-15 gains the "arbitrary role when a user has several" detail; NEW-25 is confirmed by code (`PATCH /users/:id` stores `avatarUrl` unvalidated). API-01 is "In progress", not done: 27 GET endpoints and the database half remain.
