import {
  scenarioStateSchema,
  type ScenarioState
} from "@stratton/contracts";
import mssql from "mssql";
import { DemoHttpError } from "../errors.js";
import type {
  ScenarioConcurrencyToken,
  ScenarioRepository,
  ScenarioSnapshot
} from "../scenario/scenario-repository.js";
import { createManagedIdentityCredential } from "../azure/managed-identity.js";

export interface SqlParameter {
  readonly name: string;
  readonly type: "nvarchar" | "nvarcharMax" | "bigint";
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

export interface SqlAccessToken {
  readonly token: string;
  readonly expiresOnTimestamp: number;
}

export interface SqlRequestLike {
  input(name: string, type: unknown, value: string | number): SqlRequestLike;
  query(statement: string): Promise<{
    readonly recordset: readonly Record<string, unknown>[];
    readonly rowsAffected: readonly number[];
  }>;
}

export interface SqlPoolLike {
  connect(): Promise<SqlPoolLike>;
  request(): SqlRequestLike;
  close(): Promise<void>;
}

export interface CreateManagedIdentitySqlExecutorOptions {
  readonly server: string;
  readonly database: string;
  readonly managedIdentityClientId?: string;
  readonly port?: number;
  readonly now?: () => number;
  readonly refreshSkewMs?: number;
  readonly tokenProvider?: () => Promise<SqlAccessToken | null>;
  readonly poolFactory?: (config: mssql.config) => SqlPoolLike;
}

export function createManagedIdentitySqlExecutor(
  options: CreateManagedIdentitySqlExecutorOptions
): SqlExecutor {
  const credential = createManagedIdentityCredential(options.managedIdentityClientId);
  const now = options.now ?? Date.now;
  const refreshSkewMs = options.refreshSkewMs ?? 5 * 60 * 1000;
  const tokenProvider =
    options.tokenProvider ??
    (() => credential.getToken("https://database.windows.net/.default"));
  const poolFactory =
    options.poolFactory ??
    ((config: mssql.config): SqlPoolLike => new mssql.ConnectionPool(config));

  interface PoolGeneration {
    readonly pool: SqlPoolLike;
    readonly expiresOnTimestamp: number;
    leases: number;
    retiring: boolean;
    closePromise?: Promise<void>;
  }

  let activeGeneration: PoolGeneration | undefined;
  let rotationPromise: Promise<void> | undefined;

  const closeGeneration = async (generation: PoolGeneration): Promise<void> => {
    if (!generation.closePromise) {
      generation.closePromise = generation.pool.close().catch(() => {
        throw new DemoHttpError(
          503,
          "DEPENDENCY_UNAVAILABLE",
          "SQL_POOL_RETIREMENT_FAILED"
        );
      });
    }
    await generation.closePromise;
  };

  const rotatePool = async (): Promise<void> => {
    if (rotationPromise) {
      return rotationPromise;
    }

    rotationPromise = (async () => {
      let token: SqlAccessToken | null;
      try {
        token = await tokenProvider();
      } catch {
        throw new DemoHttpError(
          503,
          "DEPENDENCY_UNAVAILABLE",
          "SQL_MANAGED_IDENTITY_TOKEN_UNAVAILABLE"
        );
      }
      if (
        !token?.token ||
        !Number.isFinite(token.expiresOnTimestamp) ||
        token.expiresOnTimestamp <= now()
      ) {
        throw new DemoHttpError(
          503,
          "DEPENDENCY_UNAVAILABLE",
          "SQL_MANAGED_IDENTITY_TOKEN_UNAVAILABLE"
        );
      }

      const poolConfig: mssql.config = {
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
      };
      const candidate = poolFactory(poolConfig);

      try {
        await candidate.connect();
      } catch {
        try {
          await candidate.close();
        } catch {
          throw new DemoHttpError(
            503,
            "DEPENDENCY_UNAVAILABLE",
            "SQL_POOL_CANDIDATE_CLOSE_FAILED"
          );
        }
        throw new DemoHttpError(
          503,
          "DEPENDENCY_UNAVAILABLE",
          "SQL_POOL_INITIALIZATION_FAILED"
        );
      }

      const previous = activeGeneration;
      activeGeneration = {
        pool: candidate,
        expiresOnTimestamp: token.expiresOnTimestamp,
        leases: 0,
        retiring: false
      };
      if (previous) {
        previous.retiring = true;
        if (previous.leases === 0) {
          await closeGeneration(previous);
        }
      }
    })();

    try {
      await rotationPromise;
    } finally {
      rotationPromise = undefined;
    }
  };

  const acquireGeneration = async (): Promise<PoolGeneration> => {
    if (
      !activeGeneration ||
      now() >= activeGeneration.expiresOnTimestamp - refreshSkewMs
    ) {
      await rotatePool();
    }
    const generation = activeGeneration;
    if (!generation) {
      throw new DemoHttpError(
        503,
        "DEPENDENCY_UNAVAILABLE",
        "SQL_POOL_INITIALIZATION_FAILED"
      );
    }
    generation.leases += 1;
    return generation;
  };

  const releaseGeneration = async (generation: PoolGeneration): Promise<void> => {
    generation.leases -= 1;
    if (generation.retiring && generation.leases === 0) {
      await closeGeneration(generation);
    }
  };

  return {
    async query<TRecord extends Record<string, unknown>>(
      statement: string,
      parameters: readonly SqlParameter[] = []
    ) {
      const generation = await acquireGeneration();
      try {
        const request = generation.pool.request();

        for (const parameter of parameters) {
          if (parameter.type === "nvarchar") {
            request.input(parameter.name, mssql.NVarChar(4000), parameter.value);
            continue;
          }
          if (parameter.type === "nvarcharMax") {
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
      } finally {
        await releaseGeneration(generation);
      }
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
          type: "nvarcharMax",
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

  public async reset(snapshot: ScenarioSnapshot): Promise<void> {
    if (snapshot.concurrencyToken.kind !== "ROW_VERSION") {
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
          type: "nvarcharMax",
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

  public async initialize(state: ScenarioState): Promise<void> {
    const parsedState = scenarioStateSchema.parse(structuredClone(state));
    this.assertCaseContext(parsedState.caseId);
    const result = await this.queryWithSessionContext(
      [
        "INSERT INTO dbo.demo_scenario_projection",
        "  (tenant_id, case_id, state_json, row_version, updated_at)",
        "SELECT @tenantId, @caseId, @stateJson, 0, SYSUTCDATETIME()",
        "WHERE NOT EXISTS (",
        "  SELECT 1 FROM dbo.demo_scenario_projection WITH (UPDLOCK, HOLDLOCK)",
        "  WHERE tenant_id = @tenantId AND case_id = @caseId",
        ");"
      ].join("\n"),
      [
        ...this.createTenantCaseParameters(),
        {
          name: "stateJson",
          type: "nvarcharMax",
          value: JSON.stringify(parsedState)
        }
      ]
    );
    if (result.rowsAffected[0] !== 1) {
      throw new DemoHttpError(
        409,
        "STATE_CONFLICT",
        "SCENARIO_PROJECTION_ALREADY_INITIALIZED"
      );
    }
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
