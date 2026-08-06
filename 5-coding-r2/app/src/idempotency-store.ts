import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  IdempotencyBeginInput,
  IdempotencyBeginResult,
  IdempotencyCompleteInput,
  IdempotencyFailInput,
  IdempotencyRecord,
  IdempotencyStore
} from "./types.js";
import type { SqlExecutor } from "./sql-client.js";

interface StoreData {
  readonly [key: string]: IdempotencyRecord | undefined;
}

function nowEpochMs(): number {
  return Date.now();
}

function beginLeaseExpiry(leaseDurationSeconds: number): number {
  return nowEpochMs() + leaseDurationSeconds * 1000;
}

function isLeaseExpired(record: IdempotencyRecord): boolean {
  return record.leaseExpiresAtEpochMs <= nowEpochMs();
}

function asReplay(record: IdempotencyRecord): IdempotencyBeginResult {
  return {
    type: "REPLAY",
    responseCode: record.responseCode ?? 200,
    responseBody: record.responseBody ?? "{}"
  };
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  public exportSnapshot(): Map<string, IdempotencyRecord> {
    return new Map(
      [...this.records.entries()].map(([key, value]) => [
        key,
        { ...value }
      ])
    );
  }

  public restoreSnapshot(snapshot: Map<string, IdempotencyRecord>): void {
    this.records.clear();
    for (const [key, value] of snapshot.entries()) {
      this.records.set(key, { ...value });
    }
  }

  public async begin(input: IdempotencyBeginInput): Promise<IdempotencyBeginResult> {
    const existing = this.records.get(input.scopedKey);
    if (!existing) {
      const leaseExpiresAtEpochMs = beginLeaseExpiry(input.leaseDurationSeconds);
      const claimId = randomUUID();
      this.records.set(input.scopedKey, {
        scopedKey: input.scopedKey,
        tenantId: input.tenantId,
        caseId: input.caseId,
        subjectId: input.subjectId,
        operationId: input.operationId,
        fingerprint: input.fingerprint,
        status: "IN_PROGRESS",
        correlationId: input.correlationId,
        claimId,
        leaseExpiresAtEpochMs
      });
      return {
        type: "STARTED",
        leaseExpiresAtEpochMs,
        claimId
      };
    }

    if (existing.fingerprint !== input.fingerprint) {
      return { type: "CONFLICT" };
    }
    if (existing.status === "COMPLETED") {
      return asReplay(existing);
    }
    if (existing.status === "FAILED" || isLeaseExpired(existing)) {
      const leaseExpiresAtEpochMs = beginLeaseExpiry(input.leaseDurationSeconds);
      const claimId = randomUUID();
      this.records.set(input.scopedKey, {
        ...existing,
        status: "IN_PROGRESS",
        correlationId: input.correlationId,
        claimId,
        leaseExpiresAtEpochMs
      });
      return {
        type: "STARTED",
        leaseExpiresAtEpochMs,
        claimId
      };
    }
    return { type: "IN_PROGRESS" };
  }

  public async complete(
    input: IdempotencyCompleteInput,
    responseCode: number,
    responseBody: string
  ): Promise<void> {
    const existing = this.records.get(input.scopedKey);
    if (!existing) {
      throw new Error("IDEMPOTENCY_NOT_FOUND");
    }
    if (
      existing.tenantId !== input.tenantId ||
      existing.caseId !== input.caseId ||
      existing.subjectId !== input.subjectId ||
      existing.operationId !== input.operationId ||
      existing.fingerprint !== input.fingerprint ||
      existing.claimId !== input.claimId
    ) {
      throw new Error("IDEMPOTENCY_CONTEXT_MISMATCH");
    }
    if (existing.status !== "IN_PROGRESS" || isLeaseExpired(existing)) {
      throw new Error("IDEMPOTENCY_LEASE_EXPIRED");
    }
    this.records.set(input.scopedKey, {
      ...existing,
      status: "COMPLETED",
      responseCode,
      responseBody,
      leaseExpiresAtEpochMs: nowEpochMs()
    });
  }

  public async fail(input: IdempotencyFailInput): Promise<void> {
    const existing = this.records.get(input.scopedKey);
    if (!existing) {
      return;
    }
    if (
      existing.tenantId !== input.tenantId ||
      existing.caseId !== input.caseId ||
      existing.subjectId !== input.subjectId ||
      existing.operationId !== input.operationId ||
      existing.fingerprint !== input.fingerprint ||
      existing.claimId !== input.claimId
    ) {
      return;
    }
    if (existing.status !== "IN_PROGRESS") {
      return;
    }
    this.records.set(input.scopedKey, {
      ...existing,
      status: "FAILED",
      leaseExpiresAtEpochMs: nowEpochMs()
    });
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }
}

