import {
  scenarioStateSchema,
  type ScenarioState
} from "@stratton/contracts";
import * as mssql from "mssql";
import { DemoHttpError } from "../errors.js";
import type {
  ScenarioConcurrencyToken,
  ScenarioRepository,
  ScenarioSnapshot
} from "../scenario/scenario-repository.js";
import { createManagedIdentityCredential } from "../azure/managed-identity.js";

export interface SqlParameter {
  readonly name: string;
  readonly type: "nvarchar" | "bigint";
  readonly value: string | number;
}

export interface SqlQueryResult<TRecord extends Record<string, unknown>> {
  readonly recordset: readonly TRecord[];
  readonly rowsAffected: readonly number[];
}

export interface SqlExecutor {
  query<TRecord extends Record<string, unknown>>(
    statement: string,
    parameters?: readonly SqlParameter[]
  ): Promise<SqlQueryResult<TRecord>>;
}

interface CreateManagedIdentitySqlExecutorOptions {
  readonly server: string;
  readonly database: string;
  readonly managedIdentityClientId?: string;
  readonly port?: number;
}

export function createManagedIdentitySqlExecutor(
  options: CreateManagedIdentitySqlExecutorOptions
): SqlExecutor {
  const credential = createManagedIdentityCredential(options.managedIdentityClientId);
  let poolPromise: Promise<mssql.ConnectionPool> | undefined;

  const getPool = async (): Promise<mssql.ConnectionPool> => {
    if (!poolPromise) {
      poolPromise = (async () => {
        const token = await credential.getToken("https://database.windows.net/.default");
        if (!token?.token) {
          throw new DemoHttpError(
            503,
            "DEPENDENCY_UNAVAILABLE",
            "SQL_MANAGED_IDENTITY_TOKEN_UNAVAILABLE"
          );
        }

        const pool = new mssql.ConnectionPool({
          server: options.server,
          database: options.database,
          ...(options.port ? { port: options.port } : {}),
          options: {
            encrypt: true,
            trustServerCertificate: false
          },
          authentication: {
            type: "azure-active-directory-access-token",
            options: {
              token: token.token
            }
          }
        } as mssql.config);

        return pool.connect();
      })();
    }

    return poolPromise;
  };

  return {
    async query<TRecord extends Record<string, unknown>>(
      statement: string,
      parameters: readonly SqlParameter[] = []
    ) {
      const pool = await getPool();
      const request = pool.request();

      for (const parameter of parameters) {
        if (parameter.type === "nvarchar") {
          request.input(parameter.name, mssql.NVarChar(mssql.MAX), parameter.value);
          continue;
        }

        request.input(parameter.name, mssql.BigInt, parameter.value);
      }

      const result = await request.query(statement);
      return {
        recordset: result.recordset as readonly TRecord[],
        rowsAffected: result.rowsAffected
      };
    }
  };
}

interface AzureSqlScenarioRepositoryOptions {
  readonly executor: SqlExecutor;
  readonly tenantId: string;
  readonly caseId: ScenarioState["caseId"];
}

interface ProjectionRecord extends Record<string, unknown> {
  readonly state_json: string;
  readonly row_version: number | string;
}

export class AzureSqlScenarioRepository implements ScenarioRepository {
  public constructor(private readonly options: AzureSqlScenarioRepositoryOptions) {}

  public async load(): Promise<ScenarioSnapshot> {
    const result = await this.queryWithSessionContext<ProjectionRecord>(
      [
        "SELECT state_json, row_version",
        "FROM dbo.demo_scenario_projection",
        "WHERE tenant_id = @tenantId AND case_id = @caseId;"
      ].join("\n"),
      this.createTenantCaseParameters()
    );
    const row = result.recordset[0];

    if (!row) {
      throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "SCENARIO_PROJECTION_NOT_FOUND");
    }

    const state = scenarioStateSchema.parse(JSON.parse(row.state_json) as unknown);
    this.assertCaseContext(state.caseId);

