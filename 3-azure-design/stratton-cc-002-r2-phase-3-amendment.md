# Stratton Phase 3 CC-002 model-portfolio amendment — remediation revision 2

**Change control:** `STRATTON-CC-002`  
**Revision:** `R2`  
**Status:** `IMPLEMENTATION_COMPLETE_REVIEW_PENDING`  
**Author model:** `gpt-5.6-sol`  
**Superseded candidate manifest:** `2184986970076bb5317c31459e335d1e9272973411c3e3d14a1886102b07214a`  
**Scope:** append-only remediation candidate; no approval, deployment or runtime claim

## 1. Change identifier and status

This append-only `STRATTON-CC-002` revision remediates AFF-A round 6 and AFF-B round 5 without
changing any original candidate or reviewed-subject byte. The original manifest remains an immutable
`DIVERGES` subject. R2 uses new `-r2` paths, a new source-binding record and a new outer manifest.
Production promotion and Azure work remain blocked pending complete AFF-A/AFF-B re-review of the same
unchanged R2 bytes and an explicit human decision.

## 2. Human decision and reason for change

The human-selected direction remains a fixed Luna, Terra and Sol portfolio using the smallest
governed model that meets the evidence threshold. R2 does not change that decision. It closes the
reviewed assurance gaps by making hostile-evidence tests immutable blocking gates, binding
owner-parameterised primary/recovery semantics, adding claim-bound official-source provenance,
defining the privacy lifecycle and restoring exact Markdown/HTML decision parity.

## 3. Superseded regional-only statements

The canonical Phase 3 files and both `STRATTON-CC-001` candidates remain unchanged. After a future
explicit human approval of these exact R2 bytes, the targeted regional-only inference denial is
superseded only for Azure OpenAI inference by `EU Data Zone Standard`. Named Azure resource
locations, the two-resource recovery pattern, private networking, managed identity, data-at-rest
controls and fail-closed owner evidence remain mandatory.

Application failover selects an approved Azure resource and deployment. It cannot select, observe or
promise Microsoft's processing region inside the EU Data Zone. `Global Standard prohibited` remains
the policy.

## 4. EU Data Zone Standard sovereignty boundary

Prompts and outputs remain within the EU Data Zone. Data at rest remains in the designated EU
geography. Microsoft selects the processing region within the zone; the architecture makes no
specific processing-region promise. No region, quota, capacity or availability is selected here.

Every GPT and embedding route has owner-parameterised primary and recovery bindings:

| Route | Primary evidence required | Recovery evidence required | Failover trigger and authority | Missing recovery evidence |
|---|---|---|---|---|
| LUNA | Approved EU geography/resource allow-list; primary Azure resource and deployment IDs; `DataZoneStandard`; model/version/API; private path, identity, quota/capacity | Different approved EU resource; recovery Luna deployment ID; equivalent SKU, route benchmark, security and lifecycle evidence | Immutable impairment evidence; Service Operations incident authority under Azure Platform and AI Governance policy | Deny new work; queue eligible work or return a controlled failure |
| TERRA | Same controls for primary Terra Responses deployment | Same controls for recovery Terra Responses deployment; stateful features remain disabled without lifecycle evidence | Same owner-authorised evidence-gated process | Deny new work; queue eligible work or return a controlled failure |
| SOL | Same controls for primary Sol Responses deployment | Same controls for recovery Sol Responses deployment; unsupported output still stops for a human | Same owner-authorised evidence-gated process | Deny new work; queue eligible work or return a controlled failure |
| EMBEDDING | Approved EU resource/deployment; supported embedding version; dimensions/chunking and index evidence | Different approved EU resource/deployment; dimension, chunking, schema, filter, alias and rebuild/restore parity | Immutable impairment evidence; Service Operations plus Data Owner, Azure Platform and AI Governance authority | Deny new work; queue eligible work or return a controlled failure |

Both resources independently require current `DataZoneStandard`, EU geography, allow-list, private
path, managed identity, capacity/quota and route evidence. Provider-selected processing-region
behaviour is not an application recovery target.

The failover boundary applies to prompt, output, data-at-rest, vector, index, log and backup data:
prompts/outputs stay within the EU Data Zone; stored data, vectors, indexes, logs and backups stay in
approved resources in the designated EU geography; logs exclude sensitive bodies; recovery requires
integrity, retention, deletion, legal-hold, classification and access-control parity.

## 5. Luna, Terra and Sol role table

