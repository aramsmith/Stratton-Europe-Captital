import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { approvedErrorCodes, approvedOperations } from "../dist/openapi-contract.js";

const openApiPath = resolve(process.cwd(), "openapi", "stratton-openapi-3.1.yaml");
const phase3ContractPath = resolve(
  process.cwd(),
  "..",
  "..",
  "3-azure-design",
  "evidence",
  "stratton-data-api-contracts.json"
);

const openApi = parse(readFileSync(openApiPath, "utf8"));
if (openApi.openapi !== "3.1.0") {
  throw new Error("OPENAPI_VERSION_MUST_BE_3_1_0");
}

const operationRows = [];
for (const [path, pathItem] of Object.entries(openApi.paths ?? {})) {
  if (!pathItem || typeof pathItem !== "object") {
    continue;
  }
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!operation || typeof operation !== "object") {
      continue;
    }
    if (!operation.operationId) {
      continue;
    }
    const roles = Array.isArray(operation["x-required-roles"]) ? operation["x-required-roles"] : [];
    operationRows.push({
      operationId: operation.operationId,
      method: method.toUpperCase(),
      path,
      roles: [...roles].sort()
    });
  }
}

const requiredDemoOperations = [
  {
    operationId: "createDemoAnalysisBundle",
    method: "POST",
    path: "/v1/demo-authority/cases/{caseId}/analysis-bundles"
  },
  {
    operationId: "getDemoAnalysisBundle",
    method: "GET",
    path: "/v1/demo-authority/analysis-bundles/{analysisBundleId}"
  },
  {
    operationId: "completeDemoAnalysisBundle",
    method: "POST",
    path: "/v1/demo-authority/analysis-bundles/{analysisBundleId}/completion"
  },
  {
    operationId: "submitDemoBundleReview",
    method: "POST",
    path: "/v1/demo-authority/cases/{caseId}/analysis-bundles/{analysisBundleId}/reviews"
  },
  {
    operationId: "prepareDemoBundleDraft",
    method: "POST",
    path: "/v1/demo-authority/cases/{caseId}/analysis-bundles/{analysisBundleId}/draft-recommendations"
  },
  {
    operationId: "getDemoModelRouteEvidence",
    method: "GET",
    path: "/v1/demo-authority/model-route-evidence/{evidenceId}"
  }
];
const demoSchemas = [
  "CreateDemoAnalysisBundleRequest",
  "AnalysisBundleResponse",
  "CompleteDemoAnalysisBundleRequest",
  "SubmitDemoBundleReviewRequest",
  "PrepareDemoBundleDraftRequest",
  "ModelRouteEvidenceResponse"
];

for (const approved of approvedOperations) {
  const found = operationRows.find((row) => row.operationId === approved.operationId);
  if (!found) {
    throw new Error(`MISSING_OPERATION_ID:${approved.operationId}`);
  }

  if (found.method !== approved.method || found.path !== approved.path) {
    throw new Error(`OPERATION_PATH_METHOD_MISMATCH:${approved.operationId}`);
  }
  const expectedRoles = [...approved.roles].sort().join(",");
  const actualRoles = [...found.roles].sort().join(",");
  if (expectedRoles !== actualRoles) {
    throw new Error(`OPERATION_ROLE_MISMATCH:${approved.operationId}`);
  }
}

for (const required of requiredDemoOperations) {
  const found = operationRows.find((row) => row.operationId === required.operationId);
  if (!found) {
    throw new Error(`MISSING_DEMO_OPERATION_ID:${required.operationId}`);
  }
  if (found.method !== required.method || found.path !== required.path) {
    throw new Error(`DEMO_OPERATION_PATH_METHOD_MISMATCH:${required.operationId}`);
  }
}

for (const schemaName of demoSchemas) {
  const schema = openApi.components?.schemas?.[schemaName];
  if (!schema || schema.additionalProperties !== false) {
    throw new Error(`DEMO_SCHEMA_MUST_BE_STRICT:${schemaName}`);
  }
}

function assertExactProperties(schemaName, expectedProperties) {
  const schema = openApi.components?.schemas?.[schemaName];
  const actual = Object.keys(schema?.properties ?? {}).sort().join(",");
  const expected = [...expectedProperties].sort().join(",");
  if (actual !== expected) {
    throw new Error(`DEMO_SCHEMA_PROPERTY_MISMATCH:${schemaName}:${actual}`);
  }
}

