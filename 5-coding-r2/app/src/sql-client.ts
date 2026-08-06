import sql from "mssql";

export type SqlPrimitive = string | number | boolean | null;
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

export interface SqlSessionContext {
  readonly tenantId: string;
  readonly caseId?: string;
  readonly allowTenantScopedLookup?: boolean;
}

export interface SqlExecutionOptions {
  readonly context?: SqlSessionContext;
}

export interface SqlCommandResult {
  readonly rowsAffected: number;
}

export interface SqlExecutor {
  queryOne<TRecord extends Record<string, unknown>>(
    statement: string,
    parameters: Readonly<Record<string, SqlPrimitive>>,
    options?: SqlExecutionOptions
  ): Promise<TRecord | undefined>;
  queryMany<TRecord extends Record<string, unknown>>(
    statement: string,
    parameters: Readonly<Record<string, SqlPrimitive>>,
    options?: SqlExecutionOptions
  ): Promise<readonly TRecord[]>;
  execute(
    statement: string,
    parameters: Readonly<Record<string, SqlPrimitive>>,
    options?: SqlExecutionOptions
  ): Promise<SqlCommandResult>;
  runInTransaction<TValue>(
    context: SqlSessionContext,
    callback: (executor: SqlExecutor) => Promise<TValue>
  ): Promise<TValue>;
  isAvailable(): Promise<boolean>;
  close(): Promise<void>;
}

function stringType(value: string): sql.ISqlType {
  if (value.length <= 4000) {
    return sql.NVarChar(4000);
  }
  return sql.NVarChar(sql.MAX);
}

export function resolveSqlBinding(value: SqlPrimitive): {
  readonly type: sql.ISqlType | (() => sql.ISqlType);
  readonly value: string | number | bigint | null;
} {
  if (value === null) {
    return { type: sql.NVarChar(sql.MAX), value: null };
  }
  if (typeof value === "boolean") {
    return { type: sql.Bit, value: value ? 1 : 0 };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("INVALID_SQL_NUMBER");
    }
    if (Number.isInteger(value)) {
      if (value >= INT32_MIN && value <= INT32_MAX) {
        return { type: sql.Int, value };
      }
      if (!Number.isSafeInteger(value)) {
        throw new Error("INTEGER_OUT_OF_SAFE_RANGE");
      }
      return { type: sql.BigInt, value: BigInt(value) };
    }
    return { type: sql.Float, value };
  }
  return { type: stringType(value), value };
}

function bindInputs(request: sql.Request, parameters: Readonly<Record<string, SqlPrimitive>>): void {
  for (const [key, value] of Object.entries(parameters)) {
    const binding = resolveSqlBinding(value);
    request.input(key, binding.type, binding.value);
  }
}

function withContext(statement: string): string {
  return `
BEGIN TRY
  EXEC sys.sp_set_session_context @key=N'tenant_id', @value=@__ctx_tenant_id;
  EXEC sys.sp_set_session_context @key=N'case_id', @value=@__ctx_case_id;
  EXEC sys.sp_set_session_context @key=N'allow_tenant_lookup', @value=@__ctx_allow_tenant_lookup;
  ${statement}
END TRY
BEGIN CATCH
  EXEC sys.sp_set_session_context @key=N'allow_tenant_lookup', @value=NULL;
  EXEC sys.sp_set_session_context @key=N'case_id', @value=NULL;
  EXEC sys.sp_set_session_context @key=N'tenant_id', @value=NULL;
  THROW;
END CATCH
EXEC sys.sp_set_session_context @key=N'allow_tenant_lookup', @value=NULL;
EXEC sys.sp_set_session_context @key=N'case_id', @value=NULL;
EXEC sys.sp_set_session_context @key=N'tenant_id', @value=NULL;
`;
}

function bindContext(request: sql.Request, options?: SqlExecutionOptions): void {
  const tenantId = options?.context?.tenantId ?? null;
  const caseId = options?.context?.caseId ?? null;
  const allowTenantLookup = options?.context?.allowTenantScopedLookup ? 1 : 0;
  request.input("__ctx_tenant_id", sql.NVarChar(64), tenantId);
  request.input("__ctx_case_id", sql.NVarChar(128), caseId);
  request.input("__ctx_allow_tenant_lookup", sql.Bit, allowTenantLookup);
}

function authOptions(managedIdentityClientId?: string): sql.config["authentication"] {
  if (managedIdentityClientId && managedIdentityClientId.trim().length > 0) {
    return {
      type: "azure-active-directory-default",
      options: {
        clientId: managedIdentityClientId.trim()
      }
    };
  }
  return {
    type: "azure-active-directory-default",
    options: {}
  };
}

