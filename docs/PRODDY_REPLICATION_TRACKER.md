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
| **Phase 1** | **Platform Foundation & Society RBAC** | Auth, Society setup, Mongoose schemas, Layout shell | 5 / 5 | Passed | `[x]` |
| **Phase 2** | **Channels & Real-Time Messaging** | Channels, Messages, Threads, Socket.io rooms, DMs | 8 / 8 | Passed | `[x]` |
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
- [x] Render society switcher in `src/components/layout/`
- [x] Render collapsible channels menu for active society
- [x] Implement theme switcher utilizing existing `themeStore.ts` (Dark/Light mode)

**Tests & Validation:**
- [x] Switching active society updates visible channels and permissions immediately
- [x] Navigation shell responds dynamically to mobile and desktop screens

---

### 1.3 Role-Based Access Control (RBAC) Gating
- [x] Bind backend `UserRole.js` and `RolePermission.js` to frontend permission gates
- [x] Wrap sensitive UI elements (create channel, delete project) in `PermissionGate` component

**Tests & Validation:**
- [x] Unauthorized roles are hidden from administrative buttons
- [x] Direct URL navigation to admin pages blocks non-authorized users

---

### **PHASE 1 EXIT QUALITY GATE**
- [x] Clean install & dev boot passes (`npm run dev`)
- [x] All Phase 1 auth & RBAC integration tests pass
- [x] Zero circular dependencies or broken imports

---

## 💬 PHASE 2: CHANNELS & REAL-TIME MESSAGING

> **Goal:** Full messaging system with real-time Socket.io pub/sub, threads, DMs, and reactions.

### 2.1 Channel Management
- [x] Implement Express routes `/api/v1/societies/:societyId/channels`
- [x] Validate kebab-case slugging in `Channel.js` model
- [x] Render channel list by type (`chat` vs `board`)

**Tests & Validation:**
- [x] Admin can create/edit/delete channels
- [x] Deleting a channel cascades and cleans up child messages

---

### 2.2 Real-time Chat Feed & Threads
- [x] Build paginated chat message loader in frontend
- [x] Wire Socket.io `message:send` and `message:new` handlers in `src/lib/socket.ts`
- [x] Implement thread replies (`parentId`) with denormalized reply counters

**Tests & Validation:**
- [x] Messages appear instantly for all users in the channel room without refresh
- [x] Thread drawer renders child replies and maintains correct count

---

### 2.3 Direct Messaging & Emoji Reactions
- [x] Implement pairwise DM creation and conversation lookup
- [x] Add emoji reaction toggle matching `Reaction.js` model
- [x] Parse `@mentions` and poll options embedded in `Message.js`

**Tests & Validation:**
- [x] DM conversation is unique per pair of users within a society
- [x] Emoji reactions update live across connected sockets

---

### 2.4 Typing & Presence Indicators
- [x] Broadcast ephemeral `typing:start` and `typing:stop` events over Socket.io
- [x] Render animated `TypingIndicator` component above chat input
- [x] Derive user presence states (`online`, `idle`, `dnd`, `offline`) via `UserPresenceBadge`

**Tests & Validation:**
- [x] Typing indicator disappears automatically after inactivity
- [x] User presence badge reflects active socket connections correctly

---

### **PHASE 2 EXIT QUALITY GATE**
- [x] Socket reconnection test passes (disconnecting and reconnecting restores state)
- [x] Paginated infinite scroll handles 500+ messages smoothly
- [x] Code review completed for all messaging controllers & hooks

---

## 📋 PHASE 3: BOARD / KANBAN & PROJECTS

> **Goal:** Dual-system board (`Lists`+`Cards` & `Statuses`+`Issues`) with drag-and-drop and issue dependencies.

### 3.1 Dual-Card System & Columns
- [x] Connect `Project.js` models to board channels
- [x] Build Kanban board with custom status columns (`lists` / `statuses`)
- [x] Implement card edit drawer and detail modals

**Tests & Validation:**
- [x] Cards render accurately in correct status columns
- [x] Sub-card hierarchy renders parent-child links correctly

---

### 3.2 Drag-and-Drop & Dependencies
- [x] Build drag-and-drop column/card reordering with batch order API updates
- [x] Implement blocked/blocking card dependencies (`issueBlocking`)
- [x] Post status update announcements automatically to connected chat channels

**Tests & Validation:**
- [x] Reordering cards updates database sequence persistently
- [x] Moving card to "Done" triggers automated channel post

---

### **PHASE 3 EXIT QUALITY GATE**
- [x] Concurrent card drag operations do not cause race conditions
- [x] All card CRUD operations pass integration tests

---

## 📅 PHASE 4: 3-SOURCE UNIFIED CALENDAR

> **Goal:** Merged calendar view aggregating direct events, message-linked dates, and task/project deadlines.

### 4.1 Aggregated Calendar Engine
- [x] Implement Express controller `/api/v1/societies/:societyId/calendar/unified`
- [x] Fetch and combine data from `CalendarEvent.js`, `Message.js` (calendarEvent field), `BoardCard.js`, and `Task` due dates
- [x] Build Tailwind CSS month grid component with date filters

**Tests & Validation:**
- [x] Calendar accurately displays items from all three sources in single date cells
- [x] Filter toggles show/hide specific event types correctly

---

### 4.2 Message Dual-Write & Dashboard Widget
- [x] Implement message action to attach date (`createCalendarEvent` dual-write)
- [x] Build 7-day upcoming events preview widget on main dashboard

**Tests & Validation:**
- [x] Adding event to message updates calendar instantly
- [x] Dashboard widget reflects upcoming 7 days accurately

---

### **PHASE 4 EXIT QUALITY GATE**
- [x] Date math verified across month transitions using `date-fns`
- [x] Aggregation query response time < 150ms for 1,000 events

---

## ✅ PHASE 5: TASKS & CATEGORIES

> **Goal:** Personal and team task management with lifecycles and categories.

### 5.1 Task Management & Lifecycle
- [x] Build `Task` Mongoose model bound to user and society
- [x] Implement status transitions (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `ON_HOLD`)
- [x] Implement custom color-coded task categories

**Tests & Validation:**
- [x] Tasks are properly isolated per user within society scope
- [x] Task completion updates completion progress metrics

---

### **PHASE 5 EXIT QUALITY GATE**
- [x] Task filtering by category, priority, and due date works seamlessly

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
