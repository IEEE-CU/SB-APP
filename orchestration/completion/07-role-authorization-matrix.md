# 07 - Role / permission matrix (PARTIAL: derived from the repo, not yet exercised by new tests) - 2026-11-01

Author: lead orchestrator (read-only inspection). Sources: `backend/src/scripts/seed.js` (`defaultMatrixMapping`, role definitions) and `docs/rbac-matrix.json` (module-level summary). Only roles that exist in those files are listed. This is what the seed GRANTS; it is not proof of what a deployed database contains (NEW-13: the deployed seed state is unknown), and it is not an endpoint-by-endpoint check (that is API-01 / AUTHZ-01, still to do).

## Roles (14) and their scope type
| Role | Level | Scope type |
|---|---|---|
| sb_faculty_advisor | super_admin | global |
| society_faculty_advisor, society_chair, society_vice_chair, society_secretary, society_treasurer, society_webmaster, society_member, ieee_member | faculty_advisor / office_bearer / member | society |
| sb_chair, sb_vice_chair, sb_secretary, sb_treasurer, sb_webmaster | office_bearer | student_branch |

Access levels in use: `full`, `limited_own_scope` (shown "scoped"), `approval`, `none`. `isGrantingLevel` grants for exactly `full`, `limited_own_scope` and `approval`; everything else (including garbage values) is denied.

## Per-action grants for the actions that matter (seed.js, wildcards expanded)
sb_faculty_advisor holds `full` on every permission. Others (scoped = limited_own_scope; "-" = none):

| Role | settings:edit | finance:view | finance:create | finance:approve | reports:approve | roles_access:edit | members:view | announcements:create | community_hub:create |
|---|---|---|---|---|---|---|---|---|---|
| society_faculty_advisor | scoped | scoped | scoped | scoped | scoped | - | scoped | scoped | scoped |
| society_chair | scoped | scoped | scoped | scoped | scoped | - | scoped | scoped | scoped |
| society_vice_chair | - | scoped | - | - | approval | - | scoped | scoped | scoped |
| society_secretary | - | scoped | - | - | approval | - | scoped | scoped | scoped |
| society_treasurer | - | scoped | scoped | approval | approval | - | - | - | scoped |
| society_webmaster | - | scoped | - | - | - | - | scoped | scoped | scoped |
| society_member | - | - | - | - | - | - | - | - | scoped |
| sb_chair | scoped | scoped | scoped | scoped | scoped | - | scoped | scoped | scoped |
| sb_vice_chair / sb_secretary | - | scoped | - | - | approval | - | scoped | scoped | scoped |
| sb_treasurer | - | scoped | scoped | approval | approval | - | - | - | scoped |
| sb_webmaster | - | scoped | - | - | - | - | scoped | scoped | scoped |
| ieee_member | - | - | - | - | - | - | - | - | scoped |
(`roles_access:edit` is only held by sb_faculty_advisor.) The module-level `docs/rbac-matrix.json` agrees with this table on every row I compared (settings: full for sb_faculty_advisor; scoped for society_faculty_advisor, society_chair, sb_chair; none for the rest).

## What this settles and what it does not
1. **D-24 (handover / settings authority).** The seed grants `settings:edit` to exactly: sb_faculty_advisor (full), society_faculty_advisor, society_chair, sb_chair. Treasurer, vice chair, secretary and webmaster (society and SB) get none. That is the same list the owner's proposal names, and it is what `integration/batch1` enforces (admin, or `settings:edit` after the society-scope guard). So D-24 describes the existing seed. The owner still has to confirm it; I have not marked it approved.
2. **Branch-level roles are not society-restricted by RBAC alone.** sb_chair has scope type `student_branch`, which `attachScope` turns into "all societies". For the handover route the cross-society limit comes from the society guard (`societyAccess`: administrator or a user of that society), not from the permission, so an SB chair is stopped from other societies' handovers only if that guard keeps applying to them. To be confirmed by a test (AUTHZ-01).
3. **The `approval` level behaves like a full grant inside scope (AUD-028 / NEW-15).** Treasurers hold `finance:approve` and vice chairs/secretaries hold `reports:approve` at `approval`, and `isGrantingLevel` treats it the same as `full` and `limited_own_scope`. Whether `approval` should be narrower (for example "may approve, may not edit") is an open policy question, not something to change here.
4. **Two systems coexist (D-03, decided):** legacy `User.role` (ADMIN, OFFICE_BEARER) and this RBAC. Routes differ in which they check; examples already verified: the handover route (admin OR `settings:edit`), the AI audit route (admin OR `finance:view`), the finance list route (finance:view AND admin). A full per-endpoint table of which check each of the 129 routes uses is still to do (API-01).

## Not done
Negative tests per role for every sensitive endpoint, the legacy-admin-without-RBAC-role case per route, and the "user with no society / unknown role" cases are not written. Nothing in this file has been reviewed by the independent reviewer.