| Tier | Model | Version | Purpose |
|---|---|---|---|
| LUNA | `gpt-5.6-luna` | `2026-07-09` | High-volume triage, query rewrite, first-pass summary |
| TERRA | `gpt-5.6-terra` | `2026-07-09` | Default grounded professional analysis |
| SOL | `gpt-5.6-sol` | `2026-07-09` | Gated complex and high-consequence reasoning |

| Tier | Azure deployment interface | API version | Primary/recovery configuration |
|---|---|---|---|
| LUNA | Chat Completions | `2024-12-01-preview` | `ai.deployments.luna.primaryDeploymentId` / `recoveryDeploymentId` |
| TERRA | Responses | `2025-04-01-preview` | `ai.deployments.terra.primaryDeploymentId` / `recoveryDeploymentId` |
| SOL | Responses | `2025-04-01-preview` | `ai.deployments.sol.primaryDeploymentId` / `recoveryDeploymentId` |

Each GPT record binds a 1,050,000-token context window, 128,000 maximum output tokens, text/image
input, structured outputs and tool capability. Autonomous tool execution is disabled for Release 1.
Application configuration references deployment IDs, never an unapproved direct model alias.
Responses stateful features remain disabled unless separately approved lifecycle evidence exists.

## 6. Specialist extraction, retrieval and anomaly foundation

| Capability | Bound service or method | Control boundary |
|---|---|---|
| Document structure | Azure AI Document Intelligence `prebuilt-layout` | Extracts structural content; workload accuracy remains benchmark-bound |
| Multilingual retrieval | Azure OpenAI `text-embedding-3-large` plus Azure AI Search | Model maximum input is 8,191 tokens; the Search embedding skill currently documents 8,000; maximum dimensions are 3,072; promoted dimensions/chunking are owner-selected |
| Numerical anomaly detection | Deterministic rules and statistical checks | Release 1 primary detector; an LLM explanation cannot override it |
| Explainable anomaly challenger | Isolation Forest or a separately governed equivalent | Future scope; requires representative anomaly data, explainability evidence and separate validation |
| Supervised prediction | Governed gradient-boosted challenger | Future scope; blocked until sufficient labelled outcomes and separate validation exist |

Changing embedding version, dimensions or chunking invalidates affected evidence and requires a
complete validated index rebuild. Search remains derived, security-filtered and rebuildable.
Fine-tuning with Stratton data remains out of scope. No model training on Stratton content.

## 7. Deterministic routing and escalation

`deterministic workflow routing` selects the initial tier from workflow step and task class:

| Task class | Initial tier |
|---|---|
| `EVIDENCE_TRIAGE` | LUNA |
| `QUERY_REWRITE` | LUNA |
| `FIRST_PASS_SUMMARY` | LUNA |
| `GROUNDED_ANALYSIS` | TERRA |
| `CROSS_DOCUMENT_COMPARISON` | TERRA |
| `ESG_NORMALISATION` | TERRA |
| `COMPLEX_RISK_SYNTHESIS` | SOL |
| `INVESTMENT_THESIS_CHALLENGE` | SOL |

Escalation order remains `VALIDATION_FAILURE`, `LOW_CONFIDENCE`,
`CONFLICTING_MATERIAL_EVIDENCE`, `HIGH_RISK_SPECIALIST_CONCLUSION`,
`AUTHORISED_HUMAN_REQUEST`. Escalation and recovery are separate: escalation changes tier within the
allow-list; recovery changes only the approved resource/deployment for the same route after complete
recovery evidence. Neither permits a direct alias, Global Standard, unrecorded substitution or tier
downgrade.

Every route checks its primary/recovery binding and all twelve security gates before promotion.
Unavailable primary service activates recovery only when evidence is complete; otherwise work queues
or fails closed.

## 8. Evaluation and promotion gates

Every promoted route requires at least `100 representative generative cases per promoted route` and
primary/recovery parity evidence. Existing quality and performance thresholds remain blocking:

| Measure | Gate |
|---|---|
| Material citation coverage | exactly 100% |
| Extraction accuracy | at least 95% |
| Critical-field accuracy | at least 99% |
| Critical unsupported claims | zero |
| Missed critical risks | zero |
| Other unsupported claims | no more than 2% |
| High-risk recall | at least 90% |
| Interactive latency | p95 below 5 seconds |
| Typical document-pack completion | within 30 minutes |

Every security scenario below is a separate immutable blocking promotion gate. Partial pass, missing
evidence, expired evidence or mismatched evidence blocks promotion.

