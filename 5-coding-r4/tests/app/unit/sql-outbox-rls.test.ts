import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { type SqlCommandResult, type SqlExecutionOptions, type SqlExecutor, type SqlPrimitive } from "../../../app/src/sql-client.js";
import { SqlWorkloadRepository } from "../../../app/src/workload-repository.js";

class FakeSqlExecutor implements SqlExecutor {
  public readonly executeCalls: Array<{
    statement: string;
    parameters: Readonly<Record<string, SqlPrimitive>>;
    options?: SqlExecutionOptions;
  }> = [];
  public readonly queryManyCalls: Array<{
    statement: string;
    parameters: Readonly<Record<string, SqlPrimitive>>;
    options?: SqlExecutionOptions;
  }> = [];

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
    return [] as TRecord[];
  }

  public async execute(
    statement: string,
    parameters: Readonly<Record<string, SqlPrimitive>>,
    options?: SqlExecutionOptions
  ): Promise<SqlCommandResult> {
    this.executeCalls.push(options ? { statement, parameters, options } : { statement, parameters });
    return { rowsAffected: 0 };
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

test("sql outbox scope enumeration uses relay-only context", async () => {
  const executor = new FakeSqlExecutor();
  const repository = new SqlWorkloadRepository(executor);
  await repository.listPendingQueueOutboxScopes(25);
  const call = executor.queryManyCalls[0];
  assert.ok(call);
  assert.match(call.statement, /exec\s+dbo\.usp_list_pending_queue_outbox_scopes/i);
  assert.equal(call.options, undefined);
});

test("sql outbox pending message read remains tenant/case scoped", async () => {
  const executor = new FakeSqlExecutor();
  const repository = new SqlWorkloadRepository(executor);
  await repository.listPendingQueueOutboxMessages(10, "tenant-a", "case-a");
  const call = executor.queryManyCalls[0];
  assert.ok(call);
  assert.equal(call.options?.context?.tenantId, "tenant-a");
  assert.equal(call.options?.context?.caseId, "case-a");
  assert.equal(call.options?.context?.allowTenantScopedLookup ?? false, false);
});

test("generic sql session context exposes no relay bypass key", () => {
  const source = readFileSync(
    resolve(process.cwd(), "..", "app", "src", "sql-client.ts"),
    "utf8"
  );
  assert.equal(source.includes("outboxRelay"), false);
  assert.equal(source.includes("outbox_relay"), false);
});

test("sql outbox compares stable message identity separately from request correlation", async () => {
  const executor = new FakeSqlExecutor();
  const repository = new SqlWorkloadRepository(executor);

  await repository.enqueueQueueOutboxMessage({
    tenantId: "tenant-a",
    caseId: "case-a",
    queueName: "q-extraction",
    messageId: "msg-stable",
    operation: "REQUEST_EXTRACTION",
    payloadReference: "blob://evidence/1",
    idempotencyKey: "idem-stable",
    correlationId: "corr-request",
    evidenceId: "evidence-1",
    evidenceVersionId: "evidence-1-v1"
  });

  const call = executor.executeCalls[0];
  assert.ok(call);
  assert.match(call.statement, /json_modify/i);
  assert.equal(typeof call.parameters.canonical_identity, "string");
  assert.equal(String(call.parameters.canonical_identity).includes("correlationId"), false);
});
