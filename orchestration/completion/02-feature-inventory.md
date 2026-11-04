# 02 - Feature inventory (Phase 0, 2026-11-01)

Built **read-only** from `D:\SB-APP` at `70ff8bd`. Charter name: `02-FEATURE-INVENTORY`.

## How to read the status column

Phase 0 is documentation only - nothing was executed in the browser or against a server. So the strongest status any row can carry here is **WIRED** (the chain page -> client -> mount -> router exists in code). Per charter §2.6 and §21, "wired" is **not** "working".

- **WIRED** - full chain present in code.
- **WIRED, no client module** - backend surface exists and is mounted, but no `frontend/src/services/*` module calls it (may be called inline, may be unconsumed).
- **UNREACHABLE** - code exists, no route reaches it.
- **DEAD** - code exists, nothing references it.
- **DEFECT (code-level)** - a problem provable from the source alone.

Runtime status (usable? all actions functional? permissions right? validation? error/loading/empty states?) is assigned in Phase 4 (`05-FUNCTIONAL-AUDIT`) and Phase 5 (QA), per feature, with evidence.

## Route table (`frontend/src/routes.tsx`)

| Path | Page | Guard |
|---|---|---|
| `/` | `LandingPage` | public |
| `/login` | `LoginPage` | public (`AuthLayout`) |
| `/register` | `RegisterPage` | **public** (`AuthLayout`, line 46) - see F-02 |
| `/dashboard`, `/profile`, `/change-password` | Dashboard, Profile, ChangePassword | `ProtectedRoute` |
| `/societies`, `/societies/new`, `/societies/:slug`, `/societies/:slug/edit` | SocietyList/Form/Detail | `ProtectedRoute` |
| `/events`, `/events/new`, `/events/:slug`, `/events/:slug/edit` | EventList/Form/Detail | `ProtectedRoute` |
| `/projects`, `/projects/new`, `/projects/:slug`, `/projects/:slug/edit` | ProjectList/Form/Detail | `ProtectedRoute` |
| `/reports`, `/reports/new`, `/reports/:slug`, `/reports/:slug/edit`, `/reports/ai-audit` | ReportList/Form/Detail, AiAuditPage | `ProtectedRoute` |
| `/announcements`, `/announcements/new`, `/announcements/:slug`, `/announcements/:slug/edit` | AnnouncementList/Form/Detail | `ProtectedRoute` |
| `/community`, `/channels/:slug` | CommunityPage, ChannelDetailPage | `ProtectedRoute` |
| `/boards/:slug`, `/tasks`, `/calendar`, `/opportunities` | BoardDetail, Tasks, Calendar, Opportunities | `ProtectedRoute` |
| `*` | `NotFoundPage` | `ProtectedRoute` (catch-all is *inside* the protected block) |
| `/admin/users`, `/admin/users/:id` | UserManagement, UserDetail | `ProtectedRoute requiredModule="users" requiredAction="admin"` |

29 page components; 1 public landing + 2 auth routes + 30 protected entries + 2 admin entries.

## Feature chain inventory

