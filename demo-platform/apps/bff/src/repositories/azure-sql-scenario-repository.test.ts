import { describe, expect, it, vi } from "vitest";
import { createProjectDanubeState } from "@stratton/scenario-data";
import {
  AzureSqlScenarioRepository,
  type SqlExecutor,
  type SqlParameter,
  type SqlQueryResult
} from "./azure-sql-scenario-repository.js";

function createExecutorDouble(...results: Array<SqlQueryResult<Record<string, unknown>>>) {
  const calls: Array<{ statement: string; parameters: readonly SqlParameter[] }> = [];
  const query = vi.fn<SqlExecutor["query"]>().mockImplementation(async (statement, parameters = []) => {
    calls.push({ statement, parameters });
    const next = results.shift();
    if (!next) {
      throw new Error(`Unexpected SQL execution: ${statement}`);
    }

    return next;
  });

  return {
    calls,
    executor: { query } satisfies SqlExecutor
  };
}

describe("AzureSqlScenarioRepository", () => {
  it("sets tenant and case session context before reads and updates with optimistic concurrency", async () => {
    const state = createProjectDanubeState();
    const executorDouble = createExecutorDouble(
      { recordset: [], rowsAffected: [0] },
      {
        recordset: [
          {
            state_json: JSON.stringify(state),
            row_version: 7
          }
        ],
        rowsAffected: [1]
      },
      { recordset: [], rowsAffected: [0] },
      { recordset: [], rowsAffected: [1] }
    );
    const repository = new AzureSqlScenarioRepository({
      executor: executorDouble.executor,
      tenantId: "tenant-stratton-demo",
      caseId: "project-danube"
    });

    const loaded = await repository.load();
    expect(loaded).toEqual(state);
    loaded.stage = "ANALYSIS";
    await repository.save(loaded);

    expect(executorDouble.calls[0]?.statement).toContain("sp_set_session_context");
    expect(executorDouble.calls[0]?.parameters).toEqual([
      { name: "tenantId", type: "nvarchar", value: "tenant-stratton-demo" },
      { name: "caseId", type: "nvarchar", value: "project-danube" }
    ]);
    expect(executorDouble.calls[1]?.statement).toContain("FROM dbo.demo_scenario_projection");
    expect(executorDouble.calls[2]?.statement).toContain("sp_set_session_context");
    expect(executorDouble.calls[3]?.statement).toContain("row_version = row_version + 1");
    expect(executorDouble.calls[3]?.parameters).toEqual(
      expect.arrayContaining([
        { name: "tenantId", type: "nvarchar", value: "tenant-stratton-demo" },
        { name: "caseId", type: "nvarchar", value: "project-danube" },
        { name: "expectedVersion", type: "bigint", value: 7 }
      ])
    );
  });

  it("throws a stable state conflict when the row version has moved", async () => {
    const state = createProjectDanubeState();
    const executorDouble = createExecutorDouble(
      { recordset: [], rowsAffected: [0] },
      {
        recordset: [
          {
            state_json: JSON.stringify(state),
            row_version: 4
          }
        ],
        rowsAffected: [1]
      },
      { recordset: [], rowsAffected: [0] },
      { recordset: [], rowsAffected: [0] }
    );
    const repository = new AzureSqlScenarioRepository({
      executor: executorDouble.executor,
      tenantId: "tenant-stratton-demo",
      caseId: "project-danube"
    });

    const loaded = await repository.load();

    await expect(repository.save(loaded)).rejects.toMatchObject({
      code: "STATE_CONFLICT",
      message: "SCENARIO_PROJECTION_VERSION_STALE"
    });
  });
});
