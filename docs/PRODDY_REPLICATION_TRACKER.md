# IEEE SB-APP: Master Execution Tracker & Phase-Wise Quality Framework

> **Strategy:** Build → Test → Validate → Ship. No rushing. Quality over speed.
> **Stack Alignment:** Node.js/Express + Mongoose (MongoDB) + Socket.io + Zustand + React 19 + Tailwind CSS + Axios.
> **Philosophy:** Every vertical ships with tests, documentation, and a quality gate before moving to the next.

---

## 🛠️ Stack Audit & Native Substitutions

| Feature Module | Proddy Reference Tool | SB-APP Native Replacement | Rationale |
|:---|:---|:---|:---|
| **State Management** | Jotai | **Zustand** (`src/store/`) | Already used for auth & theme state in `frontend/` |
| **Real-time Sync & Presence** | Convex / `@convex-dev/presence` | **Socket.io Client & Server** | Socket.io server and auth middleware are live in `server.js` |
| **Rich Text Notes & Editing** | BlockNote / ProseMirror Sync | **Quill / TipTap** + **DOMPurify** | `dompurify` is already installed in `frontend/package.json` |
| **Multiplayer Whiteboard** | Liveblocks + Excalidraw | **HTML5 Canvas / SVG** + **Socket.io state broadcast** | Prevents paid third-party API dependencies (Liveblocks) |
| **In-App & Email Notifications** | Resend / OneSignal | **Mongoose `Notification` Model** + **Socket.io** | Existing `Notification.js` schema in backend |
| **Storage Assets** | `@convex-dev/storage` | **Azure Blob Storage / Multer** | `@azure/storage-blob` & `multer` are in root `package.json` |
| **Database & Auth** | Convex Database | **Mongoose / MongoDB + JWT Auth** | Native backend models already set up in `backend/src/models/` |

---

## How to Use This Tracker

- **Status:** `[ ]` Not started | `[~]` In progress | `[x]` Done | `[!]` Blocked
- **Quality Gate:** Must pass before next phase/vertical starts
- **Testing:** Every phase has required automated/manual test coverage before marking done
- **Review:** Every vertical gets a code review before merge

---

## 📊 Phase-Wise Progress Dashboard

| Phase | Feature Module | Target Scope | Tests | Quality Gate | Status |
|:---:|:---|:---|:---:|:---:|:---:|
| **Phase 1** | **Platform Foundation & Society RBAC** | Auth, Society setup, Mongoose schemas, Layout shell | 3 / 5 | Pending | `[~]` |
| **Phase 2** | **Channels & Real-Time Messaging** | Channels, Messages, Threads, Socket.io rooms, DMs | 0 / 8 | Pending | `[ ]` |
| **Phase 3** | **Board / Kanban & Projects** | Dual System (Lists+Cards & Statuses+Issues), Drag & Drop | 0 / 7 | Pending | `[ ]` |
| **Phase 4** | **3-Source Unified Calendar** | Aggregated query merging Events, Messages, Tasks/Cards | 0 / 6 | Pending | `[ ]` |
| **Phase 5** | **Tasks & Categories** | Scoped user tasks, Categories, Priority lifecycles | 0 / 5 | Pending | `[ ]` |
| **Phase 6** | **Presence & Typing Matrix** | Ephemeral Socket.io typing & presence, User status state | 0 / 5 | Pending | `[ ]` |
| **Phase 7** | **Notes & Collaborative Canvas** | Mongoose Note model, DOMPurify HTML, Canvas Socket sync | 0 / 4 | Pending | `[ ]` |
| **Phase 8** | **Sprints & Society Milestones** | Time-boxed Sprints model, Milestones, Visual Roadmap | 0 / 4 | Pending | `[ ]` |
| **Phase 9** | **In-App & Socket Notifications** | Mongoose `Notification` store, Socket.io alerts, Badges | 0 / 4 | Pending | `[ ]` |
| **Phase 10** | **Data Export & Importers** | Custom REST API routes for Slack/Linear/Todoist JSON/CSV | 0 / 4 | Pending | `[ ]` |

---

## 🚀 PHASE 1: PLATFORM FOUNDATION & SOCIETY RBAC

> **Goal:** Validated auth sessions, society permissions, base navigation shell, and core Mongoose models.

### 1.1 Auth Session & State Integration
- [x] Connect Zustand auth store (`src/store/authStore.ts`) with login/register endpoints
- [x] Configure Axios interceptor (`src/lib/api.ts`) for JWT auto-refresh and 401 handling
- [x] Verify token storage in HTTP-only cookies / local secure memory

**Tests & Validation:**
- [x] User can register, login, refresh token, and logout without state desync
- [x] Invalid credentials return proper 401 error envelope
- [x] Password hash is never exposed in API responses

---