| # | Feature | Frontend page(s) | Client module | Backend mount | Router / models | Status | Open findings |
|---|---|---|---|---|---|---|---|
| 1 | Login / session | LoginPage | `services/auth.ts`, `store/authStore.ts` (1 inline call) | `/auth` (4) | `auth.js`, `middleware/auth.js`, `utils/authTokens.js`, `utils/jwtSecret.js`, User | WIRED | AUD-014 JWT secret, session revocation, login enumeration (tests exist in baseline) |
| 2 | Registration | RegisterPage (`/register`, public) | `services/auth.ts` | `/auth` | `auth.js` | **DEFECT (code-level)** | **NEW-17 confirmed**: public page, admin-only server policy. Needs product decision D-27 |
| 3 | Change password | ChangePasswordPage | `services/auth.ts` | `/auth` | `auth.js` | WIRED | password-revocation + session-revocation tests exist |
| 4 | Profile | ProfilePage | `services/users.ts` | `/users` (4) | `users.js`, User | WIRED | |
| 5 | Dashboard | DashboardPage | *(none)* | `/dashboard` (2) | `dashboard.js` | WIRED, no client module | NEW-16 org-wide reads |
| 6 | Societies | SocietyList/Detail/Form | `services/societies.ts` | `/societies` (19) | `societies.js`, Society, Membership, SocietyTerm | WIRED | AUD-026/D-21/D-23 (Batch 1, uncommitted); D-24 unconfirmed; society terms PII |
| 7 | Society terms / handover | SocietyDetailPage | `services/societies.ts` | `/societies` | `societies.js`, SocietyTerm | WIRED (Batch 1, uncommitted) | **D-24 never confirmed** |
| 8 | Society notes | *(no dedicated page found)* | *(none)* | `/societies/:societyId/notes` (5) | `notes.js`, Note | WIRED, no client module | NEW-? note visibility (tests exist) |
| 9 | Roadmap / sprints | *(no dedicated page found)* | *(none)* | `/societies/:societyId/roadmap` (5) | `sprints.js`, Sprint, Milestone | WIRED, no client module | Verify consumption in Phase 4 |
| 10 | Importer / scraper | OpportunitiesPage (partly) | `services/opportunities.ts` | `/societies/:societyId/importer` (2), `/opportunities` (2) | `importers.js`, `opportunities.js`, `services/opportunityScraper.js`, `utils/urlSafety.js`, Opportunity | WIRED | NEW-24 validation, NEW-25 stored URL validation, AUD-030 SSRF - **never weaken `urlSafety`** |
| 11 | Finance / transactions | *(no dedicated page found)* | *(none)* | `/transactions` (9) | `transactions.js`, Transaction | WIRED, no client module | AUD-005, NEW-07, D-B10 (no transaction data to Gemini), D-B11 (legacy admin) |
| 12 | Events + registrations | EventList/Detail/Form | `services/events.ts` | `/events` (9) | `events.js`, Event, EventRegistration | WIRED | NEW-23 legacy data, event-registration scope/index tests exist |
| 13 | Projects | ProjectList/Detail/Form | `services/projects.ts` | `/projects` (6) | `projects.js`, Project | WIRED | NEW-23 |
| 14 | Project reports | ReportList/Detail/Form | `services/reports.ts` | `/project-reports` **and** `/reports` (6 each) | `projectReports.js`, ProjectReport, ReportSnapshot | WIRED | **Double mount** - needs D-29; report read/scope tests exist |
| 15 | AI audit | AiAuditPage | `services/geminiService.ts` | *(baseline: none)* | `config/gemini.js`, `GeminiService`, `aiController` - router unmounted | **UNREACHABLE in baseline** | AUD-013: baseline calls Gemini from the browser. Fixed in `integration/batch2` (server-side), **uncommitted** |
| 16 | Announcements | AnnouncementList/Detail/Form | `services/announcements.ts` | `/announcements` (5) | `announcements.js`, Announcement | WIRED | Batch 1 audience rules (D-01, D-22) - preserve |
| 17 | Community | CommunityPage | `services/community.ts` | `/community` (2) | `community.js`, CommunityMessage, Reaction | WIRED | NEW-08 channel wrappers (Batch 2, uncommitted) |
| 18 | Channels + reactions | ChannelDetailPage | `services/channels.ts` | `/channels` (11) | `channels.js`, Channel, Reaction | WIRED | NEW-08, channel default scope (tests exist) |
| 19 | Direct messages | *(inside Community/Channel UI)* | `services/conversations.ts` | `/conversations` (5) | `conversations.js`, Conversation, Message | WIRED | NEW-22 sidebar `lastMessage.content`; DM recipients spec exists |
| 20 | Boards / Kanban | BoardDetailPage | *(none - 3 inline calls in `KanbanBoardView.tsx`)* | `/boards` (4) | `boards.js`, BoardCard | WIRED, no client module | Phase 4: inline calls, error/loading handling |
| 21 | Tasks | TasksPage | *(none - 4 inline calls)* | `/tasks` (4) | `tasks.js`, Task | WIRED, no client module | NEW-01/04/05; task-create + task-ownership integration tests **did not run** in the combined gate |
| 22 | Calendar | CalendarPage | `services/calendar.ts` | `/calendar` (6) | `calendar.js`, CalendarEvent | WIRED | calendar-conversations authz test exists |
| 23 | Notifications | *(no dedicated page found)* | *(none)* | `/notifications` (3) | `notifications.js`, Notification | WIRED, no client module | Phase 4 |
| 24 | Institution | *(no dedicated page found)* | *(none)* | `/institution` (2) | `institution.js`, Institution | WIRED, no client module | Phase 4 |
| 25 | User administration | UserManagementPage, UserDetailPage | `services/users.ts` | `/users`, `/` (rbac) | `users.js`, `rbac.js` | WIRED | NEW-15 matrix authority, NEW-20 duplicate permission requests |
| 26 | Roles / permissions (RBAC) | *(admin pages, partial)* | *(none)* | `/` root-mounted (9) | `rbac.js`, `controllers/rbac/*`, Role/Permission/RolePermission/RoleAssignment/UserRole, `services/resolvePermissions.js` | WIRED, no client module | AUD-003/D-03 dual systems; permission matrix semantics |
| 27 | Audit logs | *(none found)* | *(none)* | `/` (rbac `auditLogs.controller.js`) | AuditLog, `services/auditLogger.js` | WIRED, no client module | NEW-21 dormant auditLogger; audit-write-once / write-counts tests exist |
| 28 | File storage | *(none)* | *(none)* | **not mounted** | `storage.js`, `StorageService`, `AzureBlobProvider`, File | **UNREACHABLE (intentional)** | AUD-001 / D-02 - do not re-mount without an approved access policy |
| 29 | Email | *(none)* | *(none)* | **not imported** | `email.js` (0 routes), `EmailService`, `emailController`, `config/email.js` | **UNREACHABLE** | AUD-017; D-01 says emails are admin-only |
| 30 | PDF | *(none)* | *(none)* | **not imported** | `pdf.js` (0 routes), `PdfService`, `pdfController` | **UNREACHABLE** | AUD-017 |
| 31 | Backup / restore | *(none)* | *(none)* | none | `services/backup/BackupService.js`, `utils/dbSafety.js` | script-only | NEW-14: password hashes in exports, restore atomicity; backup-consistency + restore-hardening tests exist |
| 32 | Google Drive upload | *(none)* | `services/googleDriveService.ts` | n/a | n/a | **DEAD** | No caller anywhere in `frontend/src`. Needs D-28 |
| 33 | Health | n/a | n/a | `/health` | `routes/index.js:68` | WIRED | DB-aware 200/503 |

