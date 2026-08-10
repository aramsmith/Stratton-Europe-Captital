import { createHash } from "node:crypto";
import sql from "mssql";
import { DefaultAzureCredential } from "@azure/identity";

const APPROVED_TENANT_ID = "27140306-eea5-4e7f-91e9-4c9e86864b3a";
const APPROVED_ROUTES = ["LUNA", "TERRA", "SOL"] as const;
const MAX_ROUTE_VALIDITY_DAYS = 90;

function safeErrorToken(value: unknown): string {
  if (typeof value !== "string") {
    return "UNKNOWN";
  }
  const normalized = value.toUpperCase();
  return /^[A-Z0-9_-]{1,64}$/.test(normalized) ? normalized : "UNKNOWN";
}

export function safeBootstrapErrorCode(error: unknown): string {
  if (error instanceof Error && /^[A-Z0-9_:-]+$/.test(error.message)) {
    return error.message;
  }
  const candidate = error as {
    readonly name?: unknown;
    readonly code?: unknown;
    readonly number?: unknown;
  } | null;
  const number =
    typeof candidate?.number === "number" && Number.isSafeInteger(candidate.number)
      ? `N${candidate.number}`
      : "NUNKNOWN";
  return `BOOTSTRAP_FAILED:${safeErrorToken(candidate?.name)}:${safeErrorToken(candidate?.code)}:${number}`;
}

export type GovernedRoute = (typeof APPROVED_ROUTES)[number];

export interface RouteEvidenceInput {
  readonly route: GovernedRoute;
  readonly tenantId: string;
  readonly caseId: string;
  readonly evidenceId: string;
  readonly evidenceVersion: string;
  readonly accountResourceId: string;
  readonly deploymentId: string;
  readonly region: string;
  readonly apiVersion: string;
  readonly approvalStatus: "APPROVED";
  readonly validFromIso: string;
  readonly validUntilIso: string;
}

export interface BootstrapInput {
  readonly tenantId: string;
  readonly sqlServerFqdn: string;
  readonly sqlDatabaseName: string;
  readonly searchEndpoint: string;
  readonly searchIndexName: string;
  readonly routes: readonly RouteEvidenceInput[];
}

export interface MigrationHash {
  readonly name: string;
  readonly sha256: string;
}

export interface RouteEvidenceReceipt {
  readonly evidenceId: string;
  readonly evidenceVersion: string;
}

export interface ExistingRouteEvidenceBinding {
  readonly resourceId: string;
  readonly deploymentId: string;
  readonly region: string;
  readonly route: string;
  readonly apiVersion: string;
  readonly evidenceVersion: string;
  readonly status: string;
  readonly validFromIso: string;
  readonly validUntilIso: string;
}

export interface RouteEvidenceValidityReconciliation {
  readonly operation: "renew";
  readonly validFromIso: string;
  readonly validUntilIso: string;
}

export interface BootstrapReceipt {
  readonly migrationHashes: readonly MigrationHash[];
  readonly searchIndexEtag: string;
  readonly routeEvidence: readonly RouteEvidenceReceipt[];
}

export interface BootstrapDependencies {
  readonly migrations: {
    apply(): Promise<void>;
    hashes(): readonly MigrationHash[];
  };
  readonly search: {
    reconcile(): Promise<{ readonly etag: string }>;
  };
  readonly routeEvidence: {
    upsert(routes: readonly RouteEvidenceInput[]): Promise<readonly RouteEvidenceReceipt[]>;
  };
}

export interface MigrationInput {
  readonly name: string;
  readonly sql: string;
  readonly sha256: string;
}

export interface SearchIndexField {
  readonly name: string;
  readonly type: string;
  readonly key: boolean;
  readonly filterable: boolean;
  readonly searchable: boolean;
  readonly sortable: boolean;
  readonly facetable: boolean;
  readonly retrievable: boolean;
}

export interface SearchIndexDefinition {
  readonly name: string;
  readonly fields: readonly SearchIndexField[];
}

interface ExistingSearchIndex extends SearchIndexDefinition {
  readonly "@odata.etag"?: string;
}

function assertNonEmpty(value: string, errorCode: string): void {
  if (value.trim().length === 0) {
    throw new Error(errorCode);
  }
}

