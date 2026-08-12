import { describe, expect, it, vi } from "vitest";
import { createManagedIdentitySqlExecutor } from "./azure-sql-scenario-repository.js";

function createPool(query: () => Promise<{
  recordset: readonly Record<string, unknown>[];
  rowsAffected: readonly number[];
}>) {
  const request = {
    input: vi.fn(),
    query: vi.fn(query)
  };
  request.input.mockReturnValue(request);
  const pool = {
    connect: vi.fn(),
    request: vi.fn(() => request),
    close: vi.fn().mockResolvedValue(undefined)
  };
  pool.connect.mockResolvedValue(pool);
  return { pool, request };
}

describe("createManagedIdentitySqlExecutor", () => {
  it("clears failed initialization so a later query can acquire a fresh token and pool", async () => {
    const failed = createPool(async () => ({ recordset: [], rowsAffected: [0] }));
    failed.pool.connect.mockRejectedValueOnce(new Error("connect failed"));
    const recovered = createPool(async () => ({ recordset: [], rowsAffected: [1] }));
    const pools = [failed.pool, recovered.pool];
    const tokenProvider = vi
      .fn()
      .mockResolvedValueOnce({ token: "token-1", expiresOnTimestamp: 10_000 })
      .mockResolvedValueOnce({ token: "token-2", expiresOnTimestamp: 20_000 });

    const executor = createManagedIdentitySqlExecutor({
      server: "sql.example.test",
      database: "stratton",
      now: () => 1_000,
      tokenProvider,
      poolFactory: () => {
        const pool = pools.shift();
        if (!pool) {
          throw new Error("unexpected pool request");
        }
        return pool;
      }
    });

    await expect(executor.query("SELECT 1")).rejects.toMatchObject({
      code: "DEPENDENCY_UNAVAILABLE",
      message: "SQL_POOL_INITIALIZATION_FAILED"
    });
    await expect(executor.query("SELECT 1")).resolves.toMatchObject({
      rowsAffected: [1]
    });

    expect(tokenProvider).toHaveBeenCalledTimes(2);
    expect(failed.pool.close).toHaveBeenCalledTimes(1);
    expect(recovered.pool.connect).toHaveBeenCalledTimes(1);
  });

  it("refreshes credentials before expiry and closes the retired pool after active queries finish", async () => {
    let releaseFirstQuery: (() => void) | undefined;
    const firstQuery = new Promise<void>((resolve) => {
      releaseFirstQuery = resolve;
    });
    const first = createPool(async () => {
      await firstQuery;
      return { recordset: [], rowsAffected: [1] };
    });
    const second = createPool(async () => ({ recordset: [], rowsAffected: [1] }));
    const pools = [first.pool, second.pool];
    let now = 1_000;
    const tokenProvider = vi
      .fn()
      .mockResolvedValueOnce({ token: "token-1", expiresOnTimestamp: 10_000 })
      .mockResolvedValueOnce({ token: "token-2", expiresOnTimestamp: 20_000 });

    const executor = createManagedIdentitySqlExecutor({
      server: "sql.example.test",
      database: "stratton",
      refreshSkewMs: 1_000,
      now: () => now,
      tokenProvider,
      poolFactory: () => {
        const pool = pools.shift();
        if (!pool) {
          throw new Error("unexpected pool request");
        }
        return pool;
      }
    });

    const inFlight = executor.query("SELECT first");
    await vi.waitFor(() => expect(first.request.query).toHaveBeenCalledTimes(1));
    now = 9_500;
    await executor.query("SELECT second");

    expect(second.pool.connect).toHaveBeenCalledTimes(1);
    expect(first.pool.close).not.toHaveBeenCalled();

    releaseFirstQuery?.();
    await inFlight;
    await vi.waitFor(() => expect(first.pool.close).toHaveBeenCalledTimes(1));
    expect(tokenProvider).toHaveBeenCalledTimes(2);
  });

  it("binds session-context strings as bounded nvarchar and projection JSON as nvarchar max", async () => {
    const active = createPool(async () => ({ recordset: [], rowsAffected: [1] }));
    const executor = createManagedIdentitySqlExecutor({
      server: "sql.example.test",
      database: "stratton",
      now: () => 1_000,
      tokenProvider: async () => ({ token: "token-1", expiresOnTimestamp: 10_000 }),
      poolFactory: () => active.pool
    });

    await executor.query("SELECT 1", [
      { name: "tenantId", type: "nvarchar", value: "tenant-a" },
      { name: "stateJson", type: "nvarcharMax", value: "{}" }
    ]);

    const boundedType = active.request.input.mock.calls[0]?.[1] as { length?: number };
    const maxType = active.request.input.mock.calls[1]?.[1] as { length?: number };
    expect(boundedType.length).toBe(4000);
    expect(maxType.length).toBe(65535);
  });
});
