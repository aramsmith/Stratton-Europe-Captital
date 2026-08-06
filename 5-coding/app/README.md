# Stratton Phase 5 application runtime notes

## Runtime boundaries
- Workload API entrypoint: `dist/api-main.js`
- Worker entrypoint: `dist/worker-main.js`
- Assurance operation `recordVerdict` remains in OpenAPI only; workload runtime fails closed.

## Authentication and network boundary
- API expects a platform-validated Microsoft Entra principal header (`x-ms-client-principal`).
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
- Shared: `APP_ENV`, `ROLLOUT_ADMISSION_MAX`, `LOG_LEVEL`, `MODEL_PROVIDER_EVIDENCE_ID`, `REGIONAL_DEPLOYMENT_EVIDENCE_ID`
- API: `API_PORT`, `API_REQUEST_BODY_LIMIT_BYTES`, `API_RUNTIME_MODE`
- Worker: `WORKER_MODE`, `WORKER_MAX_CYCLES`, `WORKER_RECEIVE_WAIT_MS`, `WORKER_QUEUE_NAME`
- Production only: `AZURE_SQL_SERVER_FQDN`, `AZURE_SQL_DATABASE_NAME`, `AZURE_SERVICEBUS_FQDN`, `AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`, `AZURE_SEARCH_ENDPOINT`, `AZURE_SEARCH_INDEX_NAME`

## Database
- `migrations/001_init.sql` is Azure SQL T-SQL with:
  - SQL Server row-level security using `SESSION_CONTEXT` + schema-bound predicate + security policy
  - append-only triggers for eligibility, review and policy decision history
  - case-to-approved-decision FK integrity
  - admitted-evidence citation integrity and evidence-version linkage
  - least-privilege roles (`workload_api_role`, `worker_runtime_role`, `audit_export_role`); deployment principals must not use `db_owner`
