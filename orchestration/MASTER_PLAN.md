# MASTER_PLAN — SB-APP stabilisation (three-agent workflow)

## Objective and operating rules
Close the remaining AUD-035 findings in small, evidence-backed batches without weakening security, without touching
`digest.txt`, and without unapproved policy decisions. Protected baseline: `D:\SB-APP`
(branch `feature/sb-app-security-hardening`, HEAD `70ff8bd`). Agents work only in isolated worktrees
(`D:\SB-APP-worktrees\{terms,announcements,qa}`), never commit or push, and use the isolated MongoMemoryServer
harness only (one harness at a time, enforced by `scripts/harness-lock.js`). Rules: `AGENT_RULES.md`.

## AUD-035 summary (2026-10-29)
64 findings: Verified complete 25 · Partially resolved 9 · Not reproduced 2 · Open defect 13 · Open decision 9 ·
Not verified 4 · Superseded 2. No P0. P1: NEW-07/AUD-025 (society terms exposure), AUD-015 (CI lacks integration and
browser suites), NEW-12 (npm audit never run), NEW-11 (lazy-model index race, unconfirmed). UI replacement: not ready.
Latest executed totals: unit 681, integration 589 (38 files), frontend node 40, browser 25 → 1,335 distinct tests.
Full register: `MASTER_TODO.md`.

## Batch plan
1. **Batch 1 (running):** NEW-07/AUD-025 + NEW-11 (Agent A), NEW-06/AUD-022 (Agent B), independent NEW-11/coverage review (Agent C).
2. Batch 2: regression protection — AUD-015 (CI), NEW-10 (flaky browser specs), NEW-19, AUD-014, AUD-011; needs D-17.
3. Batch 3: dependency audit (needs D-16), then fixes only for its findings.
4. Batch 4: contract gaps — NEW-08 (needs D-12), NEW-09, NEW-20, NEW-22, AUD-013 (needs D-19).
5. Batch 5: decision package (D-02…D-15) → one implementation batch per approved decision.
Do not start Batch N+1 work during Batch N.

## Task dependencies (Batch 1)
T1 (terms authz) → T2 (index race, same file) ; T3 independent ; T4 read-only, cross-checks T2. Integration gate after all REPORTED.

## Parallel execution plan
- A, B edit disjoint files (TASK_BOARD.md). C is read-only.
- Unit tests free; integration/browser tests serialised through the shared lock.
- Coordinator: monitors, records every failure before reruns, runs the integrated regression sequence sequentially.

## Integration and release-readiness gates
1. Each agent report meets the AGENT_RULES §4 standard; coordinator inspects every changed file and the full diff vs scope.
2. No file outside ownership changed; A/B diffs do not overlap; untracked tests reviewed separately.
3. Red checks observed for new tests; relevant unit + integration + browser suites, typecheck, lint, build run on the combined tree.
4. User approves integration plan (merge/cherry-pick), then cleanup of worktrees/branches. Nothing merged automatically.
5. Release readiness is **not** claimed by this process; it needs P1 items closed, CI coverage (AUD-015), a dependency audit and the
   pending decisions in DECISIONS.md.
