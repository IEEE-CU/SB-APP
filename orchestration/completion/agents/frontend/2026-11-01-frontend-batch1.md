# Frontend batch 1 (SBA-7) - 2026-11-01
Worktree: D:\SB-APP-worktrees\wave2-frontend (uncommitted). No browsers run, no deps added.

## 1. API-F2 - DONE
- Grep: `getConversation` (singular) had no callers outside its definition.
- Removed it from `frontend/src/services/conversations.ts`.
- New `frontend/tests/unit/conversations-contract.node-test.mjs`: every `api.*('/conversations...')` call must match a route in backend/src/routes/conversations.js; also asserts all api calls were parsed and the wrapper is gone.

## 2. FE-F1 - PARTIAL (2 of 3)
- `components/board/KanbanBoardView.tsx`: `creating` state, guard in handleCreateCard, try/finally reset, `<Button loading={creating}>`.
- `components/channels/ChannelChatFeed.tsx`: `sending` state, guard in handleSend, try/finally reset, send button `disabled` while sending.
- `pages/calendar/CalendarPage.tsx` (Save Event): NOT changed. `handleCreateCustomEvent` is fully synchronous local state (no API call, closes the modal immediately), so there is no in-flight window to protect. Noted: events are not persisted at all (pre-existing; out of scope, may be a product question).
- No component tests for these (no browser/DOM test harness used); verified by tsc + eslint only.

## 3. FE-F2 - NOT DONE (needs decision)
Create/edit routes in `routes.tsx` (/societies|events|projects|reports|announcements /new and /:slug/edit) sit under a plain `<ProtectedRoute />`; only `/users` uses `requiredModule/requiredAction`. Gating needs a mapping of each form to a permission module+action (and whether admin-only vs. officer roles). Question for owner: for each of the five form routes, which module and action (e.g. `events`/`create`, `events`/`update`) must ProtectedRoute require, and should denied users go to /dashboard (current ProtectedRoute behaviour)? Not trivial, so not implemented.

## 4. NEW-09 - DONE
- New `frontend/src/lib/rateLimit.ts` (pure helpers). On a 429, `err.message` and `err.response.data.message` become "Too many requests. Please wait a moment and try again." (with "N seconds" when a valid Retry-After header exists).
- `frontend/src/lib/api.ts`: one call `applyRateLimitMessage(err)` in the response interceptor after the unchanged 401 branch; no retry.
- New `frontend/tests/unit/rate-limit.node-test.mjs` (5 tests).

## Commands and results
- `node --test tests/unit/*.node-test.mjs` (from frontend): 53 tests, 53 pass, 0 fail.
- `node .../typescript/bin/tsc -p .../tsconfig.json --noEmit`: no output (clean).
- `node .../eslint/bin/eslint.js --no-warn-ignored` on the 5 changed source files: no output (clean).

## Changed files
- M src/services/conversations.ts, src/lib/api.ts, src/components/board/KanbanBoardView.tsx, src/components/channels/ChannelChatFeed.tsx
- A src/lib/rateLimit.ts, tests/unit/conversations-contract.node-test.mjs, tests/unit/rate-limit.node-test.mjs

## Not verified
Runtime behaviour in a browser; the 429 message surfacing in each page's toast (callers that read `err.response.data.message` get it; callers using a hardcoded string do not).
