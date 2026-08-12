## Assurance boundary conflict note (recordVerdict)

The approved workload deployment scope (DU-12 workload API/jobs) does not include authority-owned
assurance compute/interface for Internal Audit verdict issuance. DU-16 currently covers assurance
stores only and does not authorise verdict compute. `recordVerdict` remains in the OpenAPI contract
as an assurance-boundary operation only.

Workload runtime behaviour is fail-closed: `POST /assurance/v1/verdicts` is denied and does not
persist or issue verdicts. Deployable implementation requires a separate authority-owned interface
and deployment authorisation beyond the Phase 4 workload plan.
