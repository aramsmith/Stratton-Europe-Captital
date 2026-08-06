export const approvedOperations = [
  { operationId: "createCase", method: "POST", path: "/v1/cases", roles: ["DealInitiator"] },
  {
    operationId: "registerSource",
    method: "POST",
    path: "/v1/cases/{caseId}/sources",
    roles: ["SourceOwner"]
  },
  {
    operationId: "createExternalLicenceDecision",
    method: "POST",
    path: "/v1/sources/{sourceId}/licence-decisions",
    roles: ["LegalApprover", "DataOwner"]
  },
  {
    operationId: "requestIngestion",
    method: "POST",
    path: "/v1/cases/{caseId}/ingestions",
    roles: ["DealContributor"]
  },
  {
    operationId: "admitEvidence",
    method: "POST",
    path: "/v1/evidence/{evidenceId}/admission",
    roles: ["DataSteward"]
  },
  {
    operationId: "requestAnalysis",
    method: "POST",
    path: "/v1/cases/{caseId}/analysis-runs",
    roles: ["DealContributor"]
  },
  {
    operationId: "getAnalysisStatus",
    method: "GET",
    path: "/v1/analysis-runs/{analysisRunId}",
    roles: ["CaseReader"]
  },
  {
    operationId: "submitReview",
    method: "POST",
    path: "/v1/cases/{caseId}/reviews",
    roles: ["DealReviewer", "LegalApprover", "ComplianceApprover"]
  },
  {
    operationId: "prepareDraft",
    method: "POST",
    path: "/v1/cases/{caseId}/draft-recommendations",
    roles: ["DealReviewer"]
  },
  {
    operationId: "exportValidationEvidence",
    method: "POST",
    path: "/v1/validation-exports",
    roles: ["ValidationProducer"]
  },
  {
    operationId: "recordVerdict",
    method: "POST",
    path: "/assurance/v1/verdicts",
    roles: ["InternalAuditValidator"]
  }
] as const;

export const approvedOperationIds = approvedOperations.map((operation) => operation.operationId);

export const approvedErrorCodes = [
  "INVALID_CONTRACT",
  "UNAUTHENTICATED",
  "POLICY_DENIED",
  "STATE_CONFLICT",
  "EVIDENCE_INCOMPLETE",
  "CAPACITY_LIMIT",
  "DEPENDENCY_UNAVAILABLE"
] as const;
