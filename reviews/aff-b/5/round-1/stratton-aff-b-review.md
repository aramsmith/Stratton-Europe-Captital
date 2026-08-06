# Stratton AFF-B review — Phase 5 — Coding round 1

**Verdict:** DIVERGES  
**Review time:** 2026-08-03T03:54:38.7348869+02:00  
**Reviewer runtime:** gpt-5.6-sol  
**Invoked by:** AFF-5  
**Subject:** `cf4ce5b9d6d003e796ff1e5a89c86007932e63641ec92f3a3a2cad8b787a7886`  
**Final round for manifest:** false

## Summary
Six unresolved major findings affect authority separation, immutable evidence, networking, Service Bus RBAC, API authentication and release disclosure. Phase 5 must not enter the human gate.

## Independent binding
- Manifest pre/post SHA-256: cf4ce5b9d6d003e796ff1e5a89c86007932e63641ec92f3a3a2cad8b787a7886 (unchanged).
- Manifest entries: 154/154 independently recomputed by the invocation host and matched.
- Final AFF-A: bcb5f8ad241cdd82a3ea290002584e91cd0a394806d6db09083c26cffe7339e8; same exact subject.
- Coverage 008: 622f9da4552c86d48f166493769b92db314a71960deab6996e1f30360b7c97e3; status `FROZEN_FORMAL_PHASE5_ROUND1_DIVERGES_NOT_GATE_ACTIVE`.
- Hash receipt: 559af43528968044258372eee472c91a1a0b8224e6a8af409e4fa36535c9c5dd.
- Model receipt: ec935efdcccd8d494ef7a2dda4df99aaeb3ce479ff234d8e819f56adc403cc71.
- Revision 1 remains 153/153 unchanged; revision 2 remains 154/154 unchanged.

## Finding summary
| BLOCKER | MAJOR | MINOR |
|---:|---:|---:|
| 0 | 6 | 0 |

| ID | Severity | Title | Owner | Required action |
|---|---|---|---|---|
| AFFB-P5-R1-MAJ-001 | MAJOR | Direct delivery write access violates the assurance pull/copy boundary | AFF-5, Internal Audit, Identity Lead | Remove delivery data-plane write access to assurance storage. Permit only signed-manifest submission; give the Internal Audit reader exact source-container read scope and the controlled copier exclusive assurance-WORM write scope. Add negative RBAC tests. |
| AFFB-P5-R1-MAJ-002 | MAJOR | Declared locked immutability and legal hold are not implemented | AFF-5, Internal Audit Records Owner, Business Continuity | Implement legal-hold resources and a separately authorised immutability-lock step, or block activation until immutable lock and legal-hold evidence is verified. Test rendered and observed state rather than input flags. |
| AFFB-P5-R1-MAJ-003 | MAJOR | Workload NSGs and routes retain fail-open Azure defaults | Network Lead, CISO, AFF-5 | Require service-specific allow rules, explicit deny rules and validated UDRs to the corresponding regional firewall. Add selected-environment rendered-template tests and explicitly handle Azure service-reserved subnets. |
| AFFB-P5-R1-MAJ-004 | MAJOR | Service Bus RBAC is over-broad and incompatible with the runtime | AFF-5, Integration Lead, Identity Lead | Grant each active worker receiver access only to its queue and sender access only to required producers and queues. Grant the API sender access only to its required queues, and do not provision blocked analysis, indexing or audit identities before activation. |
| AFFB-P5-R1-MAJ-005 | MAJOR | Container Apps authentication is not bound to an Entra tenant and audience | AFF-5, Identity Lead, API Owner | Configure the exact Microsoft Entra tenant issuer and allowed audience, require authentication, return 401 to unauthenticated callers, and validate APIM-to-app identity. Add rendered-template and spoofed-header negative tests. |
| AFFB-P5-R1-MAJ-006 | MAJOR | Release evidence suppresses open authority conflicts and residual controls | AFF-5 | Carry all fourteen owner controls and all three blocked authority interfaces into the release manifest and reports. Validation must verify faithful disclosure rather than require an empty conflict list. |

## Findings
### AFFB-P5-R1-MAJ-001 — Direct delivery write access violates the assurance pull/copy boundary
**Severity/status:** MAJOR — OPEN

**Evidence**
- 5-coding-r3/infra/modules/assurance/main.bicep:128-138 grants deliveryPrincipalId a configurable data-plane role directly on the assurance evidence container.
- 5-coding-r3/infra/parameters/prd.bicepparam:3265-3268 selects role ba92f5b4-2d11-453d-a403-e96b0029c9fe, Storage Blob Data Contributor.
- Coverage 007 CC1-OWN-002 retains an Internal Audit exact-version pull/copy acceptance boundary before activation.

