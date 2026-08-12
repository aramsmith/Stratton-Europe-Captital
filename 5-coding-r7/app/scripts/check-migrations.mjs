import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(process.cwd(), "migrations", "001_init.sql");
const routingMigrationPath = resolve(process.cwd(), "migrations", "002_model_routing.sql");
const sql = readFileSync(migrationPath, "utf8");
const routingSql = readFileSync(routingMigrationPath, "utf8");
const normalized = sql.toLowerCase();
const normalizedRouting = routingSql.toLowerCase();

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

const routingColumns = [
  "model_task_class",
  "model_tier",
  "model_route_reason",
  "model_reasoning_effort",
  "model_routing_policy_version",
  "deployment_residency_evidence_id",
  "model_name",
  "model_version",
  "model_validation_status",
  "model_latency_milliseconds",
  "model_input_tokens",
  "model_output_tokens",
  "model_observed_cost_usd"
];
for (const column of routingColumns) {
  if (!normalizedRouting.includes(`add ${column} `)) {
    throw new Error(`MISSING_MODEL_ROUTING_COLUMN:${column}`);
  }
}

for (const value of [
  "model_task_class = coalesce(model_task_class, n'grounded_analysis')",
  "model_tier = coalesce(model_tier, n'terra')",
  "model_route_reason = coalesce(model_route_reason, n'historical_pre_cc_002')",
  "model_reasoning_effort = coalesce(model_reasoning_effort, n'medium')",
  "model_routing_policy_version = coalesce(model_routing_policy_version, n'pre-cc-002')",
  "coalesce(deployment_residency_evidence_id, regional_deployment_evidence_id)",
  "model_name = coalesce(model_name, n'historical-unknown')",
  "model_version = coalesce(model_version, n'historical-unknown')",
  "model_validation_status = coalesce(model_validation_status, n'not_run')",
  "check (model_tier in (n'luna', n'terra', n'sol'))",
  "check (model_reasoning_effort in (n'low', n'medium', n'high'))",
  "check (model_validation_status in (n'not_run', n'pass', n'fail'))",
  "alter column regional_deployment_evidence_id nvarchar(128) null"
]) {
  if (!normalizedRouting.includes(value)) {
    throw new Error(`MISSING_MODEL_ROUTING_MIGRATION_SEMANTIC:${value}`);
  }
}

if (/drop\s+column\s+(?:\[)?regional_deployment_evidence_id(?:\])?/i.test(routingSql)) {
  throw new Error("HISTORICAL_REGIONAL_DEPLOYMENT_EVIDENCE_MUST_BE_PRESERVED");
}

const firstAdd = normalizedRouting.indexOf("add model_task_class ");
const backfill = normalizedRouting.indexOf("update dbo.analysis_runs");
const firstNotNull = normalizedRouting.indexOf(
  "alter column model_task_class nvarchar(64) not null"
);
if (firstAdd < 0 || backfill <= firstAdd || firstNotNull <= backfill) {
  throw new Error("MODEL_ROUTING_MIGRATION_SEQUENCE_INVALID");
}

console.log("migration checks passed");