function assertBootstrapInput(input: BootstrapInput): void {
  if (input.tenantId !== APPROVED_TENANT_ID) {
    throw new Error("BOOTSTRAP_TENANT_NOT_APPROVED");
  }
  assertNonEmpty(input.sqlServerFqdn, "BOOTSTRAP_SQL_SERVER_REQUIRED");
  assertNonEmpty(input.sqlDatabaseName, "BOOTSTRAP_SQL_DATABASE_REQUIRED");
  assertNonEmpty(input.searchIndexName, "BOOTSTRAP_SEARCH_INDEX_REQUIRED");
  if (!/^https:\/\/[^/]+\.search\.windows\.net$/i.test(input.searchEndpoint)) {
    throw new Error("BOOTSTRAP_SEARCH_ENDPOINT_INVALID");
  }

  const routesByName = new Map(input.routes.map((route) => [route.route, route]));
  if (routesByName.size !== APPROVED_ROUTES.length || input.routes.length !== APPROVED_ROUTES.length) {
    throw new Error("BOOTSTRAP_ROUTE_SET_INVALID");
  }
  for (const routeName of APPROVED_ROUTES) {
    const route = routesByName.get(routeName);
    if (!route) {
      throw new Error(`BOOTSTRAP_ROUTE_MISSING:${routeName}`);
    }
    if (
      route.tenantId !== APPROVED_TENANT_ID ||
      route.caseId !== "project-danube" ||
      route.approvalStatus !== "APPROVED"
    ) {
      throw new Error(`BOOTSTRAP_ROUTE_SCOPE_INVALID:${routeName}`);
    }
    for (const value of [
      route.evidenceId,
      route.evidenceVersion,
      route.accountResourceId,
      route.deploymentId,
      route.region,
      route.apiVersion
    ]) {
      assertNonEmpty(value, `BOOTSTRAP_ROUTE_VALUE_REQUIRED:${routeName}`);
    }
    const validFrom = Date.parse(route.validFromIso);
    const validUntil = Date.parse(route.validUntilIso);
    if (
      !Number.isFinite(validFrom) ||
      !Number.isFinite(validUntil) ||
      validUntil <= validFrom ||
      validUntil - validFrom > MAX_ROUTE_VALIDITY_DAYS * 24 * 60 * 60 * 1000
    ) {
      throw new Error(`BOOTSTRAP_ROUTE_VALIDITY_INVALID:${routeName}`);
    }
  }
}

export async function runBootstrap(
  input: BootstrapInput,
  dependencies: BootstrapDependencies
): Promise<BootstrapReceipt> {
  assertBootstrapInput(input);
  await dependencies.migrations.apply();
  const search = await dependencies.search.reconcile();
  const routeEvidence = await dependencies.routeEvidence.upsert(input.routes);
  return {
    migrationHashes: dependencies.migrations.hashes(),
    searchIndexEtag: search.etag,
    routeEvidence
  };
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function assertAppliedMigrationHashes(
  applied: readonly MigrationHash[],
  desired: readonly MigrationHash[]
): void {
  const desiredByName = new Map(desired.map((migration) => [migration.name, migration.sha256]));
  for (const migration of applied) {
    const desiredHash = desiredByName.get(migration.name);
    if (desiredHash !== undefined && desiredHash !== migration.sha256) {
      throw new Error(`MIGRATION_HASH_CHANGED:${migration.name}`);
    }
  }
}

export function reconcileRouteEvidenceValidity(
  existing: ExistingRouteEvidenceBinding,
  desired: RouteEvidenceInput
): RouteEvidenceValidityReconciliation {
  if (
    existing.resourceId !== desired.accountResourceId ||
    existing.deploymentId !== desired.deploymentId ||
    existing.region !== desired.region ||
    existing.route !== desired.route ||
    existing.apiVersion !== desired.apiVersion ||
    existing.evidenceVersion !== desired.evidenceVersion ||
    existing.status !== desired.approvalStatus
  ) {
    throw new Error(`ROUTE_EVIDENCE_CONFLICT:${desired.route}`);
  }
  return {
    operation: "renew",
    validFromIso: desired.validFromIso,
    validUntilIso: desired.validUntilIso
  };
}

function splitSqlBatches(source: string): readonly string[] {
  const batches: string[] = [];
  let current: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s*GO(?:\s+(\d+))?\s*$/i.exec(line);
    if (!match) {
      current.push(line);
      continue;
    }
    const batch = current.join("\n").trim();
    if (batch.length > 0) {
      const repeat = Number.parseInt(match[1] ?? "1", 10);
      for (let index = 0; index < repeat; index += 1) {
        batches.push(batch);
      }
    }
    current = [];
  }
  const finalBatch = current.join("\n").trim();
  if (finalBatch.length > 0) {
    batches.push(finalBatch);
  }
  return batches;
}