class SqlExecutorScope implements SqlExecutor {
  public constructor(
    private readonly requestFactory: () => sql.Request,
    private readonly txRunner: (context: SqlSessionContext, callback: (executor: SqlExecutor) => Promise<unknown>) => Promise<unknown>,
    private readonly availabilityProbe: () => Promise<boolean>,
    private readonly closer: () => Promise<void>
  ) {}

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
    const request = this.requestFactory();
    bindContext(request, options);
    bindInputs(request, parameters);
    const result = await request.query<TRecord>(withContext(statement));
    return result.recordset;
  }

  public async execute(
    statement: string,
    parameters: Readonly<Record<string, SqlPrimitive>>,
    options?: SqlExecutionOptions
  ): Promise<SqlCommandResult> {
    const request = this.requestFactory();
    bindContext(request, options);
    bindInputs(request, parameters);
    const result = await request.query(withContext(statement));
    return {
      rowsAffected: result.rowsAffected.reduce((total, next) => total + next, 0)
    };
  }

  public async runInTransaction<TValue>(
    context: SqlSessionContext,
    callback: (executor: SqlExecutor) => Promise<TValue>
  ): Promise<TValue> {
    const value = await this.txRunner(context, callback as (executor: SqlExecutor) => Promise<unknown>);
    return value as TValue;
  }

  public async isAvailable(): Promise<boolean> {
    return this.availabilityProbe();
  }

  public async close(): Promise<void> {
    await this.closer();
  }
}

export class AzureSqlExecutor implements SqlExecutor {
  public static async connect(
    server: string,
    database: string,
    managedIdentityClientId?: string
  ): Promise<AzureSqlExecutor> {
    const config: sql.config = {
      server,
      database,
      options: {
        encrypt: true,
        trustServerCertificate: false
      },
      authentication: authOptions(managedIdentityClientId)
    };
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    return new AzureSqlExecutor(pool);
  }

  private readonly scope: SqlExecutorScope;

  public constructor(private readonly pool: sql.ConnectionPool) {
    this.scope = new SqlExecutorScope(
      () => this.pool.request(),
      async (context, callback) => this.withTransaction(context, callback),
      async () => {
        try {
          const row = await this.queryOne<{ ok: number }>("SELECT 1 AS ok", {});
          return row?.ok === 1;
        } catch {
          return false;
        }
      },
      async () => this.pool.close()
    );
  }

  public async queryOne<TRecord extends Record<string, unknown>>(
    statement: string,
    parameters: Readonly<Record<string, SqlPrimitive>>,
    options?: SqlExecutionOptions
  ): Promise<TRecord | undefined> {
    return this.scope.queryOne(statement, parameters, options);
  }

  public async queryMany<TRecord extends Record<string, unknown>>(
    statement: string,
    parameters: Readonly<Record<string, SqlPrimitive>>,
    options?: SqlExecutionOptions
  ): Promise<readonly TRecord[]> {
    return this.scope.queryMany(statement, parameters, options);
  }

  public async execute(
    statement: string,
    parameters: Readonly<Record<string, SqlPrimitive>>,
    options?: SqlExecutionOptions
  ): Promise<SqlCommandResult> {
    return this.scope.execute(statement, parameters, options);
  }

  public async runInTransaction<TValue>(
    context: SqlSessionContext,
    callback: (executor: SqlExecutor) => Promise<TValue>
  ): Promise<TValue> {
    return this.scope.runInTransaction(context, callback);
  }

  private async withTransaction<TValue>(
    context: SqlSessionContext,
    callback: (executor: SqlExecutor) => Promise<TValue>
  ): Promise<TValue> {
    const transaction = new sql.Transaction(this.pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const requestFactory = () => new sql.Request(transaction);
    const scopedQueryMany = async <TRecord extends Record<string, unknown>>(
      statement: string,
      parameters: Readonly<Record<string, SqlPrimitive>>,
      options?: SqlExecutionOptions
    ): Promise<readonly TRecord[]> => {
      const request = requestFactory();
      bindContext(request, { context: options?.context ?? context });
      bindInputs(request, parameters);
      const result = await request.query<TRecord>(withContext(statement));
      return result.recordset;
    };
    let scopedExecutor: SqlExecutor;
    scopedExecutor = {
      queryOne: async <TRecord extends Record<string, unknown>>(
        statement: string,
        parameters: Readonly<Record<string, SqlPrimitive>>,
        options?: SqlExecutionOptions
      ): Promise<TRecord | undefined> => {
        const rows = await scopedQueryMany<TRecord>(statement, parameters, options);
        return rows[0] as TRecord | undefined;
      },
      queryMany: scopedQueryMany,
      execute: async (
        statement: string,
        parameters: Readonly<Record<string, SqlPrimitive>>,
        options?: SqlExecutionOptions
      ) => {
        const request = requestFactory();
        bindContext(request, { context: options?.context ?? context });
        bindInputs(request, parameters);
        const result = await request.query(withContext(statement));
        return {
          rowsAffected: result.rowsAffected.reduce((total, next) => total + next, 0)
        };
      },
      runInTransaction: async (_innerContext, innerCallback) => innerCallback(scopedExecutor),
      isAvailable: async () => true,
      close: async () => undefined
    };
    try {
      const result = await callback(scopedExecutor);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  public async isAvailable(): Promise<boolean> {
    return this.scope.isAvailable();
  }

  public async close(): Promise<void> {
    await this.scope.close();
  }
}