export class FileIdempotencyStore implements IdempotencyStore {
  private readonly fullPath: string;

  public constructor(path: string) {
    this.fullPath = resolve(path);
  }

  public async begin(input: IdempotencyBeginInput): Promise<IdempotencyBeginResult> {
    const store = this.readStore();
    const existing = store[input.scopedKey];
    if (!existing) {
      const leaseExpiresAtEpochMs = beginLeaseExpiry(input.leaseDurationSeconds);
      const claimId = randomUUID();
      store[input.scopedKey] = {
        scopedKey: input.scopedKey,
        tenantId: input.tenantId,
        caseId: input.caseId,
        subjectId: input.subjectId,
        operationId: input.operationId,
        fingerprint: input.fingerprint,
        status: "IN_PROGRESS",
        correlationId: input.correlationId,
        claimId,
        leaseExpiresAtEpochMs
      };
      this.writeStore(store);
      return {
        type: "STARTED",
        leaseExpiresAtEpochMs,
        claimId
      };
    }
    if (existing.fingerprint !== input.fingerprint) {
      return { type: "CONFLICT" };
    }
    if (existing.status === "COMPLETED") {
      return asReplay(existing);
    }
    if (existing.status === "FAILED" || isLeaseExpired(existing)) {
      const leaseExpiresAtEpochMs = beginLeaseExpiry(input.leaseDurationSeconds);
      const claimId = randomUUID();
      store[input.scopedKey] = {
        ...existing,
        status: "IN_PROGRESS",
        correlationId: input.correlationId,
        claimId,
        leaseExpiresAtEpochMs
      };
      this.writeStore(store);
      return {
        type: "STARTED",
        leaseExpiresAtEpochMs,
        claimId
      };
    }
    return { type: "IN_PROGRESS" };
  }

  public async complete(
    input: IdempotencyCompleteInput,
    responseCode: number,
    responseBody: string
  ): Promise<void> {
    const store = this.readStore();
    const existing = store[input.scopedKey];
    if (!existing) {
      throw new Error("IDEMPOTENCY_NOT_FOUND");
    }
    if (
      existing.tenantId !== input.tenantId ||
      existing.caseId !== input.caseId ||
      existing.subjectId !== input.subjectId ||
      existing.operationId !== input.operationId ||
      existing.fingerprint !== input.fingerprint ||
      existing.claimId !== input.claimId
    ) {
      throw new Error("IDEMPOTENCY_CONTEXT_MISMATCH");
    }
    if (existing.status !== "IN_PROGRESS" || isLeaseExpired(existing)) {
      throw new Error("IDEMPOTENCY_LEASE_EXPIRED");
    }
    store[input.scopedKey] = {
      ...existing,
      status: "COMPLETED",
      responseCode,
      responseBody,
      leaseExpiresAtEpochMs: nowEpochMs()
    };
    this.writeStore(store);
  }