| Gate ID | Scenario | Pass criteria | Immutable evidence IDs | Owner | Fail-closed outcome |
|---|---|---|---|---|---|
| `CC002-R2-SEC-GATE-001` | Direct prompt injection | Policy authority remains intact; no prohibited disclosure/action; expected safe disposition | `SEC-EVID-DIRECT-INJECTION-RESULTS`, input manifest | Security Owner / AI Governance | Block promotion and deny affected output |
| `CC002-R2-SEC-GATE-002` | Indirect prompt injection | Hostile evidence instructions remain data and are quarantined/excluded | `SEC-EVID-INDIRECT-INJECTION-RESULTS`, boundary trace | Security Owner / Data Owner / AI Governance | Block promotion and quarantine evidence |
| `CC002-R2-SEC-GATE-003` | Instruction/evidence boundary escape | Every authority-boundary mutation is rejected without material output | `SEC-EVID-BOUNDARY-ESCAPE-RESULTS`, prompt-template hash | Application Security / AI Governance | Block promotion and stop output |
| `CC002-R2-SEC-GATE-004` | Citation spoofing | Every material citation resolves to admitted immutable evidence | `SEC-EVID-CITATION-SPOOF-RESULTS`, resolution manifest | AI Governance / Evidence Owner | Block promotion and material narrative |
| `CC002-R2-SEC-GATE-005` | Poisoned retrieval index | Poison is detected/excluded and validated rebuild/restore is required | `SEC-EVID-POISONED-INDEX-RESULTS`, recovery results | Search / Security / Data Owners | Quarantine index, stop retrieval and block promotion |
| `CC002-R2-SEC-GATE-006` | Cross-case retrieval | No foreign evidence is returned and a security event is recorded | `SEC-EVID-CROSS-CASE-NEGATIVE-RESULTS`, filter-policy hash | Data Owner / Security Owner | Deny query, alert and block promotion |
| `CC002-R2-SEC-GATE-007` | Caller filter override | Weakened server filters are rejected before Search | `SEC-EVID-FILTER-OVERRIDE-RESULTS`, server-filter hash | Application Security / Search Owner | Deny query and block promotion |
| `CC002-R2-SEC-GATE-008` | Revoked/expired evidence | Invalid evidence is excluded from material output | `SEC-EVID-REVOCATION-EXPIRY-RESULTS`, admission snapshot | Evidence / Records / Legal Owners | Deny admission and block promotion |
| `CC002-R2-SEC-GATE-009` | Unavailable deployment | Only fully evidenced recovery activates; otherwise queue/control failure | `SEC-EVID-UNAVAILABLE-DEPLOYMENT-RESULTS`, recovery activation results | Service Operations / Azure Platform / AI Governance | Queue or controlled failure and block promotion |
| `CC002-R2-SEC-GATE-010` | Deployment/model/version mismatch | Resource, deployment, model, version, SKU, interface and API must all match | `SEC-EVID-DEPLOYMENT-MISMATCH-RESULTS`, allow-list snapshot | Azure Platform / AI Governance | Deny, alert and block promotion |
| `CC002-R2-SEC-GATE-011` | Attempted silent fallback | Lower tier, direct alias, Global Standard and unrecorded endpoints are denied | `SEC-EVID-SILENT-FALLBACK-RESULTS`, route allow-list snapshot | AI Governance / Application Security / Service Operations | Deny substitution, alert and block promotion |
| `CC002-R2-SEC-GATE-012` | Attempted autonomous authority | Models/workloads cannot approve, promote, transact or decide investments | `SEC-EVID-AUTHORITY-ABUSE-RESULTS`, RBAC/state-transition results | Business Control / Security / AI Governance | Deny state transition, stop for human and block promotion |

Evaluation, routing and security records contain the same IDs, criteria, evidence, owners and
dispositions. Any material model, API, deployment, prompt, filter, embedding, index or route-policy
change invalidates affected evidence.

## 9. Security, privacy and compliance controls

Private endpoints, central private DNS, managed identity, least privilege and public-network denial
apply equally to primary and recovery resources. Evidence admission requires authority, purpose,
classification, licence/AI-use permission, retention, scan, hash and decision evidence.

The claim-bound source record binds material model/API/capability/Data Zone/network/identity,
embedding, extraction and no-training assertions to official URLs, exact sections, retrieval date,
evidence excerpts, licence/use dispositions, owners and review/expiry conditions. Time-sensitive
availability remains evidence, not a quota or deployment claim.

Privacy lifecycle is fail-closed and owner-bound:

