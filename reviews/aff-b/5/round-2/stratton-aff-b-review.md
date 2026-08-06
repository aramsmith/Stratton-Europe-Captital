# Stratton AFF-B review — Phase 5 — Coding round 2

**Verdict:** CONFORMS-WITH-GAPS  
**Review time:** 2026-08-03T05:57:03.9454885+02:00  
**Reviewer runtime:** gpt-5.6-sol  
**Subject:** `bcdf37557f2d78d0675c8907beda6ec61dad4a25faffcca5270473a15e821626`  
**Final round for manifest:** true

## Summary

All six AFF-B round-1 MAJOR findings are resolved in the frozen revision-4 package or converted into explicit fail-closed owner gates. No BLOCKER, MAJOR or new MINOR finding remains. Three blocked authority interfaces, fourteen owner-bound residual controls and two retained AFF-B minor gaps remain disclosed, open and unwaived; no Azure or runtime effectiveness claim is made.

## Independent binding

- Canonical manifest pre/post SHA-256: `bcdf37557f2d78d0675c8907beda6ec61dad4a25faffcca5270473a15e821626` — unchanged.
- Manifest entries: **155/155** independently recomputed and matched; ordinal paths, roles and manifest UTF-8/no-BOM/no-trailing-newline contract verified.
- Revisions 1–3: **153/153**, **154/154**, **154/154** matched and immutable.
- Upstream approvals: **6/6 APPROVED** and hash-valid, including `STRATTON-CC-001`.
- Final AFF-A round 4: `a808d4934d50c1b96c92e4dee1240ce4c277c7330c2e4644914f48c5e8a1981e` — CONFORMS-WITH-GAPS on the same exact subject.
- Coverage 009: `5c25df3283233120e814629dafd742c302ed5d44424bb75e7193c4ef0456e0ad` — `ACTIVE_CONVERGED_PHASE5_REVISION4_AFF_B_ROUND2`.
- Hash receipt: `da00dda6384e1f99ade623233234497f4855b041cabfddf589bc104da0f76d6f`; model receipt: `fdeb09e67db09f30a3531d0e91626af8aacb5636a651e78343e1d43b14144034`.
- Retained local validation run `20260803T031539999Z`: PASS, 10/10 steps; Pester 55/55; application 77/77. Evidence inspected only.
- No package code, tests, Bicep, npm, containers, scanners, Azure login/commands, target validation, what-if, deployment, retention finalisation or runtime tests were executed by AFF-B.

## Finding summary

| BLOCKER | MAJOR | MINOR | Prior MAJOR resolved |
|---:|---:|---:|---:|
| 0 | 0 | 0 | 6 |

## Prior finding dispositions

| ID | Disposition | Owner | Residual boundary |
|---|---|---|---|
| `AFFB-P5-R1-MAJ-001` | **RESOLVED_WITH_CC1_OWN_002_RETAINED** | AFF-5, Internal Audit, Identity Lead | Exact source-container read and evidence pull/copy acceptance remain owner-bound under CC1-OWN-002; no production evidence admission is authorised. |
| `AFFB-P5-R1-MAJ-002` | **RESOLVED_BY_FAIL_CLOSED_SEPARATELY_AUTHORISED_FINALISATION** | AFF-5, Internal Audit Records Owner, Business Continuity | The irreversible procedure was not executed and no lock, legal hold or operating effectiveness is claimed; admission remains blocked until observed evidence is independently accepted. |
| `AFFB-P5-R1-MAJ-003` | **RESOLVED** | Network Lead, CISO, AFF-5 | Owner-supplied network values remain fail-closed sentinels and require authorised target validation in Phase 7. |
| `AFFB-P5-R1-MAJ-004` | **RESOLVED** | AFF-5, Integration Lead, Identity Lead | Analysis and audit-export interfaces remain authority-blocked and have no active worker or Service Bus data-plane RBAC. |
| `AFFB-P5-R1-MAJ-005` | **RESOLVED** | AFF-5, Identity Lead, API Owner | Tenant, client and audience values remain owner-bound. Cloud and target behaviour require separately authorised Phase 7 validation; no runtime authentication claim is made. |
| `AFFB-P5-R1-MAJ-006` | **RESOLVED_WITH_DISCLOSED_GAPS_RETAINED** | AFF-5 | All disclosed authority conflicts, fourteen owner controls and two retained AFF-B minor gaps remain open, fail closed and unwaived. |

## Security and compliance assessment

