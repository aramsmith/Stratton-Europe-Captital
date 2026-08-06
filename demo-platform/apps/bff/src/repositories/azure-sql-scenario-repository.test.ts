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

function createConcurrencyAwareExecutor(initialState = createProjectDanubeState(), initialVersion = 4) {
  const calls: Array<{ statement: string; parameters: readonly SqlParameter[] }> = [];
  let state = structuredClone(initialState);
  let rowVersion = initialVersion;

  const executor: SqlExecutor = {
    async query(statement, parameters = []) {
      calls.push({ statement, parameters });

      if (statement.includes("FROM dbo.demo_scenario_projection")) {
        return {
          recordset: [
            {
              state_json: JSON.stringify(state),
              row_version: rowVersion
            }
          ],
          rowsAffected: [1]
        };
      }

      if (statement.includes("row_version = row_version + 1")) {
        const expectedVersion = Number(
          parameters.find((parameter) => parameter.name === "expectedVersion")?.value
        );

        if (expectedVersion !== rowVersion) {
          return { recordset: [], rowsAffected: [0] };
        }

        const stateJson = String(
          parameters.find((parameter) => parameter.name === "stateJson")?.value
        );
        state = JSON.parse(stateJson) as typeof state;
        rowVersion += 1;
        return { recordset: [], rowsAffected: [1] };
      }

      if (statement.includes("sp_set_session_context")) {
        return { recordset: [], rowsAffected: [0] };
      }

      if (statement.includes("MERGE dbo.demo_scenario_projection")) {
        const stateJson = String(
          parameters.find((parameter) => parameter.name === "stateJson")?.value
        );
        state = JSON.parse(stateJson) as typeof state;
        return {
          recordset: [{ row_version: rowVersion }],
          rowsAffected: [1]
        };
      }

      throw new Error(`Unexpected SQL execution: ${statement}`);
    }
  };

  return {
    calls,
    executor,
    getState: () => structuredClone(state),
    getRowVersion: () => rowVersion
  };
}

describe("AzureSqlScenarioRepository", () => {
  it("returns snapshot tokens and updates with optimistic concurrency in one SQL batch per operation", async () => {
    const state = createProjectDanubeState();
    const executorDouble = createExecutorDouble(
      {
        recordset: [
          {
            state_json: JSON.stringify(state),
            row_version: 7
          }
        ],
        rowsAffected: [1]
      },
      { recordset: [], rowsAffected: [1] }
    );
    const repository = new AzureSqlScenarioRepository({
      executor: executorDouble.executor,
      tenantId: "tenant-stratton-demo",
      caseId: "project-danube"
    });

    const loaded = await repository.load();
    expect(loaded.state).toEqual(state);
    expect(loaded.concurrencyToken).toEqual({ kind: "ROW_VERSION", value: 7 });

    await repository.save({
      ...loaded,
      state: {
        ...loaded.state,
        stage: "ANALYSIS"
      }
    });

    expect(executorDouble.calls).toHaveLength(2);
    expect(executorDouble.calls[0]?.statement).toContain("sp_set_session_context");
    expect(executorDouble.calls[0]?.statement).toContain("FROM dbo.demo_scenario_projection");
    expect(executorDouble.calls[0]?.parameters).toEqual([
      { name: "tenantId", type: "nvarchar", value: "tenant-stratton-demo" },
      { name: "caseId", type: "nvarchar", value: "project-danube" }
    ]);
    expect(executorDouble.calls[1]?.statement).toContain("sp_set_session_context");
    expect(executorDouble.calls[1]?.statement).toContain("row_version = row_version + 1");
    expect(executorDouble.calls[1]?.parameters).toEqual(
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
      {
        recordset: [
          {
            state_json: JSON.stringify(state),
            row_version: 4
          }
        ],
        rowsAffected: [1]
      },
      { recordset: [], rowsAffected: [0] }
    );
    const repository = new AzureSqlScenarioRepository({
      executor: executorDouble.executor,
      tenantId: "tenant-stratton-demo",
      caseId: "project-danube"
    });

    const loaded = await repository.load();

    await expect(
      repository.save({
        ...loaded,
        state: loaded.state
      })
    ).rejects.toMatchObject({
      code: "STATE_CONFLICT",
      message: "SCENARIO_PROJECTION_VERSION_STALE"
    });
  });

  it("applies session context and reset in the same SQL batch", async () => {
    const state = createProjectDanubeState();
    const executorDouble = createExecutorDouble({
      recordset: [{ row_version: 0 }],
      rowsAffected: [1]
    });
    const repository = new AzureSqlScenarioRepository({
      executor: executorDouble.executor,
      tenantId: "tenant-stratton-demo",
      caseId: "project-danube"
    });

    await repository.reset({
      state,
      concurrencyToken: { kind: "ROW_VERSION", value: 0 }
    });

    expect(executorDouble.calls).toHaveLength(1);
    expect(executorDouble.calls[0]?.statement).toContain("sp_set_session_context");
    expect(executorDouble.calls[0]?.statement).toContain("UPDATE dbo.demo_scenario_projection");
    expect(executorDouble.calls[0]?.parameters).toEqual(
      expect.arrayContaining([
        { name: "tenantId", type: "nvarchar", value: "tenant-stratton-demo" },
        { name: "caseId", type: "nvarchar", value: "project-danube" },
        { name: "expectedVersion", type: "bigint", value: 0 }
      ])
    );
  });

  it("rejects stale interleaved saves from separate snapshots on a shared repository instance", async () => {
    const executorDouble = createConcurrencyAwareExecutor();
    const repository = new AzureSqlScenarioRepository({
      executor: executorDouble.executor,
      tenantId: "tenant-stratton-demo",
      caseId: "project-danube"
    });

    const firstSnapshot = await repository.load();
    const secondSnapshot = await repository.load();

    await repository.save({
      ...firstSnapshot,
      state: {
        ...firstSnapshot.state,
        stage: "ANALYSIS"
      }
    });
    await expect(
      repository.save({
        ...secondSnapshot,
        state: {
          ...secondSnapshot.state,
          stage: "REVIEW"
        }
      })
    ).rejects.toMatchObject({
      code: "STATE_CONFLICT",
      message: "SCENARIO_PROJECTION_VERSION_STALE"
    });

    expect(
      executorDouble.calls
        .filter((call) => call.statement.includes("row_version = row_version + 1"))
        .map((call) => call.parameters.find((parameter) => parameter.name === "expectedVersion")?.value)
    ).toEqual([4, 4]);
    expect(executorDouble.getState().stage).toBe("ANALYSIS");
    expect(executorDouble.getRowVersion()).toBe(5);
  });
});