**Consequence:** A delivery identity can write directly into the assurance evidence container, bypassing the independent exact-version pull, verification and controlled-copy boundary.

**Mapping:** requirements DR-004, DR-005, SR-004, SR-008, NR-002; architecture ABB-04, ABB-12, ABB-16, AD-009; coverage CC1-COV-01, CC1-COV-03.

**Owner:** AFF-5, Internal Audit, Identity Lead

**Required remediation:** Remove delivery data-plane write access to assurance storage. Permit only signed-manifest submission; give the Internal Audit reader exact source-container read scope and the controlled copier exclusive assurance-WORM write scope. Add negative RBAC tests.

### AFFB-P5-R1-MAJ-002 — Declared locked immutability and legal hold are not implemented
**Severity/status:** MAJOR — OPEN

**Evidence**
- 5-coding-r3/infra/parameters/prd.bicepparam:3223-3227 declares immutabilityLocked, legalHoldEnabled and legalHoldTags.
- 5-coding-r3/infra/modules/assurance/main.bicep:88-126 creates unlocked immutability policies but no legal-hold resource or separately authorised lock step.
- 5-coding-r3/tests/iac/Invoke-DeploymentPreflight.ps1:560-564 accepts input booleans and retention days rather than rendered or observed lock/legal-hold evidence.

**Consequence:** The package cannot substantiate locked WORM or legal-hold protection; an unlocked time-based policy remains administratively mutable.

**Mapping:** requirements DR-005, SR-004, SR-005, SR-008, SR-009, TR-003, TR-004; architecture none; coverage CC1-COV-04, CC1-COV-08, CC1-COV-09.

**Owner:** AFF-5, Internal Audit Records Owner, Business Continuity

**Required remediation:** Implement legal-hold resources and a separately authorised immutability-lock step, or block activation until immutable lock and legal-hold evidence is verified. Test rendered and observed state rather than input flags.

### AFFB-P5-R1-MAJ-003 — Workload NSGs and routes retain fail-open Azure defaults
**Severity/status:** MAJOR — OPEN

**Evidence**
- 5-coding-r3/infra/modules/network/main.bicep:21-50 deploys supplied NSG rules and route entries without enforcing a security baseline.
- 5-coding-r3/infra/parameters/prd.bicepparam:333-432 leaves workload snet-apim, snet-app and private-endpoint NSG/route arrays empty.
- 5-coding-r3/tests/iac/Invoke-DeploymentPreflight.ps1 checks selected network owner inputs but does not reject empty workload controls or prove default egress through the corresponding regional firewall.

**Consequence:** Default VNet lateral access and Internet outbound can remain available instead of explicit least privilege and controlled egress.

**Mapping:** requirements DR-007, SR-001, SR-002, SR-007, SR-010, TR-001; architecture ABB-10, ABB-15, AD-006; coverage none.

**Owner:** Network Lead, CISO, AFF-5

**Required remediation:** Require service-specific allow rules, explicit deny rules and validated UDRs to the corresponding regional firewall. Add selected-environment rendered-template tests and explicitly handle Azure service-reserved subnets.

### AFFB-P5-R1-MAJ-004 — Service Bus RBAC is over-broad and incompatible with the runtime
**Severity/status:** MAJOR — OPEN

**Evidence**
- 5-coding-r3/infra/modules/integration/main.bicep:31-48 assigns every Service Bus role at namespace scope.
- 5-coding-r3/infra/parameters/prd.bicepparam:1668-1688 grants Azure Service Bus Data Sender to every worker identity and omits the API identity.
- 5-coding-r3/app/src/api-main.ts:65-74 creates senders for q-ingestion, q-extraction and q-indexing.
- 5-coding-r3/app/src/worker-main.ts:119-126 requires every active worker to receive from its queue and the extraction worker to send to q-indexing.

**Consequence:** Production processing lacks required receiver grants, while every worker can inject messages into every queue.

**Mapping:** requirements IR-001, SR-007, TR-004, NR-002; architecture ABB-11, ABB-12, ABB-13; coverage CC1-COV-09.

**Owner:** AFF-5, Integration Lead, Identity Lead

**Required remediation:** Grant each active worker receiver access only to its queue and sender access only to required producers and queues. Grant the API sender access only to its required queues, and do not provision blocked analysis, indexing or audit identities before activation.

### AFFB-P5-R1-MAJ-005 — Container Apps authentication is not bound to an Entra tenant and audience
**Severity/status:** MAJOR — OPEN

