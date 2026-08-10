import { Buffer } from "node:buffer";
import { lookup } from "node:dns/promises";
import { pathToFileURL } from "node:url";
import * as mssql from "mssql";
import { createManagedIdentityCredential } from "./azure/managed-identity.js";

const routeSequence = ["LUNA", "TERRA", "SOL"] as const;
const receiptMarker = "STRATTON_VERIFICATION_RECEIPT:";

type RouteName = (typeof routeSequence)[number];

export interface ExpectedRouteBinding {
  readonly route: RouteName;
  readonly resourceId: string;
  readonly deploymentId: string;
  readonly region: string;
  readonly apiVersion: string;
  readonly evidenceId: string;
  readonly evidenceVersion: string;
}

export interface Phase5RouteBinding extends ExpectedRouteBinding {
  readonly status: string;
  readonly validFrom: string;
  readonly validUntil: string;
}

export interface VerificationReceipt {
  readonly version: 1;
  readonly nonce: string;
  readonly generatedAtUtc: string;
  readonly checks: {
    readonly bffHealth: true;
    readonly phase5Health: true;
    readonly sqlPrivateDns: true;
    readonly sqlTokenAuthenticatedQuery: true;
  };
  readonly routeBindings: readonly Phase5RouteBinding[];
}

interface VerificationConfiguration {
  readonly nonce: string;
  readonly bffHealthUrl: string;
  readonly phase5HealthUrl: string;
  readonly sqlServerFqdn: string;
  readonly sqlDatabaseName: string;
  readonly managedIdentityClientId: string;
  readonly tenantId: string;
  readonly caseId: string;
  readonly expectedRoutes: readonly ExpectedRouteBinding[];
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`VERIFICATION_CONFIGURATION_MISSING:${name}`);
  }
  return value;
}

function isRouteName(value: unknown): value is RouteName {
  return typeof value === "string" && routeSequence.includes(value as RouteName);
}

function requireExpectedRoute(value: unknown, index: number): ExpectedRouteBinding {
  if (!value || typeof value !== "object") {
    throw new Error("VERIFICATION_EXPECTED_ROUTES_INVALID");
  }
  const candidate = value as Record<string, unknown>;
  const expectedRoute = routeSequence[index];
  if (!expectedRoute || candidate.route !== expectedRoute) {
    throw new Error("VERIFICATION_EXPECTED_ROUTES_INVALID");
  }
  for (const name of [
    "resourceId",
    "deploymentId",
    "region",
    "apiVersion",
    "evidenceId",
    "evidenceVersion"
  ] as const) {
    if (typeof candidate[name] !== "string" || candidate[name].length === 0) {
      throw new Error("VERIFICATION_EXPECTED_ROUTES_INVALID");
    }
  }
  return {
    route: expectedRoute,
    resourceId: candidate.resourceId as string,
    deploymentId: candidate.deploymentId as string,
    region: candidate.region as string,
    apiVersion: candidate.apiVersion as string,
    evidenceId: candidate.evidenceId as string,
    evidenceVersion: candidate.evidenceVersion as string
  };
}

function readConfiguration(): VerificationConfiguration {
  let parsedRoutes: unknown;
  try {
    parsedRoutes = JSON.parse(
      Buffer.from(requireEnvironment("STRATTON_EXPECTED_ROUTES_BASE64"), "base64").toString(
        "utf8"
      )
    );
  } catch {
    throw new Error("VERIFICATION_EXPECTED_ROUTES_INVALID");
  }
  if (!Array.isArray(parsedRoutes) || parsedRoutes.length !== routeSequence.length) {
    throw new Error("VERIFICATION_EXPECTED_ROUTES_INVALID");
  }
  return {
    nonce: requireEnvironment("STRATTON_VERIFICATION_NONCE"),
    bffHealthUrl: requireEnvironment("STRATTON_BFF_HEALTH_URL"),
    phase5HealthUrl: requireEnvironment("STRATTON_PHASE5_HEALTH_URL"),
    sqlServerFqdn: requireEnvironment("AZURE_SQL_SERVER_FQDN"),
    sqlDatabaseName: requireEnvironment("AZURE_SQL_DATABASE_NAME"),
    managedIdentityClientId: requireEnvironment("AZURE_MANAGED_IDENTITY_CLIENT_ID"),
    tenantId: requireEnvironment("STRATTON_TENANT_ID"),
    caseId: requireEnvironment("STRATTON_CASE_ID"),
    expectedRoutes: parsedRoutes.map(requireExpectedRoute)
  };
}

export function isPrivateIpv4Address(address: string): boolean {
  const octets = address.split(".").map((octet) => Number(octet));
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  const first = octets[0]!;
  const second = octets[1]!;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function toIsoTimestamp(value: Date | string): string {
  const timestamp = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new Error("PHASE5_ROUTE_BINDING_TIMESTAMP_INVALID");
  }
  return timestamp.toISOString();
}