assertExactProperties("CreateDemoAnalysisBundleRequest", [
  "tenantId",
  "caseId",
  "analysisBundleId",
  "modelRoute",
  "modelDeploymentId",
  "routeEvidenceId",
  "promptTemplateVersion",
  "requestFingerprint",
  "evidenceIds"
]);
assertExactProperties("AnalysisBundleResponse", [
  "tenantId",
  "caseId",
  "analysisBundleId",
  "evidenceManifestHash",
  "modelRoute",
  "modelDeploymentId",
  "routeEvidenceId",
  "promptTemplateVersion",
  "requestFingerprint",
  "status",
  "outputKind",
  "unsupportedClaims",
  "subjectVersion",
  "evidence",
  "citationCounts"
]);
assertExactProperties("CompleteDemoAnalysisBundleRequest", [
  "tenantId",
  "caseId",
  "analysisBundleId",
  "outputManifestHash",
  "evidenceManifestHash",
  "modelRoute",
  "modelDeploymentId",
  "routeEvidenceId",
  "status",
  "citationCounts"
]);

const analysisBundleSchema = openApi.components?.schemas?.AnalysisBundleResponse;
if (!analysisBundleSchema?.required?.includes("evidence")) {
  throw new Error("ANALYSIS_BUNDLE_RESPONSE_EVIDENCE_REQUIRED");
}
const evidenceItems = analysisBundleSchema?.properties?.evidence?.items;
if (
  evidenceItems?.additionalProperties !== false ||
  [...(evidenceItems?.required ?? [])].sort().join(",") !==
    ["evidenceId", "evidenceVersionId", "ordinal"].sort().join(",") ||
  Object.keys(evidenceItems?.properties ?? {}).sort().join(",") !==
    ["evidenceId", "evidenceVersionId", "ordinal"].sort().join(",")
) {
  throw new Error("ANALYSIS_BUNDLE_RESPONSE_EVIDENCE_CONTRACT_MISMATCH");
}

const completionOperation =
  openApi.paths?.["/v1/demo-authority/analysis-bundles/{analysisBundleId}/completion"]?.post;
if (
  completionOperation?.["x-authentication"] !== "application" ||
  (completionOperation?.["x-required-roles"]?.length ?? 0) !== 0
) {
  throw new Error("DEMO_COMPLETION_MUST_USE_APPLICATION_AUTHENTICATION");
}

const routeEvidenceParameters =
  openApi.paths?.["/v1/demo-authority/model-route-evidence/{evidenceId}"]?.get?.parameters ?? [];
if (
  !routeEvidenceParameters.some(
    (parameter) =>
      parameter?.name === "tenantId" &&
      parameter?.in === "query" &&
      parameter?.required === true
  )
) {
  throw new Error("MODEL_ROUTE_EVIDENCE_TENANT_QUERY_REQUIRED");
}

const phase3 = JSON.parse(readFileSync(phase3ContractPath, "utf8"));
const phase3Operations = Array.isArray(phase3?.apis) ? phase3.apis : [];
for (const approved of approvedOperations) {
  const row = phase3Operations.find((item) => item.operationId === approved.operationId);
  if (!row) {
    throw new Error(`PHASE3_OPERATION_MISSING:${approved.operationId}`);
  }
  if (row.method !== approved.method || row.path !== approved.path) {
    throw new Error(`PHASE3_PATH_METHOD_MISMATCH:${approved.operationId}`);
  }
  const expectedRoles = [...approved.roles].sort().join(",");
  const actualRoles = Array.isArray(row.roles) ? [...row.roles].sort().join(",") : "";
  if (expectedRoles !== actualRoles) {
    throw new Error(`PHASE3_ROLE_MISMATCH:${approved.operationId}`);
  }
}

const errorCodeEnum = openApi.components?.schemas?.ErrorResponse?.properties?.code?.enum;
if (!Array.isArray(errorCodeEnum)) {
  throw new Error("ERROR_CODE_ENUM_MISSING");
}
for (const code of approvedErrorCodes) {
  if (!errorCodeEnum.includes(code)) {
    throw new Error(`MISSING_ERROR_CODE:${code}`);
  }
}

console.log("openapi checks passed");