**Evidence**
- 5-coding-r3/infra/parameters/prd.bicepparam:2037-2041 configures only authConfig.platform.enabled.
- 5-coding-r3/infra/modules/application-platform/main.bicep:111-115 passes the incomplete object directly to Microsoft.App/containerApps/authConfigs.
- 5-coding-r3/app/src/api-runtime.ts:283-334 trusts x-ms-client-principal as the platform-validated identity boundary.

**Consequence:** The required token-validation and trusted-header boundary cannot be proven and may depend on unsafe or unavailable defaults.

**Mapping:** requirements SR-007, NR-002; architecture ABB-10, ABB-11; coverage CC1-COV-01.

**Owner:** AFF-5, Identity Lead, API Owner

**Required remediation:** Configure the exact Microsoft Entra tenant issuer and allowed audience, require authentication, return 401 to unauthenticated callers, and validate APIM-to-app identity. Add rendered-template and spoofed-header negative tests.

### AFFB-P5-R1-MAJ-006 — Release evidence suppresses open authority conflicts and residual controls
**Severity/status:** MAJOR — OPEN

**Evidence**
- 5-coding-r3/app/authority-boundary-conflict-note.md:1-15 records three unresolved authority interfaces.
- 5-coding-r3/validation/New-ReleaseManifest.ps1:559-572 emits only nine residual IDs and an empty authorityConflicts array.
- 5-coding-r3/stratton-build-report.md:77-98 says no authority gates are recorded and refers to seven approved residual controls.
- 5-coding-r3/validation/Test-ReleaseEvidence.ps1:149-154 requires authorityConflicts to be empty.
- Coverage 007 retains VAL-001 through VAL-005, AFFB-RES-001/002 and CC1-OWN-001 through CC1-OWN-007 as fourteen open owner controls.

**Consequence:** The human gate package materially understates unresolved authority interfaces and owner dependencies.

**Mapping:** requirements SR-008, SR-009, TR-003, TR-004, NR-002; architecture none; coverage CC1-COV-01, CC1-COV-02, CC1-COV-03, CC1-COV-04, CC1-COV-05, CC1-COV-06, CC1-COV-07, CC1-COV-08, CC1-COV-09.

**Owner:** AFF-5

**Required remediation:** Carry all fourteen owner controls and all three blocked authority interfaces into the release manifest and reports. Validation must verify faithful disclosure rather than require an empty conflict list.


## Confirmed controls
- SQL public access is disabled; Microsoft Entra-only authentication and TLS 1.2 are configured.
- Storage, Key Vault, Service Bus, API Management, Search and Cognitive Services disable public network access or local authentication where supported.
- Managed identities and digest-pinned images are used; stored credentials and GitHub OIDC are prohibited.
- API code enforces roles, case access, human-only review routes and tenant/case SQL row-level-security context.
- Input, licence, purpose, privacy, evidence-admission and special-category gates fail closed.
- Queued analysis rechecks current source and licence authority; production analysis, vectorisation, audit export and verdict issuance remain blocked.
- Transactional idempotency, durable queue outbox, claim fencing and SQL audit sequencing are implemented.
- Blob references are allow-listed and protected against query/SAS use, ETag drift and size/hash mismatch.
- Containers run non-root with pinned base-image digests; retained scans report no HIGH or CRITICAL vulnerabilities and no secrets.
- Local signatures are accurately described as non-production integrity evidence.
- No Azure authentication, target validation, what-if, deployment or cloud runtime testing occurred.

## Applicability and residual boundary
No new legal instrument or obligation is introduced. GDPR remains human-confirmed with detailed citations open; the EU AI Act role/use-case classification remains open; SFDR and AIFMD remain conditional; DORA remains inferred conditional pending General Counsel.

Open and unwaived: VAL-001, VAL-002, VAL-003, VAL-004, VAL-005, AFFB-RES-001, AFFB-RES-002, CC1-OWN-001, CC1-OWN-002, CC1-OWN-003, CC1-OWN-004, CC1-OWN-005, CC1-OWN-006, CC1-OWN-007, AFFB-CC001-R2-MIN-001, AFFB-CC001-R3-MIN-002.

## Coverage 008
Coverage 008 preserves coverage 007 and adds the Phase 5 subject, final AFF-A binding, six major findings and eight implementation coverage domains without changing requirements or legal obligations.

## Required action
AFF-5 must preserve revision 3 byte-identically, create a new sibling candidate and model-plan revision addressing all six major findings, regenerate validation, release and canonical hash evidence, and invoke new AFF-A and AFF-B reviews against the same new manifest.

AFF-B does not approve Phase 5, open the human gate, waive residual controls, certify compliance, attest operating effectiveness or authorise Azure activity.