function sqlAuthentication(managedIdentityClientId: string): sql.config["authentication"] {
  return {
    type: "azure-active-directory-default",
    options: {
      clientId: managedIdentityClientId
    }
  };
}

function toIdempotentIdentitySql(source: string): string {
  const marker = "-- BFF is deliberately limited to the demo projection table.";
  const markerIndex = source.indexOf(marker);
  const identitySql = (markerIndex >= 0 ? source.slice(markerIndex) : source).trim();
  const identityUsers = [
    ...identitySql.matchAll(/CREATE\s+USER\s+\[([A-Za-z0-9_-]+)\]\s+FROM\s+EXTERNAL\s+PROVIDER\s*;/gi)
  ];
  if (identityUsers.length !== 2) {
    throw new Error("BOOTSTRAP_IDENTITY_SQL_INVALID");
  }
  return identitySql.replace(
    /CREATE\s+USER\s+\[([A-Za-z0-9_-]+)\]\s+FROM\s+EXTERNAL\s+PROVIDER\s*;/gi,
    (_statement, name: string) =>
      `IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'${name}') EXEC(N'CREATE USER [${name}] FROM EXTERNAL PROVIDER');`
  );
}

export class AzureSqlMigrationRunner {
  private readonly migrationHashes: readonly MigrationHash[];

  public constructor(
    private readonly server: string,
    private readonly database: string,
    private readonly managedIdentityClientId: string,
    private readonly migrations: readonly MigrationInput[],
    private readonly identityBootstrapSql: string
  ) {
    this.migrationHashes = migrations.map(({ name, sha256: hash }) => ({ name, sha256: hash }));
  }

  public hashes(): readonly MigrationHash[] {
    return this.migrationHashes;
  }

  public async apply(): Promise<void> {
    const pool = new sql.ConnectionPool({
      server: this.server,
      database: this.database,
      options: {
        encrypt: true,
        trustServerCertificate: false
      },
      authentication: sqlAuthentication(this.managedIdentityClientId)
    });
    let transactionStarted = false;
    const transaction = new sql.Transaction(pool);
    try {
      await pool.connect();
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      transactionStarted = true;
      await new sql.Request(transaction).batch(`
IF OBJECT_ID(N'dbo.deployment_migrations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.deployment_migrations (
    migration_name NVARCHAR(255) NOT NULL PRIMARY KEY,
    migration_sha256 CHAR(64) NOT NULL,
    applied_at DATETIME2(7) NOT NULL CONSTRAINT DF_deployment_migrations_applied_at DEFAULT SYSUTCDATETIME()
  );
END;
`);

      for (const migration of this.migrations) {
        const appliedRequest = new sql.Request(transaction);
        appliedRequest.input("migrationName", sql.NVarChar(255), migration.name);
        const applied = await appliedRequest.query<{ migration_sha256: string }>(`
SELECT migration_sha256
FROM dbo.deployment_migrations WITH (UPDLOCK, HOLDLOCK)
WHERE migration_name = @migrationName;
`);
        const storedHash = applied.recordset[0]?.migration_sha256;
        if (storedHash !== undefined) {
          assertAppliedMigrationHashes(
            [{ name: migration.name, sha256: storedHash }],
            [{ name: migration.name, sha256: migration.sha256 }]
          );
          continue;
        }

        for (const batch of splitSqlBatches(migration.sql)) {
          await new sql.Request(transaction).batch(batch);
        }
        const recordRequest = new sql.Request(transaction);
        recordRequest.input("migrationName", sql.NVarChar(255), migration.name);
        recordRequest.input("migrationHash", sql.Char(64), migration.sha256);
        await recordRequest.query(`
INSERT INTO dbo.deployment_migrations (migration_name, migration_sha256)
VALUES (@migrationName, @migrationHash);
`);
      }

      for (const batch of splitSqlBatches(toIdempotentIdentitySql(this.identityBootstrapSql))) {
        await new sql.Request(transaction).batch(batch);
      }
      await transaction.commit();
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) {
        await transaction.rollback();
      }
      throw error;
    } finally {
      await pool.close();
    }
  }
}

function optionalBoolean(value: unknown): boolean {
  return value === true;
}

