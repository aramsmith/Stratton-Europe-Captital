# Stratton Phase 5 unresolved authority-boundary conflicts (application scope)

1. **Assurance verdict issuance is not deployable in DU-12**
   - `recordVerdict` remains in the OpenAPI contract, but the workload runtime (`DU-12`) fails closed with `POLICY_DENIED`.
   - Approved Phase 4 authority assigns **DU-16** to assurance data stores and does **not** provide authority-owned assurance compute/API for verdict issuance from workload.
   - Result: no verdict creation path is implemented in workload runtime; this remains intentionally blocked pending authority-approved assurance interface.

2. **Analysis execution interface remains authority-blocked**
   - Worker analysis uses a blocked provider in production (`BlockedAnalysisProvider`) when authority-owned prompt/interface approval artifacts are absent for DU-12.
   - Result: analysis jobs are moved to blocked/failure state with audit evidence and dead-letter handling; no success-shaped no-op execution is allowed.

3. **Audit evidence export interface remains authority-blocked**
   - `q-audit-export` processing uses a blocked exporter in production (`BlockedAuditEvidenceExporter`) because an authority-owned immutable audit export interface contract is not approved for DU-12.
   - Result: workload does not claim successful export or verdict issuance without that authority-owned interface.
