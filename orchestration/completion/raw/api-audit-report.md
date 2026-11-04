Totals: 128 declarations in routes/*.js (excl. 1 inline `GET /health` in routes/index.js = 129); 124 mounted, 4 in unmounted files; 64 frontend API call sites.

### Flag A - mounted endpoints with NO authentication in the chain
- `POST /auth/login` (auth.js:31) chain: authLimiter
- `POST /societies/:societyId/importer/slack` (importers.js:125) chain: importGuards
- `POST /societies/:societyId/importer/todoist` (importers.js:178) chain: importGuards

### Flag B - authenticated MUTATING endpoints with no permission / admin / society guard in the route chain (inline checks possible: review the handler)
- `POST /auth/change-password` (auth.js:182) chain: authenticate ; authLimiter
- `POST /conversations` (conversations.js:99) chain: (none)
- `POST /conversations/:id/messages` (conversations.js:219) chain: (none)
- `POST /events/:id/register` (events.js:424) chain: (none)
- `PATCH /notifications/:id/read` (notifications.js:31) chain: authenticate
- `PATCH /notifications/read-all` (notifications.js:53) chain: authenticate
- `POST /role-permissions` (rbac.js:64) chain: authenticate ; rolePermissionsController.updateRolePermission
- `POST /access/check` (rbac.js:87) chain: authenticate ; accessCheckLimiter ; accessCheckController.checkAccess
- `POST /tasks` (tasks.js:60) chain: (none)
- `PUT /tasks/:id` (tasks.js:134) chain: (none)
- `DELETE /tasks/:id` (tasks.js:162) chain: (none)
- `PATCH /users/:id` (users.js:115) chain: (none)

### Flag C - authenticated GET endpoints with no permission / admin / society guard in the route chain
- `GET /announcements` (announcements.js:66)
- `GET /announcements/:id` (announcements.js:90)
- `GET /auth/me` (auth.js:170)
- `GET /calendar` (calendar.js:177)
- `GET /calendar/:id` (calendar.js:216)
- `GET /conversations` (conversations.js:68)
- `GET /conversations/:id/messages` (conversations.js:178)
- `GET /events` (events.js:24)
- `GET /events/:id` (events.js:71)
- `GET /institution` (institution.js:15)
- `GET /notifications` (notifications.js:7)
- `GET /opportunities/societies` (opportunities.js:16)
- `GET /opportunities` (opportunities.js:28)
- `GET /project-reports , /reports` (projectReports.js:50)
- `GET /project-reports/project/:projectId , /reports/project/:projectId` (projectReports.js:102)
- `GET /project-reports/:id , /reports/:id` (projectReports.js:143)
- `GET /projects` (projects.js:17)
- `GET /projects/:id` (projects.js:60)
- `GET /permissions` (rbac.js:49)
- `GET /role-permissions` (rbac.js:59)
- `GET /user/permissions` (rbac.js:72)
- `GET /societies` (societies.js:104)
- `GET /societies/:id` (societies.js:147)
- `GET /societies/:id/office-bearers` (societies.js:278)
- `GET /societies/:id/members` (societies.js:430)
- `GET /societies/:id/terms` (societies.js:710)
- `GET /tasks` (tasks.js:40)

### Flag D - frontend API calls with no matching backend route (possible contract mismatch)
- `POST /channels/:p/members` from services/channels.ts
- `DELETE /channels/:p/members` from services/channels.ts
- `GET /conversations/:p` from services/conversations.ts

### Flag E - mounted endpoints with no frontend call site found (informational)
`GET /auth/me`, `DELETE /boards/cards/:id`, `GET /calendar`, `GET /calendar/:id`, `PUT /calendar/:id`, `DELETE /calendar/:id`, `GET /channels/messages/:messageId/replies`, `POST /channels/messages/:messageId/replies`, `POST /channels/messages/:messageId/reactions`, `GET /dashboard`, `GET /dashboard/society/:societyId`, `PUT /events/:id`, `POST /events/:id/speakers`, `POST /events/:id/register`, `GET /events/:id/registrations`, `POST /societies/:societyId/importer/slack`, `POST /societies/:societyId/importer/todoist`, `GET /institution`, `PATCH /institution/logo`, `GET /societies/:societyId/notes`, `POST /societies/:societyId/notes`, `GET /societies/:societyId/notes/:noteId`, `PUT /societies/:societyId/notes/:noteId`, `DELETE /societies/:societyId/notes/:noteId`, `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `GET /project-reports/project/:projectId`, `PUT /projects/:id`, `GET /roles`, `POST /roles`, `GET /permissions`, `POST /permissions`, `GET /role-permissions`, `POST /role-permissions`, `GET /audit-logs`, `POST /access/check`, `PATCH /societies/:id/budget`, `PATCH /societies/:id/logo`, `PATCH /societies/:id/signature`, `GET /societies/:id/office-bearers`, `POST /societies/:id/office-bearers`, `PUT /societies/:id/office-bearers/:obId`, `DELETE /societies/:id/office-bearers/:obId`, `GET /societies/:id/members`, `POST /societies/:id/members`, `DELETE /societies/:id/members/:memberId`, `PUT /societies/:id/office-bearers`, `PUT /societies/:id/members`, `GET /societies/:societyId/roadmap/sprints`, `POST /societies/:societyId/roadmap/sprints`, `PUT /societies/:societyId/roadmap/sprints/:sprintId`, `GET /societies/:societyId/roadmap/milestones`, `POST /societies/:societyId/roadmap/milestones`, `GET /transactions`, `GET /transactions/society/:societyId`, `GET /transactions/:id`, `POST /transactions`, `PUT /transactions/:id`, `DELETE /transactions/:id`, `PATCH /transactions/:id/approve`, `PATCH /transactions/:id/reject`, `POST /transactions/:id/reverse`, `POST /users/:id/reset-password`

### Full table (mounted)
| Method | Path | Auth | Permission | Admin/role | Society guard | Limiter | Frontend callers | Source |
|---|---|---|---|---|---|---|---|---|
| GET | `/announcements` | yes | - | - | - | - | 1 file(s) | announcements.js:66 |
| GET | `/announcements/:id` | yes | - | - | - | - | 1 file(s) | announcements.js:90 |
| POST | `/announcements` | yes | announcements,create | - | - | - | 1 file(s) | announcements.js:119 |
| DELETE | `/announcements/:id` | yes | announcements,delete | - | - | - | 1 file(s) | announcements.js:197 |
| PATCH | `/announcements/:id` | yes | announcements,edit | - | - | - | 1 file(s) | announcements.js:233 |
| POST | `/auth/login` | **NO** | - | - | - | authLimiter | 1 file(s) | auth.js:31 |
| POST | `/auth/register` | yes | - | yes | - | registrationLimiter | 1 file(s) | auth.js:106 |
| GET | `/auth/me` | yes | - | - | - | - | none | auth.js:170 |
| POST | `/auth/change-password` | yes | - | - | - | authLimiter | 1 file(s) | auth.js:182 |
| GET | `/boards/:channelId/cards` | yes | community_hub,view | - | yes | - | 1 file(s) | boards.js:57 |
| POST | `/boards/:channelId/cards` | yes | community_hub,create | - | yes | - | 1 file(s) | boards.js:80 |
| PUT | `/boards/cards/:id` | yes | community_hub,edit | - | yes | - | 1 file(s) | boards.js:135 |
| DELETE | `/boards/cards/:id` | yes | community_hub,delete | - | yes | - | none | boards.js:183 |
| GET | `/calendar/unified` | yes | - | - | yes | - | 1 file(s) | calendar.js:22 |
| GET | `/calendar` | yes | - | - | - | - | none | calendar.js:177 |
| GET | `/calendar/:id` | yes | - | - | - | - | none | calendar.js:216 |
| POST | `/calendar` | yes | events,create | - | yes | - | 1 file(s) | calendar.js:244 |
| PUT | `/calendar/:id` | yes | events,edit | - | yes | - | none | calendar.js:294 |
| DELETE | `/calendar/:id` | yes | events,delete | - | yes | - | none | calendar.js:359 |
| GET | `/channels` | yes | community_hub,view | - | yes | - | 1 file(s) | channels.js:47 |
| GET | `/channels/:id` | yes | community_hub,view | - | yes | - | 1 file(s) | channels.js:110 |
| POST | `/channels` | yes | community_hub,create | - | yes | - | 1 file(s) | channels.js:140 |
| PUT | `/channels/:id` | yes | community_hub,edit | - | yes | - | 1 file(s) | channels.js:205 |
| DELETE | `/channels/:id` | yes | community_hub,delete | - | yes | - | 1 file(s) | channels.js:243 |
| GET | `/channels/:id/messages` | yes | community_hub,view | - | yes | - | 1 file(s) | channels.js:280 |
| POST | `/channels/:id/messages` | yes | community_hub,create | - | yes | - | 1 file(s) | channels.js:335 |
| GET | `/channels/messages/:messageId/replies` | yes | community_hub,view | - | yes | - | none | channels.js:431 |
| POST | `/channels/messages/:messageId/replies` | yes | community_hub,create | - | yes | - | none | channels.js:485 |
| POST | `/channels/messages/:messageId/reactions` | yes | community_hub,create | - | yes | - | none | channels.js:563 |
| POST | `/channels/messages/:messageId/poll/vote` | yes | community_hub,create | - | yes | - | 1 file(s) | channels.js:635 |
| GET | `/community/messages` | yes | community_hub,view | - | yes | - | 1 file(s) | community.js:17 |
| POST | `/community/messages` | yes | community_hub,create | - | yes | - | 1 file(s) | community.js:46 |
| GET | `/conversations/recipients` | yes | community_hub,view | - | - | - | 1 file(s) | conversations.js:35 |
| GET | `/conversations` | yes | - | - | - | - | 1 file(s) | conversations.js:68 |
| POST | `/conversations` | yes | - | - | - | - | 1 file(s) | conversations.js:99 |
| GET | `/conversations/:id/messages` | yes | - | - | - | - | 1 file(s) | conversations.js:178 |
| POST | `/conversations/:id/messages` | yes | - | - | - | - | 1 file(s) | conversations.js:219 |
| GET | `/dashboard` | yes | - | yes | - | - | none | dashboard.js:19 |
| GET | `/dashboard/society/:societyId` | yes | - | - | yes | - | none | dashboard.js:100 |
| GET | `/events` | yes | - | - | - | - | 1 file(s) | events.js:24 |
| GET | `/events/:id` | yes | - | - | - | - | 1 file(s) | events.js:71 |
| POST | `/events` | yes | events,create | - | yes | - | 1 file(s) | events.js:99 |
| PUT | `/events/:id` | yes | events,edit | - | yes | - | none | events.js:178 |
| PATCH | `/events/:id` | yes | events,edit | - | yes | - | 1 file(s) | events.js:253 |
| DELETE | `/events/:id` | yes | events,delete | - | yes | - | 1 file(s) | events.js:335 |
| POST | `/events/:id/speakers` | yes | events,edit | - | yes | - | none | events.js:379 |
| POST | `/events/:id/register` | yes | - | - | - | - | none | events.js:424 |
| GET | `/events/:id/registrations` | yes | events,edit | - | - | - | none | events.js:480 |
| POST | `/societies/:societyId/importer/slack` | **NO** | - | - | - | - | none | importers.js:125 |
| POST | `/societies/:societyId/importer/todoist` | **NO** | - | - | - | - | none | importers.js:178 |
| GET | `/institution` | yes | - | - | - | - | none | institution.js:15 |
| PATCH | `/institution/logo` | yes | - | yes | - | - | none | institution.js:42 |
| GET | `/societies/:societyId/notes` | yes | community_hub,view | - | yes | - | none | notes.js:50 |
| POST | `/societies/:societyId/notes` | yes | community_hub,create | - | yes | - | none | notes.js:81 |
| GET | `/societies/:societyId/notes/:noteId` | yes | community_hub,view | - | yes | - | none | notes.js:116 |
| PUT | `/societies/:societyId/notes/:noteId` | yes | community_hub,edit | - | yes | - | none | notes.js:139 |
| DELETE | `/societies/:societyId/notes/:noteId` | yes | community_hub,delete | - | yes | - | none | notes.js:177 |
| GET | `/notifications` | yes | - | - | - | - | none | notifications.js:7 |
| PATCH | `/notifications/:id/read` | yes | - | - | - | - | none | notifications.js:31 |
| PATCH | `/notifications/read-all` | yes | - | - | - | - | none | notifications.js:53 |
| GET | `/opportunities/societies` | yes | - | - | - | - | 1 file(s) | opportunities.js:16 |
| GET | `/opportunities` | yes | - | - | - | - | 1 file(s) | opportunities.js:28 |
| GET | `/project-reports , /reports` | yes | - | - | - | - | 1 file(s) | projectReports.js:50 |
| GET | `/project-reports/project/:projectId , /reports/project/:projectId` | yes | - | - | - | - | none | projectReports.js:102 |
| GET | `/project-reports/:id , /reports/:id` | yes | - | - | - | - | 1 file(s) | projectReports.js:143 |
| POST | `/project-reports , /reports` | yes | reports,create | - | yes | - | 1 file(s) | projectReports.js:171 |
| PATCH | `/project-reports/:id , /reports/:id` | yes | reports,edit | - | yes | - | 1 file(s) | projectReports.js:248 |
| DELETE | `/project-reports/:id , /reports/:id` | yes | reports,delete | - | yes | - | 1 file(s) | projectReports.js:313 |
| GET | `/projects` | yes | - | - | - | - | 1 file(s) | projects.js:17 |
| GET | `/projects/:id` | yes | - | - | - | - | 1 file(s) | projects.js:60 |
| POST | `/projects` | yes | projects,create | - | yes | - | 1 file(s) | projects.js:88 |
| PUT | `/projects/:id` | yes | projects,edit | - | yes | - | none | projects.js:147 |
| PATCH | `/projects/:id` | yes | projects,edit | - | yes | - | 1 file(s) | projects.js:207 |
| DELETE | `/projects/:id` | yes | projects,delete | - | yes | - | 1 file(s) | projects.js:274 |
| GET | `/roles` | yes | roles_access,view | - | - | - | none | rbac.js:34 |
| POST | `/roles` | yes | roles_access,create | - | - | - | none | rbac.js:40 |
| GET | `/permissions` | yes | - | - | - | - | none | rbac.js:49 |
| POST | `/permissions` | yes | - | yes | - | - | none | rbac.js:50 |
| GET | `/role-permissions` | yes | - | - | - | - | none | rbac.js:59 |
| POST | `/role-permissions` | yes | - | - | - | - | none | rbac.js:64 |
| GET | `/user/permissions` | yes | - | - | - | - | 1 file(s) | rbac.js:72 |
| GET | `/audit-logs` | yes | roles_access,view | - | - | - | none | rbac.js:79 |
| POST | `/access/check` | yes | - | - | - | accessCheckLimiter | none | rbac.js:87 |
| GET | `/societies` | yes | - | - | - | - | 2 file(s) | societies.js:104 |
| GET | `/societies/:id` | yes | - | - | - | - | 1 file(s) | societies.js:147 |
| PATCH | `/societies/:id/budget` | yes | - | yes | - | - | none | societies.js:176 |
| PATCH | `/societies/:id/logo` | yes | - | - | yes | - | none | societies.js:214 |
| PATCH | `/societies/:id/signature` | yes | - | - | yes | - | none | societies.js:245 |
| GET | `/societies/:id/office-bearers` | yes | - | - | - | - | none | societies.js:278 |
| POST | `/societies/:id/office-bearers` | yes | - | - | yes | - | none | societies.js:309 |
| PUT | `/societies/:id/office-bearers/:obId` | yes | - | - | yes | - | none | societies.js:345 |
| DELETE | `/societies/:id/office-bearers/:obId` | yes | - | - | yes | - | none | societies.js:397 |
| GET | `/societies/:id/members` | yes | - | - | - | - | none | societies.js:430 |
| POST | `/societies/:id/members` | yes | - | - | yes | - | none | societies.js:466 |
| DELETE | `/societies/:id/members/:memberId` | yes | - | - | yes | - | none | societies.js:511 |
| PUT | `/societies/:id/office-bearers` | yes | - | - | yes | - | none | societies.js:542 |
| PUT | `/societies/:id/members` | yes | - | - | yes | - | none | societies.js:571 |
| POST | `/societies` | yes | - | yes | - | - | 1 file(s) | societies.js:600 |
| PATCH | `/societies/:id` | yes | settings,edit | - | yes | - | 1 file(s) | societies.js:662 |
| GET | `/societies/:id/terms` | yes | - | - | - | - | 1 file(s) | societies.js:710 |
| POST | `/societies/:id/terms` | yes | - | yes | - | - | 1 file(s) | societies.js:732 |
| PATCH | `/societies/:id/terms/:termId/handover` | yes | - | - | yes | - | 1 file(s) | societies.js:769 |
| GET | `/societies/:societyId/roadmap/sprints` | yes | community_hub,view | - | yes | - | none | sprints.js:26 |
| POST | `/societies/:societyId/roadmap/sprints` | yes | community_hub,create | - | yes | - | none | sprints.js:50 |
| PUT | `/societies/:societyId/roadmap/sprints/:sprintId` | yes | community_hub,edit | - | yes | - | none | sprints.js:80 |
| GET | `/societies/:societyId/roadmap/milestones` | yes | community_hub,view | - | yes | - | none | sprints.js:112 |
| POST | `/societies/:societyId/roadmap/milestones` | yes | community_hub,create | - | yes | - | none | sprints.js:136 |
| GET | `/tasks` | yes | - | - | - | - | 1 file(s) | tasks.js:40 |
| POST | `/tasks` | yes | - | - | - | - | 1 file(s) | tasks.js:60 |
| PUT | `/tasks/:id` | yes | - | - | - | - | 1 file(s) | tasks.js:134 |
| DELETE | `/tasks/:id` | yes | - | - | - | - | 1 file(s) | tasks.js:162 |
| GET | `/transactions` | yes | 'finance','view' | yes | - | - | none | transactions.js:129 |
| GET | `/transactions/society/:societyId` | yes | 'finance','view' | - | yes | - | none | transactions.js:155 |
| GET | `/transactions/:id` | yes | 'finance','view' | - | - | - | none | transactions.js:181 |
| POST | `/transactions` | yes | 'finance','create' | - | yes | - | none | transactions.js:210 |
| PUT | `/transactions/:id` | yes | 'finance','edit' | - | - | - | none | transactions.js:263 |
| DELETE | `/transactions/:id` | yes | 'finance','delete' | - | - | - | none | transactions.js:309 |
| PATCH | `/transactions/:id/approve` | yes | 'finance','approve' | - | - | - | none | transactions.js:395 |
| PATCH | `/transactions/:id/reject` | yes | 'finance','approve' | - | - | - | none | transactions.js:402 |
| POST | `/transactions/:id/reverse` | yes | 'finance','edit' | - | - | - | none | transactions.js:410 |
| GET | `/users` | yes | - | yes | - | - | 1 file(s) | users.js:17 |
| GET | `/users/:id` | yes | - | yes | - | - | 1 file(s) | users.js:38 |
| POST | `/users/:id/reset-password` | yes | - | yes | - | authLimiter | none | users.js:66 |
| PATCH | `/users/:id` | yes | - | - | - | - | 1 file(s) | users.js:115 |

### Declared in UNMOUNTED files (not reachable)
- `POST /upload` (storage.js:20) chain: upload.single("file") ; storageController.upload.bind(storageController)
- `GET /files` (storage.js:30) chain: storageController.list.bind(storageController)
- `GET /download/:blobName` (storage.js:36) chain: storageController.download.bind(storageController)
- `DELETE /:blobName` (storage.js:45) chain: storageController.delete.bind(storageController)
