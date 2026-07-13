# IEEE SB APP (Frontend Workspace)

This repository currently contains the **frontend application** for IEEE Student Branch operations (finance-oriented dashboard + society operations modules), plus local developer tooling at the root.

The app is built with **React + TypeScript + Vite + Tailwind CSS** and is already wired to connect to a backend that follows a clear API contract.

---

## 1) What this project is

The frontend provides one platform for:
- Authentication (login/register/change password)
- Profile management
- Society management
- Event management
- Project management
- Report management
- Announcements
- Community hub (REST + realtime socket updates)
- Admin user listing (permission-gated)

The app is designed around **RBAC (role/permission-driven UI visibility)** and uses a shared API layer so backend teams can connect without rewriting UI logic.

---

## 2) Repository structure

```text
SB-APP/
├─ package.json                    # root: Husky + lint-staged configuration
├─ .husky/pre-commit              # secret checks + optional trufflehog + lint-staged
├─ frontend/
│  ├─ package.json                # frontend scripts and dependencies
│  ├─ .env.example                # VITE_API_BASE_URL
│  ├─ vite.config.ts              # dev server + /api and /socket.io proxy
│  ├─ tailwind.config.js          # design tokens and theme mapping
│  ├─ src/
│  │  ├─ main.tsx                 # app bootstrap
│  │  ├─ routes.tsx               # complete route map
│  │  ├─ lib/
│  │  │  ├─ api.ts                # Axios instance + auth interceptors
│  │  │  ├─ socket.ts             # socket.io client singleton
│  │  │  └─ permissions.ts        # access-level comparison helper
│  │  ├─ store/
│  │  │  ├─ authStore.ts          # token/user/permissions state
│  │  │  └─ themeStore.ts         # dark mode persistence
│  │  ├─ services/                # API service modules by domain
│  │  ├─ pages/                   # route pages (auth, modules, admin, landing)
│  │  ├─ components/
│  │  │  ├─ auth/                 # ProtectedRoute
│  │  │  ├─ layout/               # Layout/Header/Sidebar/AuthLayout
│  │  │  ├─ ui/                   # DataTable/Button/Pagination/etc.
│  │  │  └─ PermissionGate.tsx    # inline RBAC-gated rendering
│  │  ├─ hooks/                   # pagination + permission helpers
│  │  ├─ types/                   # API + model contracts
│  │  └─ index.css                # global styles + animations + CSS vars
│  ├─ mock/
│  │  ├─ mock-server.js           # json-server + custom routes + socket.io
│  │  └─ db.json                  # mock data
│  └─ public/
│     └─ logos/                   # society logos used by dashboard marquee
└─ logos/                         # repository-level static assets
```

> Note: root `package.json` references `backend/**/*` in lint-staged, but this clone currently contains only frontend code.

---

## 3) Local development setup

## Prerequisites
- Node.js 18+
- npm

## Install dependencies

From repository root:
```bash
npm install
```

From frontend:
```bash
cd frontend
npm install
```

## Environment
Create `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

## Run frontend
```bash
cd frontend
npm run dev
```
Frontend runs on `http://localhost:5173`.

## Run mock backend + socket server
```bash
cd frontend
npm run mock
```
Mock server runs on `http://localhost:5000` and serves API at `/api/v1`.

---

## 4) Scripts and quality commands

### Root
- `npm run prepare` → installs Husky hooks

### Frontend
- `npm run dev` → Vite dev server
- `npm run build` → TypeScript build + Vite production build
- `npm run lint` → ESLint
- `npm run typecheck` → TS noEmit check
- `npm run test:unit` → placeholder (`No tests yet`)
- `npm run preview` → preview built app
- `npm run mock` → start mock API/socket server

### Pre-commit behavior (`.husky/pre-commit`)
1. blocks staged secret-like files (`.env`, `.pem`, `.key`, etc.)
2. runs TruffleHog if available locally
3. runs npm audit if package files changed
4. runs lint-staged formatting

---

## 5) Frontend architecture in detail

## 5.1 App bootstrap and global wrappers
- `src/main.tsx`:
  - initializes theme **before mount** (`useThemeStore.getState().initTheme()`)
  - wraps app in `ErrorBoundary`
  - mounts router via `RouterProvider`
  - mounts `react-hot-toast` toaster

## 5.2 Routing topology (`src/routes.tsx`)
Routes are split into three layers:
1. Public landing route (`/`)
2. Auth layout routes (`/login`, `/register`)
3. Authenticated app layout routes under `<Layout/>` + `<ProtectedRoute/>`

Authenticated route groups:
- General protected:
  - `/dashboard`
  - `/profile`
  - `/change-password`
  - CRUD-style routes for societies/events/projects/reports/announcements
  - `/community`
- Admin-protected:
  - `/admin/users` requires module `users` and action `admin`

## 5.3 State management (Zustand)
### `authStore.ts`
Stores:
- `token`
- `user`
- `permissions`
- `isAuthenticated`

Persists state to `localStorage` and rehydrates using safe JSON parse.

