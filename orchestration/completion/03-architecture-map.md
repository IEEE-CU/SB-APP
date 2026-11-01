# 03 - Architecture map (Phase 0, 2026-11-01)

Derived **read-only** from `D:\SB-APP` at commit `70ff8bd` (protected baseline, working tree clean except untracked `digest.txt`, which was never opened). Every claim below is a code fact with a path, and where useful a line number. Nothing here was executed; runtime behaviour is **not** verified by this document.

Charter name for this file: `03-ARCHITECTURE-MAP`. See `INDEX.md` for the numbering reconciliation with the earlier `03-agent-c-report.md`.

## 1. Runtime topology

| Tier | Entry | Stack |
|---|---|---|
| Frontend | `frontend/src/main.tsx` -> `frontend/src/routes.tsx` | React 19, Vite 6, TypeScript 5.6, react-router-dom 6.28, axios, zustand, react-hook-form + zod, framer-motion, socket.io-client 4.8, dompurify 3.2, @google/genai 2.17 |
| Backend | `backend/src/server.js` | Express 4, Mongoose, JWT, Socket.IO 4.8, helmet, compression, cors, express-mongo-sanitize, hpp, express-rate-limit, multer, Azure Blob |
| Data | MongoDB via `backend/src/config/database.js` | 30 Mongoose models, `models/index.js` load order, `models/plugins/toJson.js` |
| Object storage | `backend/src/services/storage/` | Azure Blob provider (`storage-provider/AzureBlobProvider.js`) - reachable only through dormant code, see §7 |

API base path: `/api/v1` (`server.js:143`). Frontend calls it through `VITE_API_BASE_URL` or the Vite proxy.

## 2. Backend middleware order (`backend/src/server.js`, observed line numbers)

| Line | Middleware | Note |
|---|---|---|
| 105 | `app.set("trust proxy", trustProxy.setting)` | value comes from `config/trustProxy.js` - NEW-18 / AUD-012B cluster |
| 107 | `helmet()` | |
| 108 | `compression()` | |
| 109 | `cors(...)` | multi-line options block |
| 123 | `generalLimiter` | from `middleware/rateLimiter.js`; ordering vs trust proxy is the AUD-034 concern |
| 124-125 | `express.json({limit:"10mb"})`, `express.urlencoded({limit:"10mb"})` | body size limit 10 MB |
| 131 | `mongoSanitize()` | **after** body parsing, as required |
| 132 | `hpp()` | |
| 136 | conditional inline middleware | environment/test dependent |
| 143 | `app.use("/api/v1", routes)` | the single API mount |
| 156-157 | `notFound`, `errorHandler` | `middleware/errorHandler.js` |
| 179 | `new Server(server, {...})` | Socket.IO attached to the same HTTP server |
| 195 | `app.set("io", io)` | io handle shared with routes |

Security/auth middleware modules: `middleware/auth.js` (JWT), `middleware/rbac.js` (permission checks), `middleware/socketAuth.js` (socket handshake auth), `middleware/rateLimiter.js`, `middleware/upload.js` (multer), `middleware/errorHandler.js`.

## 3. Routers and mounts

`backend/src/routes/index.js` is the only aggregator. 26 router modules exist; **23 are mounted**, plus the aggregator's own `/health`.

| Mount (under `/api/v1`) | Router file | Endpoint declarations |
|---|---|---|
| `/auth` | `auth.js` | 4 |
| `/users` | `users.js` | 4 |
| `/` (root) | `rbac.js` | 9 |
| `/societies` | `societies.js` | 19 |
| `/societies/:societyId/notes` | `notes.js` | 5 |
| `/societies/:societyId/roadmap` | `sprints.js` | 5 |
| `/societies/:societyId/importer` | `importers.js` | 2 |
| `/notifications` | `notifications.js` | 3 |
| `/transactions` | `transactions.js` | 9 |
| `/events` | `events.js` | 9 |
| `/projects` | `projects.js` | 6 |
| `/project-reports` **and** `/reports` | `projectReports.js` | 6 (double-mounted -> 12 reachable paths) |
| `/calendar` | `calendar.js` | 6 |
| `/announcements` | `announcements.js` | 5 |
| `/dashboard` | `dashboard.js` | 2 |
| `/institution` | `institution.js` | 2 |
| `/community` | `community.js` | 2 |
| `/channels` | `channels.js` | 11 |
| `/conversations` | `conversations.js` | 5 |
| `/boards` | `boards.js` | 4 |
| `/tasks` | `tasks.js` | 4 |
| `/opportunities` | `opportunities.js` | 2 |
| `/health` | `index.js` | 1 (DB-aware 200/503) |
| *(not mounted)* `/storage` | `storage.js` | 4 - **unreachable**, see §7 |

**Totals: 129 endpoint declarations across 24 files; 125 reachable** (the 4 storage endpoints are not). Counted with `router.(get|post|put|patch|delete)(` over `backend/src/routes` - the same 129 total was reached independently by a flattened per-file extraction, so the number is cross-checked.

Per-method breakdown recorded in run 1 of this task: 52 GET, 37 POST, 15 PATCH, 13 DELETE, 12 PUT.

## 4. Models (`backend/src/models`, 30 models + `index.js` + `plugins/toJson.js`)