| Area | Status | Evidence conclusion |
|---|---|---|
| Canonical Integrity And Immutability | **CONFORMS** | Manifest pre/post SHA-256 remained bcdf3755…1626; 155/155 listed hashes matched; ordinal ordering, roles, path shape, UTF-8/no-BOM and no trailing newline were verified; revisions 1-3 remain byte-identical with 153/153, 154/154 and 154/154 matches. |
| Upstream Approvals Change Control Model And Aff A | **CONFORMS** | All six approval/change-control records are APPROVED and hash-valid; every embedded approval reference matched. STRATTON-CC-001, model-plan 15 and final AFF-A round 4 are hash-valid and bind this exact subject. |
| Private Platform Rbac Exposure And Data Flows | **CONFORMS_WITH_OWNER_BOUND_VALUES** | Private access, Entra/local-auth controls, scoped RBAC, managed identities, private endpoints and governed data flows are represented. Production identifiers and target observations remain fail-closed owner inputs. |
| Assurance Pull Copy And Worm | **CONFORMS_WITH_POST_DEPLOYMENT_OWNER_GATES** | Direct delivery writes are removed. Internal Audit controls the exact evidence-container copier; source pull/copy acceptance remains CC1-OWN-002. Lock/legal hold are not claimed complete and admission remains blocked. |
| Network Fail Closed Controls | **CONFORMS_WITH_OWNER_BOUND_VALUES** | Workload NSGs, explicit denies, regional firewall UDRs, reserved-subnet handling and private-endpoint policies are present and statically validated by retained evidence. |
| Service Bus Queue Authority | **CONFORMS** | The exact seven queue-scoped role paths match active producers/consumers. Analysis and audit-export workers are disabled and receive no Service Bus data role. |
| Apim Container Apps And Application Identity | **CONFORMS_WITH_OWNER_BOUND_VALUES** | Cloud-aware Entra issuer construction, tenant/client/audience matching, HTTPS, Return401, no excluded paths, spoofed-header deletion, bearer-token preservation, Container Apps revalidation and human claim checks are represented. |
| Tenant Rls Source Licence Privacy And Special Category | **CONFORMS** | Role and case access, SQL tenant/case RLS context, current source/licence recheck, purpose/privacy/admission gates and special-category denial fail closed. |
| Queue Idempotency Outbox And Audit | **CONFORMS** | Claim-fenced idempotency, serialised transaction scopes, durable outbox, scoped relay, retry/dead-letter paths and audit event sequencing/hash chaining are represented and retained validation reports PASS. |
| Dependencies Sbom Scans And Signing | **CONFORMS_WITH_OWNER_GATES** | Exact dependency/tool versions, AVM digest, SBOMs, retained Trivy evidence and image digests are bound. Local signing is non-production; release identity and licence acceptance remain owner gates. |
| Logging Retention Rollback Deployment And Approvals | **CONFORMS_WITH_OWNER_GATES** | Sensitive log keys are redacted; diagnostics and alerts are represented; rollback preserves evidence and prohibits boundary weakening; deployment and irreversible retention steps require separate Phase 7 authorisations. |
| Release Disclosure Validation And No Azure Execution | **CONFORMS_WITH_GAPS** | Retained run 20260803T031539999Z reports ten PASS steps, Pester 55/55 and application 77/77. Freeze artifacts were inspected statically. Three authority conflicts, fourteen owner controls and two retained minor gaps remain explicit; no reviewed procedure was executed. |

## Residual and applicability boundary

- No new law, obligation, owner value or applicability conclusion was introduced.
- Three authority interfaces remain blocked: assurance verdict issuance, analysis execution, and audit evidence export.
- Fourteen owner-bound controls remain open, fail closed and unwaived: `VAL-001`–`VAL-005`, `AFFB-RES-001`–`AFFB-RES-002`, and `CC1-OWN-001`–`CC1-OWN-007`.
- Retained gaps `AFFB-CC001-R2-MIN-001` and `AFFB-CC001-R3-MIN-002` remain open and disclosed.
- Licence inventories were reviewed as disclosure evidence only; no legal compatibility conclusion is made.
- GDPR remains human-confirmed with detailed citations open; EU AI Act classification remains open; SFDR/AIFMD remain conditional; DORA remains inferred conditional pending General Counsel.

## Official Microsoft Learn sources

- [Authentication and authorization in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/authentication) — Built-in authentication and HTTPS-only considerations.
- [Enable Authentication and Authorization in Container Apps with Microsoft Entra ID](https://learn.microsoft.com/en-us/azure/container-apps/authentication-entra) — Tenant, client and application ID URI inputs for an existing Microsoft Entra registration.
- [Azure API Management validate-jwt policy](https://learn.microsoft.com/en-us/azure/api-management/validate-jwt-policy) — Bearer JWT signature, expiry, issuer and audience validation.
- [Azure API Management set-header policy](https://learn.microsoft.com/en-us/azure/api-management/set-header-policy) — Inbound header deletion semantics used to remove spoofable platform headers.
- [Configure immutability policies for containers](https://learn.microsoft.com/en-us/azure/storage/blobs/immutable-policy-configure-container-scope) — Container-level time-based retention and policy-lock behaviour.
- [Overview of immutable storage for blob data](https://learn.microsoft.com/en-us/azure/storage/blobs/immutable-storage-overview) — WORM and legal-hold behaviour and limitations.
- [Use Managed Identities to access Azure Service Bus](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-managed-service-identity) — Data Sender/Receiver roles and narrow queue/entity RBAC scope.
- [Azure network security groups overview](https://learn.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview) — NSG allow/deny processing and Azure default rule behaviour.
- [Azure virtual network traffic routing](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-networks-udr-overview) — Default 0.0.0.0/0 Internet route and custom route override behaviour.
- [Manage network policies for private endpoints](https://learn.microsoft.com/en-us/azure/private-link/disable-private-endpoint-network-policy) — Enabling NSG and UDR policy support on private-endpoint subnets.

## Required action

AFF-5 may present the exact unchanged Phase 5 revision-4 package, final AFF-A round 4, final AFF-B round 2, coverage 009 and residual gaps to the human for an explicit Phase 5 decision. Any material change requires a new sibling candidate and new final reviews. Phase 7 remains separately human-invocable and unauthorised.

AFF-B does not approve Phase 5, waive residual controls, certify compliance, provide legal advice or attestation, authorise Azure activity, authorise retention finalisation, deployment or runtime testing, or attest operating effectiveness.