export function validatePhase5RouteBindings(
  records: readonly Phase5RouteBinding[],
  expectedRoutes: readonly ExpectedRouteBinding[],
  now: Date
): readonly Phase5RouteBinding[] {
  if (records.length !== routeSequence.length || expectedRoutes.length !== routeSequence.length) {
    throw new Error("PHASE5_ROUTE_BINDING_SEQUENCE_INVALID");
  }
  return routeSequence.map((route, index) => {
    const record = records[index];
    const expected = expectedRoutes[index];
    if (
      !record ||
      !expected ||
      !isRouteName(record.route) ||
      record.route !== route ||
      expected.route !== route ||
      record.resourceId !== expected.resourceId ||
      record.deploymentId !== expected.deploymentId ||
      record.region !== expected.region ||
      record.apiVersion !== expected.apiVersion ||
      record.evidenceId !== expected.evidenceId ||
      record.evidenceVersion !== expected.evidenceVersion ||
      record.status !== "APPROVED" ||
      new Date(record.validFrom).getTime() > now.getTime() ||
      new Date(record.validUntil).getTime() <= now.getTime()
    ) {
      throw new Error(`PHASE5_ROUTE_BINDING_INVALID:${route}`);
    }
    return {
      ...record,
      validFrom: toIsoTimestamp(record.validFrom),
      validUntil: toIsoTimestamp(record.validUntil)
    };
  });
}

export function encodeVerificationReceipt(receipt: VerificationReceipt): string {
  return Buffer.from(JSON.stringify(receipt), "utf8").toString("base64");
}

async function assertHealthy(url: string, failureCode: string): Promise<void> {
  const response = await fetch(url, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) {
    throw new Error(failureCode);
  }
}

async function verifySql(
  configuration: VerificationConfiguration
): Promise<readonly Phase5RouteBinding[]> {
  const credential = createManagedIdentityCredential(configuration.managedIdentityClientId);
  const accessToken = await credential.getToken("https://database.windows.net/.default");
  if (!accessToken?.token) {
    throw new Error("SQL_MANAGED_IDENTITY_TOKEN_UNAVAILABLE");
  }
  const pool = new mssql.ConnectionPool({
    server: configuration.sqlServerFqdn,
    database: configuration.sqlDatabaseName,
    options: {
      encrypt: true,
      trustServerCertificate: false
    },
    authentication: {
      type: "azure-active-directory-access-token",
      options: {
        token: accessToken.token
      }
    }
  });
  try {
    await pool.connect();
    await pool.request().query("SELECT CAST(1 AS int) AS verified;");
    const request = pool.request();
    request.input("tenantId", mssql.NVarChar(64), configuration.tenantId);
    request.input("caseId", mssql.NVarChar(128), configuration.caseId);
    const result = await request.query<{
      route: string;
      resourceId: string;
      deploymentId: string;
      region: string;
      apiVersion: string;
      evidenceId: string;
      evidenceVersion: string;
      status: string;
      validFrom: Date;
      validUntil: Date;
    }>(`
EXEC sys.sp_set_session_context @key=N'tenant_id', @value=@tenantId;
EXEC sys.sp_set_session_context @key=N'case_id', @value=@caseId;
SELECT
  route,
  resource_id AS resourceId,
  deployment_id AS deploymentId,
  region,
  api_version AS apiVersion,
  evidence_id AS evidenceId,
  evidence_version AS evidenceVersion,
  status,
  valid_from AS validFrom,
  valid_until AS validUntil
FROM dbo.approved_model_route_evidence
ORDER BY CASE route WHEN 'LUNA' THEN 1 WHEN 'TERRA' THEN 2 WHEN 'SOL' THEN 3 ELSE 4 END;
`);
    const records = result.recordset.map((record) => ({
      route: record.route as RouteName,
      resourceId: record.resourceId,
      deploymentId: record.deploymentId,
      region: record.region,
      apiVersion: record.apiVersion,
      evidenceId: record.evidenceId,
      evidenceVersion: record.evidenceVersion,
      status: record.status,
      validFrom: record.validFrom.toISOString(),
      validUntil: record.validUntil.toISOString()
    }));
    return validatePhase5RouteBindings(records, configuration.expectedRoutes, new Date());
  } finally {
    await pool.close();
  }
}

async function runVerificationJob(): Promise<void> {
  const configuration = readConfiguration();
  await Promise.all([
    assertHealthy(configuration.bffHealthUrl, "BFF_HEALTH_CHECK_FAILED"),
    assertHealthy(configuration.phase5HealthUrl, "PHASE5_HEALTH_CHECK_FAILED")
  ]);
  const resolved = await lookup(configuration.sqlServerFqdn, { family: 4 });
  if (!isPrivateIpv4Address(resolved.address)) {
    throw new Error("SQL_PRIVATE_DNS_CHECK_FAILED");
  }
  const routeBindings = await verifySql(configuration);
  const receipt: VerificationReceipt = {
    version: 1,
    nonce: configuration.nonce,
    generatedAtUtc: new Date().toISOString(),
    checks: {
      bffHealth: true,
      phase5Health: true,
      sqlPrivateDns: true,
      sqlTokenAuthenticatedQuery: true
    },
    routeBindings
  };
  process.stdout.write(`${receiptMarker}${encodeVerificationReceipt(receipt)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVerificationJob().catch((error: unknown) => {
    const code =
      error instanceof Error && /^[A-Z0-9_:-]+$/.test(error.message)
        ? error.message
        : "VERIFICATION_JOB_FAILED";
    process.stderr.write(
      `${JSON.stringify({
        service: "stratton-verification",
        message: "verification-failed",
        code
      })}\n`
    );
    process.exitCode = 1;
  });
}
