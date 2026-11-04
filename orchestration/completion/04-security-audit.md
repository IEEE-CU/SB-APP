# 04 - Security audit (PARTIAL: three Phase 2 items) - 2026-11-01

Written by the lead orchestrator (an implementer of parts of Batch 1/2, so NOT the independent reviewer: REV-01 must still review). All three items are read-only code inspection; no attack scenario was executed, so none of these counts as a "tested" security finding in the charter's sense (section 21). No secret value is quoted anywhere below.

## SEC-01 - DOMPurify (dependency audit: critical, direct, production, frontend)
Installed 3.4.13; vulnerable range up to 3.4.16; fix available.
Inspected: every reference to `dompurify` in `frontend/src` (9 call sites: NoteEditor, Announcement detail/list/form, CommunityPage, ReportDetail/Form) and every risky option.
Finding: all 9 calls are `DOMPurify.sanitize(someString)` with NO options. No `addHook`, no `IN_PLACE`, no `SAFE_FOR_TEMPLATES`, no `RETURN_DOM*`, no `PARSER_MEDIA_TYPE` anywhere in `src`.
The five advisories (saved audit JSON) each need one of those options: the critical one is a `SAFE_FOR_TEMPLATES` bypass in DOM output modes; the IN_PLACE ones (low and high) need `IN_PLACE` plus a removing hook; one low needs `application/xhtml+xml` parsing. None of the preconditions is met by the current code.
Correction to the Phase 0 register text: it describes the critical as the `IN_PLACE` afterSanitize hook; the critical-severity advisory is the `SAFE_FOR_TEMPLATES` one (the `IN_PLACE` ones are low/high).
Assessment: not exploitable through the current code as read; still worth upgrading (fix exists; content is user-authored; a future option change would silently re-open it). Status: **ruled out by reading, not tested**; severity for planning P2 rather than P1 unless the owner prefers to follow the audit's label. Upgrade plan belongs under D-26.

## SEC-02 - proxy-addr (critical, transitive via Express 4.22.3, production, backend)
Installed 2.0.7 (vulnerable: 1.1.0 to below 2.0.8); fix available.
Inspected: `backend/src/config/trustProxy.js` and its single use in `server.js` (`app.set("trust proxy", ...)`).
Facts: `TRUST_PROXY` must be set explicitly in production (the server refuses to start otherwise); accepted forms are 0/none, a hop count 1-10, or a list of addresses/CIDRs/named subnets; "true" and "*" are refused. The repo has no deployment manifest, so the real value is unknown.
Advisory title: IP spoofing via an IPv4-mapped IPv6 trust subnet. I read the title and metadata only, not the full advisory text.
Assessment (inference, not tested): affects deployments that configure TRUST_PROXY as an address/subnet list; probably not trust-nothing (0/unset) and probably not a plain hop count. If affected, `req.ip` can be spoofed, which feeds every rate-limit key and audit-log address (links to NEW-18, AUD-012B, AUD-034). Cannot be settled until the hosting topology (NEW-18) is decided. The fix needs a plan: proxy-addr is pulled in by Express, so either an Express update or a dependency override is required (neither done; D-26).

## SEC-03 - googleDriveService.ts (F-01 / D-28)
`frontend/src/services/googleDriveService.ts`, 119 lines, 3 exports (initGoogleCloud, connectCloudAccount, syncLedgerToCloud).
Findings: no callers anywhere in `frontend/src`; no `import.meta.env`/`process.env` reads; no credential-like literals; no client ID in the file (it is passed in as a parameter); no Google variables in any `.env.example`. It holds no secret.
Privacy note for D-28: `syncLedgerToCloud(stateData)` is a ledger upload to Google Drive. It is unreachable today, but wiring it up would send financial data to Google, which runs against the owner's D-B10 boundary. This supports deleting it; deletion is a feature removal and still needs the owner's approval.

## Not done here
The full security audit sections 10.1 to 10.5 (authentication matrix, authorization matrix, API/DB/secrets review) have not been started. They are tracked as AUTHZ-01, API-01 and the Phase 2/3 items in MASTER-TODO.
