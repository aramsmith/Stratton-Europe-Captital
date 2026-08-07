# Stratton Phase 5 OBO and Route Authority Design

**Status:** Approved  
**Date:** 2026-08-07  
**Scope:** Resolve the two final handoff blockers without weakening human authority or replacing existing Phase 5 endpoints.

## Context

The demo platform is complete and locally verified, but final review found two load-bearing gaps:

1. The demo BFF cannot complete the immutable Phase 5 lifecycle. Phase 5 accepts one evidence item per analysis run, derives human authority from `x-ms-client-principal`, exposes no external completion callback, and does not return the output manifest hash required by its review and draft endpoints.
2. The demo validates declared Azure OpenAI route metadata but does not authoritatively prove the actual Azure resource location or that a route-evidence record approves the exact resource and deployment.

The selected resolution is a minimal additive Phase 5 API extension. Existing Release 1 endpoints and behavior remain backward compatible.

## Goals

- Preserve Phase 5 as the authoritative policy and state-transition boundary.
- Propagate a Microsoft Entra user identity through the browser, web proxy, BFF, and Phase 5 using delegated OAuth On-Behalf-Of (OBO).
- Support one governed cross-document analysis bundle without changing existing single-evidence analysis endpoints.
- Return an authoritative subject version for human reviews and draft preparation.
- Prove each Azure OpenAI route using both Azure Resource Manager data and an approved Phase 5 evidence record.
- Fail closed when identity, bundle state, citations, resource metadata, or route evidence is missing or inconsistent.
- Preserve draft-only output and the Investment Committee's exclusive decision authority.

## Non-goals

- No investment-decision endpoint or automatic committee decision.
- No replacement or semantic change to existing `/v1/cases`, evidence, analysis, review, or draft endpoints.
- No Azure deployment, login, what-if, or runtime verification in this implementation.
- No generic workflow engine or broad Phase 5 redesign.

## Architecture

### Identity chain

1. The browser acquires a delegated access token for the demo BFF API.
2. The private web Container App remains the same-origin proxy and forwards the bearer token unchanged. It does not manufacture or forward human-authority headers.
3. The BFF validates issuer, tenant, audience, expiry, subject, delegated scopes, application roles, case access, and purpose.
4. The BFF exchanges the validated user token for a delegated Phase 5 token using OBO.
5. The BFF uses a managed-identity-backed federated client assertion for the confidential-client portion of OBO. No client secret is stored.
6. Phase 5 authentication validates the delegated token and derives the human principal and roles from its claims. Application-only tokens cannot invoke human operations.

LOCAL mode uses a clearly isolated deterministic token exchange and principal fixture. It cannot activate when `DEMO_MODE=AZURE`.

### Additive Phase 5 surface

Add versioned endpoints under `/v1/demo-authority`. Existing endpoints remain unchanged.

#### Create analysis bundle

`POST /v1/demo-authority/cases/{caseId}/analysis-bundles`

Input:

- `caseId`
- admitted `evidenceIds[]`
- model route and deployment identifiers
- prompt-template version
- request fingerprint
- idempotency key

Phase 5:

- requires a delegated human `DealContributor`;
- validates tenant, case, purpose, licence, admission, extraction, indexing, route evidence, and every evidence item;
- creates one bundle and immutable evidence-version manifest;
- returns `analysisBundleId`, status, and evidence manifest.

#### Complete analysis bundle

`POST /v1/demo-authority/analysis-bundles/{analysisBundleId}/completion`

This is a service operation. It requires an application token from the explicitly configured demo BFF identity and cannot be called with a browser token.

Input:

- output manifest hash;
- material-claim and citation assessment;
- unsupported-claim count;
- route/deployment evidence IDs;
- deterministic completion idempotency key.

Phase 5 validates that the completion belongs to the authorized bundle and persists `DRAFT_ONLY_READY`. It returns the authoritative `subjectVersion`, equal to the accepted output manifest hash.

#### Get analysis bundle

`GET /v1/demo-authority/analysis-bundles/{analysisBundleId}`

Returns bundle status, evidence manifest, output kind, unsupported-claim count, and `subjectVersion` when ready. It never returns raw prompts, documents, or completion bodies.

#### Submit bundle review

`POST /v1/demo-authority/cases/{caseId}/analysis-bundles/{analysisBundleId}/reviews`

Requires a delegated human identity and the exact applicable review role. Phase 5 validates:

- current bundle state;
- exact `subjectVersion`;
- finding/domain review eligibility;
- current citation assessment;
- no stale or conflicting review.

#### Prepare bundle draft

`POST /v1/demo-authority/cases/{caseId}/analysis-bundles/{analysisBundleId}/draft-recommendations`

Requires a delegated human `DealReviewer`, the exact subject version, current specialist approvals, and all mandatory security gates. It produces a draft-only recommendation state. It cannot issue or submit an investment decision.

