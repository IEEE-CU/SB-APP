# INDEX - completion\ document map (2026-11-01)

The earlier completion run numbered its files `00-04`; the charter (§19) uses a different numbering. `mv` and `rm` are unavailable to the agent and the owner asked for no renames or deletions, so **nothing was renamed**. This index is the mapping. Note that Windows filenames are case-insensitive, so `00-CURRENT-STATE.md` and `00-current-state.md` are the *same* file - the charter's upper-case names are therefore realised by the lower-case files listed below, not by duplicates.

## Charter name -> actual file

| Charter name (§19) | Actual file | State |
|---|---|---|
| `00-CURRENT-STATE` | `00-current-state.md` | Earlier run's version **plus** a `PHASE 0 RE-ESTABLISHED (2026-11-01)` section appended. Both kept; the appended section is authoritative where they differ. |
| `01-MASTER-ROADMAP` | `01-master-roadmap.md` | New, 2026-11-01. |
| `02-FEATURE-INVENTORY` | `02-feature-inventory.md` | New, 2026-11-01. |
| `03-ARCHITECTURE-MAP` | `03-architecture-map.md` | New, 2026-11-01. |
| `04-SECURITY-AUDIT` | *not written* | Phase 2. Inputs exist: `raw/c4-audit-summary.md`, AUD-035 register. |
| `05-FUNCTIONAL-AUDIT` | *not written* | Phase 4. |
| `06-API-AND-DATABASE-AUDIT` | *not written* | Phase 3. Starting point: the 129-endpoint table in `03-architecture-map.md`. |
| `07-ROLE-AUTHORIZATION-MATRIX` | *not written* | Phase 2/3. |
| `08-UI-UX-AUDIT`, `09-UI-UX-ISSUE-REGISTER` | *not written* | Phase 6, gated by charter §11. |
| `10-BATCH1-VERIFICATION` | `01-batch1-verification.md` | **Legacy numbering.** Content current; file not renamed. |
| `11-BATCH2-VERIFICATION` | `02-batch2-verification.md` | **Legacy numbering.** Content current; file not renamed. |
| `12-AGENT-C-REPORT` | `03-agent-c-report.md` | **Legacy numbering.** Content current; file not renamed. |
| `13-CI-AND-DEPENDENCY-AUDIT` | *not written* | Phase 7. Inputs: `03-agent-c-report.md` §C1/C4 and `raw/c4-audit-*.json`. |
| `14-COMBINED-REGRESSION-GATE` | `14-combined-regression-gate.md` (new) **supersedes** `04-combined-regression-gate.md` | `04` is kept and carries the owner's 2026-11-01 CORRECTION; `14` holds the full corrected record plus the counted test baseline. |
| `15-FINAL-ISSUE-REGISTER` | *not written* | Phase 9. |
| `16-FINAL-READINESS-REPORT` | *not written* | Phase 10. |
| `MASTER-TODO` | `MASTER-TODO.md` | Earlier checklist kept at the top; the canonical task table is appended below it. **Single source of truth.** |
| `DECISION-REGISTER` | `DECISION-REGISTER.md` | New, 2026-11-01. |
| `CHANGELOG` | *not written* | Opens when the first approved change is made. |
| `AGENT-HANDOVER` | *not written* | Phase 10. |

## Other contents of `completion\`

- `CHARTER.md` - the governing document. Agent instructions resolve relative paths from this directory.
- `raw\` - raw test and audit output. `raw\combined\` holds the ten files of the combined gate (including `progress.txt`, which proves the gate finished); `raw\c4-audit-*.json` holds the dependency audit; `raw\combined-copy-manifest.txt` proves the 32 combined files are byte-identical to their sources; `raw\diag-socket-*.spec.ts` are the NEW-10 diagnostic specs.

## Numbering collisions to be aware of

`01-batch1-verification.md` / `01-master-roadmap.md`, `02-batch2-verification.md` / `02-feature-inventory.md`, and `03-agent-c-report.md` / `03-architecture-map.md` share a leading number. That is a consequence of not renaming files; this table disambiguates them. If the owner later authorises renames, the legacy three become `10-`, `11-`, `12-` and `04-combined-regression-gate.md` is absorbed into `14-`.
