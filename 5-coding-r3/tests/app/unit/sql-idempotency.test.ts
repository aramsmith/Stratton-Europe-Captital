import assert from "node:assert/strict";
import { test } from "node:test";
import { SqlIdempotencyStore } from "../../../app/src/idempotency-store.js";
import { resolveSqlBinding, type SqlCommandResult, type SqlExecutionOptions, type SqlExecutor, type SqlPrimitive } from "../../../app/src/sql-client.js";

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
  public readonly transactionContexts: Array<{ tenantId: string; caseId?: string; allowTenantScopedLookup?: boolean }> = [];
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
    const call = options ? { statement, parameters, options } : { statement, parameters };
    this.queryManyCalls.push(call);
    return this.nextQueryManyRows as TRecord[];
  }

  public async execute(
    statement: string,
    parameters: Readonly<Record<string, SqlPrimitive>>,
    options?: SqlExecutionOptions
  ): Promise<SqlCommandResult> {
    const call = options ? { statement, parameters, options } : { statement, parameters };
    this.executeCalls.push(call);
    return this.nextExecuteResult;
  }

  public async runInTransaction<TValue>(
    context: { tenantId: string; caseId?: string; allowTenantScopedLookup?: boolean },
    callback: (executor: SqlExecutor) => Promise<TValue>
  ): Promise<TValue> {
    this.transactionContexts.push(context);
    return callback(this);
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async close(): Promise<void> {
    return;
  }
}

test("SQL binding uses BIGINT for lease epoch and large size integers", () => {
  const lease = resolveSqlBinding(1_700_000_000_000);
  const hugeSize = resolveSqlBinding(5_000_000_000);
  const small = resolveSqlBinding(42);
  const leaseType = lease.type as unknown as { declaration?: string; name?: string };
  assert.equal(typeof lease.value, "bigint");
  const hugeType = hugeSize.type as unknown as { declaration?: string; name?: string };
  assert.equal(typeof hugeSize.value, "bigint");
  const smallType = small.type as unknown as { declaration?: string; name?: string };
  assert.equal(typeof small.value, "number");
  assert.equal((leaseType.declaration ?? leaseType.name ?? "").toLowerCase(), "bigint");
  assert.equal((hugeType.declaration ?? hugeType.name ?? "").toLowerCase(), "bigint");
  assert.equal((smallType.declaration ?? smallType.name ?? "").toLowerCase(), "int");
});

test("SqlIdempotencyStore begin/complete/fail include claim fencing and scoped context", async () => {
  const executor = new FakeSqlExecutor();
  const store = new SqlIdempotencyStore(executor);
  executor.nextQueryManyRows = [
    {
      status: "IN_PROGRESS",
      fingerprint: "fp",
      response_code: null,
      response_body: null,
      lease_expires_at_epoch_ms: Date.now() + 60_000,
      claim_id: "claim-a",
      created: 1,
      claimed: 1
    }
  ];
  const begin = await store.begin({
    scopedKey: "key-1",
    tenantId: "tenant-a",
    caseId: "case-a",
    subjectId: "subject-a",
    operationId: "op-a",
    fingerprint: "fp",
    correlationId: "corr-a",
    leaseDurationSeconds: 30
  });
  assert.equal(begin.type, "STARTED");
  const claimId = begin.type === "STARTED" ? begin.claimId : "";
  assert.equal(executor.transactionContexts.length >= 1, true);
  assert.equal(executor.transactionContexts[0]?.tenantId, "tenant-a");
  assert.equal(executor.transactionContexts[0]?.caseId, "case-a");
  assert.equal(executor.queryManyCalls[0]?.statement.includes("claim_id"), true);
  assert.equal(executor.queryManyCalls[0]?.options?.context?.tenantId, "tenant-a");
  assert.equal(executor.queryManyCalls[0]?.options?.context?.caseId, "case-a");

  await store.complete(
    {
      scopedKey: "key-1",
      tenantId: "tenant-a",
      caseId: "case-a",
      subjectId: "subject-a",
      operationId: "op-a",
      fingerprint: "fp",
      claimId
    },
    200,
    "{}"
  );
  assert.equal(executor.executeCalls[0]?.statement.includes("AND claim_id = @claim_id"), true);
  assert.equal(executor.executeCalls[0]?.parameters.claim_id, claimId);

  await store.fail({
    scopedKey: "key-1",
    tenantId: "tenant-a",
    caseId: "case-a",
    subjectId: "subject-a",
    operationId: "op-a",
    fingerprint: "fp",
    claimId
  });
  assert.equal(executor.executeCalls[1]?.statement.includes("AND claim_id = @claim_id"), true);
});
