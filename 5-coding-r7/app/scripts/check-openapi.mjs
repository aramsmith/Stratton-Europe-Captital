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
const cc002RoutingContractPath = resolve(
  process.cwd(),
  "..",
  "..",
  "3-azure-design",
  "evidence",
  "stratton-model-routing-contract-cc-002-r2-proposed.json"
);
const analysisRoles = [
  "ComplianceApprover",
  "DealContributor",
  "DealReviewer",
  "LegalApprover",
  "ValidationProducer"
];

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

const phase3 = JSON.parse(readFileSync(phase3ContractPath, "utf8"));
const cc002Routing = JSON.parse(readFileSync(cc002RoutingContractPath, "utf8"));
if (
  cc002Routing.changeControlId !== "STRATTON-CC-002" ||
  cc002Routing.recordType !== "STRATTON_DETERMINISTIC_MODEL_ROUTING_CONTRACT"
) {
  throw new Error("CC002_ROUTING_CONTRACT_INVALID");
}
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
  if (
    approved.operationId === "requestAnalysis" &&
    actualRoles !== "DealContributor"
  ) {
    throw new Error("PHASE3_BASELINE_ANALYSIS_ROLE_MISMATCH");
  }
  if (approved.operationId !== "requestAnalysis" && expectedRoles !== actualRoles) {
    throw new Error(`PHASE3_ROLE_MISMATCH:${approved.operationId}`);
  }
}
if ([...approvedOperations.find((item) => item.operationId === "requestAnalysis").roles]
  .sort()
  .join(",") !== analysisRoles.sort().join(",")) {
  throw new Error("CC002_ANALYSIS_ROLE_OVERLAY_MISMATCH");
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