### 1.2 Society Navigation & Shell Layout
- [ ] Render society switcher in `src/components/layout/`
- [ ] Render collapsible channels menu for active society
- [ ] Implement theme switcher utilizing existing `themeStore.ts` (Dark/Light mode)

**Tests & Validation:**
- [ ] Switching active society updates visible channels and permissions immediately
- [ ] Navigation shell responds dynamically to mobile and desktop screens

---

### 1.3 Role-Based Access Control (RBAC) Gating
- [ ] Bind backend `UserRole.js` and `RolePermission.js` to frontend permission gates
- [ ] Wrap sensitive UI elements (create channel, delete project) in `PermissionGate` component

**Tests & Validation:**
- [ ] Unauthorized roles are hidden from administrative buttons
- [ ] Direct URL navigation to admin pages blocks non-authorized users

---

### **PHASE 1 EXIT QUALITY GATE**
- [ ] Clean install & dev boot passes (`npm run dev`)
- [ ] All Phase 1 auth & RBAC integration tests pass
- [ ] Zero circular dependencies or broken imports

---

## 💬 PHASE 2: CHANNELS & REAL-TIME MESSAGING

> **Goal:** Full messaging system with real-time Socket.io pub/sub, threads, DMs, and reactions.

### 2.1 Channel Management
- [ ] Implement Express routes `/api/v1/societies/:societyId/channels`
- [ ] Validate kebab-case slugging in `Channel.js` model
- [ ] Render channel list by type (`chat` vs `board`)

**Tests & Validation:**
- [ ] Admin can create/edit/delete channels
- [ ] Deleting a channel cascades and cleans up child messages

---

### 2.2 Real-time Chat Feed & Threads
- [ ] Build paginated chat message loader in frontend
- [ ] Wire Socket.io `message:send` and `message:new` handlers in `src/lib/socket.ts`
- [ ] Implement thread replies (`parentMessageId`) with denormalized reply counters

**Tests & Validation:**
- [ ] Messages appear instantly for all users in the channel room without refresh
- [ ] Thread drawer renders child replies and maintains correct count

---

### 2.3 Direct Messages & Emoji Reactions
- [ ] Implement idempotent DM creation route `/api/v1/conversations/get-or-create`
- [ ] Add emoji reaction toggle matching `Reaction.js` schema
- [ ] Parse `@mentions` and poll options embedded in `Message.js`

**Tests & Validation:**
- [ ] DM conversation is unique per pair of users within a society
- [ ] Emoji reactions update live across connected sockets

---

### **PHASE 2 EXIT QUALITY GATE**
- [ ] Socket reconnection test passes (disconnecting and reconnecting restores state)
- [ ] Paginated infinite scroll handles 500+ messages smoothly
- [ ] Code review completed for all messaging controllers & hooks

---

## 📋 PHASE 3: BOARD / KANBAN & PROJECTS

> **Goal:** Dual-system board (`Lists`+`Cards` & `Statuses`+`Issues`) with drag-and-drop and issue dependencies.

### 3.1 Dual-Card System & Columns
- [ ] Connect `Project.js` models to board channels
- [ ] Build Kanban board with custom status columns (`lists` / `statuses`)
- [ ] Implement card edit drawer and detail modals

**Tests & Validation:**
- [ ] Cards render accurately in correct status columns
- [ ] Sub-card hierarchy renders parent-child links correctly

---

### 3.2 Drag-and-Drop & Dependencies
- [ ] Build drag-and-drop column/card reordering with batch order API updates
- [ ] Implement blocked/blocking card dependencies (`issueBlocking`)
- [ ] Post status update announcements automatically to connected chat channels

**Tests & Validation:**
- [ ] Reordering cards updates database sequence persistently
- [ ] Moving card to "Done" triggers automated channel post

---

### **PHASE 3 EXIT QUALITY GATE**
- [ ] Concurrent card drag operations do not cause race conditions
- [ ] All card CRUD operations pass integration tests

---

## 📅 PHASE 4: 3-SOURCE UNIFIED CALENDAR

> **Goal:** Merged calendar view aggregating direct events, message-linked dates, and task/project deadlines.

### 4.1 Aggregated Calendar Engine
- [ ] Implement Express controller `/api/v1/societies/:societyId/calendar/unified`
- [ ] Fetch and combine data from `CalendarEvent.js`, `Message.js` (calendarEvent field), and `Project.js`/`Task` due dates
- [ ] Build Tailwind CSS month grid component with date filters

**Tests & Validation:**
- [ ] Calendar accurately displays items from all three sources in single date cells
- [ ] Filter toggles show/hide specific event types correctly

---

### 4.2 Message Dual-Write & Dashboard Widget
- [ ] Implement message action to attach date (`createCalendarEvent` dual-write)
- [ ] Build 7-day upcoming events preview widget on main dashboard

**Tests & Validation:**
- [ ] Adding event to message updates calendar instantly
- [ ] Dashboard widget reflects upcoming 7 days accurately

---