    return {
      state: structuredClone(state),
      concurrencyToken: createRowVersionToken(Number(row.row_version))
    };
  }

  public async save(snapshot: ScenarioSnapshot): Promise<void> {
    if (!snapshot.concurrencyToken || snapshot.concurrencyToken.kind !== "ROW_VERSION") {
      throw new DemoHttpError(409, "STATE_CONFLICT", "SCENARIO_PROJECTION_LOAD_REQUIRED");
    }

    const parsedState = scenarioStateSchema.parse(structuredClone(snapshot.state));
    this.assertCaseContext(parsedState.caseId);

    const result = await this.queryWithSessionContext(
      [
        "UPDATE dbo.demo_scenario_projection",
        "SET state_json = @stateJson,",
        "    row_version = row_version + 1,",
        "    updated_at = SYSUTCDATETIME()",
        "WHERE tenant_id = @tenantId",
        "  AND case_id = @caseId",
        "  AND row_version = @expectedVersion;"
      ].join("\n"),
      [
        ...this.createTenantCaseParameters(),
        {
          name: "stateJson",
          type: "nvarchar",
          value: JSON.stringify(parsedState)
        },
        {
          name: "expectedVersion",
          type: "bigint",
          value: snapshot.concurrencyToken.value
        }
      ]
    );

    if (result.rowsAffected[0] !== 1) {
      throw new DemoHttpError(409, "STATE_CONFLICT", "SCENARIO_PROJECTION_VERSION_STALE");
    }
  }

  public async reset(state: ScenarioState): Promise<void> {
    const parsedState = scenarioStateSchema.parse(structuredClone(state));
    this.assertCaseContext(parsedState.caseId);

    const result = await this.queryWithSessionContext<ProjectionRecord>(
      [
        "MERGE dbo.demo_scenario_projection WITH (HOLDLOCK) AS target",
        "USING (SELECT @tenantId AS tenant_id, @caseId AS case_id) AS source",
        "ON target.tenant_id = source.tenant_id AND target.case_id = source.case_id",
        "WHEN MATCHED THEN",
        "  UPDATE SET state_json = @stateJson,",
        "             row_version = target.row_version + 1,",
        "             updated_at = SYSUTCDATETIME()",
        "WHEN NOT MATCHED THEN",
        "  INSERT (tenant_id, case_id, state_json, row_version, updated_at)",
        "  VALUES (@tenantId, @caseId, @stateJson, 0, SYSUTCDATETIME())",
        "OUTPUT inserted.row_version;"
      ].join("\n"),
      [
        ...this.createTenantCaseParameters(),
        {
          name: "stateJson",
          type: "nvarchar",
          value: JSON.stringify(parsedState)
        }
      ]
    );

    const row = result.recordset[0];
    void row;
  }

  private queryWithSessionContext<TRecord extends Record<string, unknown>>(
    statement: string,
    parameters: readonly SqlParameter[]
  ): Promise<SqlQueryResult<TRecord>> {
    return this.options.executor.query(
      [
        "EXEC sys.sp_set_session_context @key = N'tenant_id', @value = @tenantId;",
        "EXEC sys.sp_set_session_context @key = N'case_id', @value = @caseId;",
        statement
      ].join("\n"),
      parameters
    );
  }

  private createTenantCaseParameters(): readonly SqlParameter[] {
    return [
      {
        name: "tenantId",
        type: "nvarchar",
        value: this.options.tenantId
      },
      {
        name: "caseId",
        type: "nvarchar",
        value: this.options.caseId
      }
    ];
  }

  private assertCaseContext(caseId: string): void {
    if (caseId !== this.options.caseId) {
      throw new DemoHttpError(400, "INVALID_CONTRACT", "SCENARIO_CASE_CONTEXT_MISMATCH");
    }
  }
}

function createRowVersionToken(value: number): ScenarioConcurrencyToken {
  return {
    kind: "ROW_VERSION",
    value
  };
}
