# Batch 2 TODO
Status vocabulary: Verified defect / Suspected / Not reproduced / Blocked / Requires policy decision / Fixed-unverified / Independently verified / Integrated+regression-tested.
| ID | Verified fact | Severity | Agent | Status | Depends on |
|---|---|---|---|---|---|
| NEW-08 | Frontend wrappers call routes that do not exist; no UI caller; Channel has no members field | Low (dead code); Medium only if membership is wanted | A | Requires policy decision | D-B1 |
| AUD-013 | VITE_GEMINI_API_KEY inlined into the browser bundle; backend AI route is an unmounted placeholder | High (secret exposure) | B | Verified defect; implementation blocked | D-B2, D-B3, D-B4 |
| AUD-015 | CI omits integration suite (41 files), Playwright session suite, 40 frontend Node tests, frontend build | Medium-High | C | Verified (read-only); change needs approval | D-B5 |
| NEW-10 | socket-reconnect flake, fails at dropConnection, only when run last in a chain; no cause established | Medium (CI reliability) | C | Suspected; open | D-B6 |
| NEW-19 | e2e.spec.ts targets localhost:5000 | Low | C | Verified; no change yet | D-B5 |
| AUD-014 | 6 test-results files + tsbuildinfo tracked, not ignored | Low | C | Verified; change needs approval | D-B7 |
| NEW-22 | Backend returns no lastMessage; UI preview never shows | Low | follow-up | Verified by code read; not started | after A/B/C |
| NEW-05 | Backend society check present with integration tests; no browser test | Low | follow-up | Not started | after A/B/C |
| NEW-12 | npm audit | - | - | Pending network approval | D-B8 |
Dependencies: none of these touch the Batch 1 files.

## Status update 2026-10-29 (coordinator-run evidence; no agents were used)
| ID | Status |
|---|---|
| NEW-08 | FIXED in integration/batch2 (D-B1a): 2 unused wrappers deleted; new static contract test (service calls vs backend routes). Independently verified: red check on baseline fails 2 of 3, passes after. Integrated + gated. No backend change. |
| AUD-013 | FIXED in integration/batch2: POST /api/v1/ai/financial-insights (finance:view, scope-limited, payload = optional societyId only, per-user limit 10/15 min counted after validation), key only in backend config, frontend no longer imports the Google client. Verified: backend unit 8, integration 9, frontend node 2, browser 3; fake key absent from the production bundle, present in the baseline bundle (red check). Integrated + gated. Not run: any real Gemini call (none is possible/allowed here). Open: D-B10, D-B11. |
| AUD-015, NEW-19, AUD-014 | Unchanged (D-B5, D-B7 unanswered). |
| NEW-10 | STILL OPEN. New evidence: on the Batch 2 tree socket-reconnect failed in the chain AND on its first standalone rerun (same step), then passed 4/4 twice; baseline in qa passed 4/4 standalone. So the earlier "only fails when run last" pattern is not reliable. Cause unknown. |
| NEW-22, NEW-05 | Not started (follow-ups). NEW-12: pending D-B8. |
