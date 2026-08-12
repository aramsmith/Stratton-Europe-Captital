# Stratton Phase 5 application runtime notes

## Runtime boundaries
- Workload API entrypoint: `dist/api-main.js`
- Worker entrypoint: `dist/worker-main.js`
- Assurance operation `recordVerdict` remains in OpenAPI only; workload runtime fails closed.

## Authentication and network boundary
- APIM removes caller-supplied platform identity headers, validates the original human bearer token against the owner-bound Entra tenant and audience, and forwards that token unchanged.
- Container Apps revalidates the same token and injects the trusted `x-ms-client-principal` header consumed by the API.
- Missing, malformed, non-Entra or role-incompatible principals are denied.
- Direct spoofing with custom role headers is ignored/denied.
- Private APIM forwarding + Container Apps authentication are mandatory for deployment.

## Production adapters (no local durability claims)
- API and worker production mode require:
  - Azure SQL via managed identity (`AZURE_SQL_SERVER_FQDN`, `AZURE_SQL_DATABASE_NAME`)
  - Azure Service Bus via managed identity (`AZURE_SERVICEBUS_FQDN`, `WORKER_QUEUE_NAME`)
- Production entrypoints fail closed on missing Azure configuration.
- In-memory/file adapters are test-only (`ALLOW_TEST_ADAPTERS=true`).
- Unresolved authority-boundary blockers are tracked in `authority-boundary-conflict-note.md`.

## Idempotency and payload safety
- Mutating operations require `idempotency-key`.
- Keys are scoped by tenant + case + subject + operation and request fingerprint.
- Identical retries replay prior response; mismatched payloads conflict.
- Raw payload fields (`documentBody`, `promptBody`, `completionBody`, `sourceWritePayload`, `rawDocumentPayload`) are denied.

## Mandatory environment variables
- Shared: `APP_ENV`, `ROLLOUT_ADMISSION_MAX`, `LOG_LEVEL`, `MODEL_PROVIDER_EVIDENCE_ID`, `PROMPT_GOVERNANCE_EVIDENCE_ID`
- Routing: `MODEL_ROUTING_POLICY_VERSION=stratton-model-routing-v1` and `MODEL_ROUTE_DEPLOYMENTS_JSON`
- API: `API_PORT`, `API_REQUEST_BODY_LIMIT_BYTES`, `API_RUNTIME_MODE`
- Worker: `WORKER_MODE`, `WORKER_MAX_CYCLES`, `WORKER_RECEIVE_WAIT_MS`, `WORKER_QUEUE_NAME`
- Production only: `AZURE_SQL_SERVER_FQDN`, `AZURE_SQL_DATABASE_NAME`, `AZURE_SERVICEBUS_FQDN`, `AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`, `AZURE_SEARCH_ENDPOINT`, `AZURE_SEARCH_INDEX_NAME`

`MODEL_ROUTE_DEPLOYMENTS_JSON` must contain exactly `LUNA`, `TERRA` and `SOL`. Each tier must
provide a non-empty `deploymentId` and `residencyEvidenceId`, its matching `gpt-5.6-*` model name,
model version `2026-07-09` and `validationStatus: "VALIDATED"`. Extra or missing tiers and fields
are rejected. There is no global or legacy residency-evidence fallback.

The case-scoped analysis POST accepts a task class and optional authorised escalation reason. The
application selects and persists the deployment, route reason, effort and policy evidence. Status
responses expose only safe tier/reason/policy metadata, not deployment or residency evidence IDs.
Azure/production analysis remains fail closed: `BlockedAnalysisProvider` is retained and production
workers reject `q-analysis` before provider execution. The in-memory provider is test-only.

## Specialist foundation and benchmark evidence

- Document Intelligence extraction requests use `prebuilt-layout` with API version `2024-11-30`.
- The benchmark runner requires a deterministic routed tier, non-blank model identity and version,
  at least 100 representative cases, interactive p95 at or below 5,000 ms, typical pack time at
  or below 30 minutes, and positive finite input-token, output-token and USD-cost evidence. These
  controls compose with the existing citation and unsupported-claim gates; their failure order is
  the existing gates first, then route sample, latency, pack, identity and token/cost gates.
- `evidence/model-portfolio/model-portfolio-benchmark-template.json` is blocked owner input only.
  It contains no observed benchmark metrics or promotion claim.
- `text-embedding-3-large` dimensions and chunking parameters require owner benchmark evidence.
  Changing either requires an index rebuild.
- Deterministic numerical rules are paired with Isolation Forest as the initial explainable anomaly
  approach. Supervised challengers remain future work and require evidence before use.

## Database
- `migrations/001_init.sql` is Azure SQL T-SQL with:
  - SQL Server row-level security using `SESSION_CONTEXT` + schema-bound predicate + security policy
  - append-only triggers for eligibility, review and policy decision history
  - case-to-approved-decision FK integrity
  - admitted-evidence citation integrity and evidence-version linkage
  - least-privilege roles (`workload_api_role`, `worker_runtime_role`, `audit_export_role`); deployment principals must not use `db_owner`
- `migrations/002_model_routing.sql` adds route identity and nullable observation columns, backfills
  historical rows without rewriting their original route evidence, and retains the historical
  `regional_deployment_evidence_id` column as nullable for compatibility. New writes use
  `deployment_residency_evidence_id`.

## Local application validation

Run `npm run validate` from `app/`. The gate formats, lints, typechecks, builds, runs unit and
integration tests, checks OpenAPI/migrations and verifies pinned container base-image digests. It
does not sign in to Azure, invoke a model or perform deployment/runtime validation.