### Supporting Azure operations

The BFF call order is:

1. validate delegated user identity and authorization;
2. create the Phase 5 authority bundle;
3. perform Azure extraction, retrieval, and model operations;
4. validate citations and output locally;
5. submit the service-authenticated completion to Phase 5;
6. read the authoritative subject version;
7. expose the draft finding for human disposition.

Authority denial stops all supporting operations. Supporting-operation or completion failure cannot produce a success-shaped local state.

## Authoritative EU route binding

AZURE startup resolves each Luna, Terra, and Sol binding from two independent authorities.

### Azure Resource Manager authority

Using the BFF managed identity, retrieve each exact `Microsoft.CognitiveServices/accounts` resource by supplied resource ID. Validate:

- returned resource ID exactly matches;
- `kind` is an approved OpenAI/AI Services kind;
- actual `location` is in the approved EU allowlist;
- the account endpoint matches the configured endpoint;
- the configured deployment belongs to that account.

### Phase 5 evidence authority

Add:

`GET /v1/demo-authority/model-route-evidence/{evidenceId}`

The response contains:

- evidence status (`APPROVED`, `SUSPENDED`, or `EXPIRED`);
- resource ID;
- deployment ID;
- actual approved region;
- model route;
- API version;
- validity period;
- evidence version.

The BFF requires an exact match between the Phase 5 record, ARM resource, and supplied deployment configuration. Missing, expired, suspended, mismatched, or unavailable evidence fails startup. The BFF records only evidence identifiers and safe resource metadata in telemetry.

LOCAL mode uses immutable synthetic records matching Project Danube. These fixtures prove contract behavior but are not represented as Azure runtime assurance.

## Data model

Phase 5 receives additive records:

- `AnalysisBundle`
- `AnalysisBundleEvidenceVersion`
- `AnalysisBundleCompletion`
- `AnalysisBundleReview`
- `ApprovedModelRouteEvidence`

All records include tenant, case where applicable, correlation ID, actor or service principal ID, idempotency key, created timestamp, and immutable version identifiers.

The demo scenario stores only Phase 5 bundle IDs and authoritative subject versions. Phase 5 remains the source of authority state.

## Error behavior

- Missing/invalid user token: `401 UNAUTHENTICATED`
- Wrong tenant, audience, scope, role, purpose, case, service principal, or route evidence: `403 POLICY_DENIED`
- Stale subject version, duplicate conflicting completion, or invalid lifecycle: `409 STATE_CONFLICT`
- Missing admission, extraction, indexing, citations, approvals, or gate evidence: `422 EVIDENCE_INCOMPLETE`
- Unavailable OBO, Phase 5, ARM, or Azure dependency: `503 DEPENDENCY_UNAVAILABLE`

No failure is converted to local success, and no fallback identity, model, endpoint, region, or evidence record is allowed.

## Infrastructure and administration

Bicep adds explicit parameters and settings for:

- browser/BFF delegated scope and audiences;
- BFF/Phase 5 delegated scope;
- Phase 5 application ID;
- managed-identity federated credential used as the OBO client assertion;
- allowed BFF service principal for completion;
- ARM read permission on the three approved Cognitive Services accounts.

The admin handoff documents app registrations, delegated permissions, admin consent, app-role assignments, federated identity, and Phase 5 route-evidence records. No secrets are emitted.

## Testing

### Phase 5

- Existing endpoint regression tests remain unchanged and green.
- Bundle contract and lifecycle tests cover admission, idempotency, completion, subject version, reviews, draft preparation, stale state, and authority denial.
- Delegated user tokens are required for human endpoints; application tokens are required for completion.

### Demo BFF and web

- Browser token forwarding tests prove the proxy does not manufacture identity headers.
- JWT and OBO tests cover issuer, audience, tenant, scopes, roles, expiry, consent, and token-exchange failure.
- Workflow tests prove Phase 5 authority precedes Azure supporting calls and completion precedes visible success.
- ARM/evidence tests cover valid routes and every mismatch/failure state.

### Acceptance

- The existing Project Danube journey remains deterministic.
- Cross-case, prompt-injection, spoofed-authority, stale-version, licence, route, and security-gate tests remain fail closed.
- Clean `npm ci` plus `node scripts/verify-demo.mjs` remains the local acceptance gate.

Azure authentication, ARM lookup, deployment, and runtime tests remain blocked until separately authorized.

## Compatibility and rollout

- New endpoints are additive and versioned under `/v1/demo-authority`.
- Existing Release 1 clients and endpoints are unchanged.
- The demo refuses AZURE startup unless all delegated-identity, Phase 5, ARM, and route-evidence bindings are complete.
- Deployment authorization remains a separate user decision after local verification and final review.