Key methods:
- `login(email, password)`
- `register(name, email, password)`
- `logout()`
- `fetchPermissions()` from `/user/permissions`
- `getAccessLevel(module)`
- `updateUserProfile(data)`

### `themeStore.ts`
Stores and persists `darkMode`; toggles `.dark` class on `<html>`.

## 5.4 API layer
### Axios instance (`lib/api.ts`)
- base URL from `VITE_API_BASE_URL` (fallback `/api/v1`)
- request interceptor attaches the auth token in the HTTP authorization header when available
- response interceptor handles `401` by clearing token and redirecting to `/login`

### Service modules (`src/services/*`)
Each domain owns one service wrapper with typed methods.
Examples:
- `authService` (`/auth/login`, `/auth/register`, `/auth/change-password`)
- `societyService` (`/societies`)
- `eventService` (`/events`)
- `projectService` (`/projects`)
- `reportService` (`/reports`)
- `announcementService` (`/announcements`)
- `communityService` (`/community/messages`)
- `userService` (`/users`)

## 5.5 Permission model and gatekeeping
Permission data shape (`types/models.ts`):
```ts
{ module: string; action: string; accessLevel: 'none' | 'read' | 'write' | 'admin' | 'superadmin' }
```

UI enforcement happens in three places:
1. **Route-level**: `ProtectedRoute`
2. **Component-level**: `PermissionGate`
3. **Navigation-level**: `Sidebar` hides modules user cannot read

Action-to-level mapping treats `create` like `write`, and `delete` like `admin`.

## 5.6 UI foundation
- Tailwind tokens are mapped to CSS variables (`index.css` + `tailwind.config.js`)
- Dark mode switches token values by toggling `.dark`
- Reusable UI blocks:
  - `Button`
  - `DataTable` (sortable headers)
  - `SearchInput` (debounced)
  - `Pagination`
  - `LoadingSpinner`
  - `ErrorBoundary`

## 5.7 Security-conscious rendering
HTML content from API is sanitized before injection:
- `ReportDetailPage` uses `DOMPurify.sanitize(...)`
- `CommunityPage` uses `DOMPurify.sanitize(...)`

This is critical for backend teams returning rich text fields (`report.content`, message content).

## 5.8 Realtime communication
`lib/socket.ts` manages a socket.io singleton.
- Host derived from `VITE_API_BASE_URL` (removes `/api/v1`)
- token sent through `socket.auth`
- reconnection is enabled

Community module:
- initial fetch via REST (`GET /community/messages`)
- live updates via `community:message` socket event

---

## 6) Data contracts and expected backend response shapes

## 6.1 Envelope format (mandatory)
Frontend expects:
```json
{
  "success": true,
  "data": ...,
  "meta": { "page": 1, "limit": 20, "totalItems": 100, "totalPages": 5 }
}
```