export function assertSearchSchemaCompatible(
  desired: SearchIndexDefinition,
  existing: SearchIndexDefinition
): void {
  if (existing.name !== desired.name) {
    throw new Error("SEARCH_SCHEMA_DESTRUCTIVE_CHANGE:index-name");
  }
  const desiredFields = new Map(desired.fields.map((field) => [field.name, field]));
  const existingFields = new Map(existing.fields.map((field) => [field.name, field]));
  for (const existingField of existing.fields) {
    if (!desiredFields.has(existingField.name)) {
      throw new Error(`SEARCH_SCHEMA_DESTRUCTIVE_CHANGE:field-removal:${existingField.name}`);
    }
  }
  for (const desiredField of desired.fields) {
    const existingField = existingFields.get(desiredField.name);
    if (!existingField) {
      continue;
    }
    if (existingField.type !== desiredField.type) {
      throw new Error(`SEARCH_SCHEMA_DESTRUCTIVE_CHANGE:field-type:${desiredField.name}`);
    }
    for (const property of [
      "key",
      "filterable",
      "searchable",
      "sortable",
      "facetable",
      "retrievable"
    ] as const) {
      if (optionalBoolean(existingField[property]) !== optionalBoolean(desiredField[property])) {
        throw new Error(`SEARCH_SCHEMA_DESTRUCTIVE_CHANGE:${property}:${desiredField.name}`);
      }
    }
  }
}

export class AzureSearchReconciler {
  public constructor(
    private readonly endpoint: string,
    private readonly indexName: string,
    private readonly definition: SearchIndexDefinition,
    managedIdentityClientId: string
  ) {
    this.credential = new DefaultAzureCredential({ managedIdentityClientId });
  }

  private readonly credential: DefaultAzureCredential;

  public async reconcile(): Promise<{ readonly etag: string }> {
    if (this.definition.name !== this.indexName) {
      throw new Error("SEARCH_SCHEMA_INDEX_NAME_MISMATCH");
    }
    const token = await this.credential.getToken("https://search.azure.com/.default");
    if (!token?.token) {
      throw new Error("SEARCH_AUTH_FAILED");
    }
    const url = `${this.endpoint.replace(/\/+$/, "")}/indexes/${encodeURIComponent(
      this.indexName
    )}?api-version=2024-07-01`;
    const headers = {
      authorization: `Bearer ${token.token}`,
      accept: "application/json"
    };
    const current = await fetch(url, { headers });
    if (current.status === 404) {
      return this.putIndex(url, headers);
    }
    if (!current.ok) {
      throw new Error(`SEARCH_READ_FAILED:${current.status}`);
    }
    const existing = (await current.json()) as ExistingSearchIndex;
    assertSearchSchemaCompatible(this.definition, existing);
    return this.putIndex(url, headers, current.headers.get("etag") ?? existing["@odata.etag"]);
  }

  private async putIndex(
    url: string,
    headers: Readonly<Record<string, string>>,
    etag?: string | null
  ): Promise<{ readonly etag: string }> {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...headers,
        "content-type": "application/json",
        ...(etag ? { "if-match": etag } : {})
      },
      body: JSON.stringify(this.definition)
    });
    if (!response.ok) {
      throw new Error(`SEARCH_RECONCILE_FAILED:${response.status}`);
    }
    const responseBody = (await response.json()) as ExistingSearchIndex;
    const receivedEtag = response.headers.get("etag") ?? responseBody["@odata.etag"];
    if (!receivedEtag) {
      throw new Error("SEARCH_ETAG_MISSING");
    }
    return { etag: receivedEtag };
  }
}

function withRouteSession(
  statement: string,
  values: Readonly<Record<string, string>>
): { readonly statement: string; readonly values: Readonly<Record<string, string>> } {
  return {
    statement: `
BEGIN TRY
  EXEC sys.sp_set_session_context @key=N'tenant_id', @value=@tenantId;
  EXEC sys.sp_set_session_context @key=N'case_id', @value=@caseId;
  ${statement}
END TRY
BEGIN CATCH
  EXEC sys.sp_set_session_context @key=N'case_id', @value=NULL;
  EXEC sys.sp_set_session_context @key=N'tenant_id', @value=NULL;
  THROW;
END CATCH
EXEC sys.sp_set_session_context @key=N'case_id', @value=NULL;
EXEC sys.sp_set_session_context @key=N'tenant_id', @value=NULL;
`,
    values
  };
}

export class AzureSqlRouteEvidenceRepository {
  public constructor(
    private readonly server: string,
    private readonly database: string,
    private readonly managedIdentityClientId: string
  ) {}

