# DECISIONS

## Approved (user, 2026-10-29)
- **D-A1 Society terms.** Same-society members may read society terms. Sensitive fields require explicit authorization supported by the
  existing permission model. Cross-society reads denied unless an existing explicit authorization permits them. No new role or
  permission may be invented. If the existing model does not establish who may see emails or budgets, that subtask is BLOCKED and
  returns here as a decision.
- **D-A2 Announcement audiences.** Administrators may choose `ALL`, `SOCIETY`, `LEADERSHIP`. Non-administrators may choose only
  `SOCIETY` for their own society. The backend enforces it. Do not broaden announcement visibility or redesign `LEADERSHIP`.
- **D-A3 Commit authorisation.** The AUD-033/AUD-034 changes were committed (`70ff8bd`) and three agent branches/worktrees created.
  Not authorised: unrelated commits, touching `digest.txt`, unapproved architectural or security-policy decisions.

## Approved (user, Batch 1 integration authorization, 2026-10-29)
- **D-01** Chair/treasurer emails stay administrator-only. Budgets additionally require the existing `finance:view` permission. (Implemented by Agent A; coordinator-verified.)
- **D-22** Preserve legacy announcement behavior: non-admin creators may edit title/content of their legacy `LEADERSHIP` announcements but cannot change the audience; non-admins cannot edit legacy `ALL` or other-society announcements. (Implemented by Agent B pass 2; coordinator-verified.)
- **D-23** Restrict society-term handover PATCH writes to administrators and authorized office bearers of the relevant society, reusing existing role/permission mechanisms. **Implemented as:** `societyAccess` (admin or a user of that society) then, for non-administrators, the existing RBAC permission `settings:edit` (same rule as `PATCH /societies/:id`; the matrix grants it to `society_chair`, `society_faculty_advisor`, `sb_chair`, `sb_faculty_advisor`). Legacy `ADMIN` passes without an RBAC role. Interpretation to confirm: `settings:edit` was chosen as the existing mechanism for "authorized office bearers"; treasurers, vice-chairs, secretaries and webmasters do NOT hold it, so they cannot update a handover.
- **D-20** Duplicate-term error-message changes deferred (no change made; the loser of a duplicate still gets the generic error-handler 400).
- **D-21** Creating a term for a nonexistent society is refused: 404 "Society not found" (400 for a malformed id), checked before the index wait; the startup model load and `init()` readiness guard are unchanged (503 if the index cannot be built).

## Pending (needed before the related work can start)
| ID | Decision | Findings | Evidence / options needed |
|---|---|---|---|
| D-02 | Permanent storage design or removal | AUD-001, AUD-009a | Ownership, validation, ACL review |
| D-03 | Single role system (legacy `User.role` vs RBAC) | AUD-003 | Migration impact per module |
| D-04 | Multi-instance support (shared store/adapter) | AUD-007, AUD-012, AUD-024 | Cost/benefit; currently cluster refused |
| D-05 | Rate-limit keying behind NAT and TRUST_PROXY topology | NEW-18 | Deployment topology facts |
| D-06 | Permission-level semantics (`limited_own_scope`, `approval`) | AUD-028 | Matrix intent |
| D-07 | Matrix-edit authority and matrix read exposure | NEW-15 | Who may edit/read roles & permissions |
| D-08 | Org-wide read policy (events, projects, dashboards) | NEW-16 | Product intent |
| D-09 | Admin onboarding workflow (society/role assignment, token in response) | NEW-17 | Needs UX + API |
| D-10 | Backup encryption/retention, restore atomicity, legacy `reports` | NEW-14 | Ops policy |
| D-11 | Legacy-data migration plan | NEW-23 | Dry-run first |
| D-12 | Channel membership endpoints: implement or remove FE calls | NEW-08 | Product intent |
| D-13 | Finance approval rules (chair approval, admin self-approval) and UI | AUD-005 | Product/finance policy |
| D-14 | Global default society for channel list | AUD-029 | One-line fail-closed vs admin UX |
| D-15 | Leadership read of private notes | AUD-032 | Hierarchy definition |
| D-16 | Network approval for `npm audit` | NEW-12 | Registry access |
| D-17 | Commit the harness runner scripts into the repo (CI) | AUD-015 | Currently in `D:\SB-APP-orchestration\scripts` |
| D-18 | Dormant `auditLogger` middleware: remove? | NEW-21 | — |
| D-19 | AI via backend vs removing client-side Gemini | AUD-013 | — |
| D-24 | Confirm `settings:edit` as the "authorized office bearer" rule for term handover (treasurers cannot update a handover; alternatives: also `finance:edit` for `balanceReconciled`, or `reports:edit`) | NEW-26 | Raised while implementing D-23 |
| D-25 | Legacy `ALL`/foreign-society announcements by non-admins stay un-editable by them (D-22 as approved); no action unless you want a migration | AUD-022 | Informational |