Announcement, AuditLog, BoardCard, CalendarEvent, Channel, CommunityMessage, Conversation, Event, EventRegistration, File, Institution, Membership, Message, Milestone, Note, Notification, Opportunity, Permission, Project, ProjectReport, Reaction, ReportSnapshot, Role, RoleAssignment, RolePermission, Society, SocietyTerm, Sprint, Task, Transaction, User, UserRole.

Field-level, index-level and uniqueness auditing is **Phase 3** (`06-API-AND-DATABASE-AUDIT`) and is deliberately not attempted here.

## 5. The two authorization systems (AUD-003, decision D-03)

Both are present in the baseline and neither is a subset of the other:

1. **Legacy** - `User.role` (`models/User.js`) with values including `ADMIN` / `OFFICE_BEARER`, consulted directly by route handlers.
2. **RBAC** - `Role`, `Permission`, `RolePermission`, `RoleAssignment`, `UserRole`, resolved by `services/resolvePermissions.js` and enforced by `middleware/rbac.js`; administered through `controllers/rbac/*.controller.js` (`permissions`, `rolePermissions`, `roles`, `accessCheck`, `auditLogs`) behind the root-mounted `routes/rbac.js`.

Frontend mirror: `hooks/usePermissions.ts` + `components/auth/ProtectedRoute` (`requiredModule` / `requiredAction`). **Do not introduce a third system** (charter §3). The authoritative matrix is Phase 2/3 work (`07-ROLE-AUTHORIZATION-MATRIX`).

## 6. Sockets

`new Server(...)` in `server.js:179`, handshake auth in `middleware/socketAuth.js`, presence in `services/presenceService.js` (in-memory). Multi-process/multi-host presence correctness is **unverified** and tied to `config/clusterMode.js` and NEW-10. Backend socket test coverage exists at both levels (`test/unit/socket-*.test.js`, `test/integration/socket-*.integration.test.js`) plus the browser spec `frontend/tests/session/socket-reconnect.spec.ts`.

## 7. Dormant, unreachable and dead code (all confirmed by reading the baseline)

| Item | Evidence | Finding |
|---|---|---|
| `routes/storage.js` (4 endpoints) | `routes/index.js:54-58` - import kept, mount commented out with an explicit AUD-001 note pointing at `test/unit/storage-unmounted.test.js` | AUD-001 / D-02: deliberately unmounted because it had no auth; guarded by a test |
| `routes/ai.js`, `routes/email.js`, `routes/pdf.js` | never imported in `routes/index.js`; each declares **zero** `router.*` handlers | AUD-017: dormant routers whose controllers (`aiController.js`, `emailController.js`, `pdfController.js`) and services (`GeminiService`, `EmailService`, `PdfService`) do exist. In the baseline there is **no server-side AI endpoint** - the frontend talks to Gemini directly (`frontend/src/services/geminiService.ts`), which is exactly AUD-013. `integration/batch2` adds the server-side AI route; do not re-implement it. |
| `services/backup/BackupService.js` | no router references it | NEW-14 surface; reachable only by scripts |
| `frontend/src/services/googleDriveService.ts` | no importer anywhere in `frontend/src` | **Dead code**: a complete Google Drive OAuth upload flow with no caller. Requires a product decision (see `DECISION-REGISTER.md`, D-28) |
| `frontend` route `/register` | `frontend/src/routes.tsx:46`, inside `AuthLayout`, **outside** the `ProtectedRoute` block (lines 52-90) | **NEW-17 confirmed at code level**: a publicly reachable registration page while server-side registration is admin-only |

## 8. Frontend structure

- **29 page components** under `frontend/src/pages` (see `02-feature-inventory.md` for the route-by-route table).
- **14 API client modules** under `frontend/src/services`: announcements, auth, calendar, channels, community, conversations, events, geminiService, googleDriveService, opportunities, projects, reports, societies, users.
- Supporting: `hooks/usePermissions.ts`, `hooks/usePagination.ts`, `store/authStore.ts`, `utils/slug.ts`, `components/{layout,auth,board,...}`.
- **API calls that bypass the service layer** (9 calls in 4 files): `pages/tasks/TasksPage.tsx` (4), `components/board/KanbanBoardView.tsx` (3), `components/layout/SocietySwitcher.tsx` (1), `store/authStore.ts` (1). Phase 4 item - these are the places where error/loading/permission handling is most likely to be inconsistent.
- **Mounted backend surface with no frontend service module**: transactions (finance), tasks, boards, notes, sprints, notifications, dashboard, importers, institution, rbac. Either consumed inline (as above) or unconsumed. Resolving which is Phase 3/4 work, not a Phase 0 claim.
- `frontend/package.json` `"test:unit"` is a **stub**: `echo "No tests yet" && exit 0`. The 40-45 Node tests that the gates report are real files (`frontend/tests/unit/*.node-test.mjs`) but are **not wired to any npm script** - directly relevant to AUD-015 / CI (`D-B5`).

## 9. Verified facts vs assumptions

Verified by reading the baseline: everything in §2-§8 above.
**Not** verified here and not claimed: whether any endpoint authorizes correctly, whether any feature works end to end, index/schema correctness, socket behaviour under multiple processes, PWA/service-worker runtime behaviour, deployment topology. Those are Phases 2, 3, 4, 5 and 7.