  public async fail(input: IdempotencyFailInput): Promise<void> {
    const store = this.readStore();
    const existing = store[input.scopedKey];
    if (!existing) {
      return;
    }
    if (
      existing.tenantId !== input.tenantId ||
      existing.caseId !== input.caseId ||
      existing.subjectId !== input.subjectId ||
      existing.operationId !== input.operationId ||
      existing.fingerprint !== input.fingerprint ||
      existing.claimId !== input.claimId
    ) {
      return;
    }
    if (existing.status !== "IN_PROGRESS") {
      return;
    }
    store[input.scopedKey] = {
      ...existing,
      status: "FAILED",
      leaseExpiresAtEpochMs: nowEpochMs()
    };
    this.writeStore(store);
  }

  public async isAvailable(): Promise<boolean> {
    try {
      mkdirSync(dirname(this.fullPath), { recursive: true });
      if (!this.exists()) {
        writeFileSync(this.fullPath, "{}", "utf8");
      }
      this.readStore();
      return true;
    } catch {
      return false;
    }
  }

  private exists(): boolean {
    try {
      readFileSync(this.fullPath, "utf8");
      return true;
    } catch {
      return false;
    }
  }

  private readStore(): Record<string, IdempotencyRecord> {
    const raw = readFileSync(this.fullPath, "utf8");
    if (raw.trim().length === 0) {
      return {};
    }
    return JSON.parse(raw) as Record<string, IdempotencyRecord>;
  }

  private writeStore(store: StoreData): void {
    writeFileSync(this.fullPath, JSON.stringify(store), "utf8");
  }
}

export class SqlIdempotencyStore implements IdempotencyStore {
  public constructor(private readonly executor: SqlExecutor) {}

  public async begin(input: IdempotencyBeginInput): Promise<IdempotencyBeginResult> {
    const nowIso = new Date().toISOString();
    const leaseExpiresAtEpochMs = beginLeaseExpiry(input.leaseDurationSeconds);
    const claimId = randomUUID();
    return this.executor.runInTransaction(
      { tenantId: input.tenantId, caseId: input.caseId },
      async (scoped) => {
        const rows = await scoped.queryMany<{
          status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
          fingerprint: string;
          response_code: number | null;
          response_body: string | null;
          lease_expires_at_epoch_ms: number;
          claim_id: string | null;
          created: number;
          claimed: number;
        }>(
          `
DECLARE @created INT = 0;
DECLARE @claimed INT = 0;
IF NOT EXISTS (
  SELECT 1
  FROM dbo.idempotency_records WITH (UPDLOCK, HOLDLOCK)
  WHERE scoped_key = @scoped_key
)
BEGIN
  INSERT INTO dbo.idempotency_records (
    scoped_key, tenant_id, case_id, subject_id, operation_id, fingerprint, status, correlation_id,
    claim_id, lease_expires_at_epoch_ms, created_at
  ) VALUES (
    @scoped_key, @tenant_id, @case_id, @subject_id, @operation_id, @fingerprint, N'IN_PROGRESS', @correlation_id,
    @claim_id, @lease_expires_at_epoch_ms, @created_at
  );
  SET @created = 1;
  SET @claimed = 1;
END
ELSE
BEGIN
  UPDATE dbo.idempotency_records
  SET
    status = N'IN_PROGRESS',
    correlation_id = @correlation_id,
    claim_id = @claim_id,
    lease_expires_at_epoch_ms = @lease_expires_at_epoch_ms
  WHERE scoped_key = @scoped_key
    AND fingerprint = @fingerprint
    AND (status = N'FAILED' OR lease_expires_at_epoch_ms < @now_epoch_ms);
  IF @@ROWCOUNT > 0 SET @claimed = 1;
END;
SELECT
  status,
  fingerprint,
  response_code,
  response_body,
  lease_expires_at_epoch_ms,
  claim_id,
  @created AS created,
  @claimed AS claimed
FROM dbo.idempotency_records
WHERE scoped_key = @scoped_key;
      `,
          {
            scoped_key: input.scopedKey,
            tenant_id: input.tenantId,
            case_id: input.caseId,
            subject_id: input.subjectId,
            operation_id: input.operationId,
            fingerprint: input.fingerprint,
            correlation_id: input.correlationId,
            claim_id: claimId,
            lease_expires_at_epoch_ms: leaseExpiresAtEpochMs,
            now_epoch_ms: nowEpochMs(),
            created_at: nowIso
          },
          {
            context: {
              tenantId: input.tenantId,
              caseId: input.caseId
            }
          }
        );
        const row = rows[0];
        if (!row) {
          return { type: "IN_PROGRESS" };
        }
        if (row.fingerprint !== input.fingerprint) {
          return { type: "CONFLICT" };
        }
        if (row.status === "COMPLETED") {
          return {
            type: "REPLAY",
            responseCode: row.response_code ?? 200,
            responseBody: row.response_body ?? "{}"
          };
        }
        if (row.created === 1 || row.claimed === 1) {
          return {
            type: "STARTED",
            leaseExpiresAtEpochMs: row.lease_expires_at_epoch_ms,
            claimId: row.claim_id ?? claimId
          };
        }
        return { type: "IN_PROGRESS" };
      }
    );
  }

