import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertAppliedMigrationHashes,
  assertSearchSchemaCompatible,
  reconcileRouteEvidenceValidity,
  runBootstrap,
  safeBootstrapErrorCode,
  type BootstrapDependencies,
  type BootstrapInput,
  type SearchIndexDefinition,
  type RouteEvidenceInput
} from "../../../app/src/bootstrap-runtime.js";

const approvedTenantId = "27140306-eea5-4e7f-91e9-4c9e86864b3a";

test("bootstrap error classification exposes only safe type and code tokens", () => {
  const error = Object.assign(new Error("raw provider message must not be logged"), {
    name: "ConnectionError",
    code: "ETIMEOUT",
    number: 208
  });

  assert.equal(safeBootstrapErrorCode(error), "BOOTSTRAP_FAILED:CONNECTIONERROR:ETIMEOUT:N208");
  assert.equal(safeBootstrapErrorCode(new Error("SEARCH_AUTH_FAILED")), "SEARCH_AUTH_FAILED");
});

const routes: readonly RouteEvidenceInput[] = [
  {
    route: "LUNA",
    tenantId: approvedTenantId,
    caseId: "project-danube",
    evidenceId: "SEC-EVID-LUNA-ROUTE-v1",
    evidenceVersion: "route-evidence-luna-v1",
    accountResourceId:
      "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/luna",
    deploymentId: "luna-evidence-triage",
    region: "westeurope",
    apiVersion: "2025-01-01-preview",
    approvalStatus: "APPROVED",
    validFromIso: "2026-08-10T00:00:00.000Z",
    validUntilIso: "2026-09-09T00:00:00.000Z"
  },
  {
    route: "TERRA",
    tenantId: approvedTenantId,
    caseId: "project-danube",
    evidenceId: "SEC-EVID-TERRA-ROUTE-v1",
    evidenceVersion: "route-evidence-terra-v1",
    accountResourceId:
      "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/terra",
    deploymentId: "terra-evidence-analysis",
    region: "westeurope",
    apiVersion: "2025-01-01-preview",
    approvalStatus: "APPROVED",
    validFromIso: "2026-08-10T00:00:00.000Z",
    validUntilIso: "2026-09-09T00:00:00.000Z"
  },
  {
    route: "SOL",
    tenantId: approvedTenantId,
    caseId: "project-danube",
    evidenceId: "SEC-EVID-SOL-ROUTE-v1",
    evidenceVersion: "route-evidence-sol-v1",
    accountResourceId:
      "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/sol",
    deploymentId: "sol-investment-synthesis",
    region: "westeurope",
    apiVersion: "2025-01-01-preview",
    approvalStatus: "APPROVED",
    validFromIso: "2026-08-10T00:00:00.000Z",
    validUntilIso: "2026-09-09T00:00:00.000Z"
  }
];

const input: BootstrapInput = {
  tenantId: approvedTenantId,
  sqlServerFqdn: "stratton.database.windows.net",
  sqlDatabaseName: "stratton",
  searchEndpoint: "https://stratton.search.windows.net",
  searchIndexName: "governed-evidence",
  routes
};

test("runs migrations, search reconciliation, and route evidence in order", async () => {
  const calls: string[] = [];
  const dependencies: BootstrapDependencies = {
    migrations: {
      async apply() {
        calls.push("migrations");
      },
      hashes() {
        return [{ name: "001_init.sql", sha256: "a".repeat(64) }];
      }
    },
    search: {
      async reconcile() {
        calls.push("search");
        return { etag: '"schema-v1"' };
      }
    },
    routeEvidence: {
      async upsert(received) {
        calls.push("route-evidence");
        return received.map(({ evidenceId, evidenceVersion }) => ({ evidenceId, evidenceVersion }));
      }
    }
  };

  const receipt = await runBootstrap(input, dependencies);

  assert.deepEqual(calls, ["migrations", "search", "route-evidence"]);
  assert.deepEqual(receipt.migrationHashes, [{ name: "001_init.sql", sha256: "a".repeat(64) }]);
  assert.equal(receipt.searchIndexEtag, '"schema-v1"');
  assert.deepEqual(receipt.routeEvidence, [
    { evidenceId: "SEC-EVID-LUNA-ROUTE-v1", evidenceVersion: "route-evidence-luna-v1" },
    { evidenceId: "SEC-EVID-TERRA-ROUTE-v1", evidenceVersion: "route-evidence-terra-v1" },
    { evidenceId: "SEC-EVID-SOL-ROUTE-v1", evidenceVersion: "route-evidence-sol-v1" }
  ]);
});

test("rejects a non-approved tenant before any data-plane operation", async () => {
  let calls = 0;
  const dependencies: BootstrapDependencies = {
    migrations: {
      async apply() {
        calls += 1;
      },
      hashes() {
        return [];
      }
    },
    search: {
      async reconcile() {
        calls += 1;
        return { etag: '"schema-v1"' };
      }
    },
    routeEvidence: {
      async upsert() {
        calls += 1;
        return [];
      }
    }
  };

  await assert.rejects(
    runBootstrap({ ...input, tenantId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }, dependencies),
    /BOOTSTRAP_TENANT_NOT_APPROVED/
  );
  assert.equal(calls, 0);
});

test("rejects a changed hash for an applied migration", () => {
  assert.throws(
    () =>
      assertAppliedMigrationHashes(
        [{ name: "001_init.sql", sha256: "a".repeat(64) }],
        [{ name: "001_init.sql", sha256: "b".repeat(64) }]
      ),
    /MIGRATION_HASH_CHANGED:001_init\.sql/
  );
});

test("rejects a destructive Azure Search field change", () => {
  const desired: SearchIndexDefinition = {
    name: "governed-evidence",
    fields: [
      {
        name: "tenantId",
        type: "Edm.String",
        key: false,
        filterable: true,
        searchable: false,
        sortable: false,
        facetable: false,
        retrievable: true
      }
    ]
  };

  assert.throws(
    () =>
      assertSearchSchemaCompatible(desired, {
        ...desired,
        fields: [{ ...desired.fields[0]!, type: "Edm.Int32" }]
      }),
    /SEARCH_SCHEMA_DESTRUCTIVE_CHANGE:field-type:tenantId/
  );
});

test("renews expired validity for an existing identical route binding", () => {
  const desired = routes[0]!;
  const reconciliation = reconcileRouteEvidenceValidity(
    {
      resourceId: desired.accountResourceId,
      deploymentId: desired.deploymentId,
      region: desired.region,
      route: desired.route,
      apiVersion: desired.apiVersion,
      evidenceVersion: desired.evidenceVersion,
      status: desired.approvalStatus,
      validFromIso: "2026-06-01T00:00:00.000Z",
      validUntilIso: "2026-07-01T00:00:00.000Z"
    },
    desired
  );

  const rerunTime = Date.parse("2026-08-10T12:00:00.000Z");
  assert.equal(reconciliation.operation, "renew");
  assert.equal(reconciliation.validFromIso, desired.validFromIso);
  assert.equal(reconciliation.validUntilIso, desired.validUntilIso);
  assert.ok(Date.parse(reconciliation.validFromIso) <= rerunTime);
  assert.ok(Date.parse(reconciliation.validUntilIso) > rerunTime);
});