### **PHASE 4 EXIT QUALITY GATE**
- [ ] Date math verified across month transitions using `date-fns`
- [ ] Aggregation query response time < 150ms for 1,000 events

---

## ✅ PHASE 5: TASKS & CATEGORIES

> **Goal:** Personal and team task management with lifecycles and categories.

### 5.1 Task Management & Lifecycle
- [ ] Build `Task` Mongoose model bound to user and society
- [ ] Implement status transitions (`not_started`, `in_progress`, `completed`, `on_hold`)
- [ ] Implement custom color-coded task categories

**Tests & Validation:**
- [ ] Tasks are properly isolated per user within society scope
- [ ] Task completion updates completion progress metrics

---

### **PHASE 5 EXIT QUALITY GATE**
- [ ] Task filtering by category, priority, and due date works seamlessly

---

## ⚡ PHASE 6: PRESENCE & REAL-TIME MATRIX

> **Goal:** Ephemeral Socket.io presence, typing indicators, and user status derivation.

### 6.1 Ephemeral Presence & Typing
- [ ] Track active user socket connections in server memory
- [ ] Broadcast `typing:start` and `typing:stop` over Socket.io room channels
- [ ] Derive user states (`online`, `idle`, `dnd`, `offline`) with 15s heartbeat

**Tests & Validation:**
- [ ] Typing indicator disappears after 3 seconds of inactivity
- [ ] User status indicator updates across all client sidebars

---

### **PHASE 6 EXIT QUALITY GATE**
- [ ] Zero memory leaks in socket connection tracking Map after 1,000 connect/disconnect cycles

---

## 📝 PHASE 7: NOTES & COLLABORATIVE CANVAS

> **Goal:** Collaborative channel document notes and HTML5 real-time whiteboard canvas.

### 7.1 Notes & Canvas Synchronization
- [ ] Build `Note` Mongoose schema with `DOMPurify` HTML sanitization
- [ ] Implement HTML5 Canvas drawing view
- [ ] Stream vector draw strokes over Socket.io to active room members

**Tests & Validation:**
- [ ] Rich text note content sanitizes raw HTML safely before rendering
- [ ] Drawing on canvas replicates strokes live to other room participants

---

### **PHASE 7 EXIT QUALITY GATE**
- [ ] XSS vectors blocked by `DOMPurify` sanitizer
- [ ] Canvas rendering handles 60fps smooth stroke synchronization

---

## 🚀 PHASE 8: SPRINTS & SOCIETY MILESTONES

> **Goal:** Time-boxed sprints and society milestone roadmap visualization.

### 8.1 Sprint & Roadmap Engine
- [ ] Build `Sprint` and `Milestone` Mongoose schemas
- [ ] Implement visual roadmap timeline component
- [ ] Support assigning board cards/issues to active sprints

**Tests & Validation:**
- [ ] Active sprint metrics calculate completed card points correctly
- [ ] Roadmap timeline renders milestones in target date sequence

---

### **PHASE 8 EXIT QUALITY GATE**
- [ ] Sprint status transitions (`planned` $\rightarrow$ `active` $\rightarrow$ `completed`) update card states properly

---

## 🔔 PHASE 9: IN-APP & SOCKET NOTIFICATIONS

> **Goal:** Unread notification tracking and real-time Socket.io notification dispatch.

### 9.1 Notification Center
- [ ] Connect backend `Notification.js` model to notification API routes
- [ ] Dispatch Socket.io alerts on `@mentions`, DMs, and thread replies
- [ ] Build top navigation unread badge and notification dropdown drawer

**Tests & Validation:**
- [ ] Receiving mention creates DB record and triggers real-time toast alert
- [ ] Clicking notification marks item as read and navigates to target URL

---

### **PHASE 9 EXIT QUALITY GATE**
- [ ] Unread count updates dynamically across browser tabs

---

## 📦 PHASE 10: DATA EXPORT & IMPORTERS

> **Goal:** Import channels, messages, and tasks from external JSON/CSV export files.

### 10.1 Batch Importers & Mapping
- [ ] Implement backend routes for processing Slack/Linear/Todoist export files
- [ ] Build front-end mapping preview modal for user allocation
- [ ] Batch insert imported items into Mongoose database collections

**Tests & Validation:**
- [ ] Uploading valid Slack export JSON creates corresponding channels and messages
- [ ] Import progress bar tracks batch processing state accurately

---

### **PHASE 10 EXIT QUALITY GATE**
- [ ] Batch import handles 10,000 messages cleanly without database timeouts
- [ ] All Phase 10 integration tests passing

---

## 🏁 MASTER EXIT GATE

- [ ] All 10 phases pass their individual Quality Gates
- [ ] Full end-to-end integration test suite passing
- [ ] No regression bugs in core IEEE SB-APP auth or society modules
- [ ] Production build succeeds (`npm run build`) without TypeScript or Vite errors
