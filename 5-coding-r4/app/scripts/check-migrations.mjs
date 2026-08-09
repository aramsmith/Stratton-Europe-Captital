import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(process.cwd(), "migrations", "001_init.sql");
const demoAuthorityMigrationPath = resolve(process.cwd(), "migrations", "002_demo_authority.sql");
const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.toLowerCase();

const requiredSnippets = [
  "create table dbo.cases",
  "create table dbo.eligibility_decisions",
  "create table dbo.source_registrations",
  "create table dbo.external_licence_decisions",
  "create table dbo.evidence_envelopes",
  "create table dbo.evidence_admission_decisions",
  "create table dbo.evidence_objects",
  "create table dbo.analysis_runs",
  "create table dbo.material_claims",
  "create table dbo.citations",
  "create table dbo.review_approvals",
  "create table dbo.policy_decisions",
  "create table dbo.work_items",
  "create table dbo.audit_outbox",
  "create table dbo.validation_manifests",
  "create table dbo.idempotency_records",
  "create table dbo.extraction_chunks",
  "create security policy dbo.stratton_rls_policy",
  "session_context",
  "allow_tenant_lookup",
  "with schemabinding",
  "create trigger dbo.trg_eligibility_append_only",
  "create trigger dbo.trg_review_approvals_append_only",
  "create trigger dbo.trg_policy_decisions_append_only",
  "create trigger dbo.trg_evidence_admission_decisions_append_only",
  "rollout_sequence int not null",
  "check (rollout_sequence between 1 and 20)",
  "fk_cases_deal_eligibility",
  "fk_cases_jurisdiction_eligibility",
  "add block predicate rls.fn_tenant_case(tenant_id, case_id) on dbo.idempotency_records after insert",
  "add block predicate rls.fn_tenant_case(tenant_id, case_id) on dbo.idempotency_records after update",
  "grant select, insert, update on dbo.idempotency_records to workload_api_role",
  "grant select, insert, update on dbo.idempotency_records to worker_runtime_role"
  ,"opened_at datetime2",
  "committee_ready_at datetime2",
  "domain nvarchar",
  "authoritative_status nvarchar",
  "connector_evidence_id nvarchar",
  "purpose_id nvarchar",
  "approved_by nvarchar",
  "lease_expires_at_epoch_ms bigint",
  "claim_id nvarchar",
  "work_type nvarchar",
  "queued_at datetime2",
  "completed_at datetime2",
  "evidence_id nvarchar",
  "evidence_version_id nvarchar",
  "analysis_run_id nvarchar",
  "benchmark_version nvarchar",
  "producer_identity nvarchar"
  ,"decided_at datetime2"
  ,"fk_analysis_runs_evidence_envelope"
  ,"fk_analysis_runs_evidence_object"
  ,"uq_evidence_objects_lineage"
  ,"trg_citations_require_admitted_evidence"
  ,"trg_review_subject_integrity"
  ,"output_manifest_hash nvarchar"
  ,"usp_admit_evidence"
];

for (const snippet of requiredSnippets) {
  if (!normalized.includes(snippet)) {
    throw new Error(`MISSING_REQUIRED_SQL_SNIPPET:${snippet}`);
  }
}

const forbiddenSnippets = [
  "timestamptz",
  "current_setting(",
  "force row level security",
  "enable row level security",
  "deferrable",
  "bigserial",
  "create policy "
];

for (const snippet of forbiddenSnippets) {
  if (normalized.includes(snippet)) {
    throw new Error(`POSTGRESQL_CONSTRUCT_NOT_ALLOWED:${snippet}`);
  }
}

if (!normalized.includes("fk_citations_admitted_evidence")) {
  throw new Error("MISSING_ADMITTED_EVIDENCE_FK");
}
if (!normalized.includes("fk_citations_evidence_lineage")) {
  throw new Error("MISSING_EVIDENCE_LINEAGE_FK");
}

if (!existsSync(demoAuthorityMigrationPath)) {
  throw new Error("MISSING_DEMO_AUTHORITY_MIGRATION:002_demo_authority.sql");
}

const demoAuthoritySql = readFileSync(demoAuthorityMigrationPath, "utf8").toLowerCase();
for (const snippet of [
  "create table dbo.analysis_bundles",
  "create table dbo.analysis_bundle_evidence",
  "create table dbo.analysis_bundle_reviews",
  "create table dbo.approved_model_route_evidence",
  "uq_analysis_bundle_request_fingerprint",
  "uq_analysis_bundle_evidence_ordinal",
  "trg_analysis_bundle_evidence_append_only",
  "add filter predicate rls.fn_tenant_case(tenant_id, case_id) on dbo.analysis_bundles",
  "grant select, insert, update on dbo.analysis_bundles to workload_api_role",
  "grant select on dbo.approved_model_route_evidence to workload_api_role"
]) {
  if (!demoAuthoritySql.includes(snippet)) {
    throw new Error(`MISSING_DEMO_AUTHORITY_SQL_SNIPPET:${snippet}`);
  }
}

for (const forbidden of ["raw_content", "content_text", "payload_body", "document_text"]) {
  if (demoAuthoritySql.includes(forbidden)) {
    throw new Error(`DEMO_AUTHORITY_RAW_CONTENT_NOT_ALLOWED:${forbidden}`);
  }
}

console.log("migration checks passed");
