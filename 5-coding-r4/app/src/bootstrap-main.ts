import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { StructuredLogger } from "./logger.js";
import {
  AzureSearchReconciler,
  AzureSqlMigrationRunner,
  AzureSqlRouteEvidenceRepository,
  runBootstrap,
  safeBootstrapErrorCode,
  sha256,
  type BootstrapInput,
  type MigrationInput,
  type RouteEvidenceInput,
  type SearchIndexDefinition
} from "./bootstrap-runtime.js";

const requiredEnvironmentNames = [
  "BOOTSTRAP_TENANT_ID",
  "AZURE_SQL_SERVER_FQDN",
  "AZURE_SQL_DATABASE_NAME",
  "AZURE_SEARCH_ENDPOINT",
  "AZURE_SEARCH_INDEX_NAME",
  "AZURE_MANAGED_IDENTITY_CLIENT_ID",
  "BOOTSTRAP_PROJECTION_MIGRATION_SQL",
  "BOOTSTRAP_IDENTITY_BOOTSTRAP_SQL",
  "BOOTSTRAP_EXPECTED_MIGRATION_HASHES_JSON",
  "BOOTSTRAP_SEARCH_SCHEMA_JSON",
  "BOOTSTRAP_ROUTES_JSON"
] as const;

function required(name: (typeof requiredEnvironmentNames)[number]): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`MISSING_REQUIRED_ENV:${name}`);
  }
  return value.trim();
}

function requiredRaw(name: (typeof requiredEnvironmentNames)[number]): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`MISSING_REQUIRED_ENV:${name}`);
  }
  return value;
}

function assertSecretFreeEnvironment(env: NodeJS.ProcessEnv): void {
  for (const [name, value] of Object.entries(env)) {
    if (!value) {
      continue;
    }
    if (/(password|connection.?string|client.?secret|api.?key)/i.test(name)) {
      throw new Error(`SECRET_VALUE_NOT_ALLOWED:${name}`);
    }
  }
}

function parseJson<T>(name: (typeof requiredEnvironmentNames)[number]): T {
  try {
    return JSON.parse(required(name)) as T;
  } catch {
    throw new Error(`INVALID_JSON_ENV:${name}`);
  }
}

function loadMigration(name: string, sql: string, expectedHashes: Readonly<Record<string, string>>): MigrationInput {
  const expectedHash = expectedHashes[name];
  const actualHash = sha256(sql);
  if (!expectedHash || expectedHash !== actualHash) {
    throw new Error(`MIGRATION_OUTPUT_HASH_MISMATCH:${name}`);
  }
  return { name, sql, sha256: actualHash };
}