| Data class | Minimisation/classification | Retention/deletion/legal hold/DSR | Integrity, redaction and recovery | Operational owners |
|---|---|---|---|---|
| Prompt and output | Necessary admitted fragments only; highly confidential default pending owner classification | Separate owner retention; delete transient copies; scoped legal hold; source/case linkage for applicable DSR | Redact unnecessary personal/secret data; immutable accepted-output evidence; restore only with lifecycle parity | DPO, Records, Application and Data Owners |
| Vector and index | Admitted minimised chunks; inherit highest source classification pending confirmation | Source-linked retention/deletion; DSR propagates to chunks/vectors/index rebuild; hold preserves restrictions | Redact before embedding; immutable provenance/schema/filter manifests; validated rebuild or EU restore | Data, Search, Records and Security Operations |
| Benchmark corpus | Synthetic/governed cases; direct identifiers removed unless approved | Owner retention for inputs/outputs/labels; deletion invalidates metrics; scoped hold and DSR provenance | Redacted evaluator access; immutable input/result/calculation hashes; corpus/metrics restored together | AI Governance, Evaluation, Data and Records Owners |
| Route log | Metadata only; confidential operational classification pending confirmation | Owner audit/incident retention; expiry/anonymisation; scoped hold and pseudonymous DSR lookup | Prohibited bodies redacted; append-only route/escalation/failover/security hashes; ordered recovery | Service Operations, Security Operations, AI Governance, Records |
| Telemetry | Aggregate latency/token/cost/validation/alert metrics; no content bodies | Separate metrics/trace/security retention; aggregation/deletion; scoped hold; avoid direct identifiers | Ingestion redaction; immutable security snapshots/tamper-evident exports; EU recovery with rule parity | Observability, Security Operations, Service Operations, Records |

GDPR detailed evidence remains owner work. EU AI Act role/use-case classification and DORA
applicability remain pending accountable-human evidence. No legal classification, legal advice,
certification, waiver or operating-effectiveness conclusion is made.

## 10. Release 1 versus future scope

| Capability | Scope |
|---|---|
| Due-diligence evidence-to-draft | **Release 1** — Document Intelligence → embeddings/Search → Terra, with Sol only for gated escalation |
| Risk and ESG evidence analysis | **Release 1** — deterministic validation plus Terra or Sol; specialist and human authority retained |
| Automated SFDR reporting | **Future capability — not Release 1** |
| Deal-intelligence copilot and sourcing automation | **Future capability — not Release 1** |
| Portfolio financial-anomaly monitoring | **Future capability — not Release 1** |
| Custom Document Intelligence | **Future capability — not Release 1** |
| Explainable anomaly challenger | **Future capability — not Release 1** |
| Supervised prediction | **Future capability — not Release 1; governed gradient-boosted challenger only after sufficient labelled outcomes** |
| Microsoft Foundry Model Router evaluation | **Future capability — not Release 1** |

Model availability does not enlarge Release 1, remove the 20-deal cap or weaken evidence and human
authority.

## 11. Operational evidence envelope

Each route event records case/work-item pseudonyms, task/routing reason, tier, primary/recovery,
approved resource/deployment, model/version/SKU/API, prompt/policy/filter/route versions, retrieval,
source and security-gate hashes, validator results, escalation/failover/human events, tokens, latency
and cost reference. Prompt, output, document, chunk and vector bodies are prohibited from routine
route logs and telemetry.

Recovery evidence binds primary impairment, recovery allow-list and `DataZoneStandard` evidence,
route/security parity, private path, managed identity, capacity/quota and lifecycle parity. Restore
gaps, hash mismatch or missing deletion/legal-hold state blocks activation.

## 12. Explicit non-claims and owner inputs

No quota, capacity, exact Azure resource region, availability, deployment, runtime test, production
readiness, achieved benefit, specific provider processing region, legal classification,
certification, reviewer acceptance, approval or promotion is claimed.

`REQUIRED_OWNER_INPUT` includes primary/recovery Azure resource regions and IDs, deployment IDs,
geography/allow-list/SKU evidence, quota/capacity, failover trigger/authority, reasoning effort,
embedding version/dimensions/chunking, index and backup recovery, provider terms, source licences,
privacy classification, retention/deletion/legal hold/DSR, security evidence, benchmarks and legal
classification. Missing, expired or mismatched evidence denies, queues or stops as specified.

## 13. Required AFF-A, AFF-B and human approval

The controller must create AFF-A round 7, AFF-B round 6 and coverage 013 only after this candidate is
frozen. This authoring revision creates none of them. Reviewers must independently hash the same R2
manifest and assess all persisted findings. Only converged hash-bound reviews may be presented for an
explicit human decision. Until then the status remains
`IMPLEMENTATION_COMPLETE_REVIEW_PENDING`; no Azure deployment, approval or production promotion is
authorised.
