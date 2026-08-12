import assert from "node:assert/strict";
import { test } from "node:test";
import type { AnalysisBundleCompletionRecord } from "../../../app/src/demo-authority-types.js";
import {
  type SqlCommandResult,
  type SqlExecutionOptions,
  type SqlExecutor,
  type SqlPrimitive
} from "../../../app/src/sql-client.js";
import { SqlWorkloadRepository } from "../../../app/src/workload-repository.js";

class FakeSqlExecutor implements SqlExecutor {
  public readonly queryManyCalls: Array<{
    statement: string;
    parameters: Readonly<Record<string, SqlPrimitive>>;
    options?: SqlExecutionOptions;
  }> = [];
  public readonly executeCalls: Array<{
    statement: string;
    parameters: Readonly<Record<string, SqlPrimitive>>;
    options?: SqlExecutionOptions;
  }> = [];
  public nextQueryManyRows: Array<Record<string, unknown>> = [];
  public nextExecuteResult: SqlCommandResult = { rowsAffected: 1 };

  public async queryOne<TRecord extends Record<string, unknown>>(
    statement: string,
    parameters: Readonly<Record<string, SqlPrimitive>>,
    options?: SqlExecutionOptions
  ): Promise<TRecord | undefined> {
    const rows = await this.queryMany<TRecord>(statement, parameters, options);
    return rows[0];
  }

  public async queryMany<TRecord extends Record<string, unknown>>(
    statement: string,
    parameters: Readonly<Record<string, SqlPrimitive>>,
    options?: SqlExecutionOptions
  ): Promise<readonly TRecord[]> {
    this.queryManyCalls.push(options ? { statement, parameters, options } : { statement, parameters });
    if (
      statement.includes("approved_model_route_evidence") &&
      parameters.tenant_id !== this.nextQueryManyRows[0]?.tenant_id
    ) {
      return [];
    }
    return this.nextQueryManyRows as TRecord[];
  }

  public async execute(
    statement: string,
    parameters: Readonly<Record<string, SqlPrimitive>>,
    options?: SqlExecutionOptions
  ): Promise<SqlCommandResult> {
    this.executeCalls.push(options ? { statement, parameters, options } : { statement, parameters });
    return this.nextExecuteResult;
  }

  public async runInTransaction<TValue>(
    _context: { tenantId: string; caseId?: string; allowTenantScopedLookup?: boolean },
    callback: (executor: SqlExecutor) => Promise<TValue>
  ): Promise<TValue> {
    return callback(this);
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async close(): Promise<void> {
    return;
  }
}

const completedBundleRow = {
  tenant_id: "tenant-a",
  case_id: "project-danube",
  analysis_bundle_id: "bundle-1",
  evidence_manifest_hash: "manifest-1",
  model_route: "TERRA",
  model_deployment_id: "terra-grounded-analysis",
  route_evidence_id: "route-evidence-1",
  prompt_template_version: "phase5-template-v1",
  request_fingerprint: "request-1",
  status: "DRAFT_ONLY_READY",
  output_kind: "DRAFT_ONLY",
  unsupported_claims: 0,
  total_claims: 3,
  cited_claims: 3,
  material_claims: 2,
  cited_material_claims: 2,
  subject_version: "output-manifest-1"
};

const completion: AnalysisBundleCompletionRecord = {
  tenantId: "tenant-a",
  caseId: "project-danube",
  analysisBundleId: "bundle-1",
  subjectVersion: "output-manifest-1",
  status: "DRAFT_ONLY_READY",
  unsupportedClaims: 0,
  totalClaims: 3,
  citedClaims: 3,
  materialClaims: 2,
  citedMaterialClaims: 2
};

test("SQL route evidence lookup uses the real tenant predicate and session context", async () => {
  const executor = new FakeSqlExecutor();
  executor.nextQueryManyRows = [
    {
      tenant_id: "tenant-a",
      evidence_id: "route-evidence-1",
      status: "APPROVED",
      resource_id:
        "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/aoai",
      deployment_id: "terra-grounded-analysis",
      region: "westeurope",
      route: "TERRA",
      api_version: "2026-01-01",
      evidence_version: "route-evidence-1:v1",
      valid_from: "2026-08-01T00:00:00.000Z",
      valid_until: "2026-12-31T23:59:59.000Z"
    }
  ];
  const repository = new SqlWorkloadRepository(executor);

  const evidence = await repository.getApprovedModelRouteEvidence("tenant-a", "route-evidence-1");
  assert.equal(evidence?.tenantId, "tenant-a");
  const call = executor.queryManyCalls[0];
  assert.ok(call);
  assert.match(call.statement, /tenant_id\s*=\s*@tenant_id/i);
  assert.match(call.statement, /evidence_id\s*=\s*@evidence_id/i);
  assert.deepEqual(call.parameters, {
    tenant_id: "tenant-a",
    evidence_id: "route-evidence-1"
  });
  assert.deepEqual(call.options?.context, {
    tenantId: "tenant-a",
    allowTenantScopedLookup: true
  });
  assert.equal(call.statement.includes("__model-route-evidence__"), false);

  assert.equal(
    await repository.getApprovedModelRouteEvidence("tenant-b", "route-evidence-1"),
    undefined
  );
  assert.equal(executor.queryManyCalls[1]?.options?.context?.tenantId, "tenant-b");
});

test("SQL route evidence preserves Date values returned by the mssql driver", async () => {
  const executor = new FakeSqlExecutor();
  const validFrom = new Date("2026-08-01T00:00:00.000Z");
  const validUntil = new Date("2026-09-01T00:00:00.000Z");
  executor.nextQueryManyRows = [
    {
      tenant_id: "tenant-a",
      evidence_id: "route-evidence-1",
      status: "APPROVED",
      resource_id:
        "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/aoai",
      deployment_id: "terra-grounded-analysis",
      region: "westeurope",
      route: "TERRA",
      api_version: "2026-01-01",
      evidence_version: "route-evidence-1:v1",
      valid_from: validFrom,
      valid_until: validUntil
    }
  ];
  const repository = new SqlWorkloadRepository(executor);

  const evidence = await repository.getApprovedModelRouteEvidence("tenant-a", "route-evidence-1");

  assert.equal(evidence?.validFromIso, validFrom.toISOString());
  assert.equal(evidence?.validUntilIso, validUntil.toISOString());
});

test("SQL completion uses an atomic null-subject update and accepts an identical race replay", async () => {
  const executor = new FakeSqlExecutor();
  executor.nextExecuteResult = { rowsAffected: 0 };
  executor.nextQueryManyRows = [completedBundleRow];
  const repository = new SqlWorkloadRepository(executor);

  await repository.completeAnalysisBundle(completion);

  const update = executor.executeCalls[0];
  assert.ok(update);
  assert.match(update.statement, /UPDATE\s+dbo\.analysis_bundles/i);
  assert.match(update.statement, /AND\s+subject_version\s+IS\s+NULL/i);
  assert.equal(executor.queryManyCalls.length, 1);
});

test("SQL completion rejects a conflicting affected-row replay", async () => {
  const executor = new FakeSqlExecutor();
  executor.nextExecuteResult = { rowsAffected: 0 };
  executor.nextQueryManyRows = [{ ...completedBundleRow, subject_version: "different-output" }];
  const repository = new SqlWorkloadRepository(executor);

  await assert.rejects(
    repository.completeAnalysisBundle(completion),
    /ANALYSIS_BUNDLE_COMPLETION_CONFLICT/
  );
});