## Phase-0 feature-level findings (new, from the repository)

- **F-01** (P2, code-level): `frontend/src/services/googleDriveService.ts` is dead code implementing a full Google Drive OAuth upload flow. Removing it is a feature removal -> owner approval (charter §16.2). Decision D-28.
- **F-02** (P2, code-level, = NEW-17): `/register` is publicly routed (`routes.tsx:46`) while registration is admin-only server-side. Users reach a page that cannot succeed. Decision D-27 (remove the route, gate it, or implement self-registration).
- **F-03** (P3, code-level): `projectReports.js` is mounted twice (`/project-reports` and `/reports`), doubling the reachable surface and any authorization mistake in it. Decision D-29.
- **F-04** (P2, code-level): nine API calls bypass the `services/` layer (`TasksPage.tsx` 4, `KanbanBoardView.tsx` 3, `SocietySwitcher.tsx` 1, `authStore.ts` 1). Highest-risk spots for inconsistent 401/403/429 handling (relates to NEW-09).
- **F-05** (P2, CI): `frontend/package.json` `"test:unit"` is a stub; the real frontend Node tests are not reachable through any npm script. Folds into AUD-015 / D-B5.
- **F-06** (P3): ten mounted backend areas have no frontend client module (dashboard, notes, sprints, transactions, boards, tasks, notifications, institution, rbac, audit logs). Phase 3/4 must decide, per area, whether each is consumed inline or genuinely unused.