function loadInput(): {
  readonly input: BootstrapInput;
  readonly migrations: readonly MigrationInput[];
  readonly identityBootstrapSql: string;
  readonly managedIdentityClientId: string;
  readonly searchSchema: SearchIndexDefinition;
} {
  assertSecretFreeEnvironment(process.env);
  const expectedHashes = parseJson<Record<string, string>>("BOOTSTRAP_EXPECTED_MIGRATION_HASHES_JSON");
  const migrationDirectory = process.env.BOOTSTRAP_MIGRATIONS_DIR?.trim() || resolve(process.cwd(), "migrations");
  const initial = readFileSync(resolve(migrationDirectory, "001_init.sql"), "utf8");
  const authority = readFileSync(resolve(migrationDirectory, "002_demo_authority.sql"), "utf8");
  const projectDanube = readFileSync(
    resolve(migrationDirectory, "003_project_danube_seed.sql"),
    "utf8"
  );
  const admissionRecovery = readFileSync(
    resolve(migrationDirectory, "004_project_danube_admission_recovery.sql"),
    "utf8"
  );
  const extractionRecovery = readFileSync(
    resolve(migrationDirectory, "005_project_danube_extraction_recovery.sql"),
    "utf8"
  );
  const processingReceipts = readFileSync(
    resolve(migrationDirectory, "006_project_danube_processing_receipts.sql"),
    "utf8"
  );
  const readinessGrant = readFileSync(
    resolve(migrationDirectory, "007_demo_authority_readiness_grant.sql"),
    "utf8"
  );
  const responsesApiVersion = readFileSync(
    resolve(migrationDirectory, "008_openai_responses_api_version.sql"),
    "utf8"
  );
  const projection = requiredRaw("BOOTSTRAP_PROJECTION_MIGRATION_SQL");
  const routes = parseJson<readonly RouteEvidenceInput[]>("BOOTSTRAP_ROUTES_JSON");
  const searchSchema = parseJson<SearchIndexDefinition>("BOOTSTRAP_SEARCH_SCHEMA_JSON");
  const input: BootstrapInput = {
    tenantId: required("BOOTSTRAP_TENANT_ID"),
    sqlServerFqdn: required("AZURE_SQL_SERVER_FQDN"),
    sqlDatabaseName: required("AZURE_SQL_DATABASE_NAME"),
    searchEndpoint: required("AZURE_SEARCH_ENDPOINT"),
    searchIndexName: required("AZURE_SEARCH_INDEX_NAME"),
    routes
  };
  return {
    input,
    migrations: [
      loadMigration("001_init.sql", initial, expectedHashes),
      loadMigration("002_demo_authority.sql", authority, expectedHashes),
      loadMigration("003_project_danube_seed.sql", projectDanube, expectedHashes),
      loadMigration(
        "004_project_danube_admission_recovery.sql",
        admissionRecovery,
        expectedHashes
      ),
      loadMigration(
        "005_project_danube_extraction_recovery.sql",
        extractionRecovery,
        expectedHashes
      ),
      loadMigration(
        "006_project_danube_processing_receipts.sql",
        processingReceipts,
        expectedHashes
      ),
      loadMigration(
        "007_demo_authority_readiness_grant.sql",
        readinessGrant,
        expectedHashes
      ),
      loadMigration(
        "008_openai_responses_api_version.sql",
        responsesApiVersion,
        expectedHashes
      ),
      loadMigration("demo-projection.sql", projection, expectedHashes)
    ],
    identityBootstrapSql: required("BOOTSTRAP_IDENTITY_BOOTSTRAP_SQL"),
    managedIdentityClientId: required("AZURE_MANAGED_IDENTITY_CLIENT_ID"),
    searchSchema
  };
}

async function main(): Promise<void> {
  const logger = new StructuredLogger("stratton-bootstrap", (entry) => {
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  });
  try {
    const configuration = loadInput();
    logger.log("INFO", "bootstrap-started", {
      correlationId: "bootstrap",
      tenantId: configuration.input.tenantId,
      searchIndexName: configuration.input.searchIndexName
    });
    const migrations = new AzureSqlMigrationRunner(
      configuration.input.sqlServerFqdn,
      configuration.input.sqlDatabaseName,
      configuration.managedIdentityClientId,
      configuration.migrations,
      configuration.identityBootstrapSql
    );
    const receipt = await runBootstrap(configuration.input, {
      migrations,
      search: new AzureSearchReconciler(
        configuration.input.searchEndpoint,
        configuration.input.searchIndexName,
        configuration.searchSchema,
        configuration.managedIdentityClientId
      ),
      routeEvidence: new AzureSqlRouteEvidenceRepository(
        configuration.input.sqlServerFqdn,
        configuration.input.sqlDatabaseName,
        configuration.managedIdentityClientId
      )
    });
    logger.log("INFO", "bootstrap-receipt", { correlationId: "bootstrap", receipt });
  } catch (error) {
    logger.log("ERROR", "bootstrap-failed", {
      correlationId: "bootstrap",
      errorCode: safeBootstrapErrorCode(error)
    });
    process.exitCode = 1;
  }
}

void main();