  public async complete(
    input: IdempotencyCompleteInput,
    responseCode: number,
    responseBody: string
  ): Promise<void> {
    const result = await this.executor.runInTransaction(
      { tenantId: input.tenantId, caseId: input.caseId },
      async (scoped) =>
        scoped.execute(
          `
UPDATE dbo.idempotency_records
SET
  status = N'COMPLETED',
  response_code = @response_code,
  response_body = @response_body,
  lease_expires_at_epoch_ms = @now_epoch_ms,
  completed_at = SYSUTCDATETIME()
WHERE scoped_key = @scoped_key
  AND tenant_id = @tenant_id
  AND case_id = @case_id
  AND subject_id = @subject_id
  AND operation_id = @operation_id
  AND fingerprint = @fingerprint
  AND claim_id = @claim_id
  AND status = N'IN_PROGRESS'
  AND lease_expires_at_epoch_ms >= @now_epoch_ms;
      `,
          {
            scoped_key: input.scopedKey,
            tenant_id: input.tenantId,
            case_id: input.caseId,
            subject_id: input.subjectId,
            operation_id: input.operationId,
            fingerprint: input.fingerprint,
            claim_id: input.claimId,
            response_code: responseCode,
            response_body: responseBody,
            now_epoch_ms: nowEpochMs()
          },
          {
            context: {
              tenantId: input.tenantId,
              caseId: input.caseId
            }
          }
        )
    );
    if (result.rowsAffected !== 1) {
      throw new Error("IDEMPOTENCY_COMPLETE_CONDITION_FAILED");
    }
  }

  public async fail(input: IdempotencyFailInput): Promise<void> {
    await this.executor.runInTransaction(
      { tenantId: input.tenantId, caseId: input.caseId },
      async (scoped) =>
        scoped.execute(
          `
UPDATE dbo.idempotency_records
SET
  status = N'FAILED',
  lease_expires_at_epoch_ms = @now_epoch_ms,
  completed_at = SYSUTCDATETIME()
WHERE scoped_key = @scoped_key
  AND tenant_id = @tenant_id
  AND case_id = @case_id
  AND subject_id = @subject_id
  AND operation_id = @operation_id
  AND fingerprint = @fingerprint
  AND claim_id = @claim_id
  AND status = N'IN_PROGRESS';
      `,
          {
            scoped_key: input.scopedKey,
            tenant_id: input.tenantId,
            case_id: input.caseId,
            subject_id: input.subjectId,
            operation_id: input.operationId,
            fingerprint: input.fingerprint,
            claim_id: input.claimId,
            now_epoch_ms: nowEpochMs()
          },
          {
            context: {
              tenantId: input.tenantId,
              caseId: input.caseId
            }
          }
        )
    );
  }

  public async isAvailable(): Promise<boolean> {
    return this.executor.isAvailable();
  }
}