For errors:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": {}
  }
}
```

Supported `ErrorCode` values are defined in `src/types/api.ts`.

## 6.2 Pagination contract
List endpoints should support:
- query params: `page`, `limit`
- response includes `meta` with `page`, `limit`, `totalItems`, `totalPages`

## 6.3 Auth contract
### POST `/auth/login`
Request:
```json
{ "email": "...", "password": "..." }
```
Response `data`:
```json
{
  "token": "jwt-or-token",
  "user": { "id": "...", "name": "...", "email": "..." }
}
```

### POST `/auth/register`
Request:
```json
{ "name": "...", "email": "...", "password": "..." }
```
Response shape same as login.

### POST `/auth/change-password`
Request:
```json
{ "currentPassword": "...", "newPassword": "..." }
```
Response:
```json
{ "success": true, "data": null }
```

## 6.4 Permission contract
### GET `/user/permissions`
Response:
```json
{
  "success": true,
  "data": {
    "permissions": [
      { "module": "societies", "action": "view", "accessLevel": "admin" }
    ]
  }
}
```

Important:
- `module` names must align with frontend module keys (`societies`, `events`, `projects`, `reports`, `announcements`, `community`, `users`).

## 6.5 Domain endpoints expected by frontend services
- Users: `GET /users`, `GET /users/:id`, `PATCH /users/:id`
- Societies: `GET /societies`, `GET /societies/:id`, `POST /societies`, `PATCH /societies/:id`
- Events: `GET /events`, `GET /events/:id`, `POST /events`, `PATCH /events/:id`, `DELETE /events/:id`
- Projects: `GET /projects`, `GET /projects/:id`, `POST /projects`, `PATCH /projects/:id`, `DELETE /projects/:id`
- Reports: `GET /reports`, `GET /reports/:id`, `POST /reports`, `PATCH /reports/:id`, `DELETE /reports/:id`
- Announcements: `GET /announcements`, `GET /announcements/:id`, `POST /announcements`, `PATCH /announcements/:id`, `DELETE /announcements/:id`
- Community: `GET /community/messages`, `POST /community/messages`

## 6.6 Model fields used by UI
Core fields consumed by screens are in `src/types/models.ts`.
Backend should preserve these names for seamless integration (or coordinate a typed migration).

---

## 7) How backend team can connect quickly (step-by-step)

1. Implement endpoints under `/api/v1` (or update `VITE_API_BASE_URL` accordingly).
2. Return the exact response envelope (`success`, `data`, optional `meta`).
3. Implement permission endpoint with correct module keys.
4. Ensure the backend reads the auth token from the HTTP authorization header.
5. For community realtime, emit `community:message` with `CommunityMessage` payload.
6. Verify CORS and credentials for local dev (`localhost:5173`).
7. Point frontend `.env` to real backend URL.
8. Run frontend and validate:
   - login -> permissions fetch -> sidebar visibility
   - list pages pagination/search/sort
   - create/edit/delete flows
   - community live updates

---

## 8) How extra-feature teams can extend the app cleanly

When adding a new module (example: `budgets`), follow this existing pattern:

1. **Type contracts**
   - add model in `src/types/models.ts`
   - add API typing if needed in `src/types/api.ts`

2. **Service layer**
   - create `src/services/budgets.ts`
   - include list/detail/create/update/delete methods

3. **Pages**
   - create list/detail/form pages under `src/pages/budgets/`

4. **Routing**
   - register routes in `src/routes.tsx`
   - wrap protected routes using `ProtectedRoute`/module requirements when needed

5. **Navigation and RBAC**
   - add sidebar item in `Sidebar.tsx`
   - use `PermissionGate` for action-level controls

6. **UI consistency**
   - reuse existing `DataTable`, `SearchInput`, `Pagination`, `Button`, `LoadingSpinner`
   - follow tokenized classes (`text-ink`, `bg-surface`, etc.)

7. **Validation/security**
   - use `zod` + `react-hook-form` in forms
   - sanitize any HTML before `dangerouslySetInnerHTML`

8. **Realtime (optional)**
   - extend `lib/socket.ts` event handling if module needs live updates

---

## 9) Mock server details (for local/offline development)

`frontend/mock/mock-server.js` provides:
- json-server data source (`db.json`)
- auth mock endpoints
- permission mock endpoint
- pagination wrappers
- REST CRUD mapping to collections
- socket.io server
- broadcast on community message creation

Resource map implemented:
- `/api/v1/users` -> `users`
- `/api/v1/societies` -> `societies`
- `/api/v1/events` -> `events`
- `/api/v1/projects` -> `projects`
- `/api/v1/reports` -> `reports`
- `/api/v1/announcements` -> `announcements`
- `/api/v1/community/messages` -> `communityMessages`

---

## 10) Route/module matrix

| Route | Purpose | Protection |
|---|---|---|
| `/` | Marketing/landing | Public |
| `/login`, `/register` | Auth entry | Public (AuthLayout) |
| `/dashboard` | Overview + cards + carousel + marquee | Auth required |
| `/profile` | User profile | Auth required |
| `/change-password` | Password change | Auth required |
| `/societies*` | Society CRUD/list/detail | Auth required + action-based buttons |
| `/events*` | Event CRUD/list/detail | Auth required + action-based buttons |
| `/projects*` | Project CRUD/list/detail | Auth required + action-based buttons |
| `/reports*` | Report CRUD/list/detail | Auth required + action-based buttons |
| `/announcements*` | Announcement CRUD/list/detail | Auth required + action-based buttons |
| `/community` | Chat/community hub | Auth required |
| `/admin/users` | User management | Requires `users` + `admin` |

---

## 11) Important integration cautions

1. **401 handling is global**: any unauthorized API response logs user out and redirects to `/login`.
2. **Permissions drive UI visibility**: missing or wrong module keys hide routes/actions.
3. **Pagination meta is required on list pages**: without it, paging controls break.
4. **Rich text must be trusted+sanitized**: frontend sanitizes, but backend should still validate/stored content safely.
5. **Socket URL is derived from API base URL**: keep API base predictable (`.../api/v1`).

---

## 12) Recommended backend handover checklist

- [ ] `/api/v1` base reachable from frontend
- [ ] Auth endpoints return expected `token + user`
- [ ] `/user/permissions` returns correct module names and levels
- [ ] All list endpoints return `data[] + meta`
- [ ] CRUD endpoints align with service method paths
- [ ] CORS allows frontend host(s)
- [ ] `community:message` socket emission implemented
- [ ] Error envelope (`success:false/error.code/message`) standardized
- [ ] Validate production behavior with `npm run build` and `npm run preview`

---

## 13) Current limitations / known realities

- No production backend code in this repository clone yet.
- Unit tests are currently placeholder (`test:unit`).
- Some dashboard comments indicate future Team 2/Team 4 integration for richer backend-driven data fields (e.g., logo URLs).

---

## 14) Quick start (TL;DR)

```bash
# terminal 1
cd frontend
cp .env.example .env
npm install
npm run mock

# terminal 2
cd frontend
npm run dev
```

Open `http://localhost:5173`.
