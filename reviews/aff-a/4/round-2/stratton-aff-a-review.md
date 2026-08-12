# AFF-A Rubber Duck Review — Phase 4 Round 2

**Verdict:** `DIVERGES`  
**Manifest:** `b5ea093651b32627ff5ecee9ebeabd8f9c95e00856ee43da153869690e95b159`  
**Model independence:** reviewer `gpt-5.5`; author `gpt-5.6-sol`; verified different.  
**Final for manifest:** no.

All eight manifest entries and the independent verification receipt matched local SHA-256
recomputation. Requirements 31/31, ABBs 19/19, SBBs 23/23, decisions 10/10 and resource inventory
44/44 are mapped. The 17-node, 44-edge graph is acyclic.

## Round-1 dispositions

- `AFFA-P4-R1-MAJ-001`: **RESOLVED** — the generated hash manifest now excludes itself.
- `AFFA-P4-R1-MAJ-002`: **RESOLVED** — WP-01 explicitly maps and implements `ABB-17`.

## Finding

### AFFA-P4-R2-MAJ-001 — Release hashes contain absolute checkout paths

The PowerShell pattern in `4-implementation-plan/stratton-implementation-plan.md:236-246` sorts by
`FullName` and writes `path=$_.FullName`. Its output therefore changes when the same source is checked
out under a different directory and can disclose the local path.

**Required remediation:** continue hashing resolved full paths, but sort and serialize stable,
normalised repository- or case-relative paths. Regenerate the affected artifacts and manifest, then
re-invoke AFF-A over the complete subject.

The seven owner-bound controls remain open and unwaived. This review is not approval, waiver,
certification, deployment authorisation or runtime validation.

_AFF-4 orchestration serialized the independent review response without changing its verdict or
findings._