  public async upsert(
    routes: readonly RouteEvidenceInput[]
  ): Promise<readonly RouteEvidenceReceipt[]> {
    const pool = new sql.ConnectionPool({
      server: this.server,
      database: this.database,
      options: {
        encrypt: true,
        trustServerCertificate: false
      },
      authentication: sqlAuthentication(this.managedIdentityClientId)
    });
    let transactionStarted = false;
    const transaction = new sql.Transaction(pool);
    try {
      await pool.connect();
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      transactionStarted = true;
      for (const route of routes) {
        const existingRequest = new sql.Request(transaction);
        for (const [name, value] of Object.entries({
          tenantId: route.tenantId,
          caseId: route.caseId,
          evidenceId: route.evidenceId
        })) {
          existingRequest.input(name, sql.NVarChar(512), value);
        }
        const existingQuery = withRouteSession(
          `
SELECT resource_id, deployment_id, region, route, api_version, evidence_version, status,
       valid_from, valid_until
FROM dbo.approved_model_route_evidence
WHERE tenant_id = @tenantId AND case_id = @caseId AND evidence_id = @evidenceId;
`,
          {}
        );
        const existing = await existingRequest.query<{
          resource_id: string;
          deployment_id: string;
          region: string;
          route: string;
          api_version: string;
          evidence_version: string;
          status: string;
          valid_from: Date;
          valid_until: Date;
        }>(existingQuery.statement);
        const row = existing.recordset[0];
        if (row) {
          const reconciliation = reconcileRouteEvidenceValidity(
            {
              resourceId: row.resource_id,
              deploymentId: row.deployment_id,
              region: row.region,
              route: row.route,
              apiVersion: row.api_version,
              evidenceVersion: row.evidence_version,
              status: row.status,
              validFromIso: row.valid_from.toISOString(),
              validUntilIso: row.valid_until.toISOString()
            },
            route
          );
          const renewRequest = new sql.Request(transaction);
          for (const [name, value] of Object.entries({
            tenantId: route.tenantId,
            caseId: route.caseId,
            evidenceId: route.evidenceId,
            validFrom: reconciliation.validFromIso,
            validUntil: reconciliation.validUntilIso
          })) {
            renewRequest.input(name, sql.NVarChar(1024), value);
          }
          const renewQuery = withRouteSession(
            `
UPDATE dbo.approved_model_route_evidence
SET valid_from = CONVERT(DATETIME2(7), @validFrom, 127),
    valid_until = CONVERT(DATETIME2(7), @validUntil, 127)
WHERE tenant_id = @tenantId AND case_id = @caseId AND evidence_id = @evidenceId;
`,
            {}
          );
          const renewed = await renewRequest.query(renewQuery.statement);
          if (renewed.rowsAffected[0] !== 1) {
            throw new Error(`ROUTE_EVIDENCE_RENEWAL_FAILED:${route.route}`);
          }
          continue;
        }

        const insertRequest = new sql.Request(transaction);
        for (const [name, value] of Object.entries({
          tenantId: route.tenantId,
          caseId: route.caseId,
          evidenceId: route.evidenceId,
          status: route.approvalStatus,
          resourceId: route.accountResourceId,
          deploymentId: route.deploymentId,
          region: route.region,
          route: route.route,
          apiVersion: route.apiVersion,
          evidenceVersion: route.evidenceVersion,
          validFrom: route.validFromIso,
          validUntil: route.validUntilIso
        })) {
          insertRequest.input(name, sql.NVarChar(1024), value);
        }
        const insertQuery = withRouteSession(
          `
INSERT INTO dbo.approved_model_route_evidence (
  tenant_id, case_id, evidence_id, status, resource_id, deployment_id, region,
  route, api_version, evidence_version, valid_from, valid_until
) VALUES (
  @tenantId, @caseId, @evidenceId, @status, @resourceId, @deploymentId, @region,
  @route, @apiVersion, @evidenceVersion, CONVERT(DATETIME2(7), @validFrom, 127),
  CONVERT(DATETIME2(7), @validUntil, 127)
);
`,
          {}
        );
        await insertRequest.query(insertQuery.statement);
      }
      await transaction.commit();
      transactionStarted = false;
      return routes.map(({ evidenceId, evidenceVersion }) => ({ evidenceId, evidenceVersion }));
    } catch (error) {
      if (transactionStarted) {
        await transaction.rollback();
      }
      throw error;
    } finally {
      await pool.close();
    }
  }
}
