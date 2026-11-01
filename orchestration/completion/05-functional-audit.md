# 05 - Frontend functional audit (FIRST PASS, STATIC ONLY) - 2026-11-01

Author: lead orchestrator. Method: reading `frontend/src` of the protected checkout (baseline 70ff8bd) and small search scripts. NOTHING was run in a browser, so no feature below is "verified working"; this pass looks for gaps that code reading can show. The memory on this machine was too low to start a dev server plus browser safely. Not reviewed by the independent reviewer. The route list and the 129-endpoint table are in `02-feature-inventory.md` / `06-api-and-database-audit.md`.

## Routes and guards
- Public: `/` (landing), `/login`, `/register`. All app pages sit under `ProtectedRoute` (signed-in). `/admin/users` and `/admin/users/:id` additionally require `users:admin` in the UI.
- `/register` is publicly routed although server-side registration is admin-only (F-02 / NEW-17 / decision D-27).
- Create/edit form routes (`/societies/new`, `/events/new`, `/projects/new`, `/reports/new`, `/announcements/new` and the `/edit` routes) are guarded only by sign-in. `PermissionGate` (11 pages) hides the create/edit buttons on list and detail pages, but someone who types the URL still sees the form and gets a 403 from the server on submit. Not a security hole (the backend enforces), a UX gap. NEW FINDING FE-F2, P3.
- The AI audit page `/reports/ai-audit` is reachable by every signed-in user in the baseline (the Batch 2 candidate makes the server require finance:view or admin and shows a clear message).

## UI permission model - checked, NOT a defect
I suspected the UI used a different permission vocabulary than the backend (`read/write/admin` vs `full/limited_own_scope/approval`). Reading `GET /user/permissions` showed the backend translates the levels before sending them (`full` becomes `superadmin`, `limited_own_scope` becomes `admin`, `approval` becomes `write`), so the UI gates and the backend agree at module level. Two real limits: the UI only knows module-level levels, not individual actions, so a button can show for a user whose role lacks that specific action (the server still refuses); and `usePermissions.getAccessLevel` returns `"read"` for a module with no entry, which the comment in the code says was removed as insecure.

## 429 handling (NEW-09) - confirmed open
A search of all frontend source for `429`, "Too many" and "rate limit" finds nothing. A rate-limited request surfaces as whatever generic error the page shows. (The Batch 2 candidate adds 429 handling only for the new AI service.)

## Double-submit protection
14 files contain a submit handler. The shared `Button` component has a `loading` prop that disables it, and the society, event, project, report, change-password and announcement forms use it, so they are protected (my first regex missed this and wrongly flagged them; corrected after reading the component). Three places have no in-flight protection on the submit button:
- `CalendarPage.tsx:562` "Save Event" (no loading/disabled);
- `components/board/KanbanBoardView.tsx:274` "Create Card";
- `components/channels/ChannelChatFeed.tsx:176` send button, disabled only while the text box is empty.
A fast double click could create two events or cards or send twice. Not tested; the handlers might guard it some other way. NEW FINDING FE-F1, P3.

## API usage
64 call sites in `src`. 9 of them bypass the `services/` layer (TasksPage 4, KanbanBoardView 3, SocietySwitcher 1, authStore 1; F-04), which is where inconsistent 401/403/429 handling is most likely. One dead wrapper calls a route that does not exist (`getConversation`, API-F2, see file 06). The two channel-member wrappers are removed in the Batch 2 candidate.

## Not covered at all
Loading, empty, error, forbidden and expired-session states per page; every dialog and tab; responsive layout; accessibility; the feature-by-feature workflows (that is the Playwright and UI/UX work, Phases 5 and 6); the `.xlsx`/export-style features if any. FE-01 stays "In progress"; no row of the feature inventory has moved from "wired" to "verified".
