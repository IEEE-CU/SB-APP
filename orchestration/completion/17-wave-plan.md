# 17 - Wave plan for the remaining backlog (2026-11-01)

Purpose: split everything still open into groups ("waves") so several agents can genuinely run in parallel without conflicting, and to keep the one hard constraint visible: **only one agent may run the isolated test harness (`run-integration.js` / `run-browser.js`) at a time** — the harness is a fixed port (5057/5174) and this machine has very little free memory. Document-only and read-only tasks have no such limit and can all run together.

Rule for every wave: an agent edits only files its task names; no two agents touch the same file or worktree at once; no task in a wave may start until every decision it depends on (see DECISION-REGISTER.md) is answered.

## Wave 1 — runs now, no owner decision needed, no test harness (parallel-safe)
No file overlap between these five; all are read-only investigation or document-only, so no harness contention either.

| Agent | Task | Output | Worktree |
|---|---|---|---|
| Security Lead | SEC-02 follow-up (is the root `tar` critical actually reachable?) + a read-only design review of NEW-14 backup/restore safety (no real backup run) + a read-only audit of the importer/scraper (NEW-24, AUD-030, NEW-25: SSRF, validation, duplicate handling) | `completion/agents/security/2026-11-01-wave1.md` | read-only |
| DevOps / CI Engineer | A fix PROPOSAL (not applied) for NEW-19's stale `e2e.spec.ts` config, and an investigation of F-06 (which of the 10 backend areas with no frontend `services/` client are actually used inline vs. genuinely unused) | `completion/agents/devops/2026-11-01-wave1.md` | read-only |
| QA Engineer | Write (do not run) a browser-test PROPOSAL for NEW-05 (task-creation society scope), and investigate NEW-20 (duplicate permission requests) from the code | `completion/agents/qa/2026-11-01-wave1.md` | read-only |
| Backend Engineer | Read-only investigation of NEW-23 (legacy event/project data mismatches — propose an approach, no migration) and NEW-21 (is the audit logger really dormant, and where) | `completion/agents/backend/2026-11-01-wave1.md` | wave2-backend (read-only for this task; its NEW-22 diff stays as is) |
| Frontend / UI-UX Lead | Extend `05-functional-audit.md` with a second static pass: remaining pages/workflows not yet covered (events, projects, tasks, calendar forms) — still no browser, read-only | `completion/05-functional-audit.md` (append) | wave2-frontend (read-only for this task) |
| CEO | Consolidate `13-CI-AND-DEPENDENCY-AUDIT.md` from DEP-01 + AUD-015 + AUD-014 findings already on file; update `01-master-roadmap.md` to match this wave plan | `completion/13-ci-and-dependency-audit.md`, `completion/01-master-roadmap.md` | read-only |

Reviewer stays idle this wave — nothing new to review until Wave 1 produces diffs/reports worth checking.
Dispatch: at most 4-5 at once given ~1 GB free memory; none of these starts the harness, so memory pressure is from the agent processes only, not from mongod/Playwright.

## Wave 2 — gated on your decisions, no harness
| Depends on | Agent | Task |
|---|---|---|
| D-B6 approved | QA | Apply the proposed NEW-10 test-only fix (wait for `channel:join` before dropping the socket) in a fresh worktree branched off `integration/combined` |
| D-24 confirmed | Security Lead | Write the per-endpoint negative-test PROPOSALS for AUTHZ-01 (not run yet — Wave 3) |
| D-B5 + hosting facts (NEW-18) | DevOps | Apply the NEW-19 fix, wire the frontend `test:unit` stub to the real tests (CI-02), write up the TRUST_PROXY-dependent severity of proxy-addr |
| D-26 approved | Security Lead | Turn the DEP-01 plan into an exact proposed `package.json`/lockfile diff (still no `npm install` run — that is a separate, later approval under charter §2.5) |
| Q7 answered | Frontend | Implement FE-F2 (gate the 5 create/edit routes) in wave2-frontend |
| Q6 answered | Backend or Frontend | Fix (or explicitly leave) calendar event persistence |
| D-B7 + your commit decision | CEO | Prepare the commit for the generated-files untracking (already staged in batch2-ci) |

## Wave 3 — harness required, STRICTLY ONE AT A TIME (serialize even across agents)
1. Rerun the 8 integration files that never started + the `socket-reconnect` spec, on `integration/combined` (QA).
2. Run the NEW-10 fix from Wave 2 repeatedly (chained + standalone) to confirm it holds (QA).
3. Run the new AUTHZ-01 negative tests from Wave 2 (Security or QA).
4. Run the NEW-05 browser test proposed in Wave 1 (QA).
5. A real GitHub Actions run of the CI workflow (DevOps) — not local, so it does not compete for this machine's port/memory, but still sequence it after the others so its own findings are current.

## Wave 4 — after everything above
- Independent Reviewer: review every Wave 1-3 diff and the two already-uncommitted agent changes (Backend NEW-22, Frontend batch 1) together, as the real Phase 9 "full independent review" (not just the 3 commits from before).
- CEO: write `15-FINAL-ISSUE-REGISTER.md` and `16-FINAL-READINESS-REPORT.md`.
- Phase 6 UI/UX audit and improvements — stays blocked behind the security/functional gates per charter §11; no large redesign without your separate approval.

## What I'm dispatching right now
Wave 1, all 6 tasks, since none needs a decision or the harness. I'll review each report before updating MASTER-TODO/DECISION-REGISTER and before dispatching anything from Wave 2.
