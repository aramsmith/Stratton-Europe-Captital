import { z } from "zod";

export const modelRouteSchema = z.enum(["LUNA", "TERRA", "SOL"]);
export type ModelRoute = z.infer<typeof modelRouteSchema>;
export const provenanceStatusSchema = z.enum(["PENDING", "VERIFIED"]);
export type ProvenanceStatus = z.infer<typeof provenanceStatusSchema>;
export const authorityGateRoleSchema = z.enum(["HUMAN_ANALYST_REVIEW_GATE"]);
export type AuthorityGateRole = z.infer<typeof authorityGateRoleSchema>;

export const analysisTaskClassSchema = z.enum([
  "EVIDENCE_TRIAGE",
  "QUERY_REWRITE",
  "FIRST_PASS_SUMMARY",
  "GROUNDED_ANALYSIS",
  "CROSS_DOCUMENT_COMPARISON",
  "ESG_NORMALISATION",
  "COMPLEX_RISK_SYNTHESIS",
  "INVESTMENT_THESIS_CHALLENGE"
]);
export type AnalysisTaskClass = z.infer<typeof analysisTaskClassSchema>;
export const reviewTypeSchema = z.enum(["DEAL", "LEGAL", "COMPLIANCE"]);
export type ReviewType = z.infer<typeof reviewTypeSchema>;
export const reviewDecisionSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export const reviewSubmissionDecisionSchema = z.enum(["APPROVED", "REJECTED"]);
export type ReviewSubmissionDecision = z.infer<typeof reviewSubmissionDecisionSchema>;
export const evidenceDomainSchema = z.enum([
  "FINANCIAL",
  "COMMERCIAL",
  "LEGAL",
  "ESG",
  "OPERATIONAL"
]);
export type EvidenceDomain = z.infer<typeof evidenceDomainSchema>;
const dealReviewDomains: readonly EvidenceDomain[] = [
  "FINANCIAL",
  "COMMERCIAL",
  "OPERATIONAL"
];
const complianceReviewDomains: readonly EvidenceDomain[] = [
  "LEGAL",
  "ESG",
  "OPERATIONAL"
];

export function getEligibleReviewTypesForDomains(
  domains: readonly EvidenceDomain[]
): ReviewType[] {
  const domainSet = new Set(domains);
  const reviewTypes: ReviewType[] = [];

  if (dealReviewDomains.some((domain) => domainSet.has(domain))) {
    reviewTypes.push("DEAL");
  }
  if (domainSet.has("LEGAL")) {
    reviewTypes.push("LEGAL");
  }
  if (complianceReviewDomains.some((domain) => domainSet.has(domain))) {
    reviewTypes.push("COMPLIANCE");
  }

  return reviewTypes;
}

export const citationSchema = z
  .object({
    citationId: z.string().min(1),
    evidenceId: z.string().min(1),
    locator: z.string().min(1),
    accessible: z.literal(true)
  })
  .strict();

export const findingTextVersionSchema = z
  .object({
    versionId: z.string().min(1),
    actorType: z.enum(["AI", "HUMAN"]),
    action: z.enum(["GENERATED", "EDITED", "ACCEPTED", "CHALLENGED", "REJECTED"]),
    summary: z.string().min(1),
    occurredAtIso: z.string().datetime()
  })
  .strict();

export const findingSchema = z
  .object({
    findingId: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    materiality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    status: z.enum(["DRAFT", "ACCEPTED", "CHALLENGED", "REJECTED"]),
    route: modelRouteSchema.optional(),
    citations: z.array(citationSchema),
    originalAiSummary: z.string().min(1).optional(),
    textHistory: z.array(findingTextVersionSchema).default([]),
    analysisRunId: z.string().min(1).optional(),
    analysisRequestFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    authorityGateRole: authorityGateRoleSchema.optional(),
    projectionVersion: z.string().regex(/^[a-f0-9]{64}$/).optional()
  })
  .strict()
  .superRefine((finding, context) => {
    if (
      (finding.materiality === "HIGH" || finding.materiality === "CRITICAL") &&
      finding.citations.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "MATERIAL_FINDING_REQUIRES_CITATION"
      });
    }
  });

export const analysisRunMetadataSchema = z
  .object({
    analysisRunId: z.string().min(1),
    route: modelRouteSchema,
    taskClass: analysisTaskClassSchema,
    analystQuestion: z.string().min(1),
    questionHash: z.string().regex(/^[a-f0-9]{64}$/),
    admittedEvidenceIds: z.array(z.string().min(1)).min(1),
    evidenceSetHash: z.string().regex(/^[a-f0-9]{64}$/),
    analysisRequestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    promptTemplateVersion: z.string().min(1),
    authorityGateRole: authorityGateRoleSchema
  })
  .strict();
export type AnalysisRunMetadata = z.infer<typeof analysisRunMetadataSchema>;

export const analysisAuthoritySchema = z
  .object({
    analysisBundleId: z.string().min(1),
    evidenceManifestHash: z.string().min(1),
    subjectVersion: z.string().min(1),
    status: z.literal("DRAFT_ONLY_READY")
  })
  .strict();
export type AnalysisAuthority = z.infer<typeof analysisAuthoritySchema>;

export const governanceEventMetadataSchema = z
  .object({
    analysisRequestFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    questionHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    evidenceSetHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    taskClass: analysisTaskClassSchema.optional(),
    route: modelRouteSchema.optional(),
    phase5RunId: z.string().min(1).optional(),
    authorityGateRole: authorityGateRoleSchema.optional(),
    findingIds: z.array(z.string().min(1)).optional(),
    operationId: z.string().min(1).optional(),
    payloadHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    subjectVersion: z.string().min(1).optional(),
    securityGateId: z.string().min(1).optional(),
    securityGateEvidenceId: z.string().min(1).optional()
  })
  .strict();

export const scenarioStateSchema = z
  .object({
    caseId: z.literal("project-danube"),
    analysisCycleId: z.string().min(1).default("project-danube-cycle-1"),
    stage: z.enum(["INTAKE", "ANALYSIS", "REVIEW", "COMMITTEE_PREPARATION"]),
    evidence: z
      .array(
        z
          .object({
            evidenceId: z.string().min(1),
            title: z.string().min(1),
            domain: evidenceDomainSchema,
            admissionStatus: z.enum(["QUARANTINED", "ADMITTED", "REJECTED"]),
            owner: z.string().min(1),
            licenceStatus: z.enum(["APPROVED", "NOT_REQUIRED", "EXPIRED", "MISSING"]),
            provenanceStatus: provenanceStatusSchema.default("PENDING"),
            sourceLocator: z.string().min(1),
            sourcePreview: z.string().min(1).optional()
          })
          .strict()
      ),
    findings: z.array(findingSchema),
    reviews: z
      .array(
        z
          .object({
            reviewId: z.string().min(1),
            reviewType: reviewTypeSchema,
            decision: reviewDecisionSchema,
            findingId: z.string().min(1),
            subjectVersion: z.string().min(1),
            projectionVersion: z.string().min(1).optional()
          })
          .strict()
      ),
    latestAnalysisRun: analysisRunMetadataSchema.optional(),
    analysisAuthority: analysisAuthoritySchema.optional(),
    governanceEvents: z
      .array(
        z
          .object({
            eventId: z.string().min(1),
            type: z.string().min(1),
            outcome: z.enum(["ALLOW", "DENY", "SUCCESS", "FAILURE"]),
            occurredAtIso: z.string().datetime(),
            correlationId: z.string().min(1),
            detail: z.string().min(1).optional(),
            metadata: governanceEventMetadataSchema.optional()
          })
          .strict()
      )
  })
  .strict()
  .superRefine((scenario, context) => {
    const evidenceById = new Map(
      scenario.evidence.map((evidence) => [evidence.evidenceId, evidence] as const)
    );

    scenario.findings.forEach((finding, findingIndex) => {
      if (finding.materiality !== "HIGH" && finding.materiality !== "CRITICAL") {
        return;
      }

      finding.citations.forEach((citation, citationIndex) => {
        const evidence = evidenceById.get(citation.evidenceId);

        if (
          evidence?.admissionStatus !== "ADMITTED" ||
          (evidence.licenceStatus !== "APPROVED" &&
            evidence.licenceStatus !== "NOT_REQUIRED")
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              evidence?.admissionStatus !== "ADMITTED"
                ? "MATERIAL_FINDING_CITATION_MUST_REFERENCE_ADMITTED_EVIDENCE"
                : "MATERIAL_FINDING_CITATION_REQUIRES_VALID_LICENCE",
            path: ["findings", findingIndex, "citations", citationIndex, "evidenceId"]
          });
        }
      });
    });
  });

export type ScenarioState = z.infer<typeof scenarioStateSchema>;
export type EvidenceItem = ScenarioState["evidence"][number];
export type AnalysisFinding = ScenarioState["findings"][number];
export type ReviewRequirement = ScenarioState["reviews"][number];
export type GovernanceEvent = ScenarioState["governanceEvents"][number];
export type FindingTextVersion = z.infer<typeof findingTextVersionSchema>;

export const evidenceAdmissionRequestSchema = z
  .object({
    caseId: z.literal("project-danube")
  })
  .strict();
export type EvidenceAdmissionRequest = z.infer<typeof evidenceAdmissionRequestSchema>;

export const scenarioMutationResponseSchema = z
  .object({
    scenario: scenarioStateSchema
  })
  .strict();
export type ScenarioMutationResponse = z.infer<typeof scenarioMutationResponseSchema>;

export const analysisRunRequestSchema = z
  .object({
    caseId: z.literal("project-danube"),
    taskClass: analysisTaskClassSchema,
    question: z.string().trim().min(1)
  })
  .strict();
export type AnalysisRunRequest = z.infer<typeof analysisRunRequestSchema>;

export const analysisRunResponseSchema = z
  .object({
    analysisRunId: z.string().min(1),
    route: modelRouteSchema,
    scenario: scenarioStateSchema,
    findings: z.array(findingSchema),
    correlationId: z.string().min(1).default("unknown"),
    analysisMetadata: analysisRunMetadataSchema
  })
  .strict();
export type AnalysisRunResponse = z.infer<typeof analysisRunResponseSchema>;

export const findingDispositionActionSchema = z.enum(["ACCEPT", "EDIT", "CHALLENGE", "REJECT"]);
export type FindingDispositionAction = z.infer<typeof findingDispositionActionSchema>;

export const findingDispositionRequestSchema = z
  .object({
    caseId: z.literal("project-danube"),
    action: findingDispositionActionSchema,
    editedSummary: z.string().trim().min(1).optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === "EDIT" && !value.editedSummary) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "EDIT_REQUIRES_EDITED_SUMMARY",
        path: ["editedSummary"]
      });
    }
  });
export type FindingDispositionRequest = z.infer<typeof findingDispositionRequestSchema>;

export const reviewSubmissionRequestSchema = z
  .object({
    caseId: z.literal("project-danube"),
    reviewType: reviewTypeSchema,
    decision: reviewSubmissionDecisionSchema,
    rationale: z.string().trim().min(1),
    subjectVersion: z.string().min(1)
  })
  .strict();
export type ReviewSubmissionRequest = z.infer<typeof reviewSubmissionRequestSchema>;

export const recommendationPreparationRequestSchema = z
  .object({
    caseId: z.literal("project-danube")
  })
  .strict();
export type RecommendationPreparationRequest = z.infer<
  typeof recommendationPreparationRequestSchema
>;

export const securityGateRunRequestSchema = z
  .object({
    caseId: z.literal("project-danube")
  })
  .strict();
export type SecurityGateRunRequest = z.infer<typeof securityGateRunRequestSchema>;

export const securityGateOutcomeSchema = z.enum(["PASS", "FAIL", "NOT_RUN", "STALE"]);
export type SecurityGateOutcome = z.infer<typeof securityGateOutcomeSchema>;
export const mandatorySecurityGateBindings: readonly Readonly<{
  gateId: string;
  evidenceId: string;
}>[] = Array.from({ length: 12 }, (_, index) => {
  const ordinal = String(index + 1).padStart(3, "0");
  return {
    gateId: `CC002-R2-SEC-GATE-${ordinal}`,
    evidenceId: `STRATTON-DEMO-SEC-GATE-${ordinal}-v1`
  };
});
export const auditExportStatusSchema = z.enum(["READY", "BLOCKED"]);
export type AuditExportStatus = z.infer<typeof auditExportStatusSchema>;
export const governanceDecisionResultSchema = z.enum(["ALLOW", "DENY", "SUCCESS", "FAILURE"]);
export type GovernanceDecisionResult = z.infer<typeof governanceDecisionResultSchema>;
export const governanceAssuranceStatusSchema = z.enum(["CURRENT", "STALE", "PENDING"]);
export type GovernanceAssuranceStatus = z.infer<typeof governanceAssuranceStatusSchema>;

export const governanceLineageNodeSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    sourceLocators: z.array(z.string().min(1)),
    evidenceIds: z.array(z.string().min(1)),
    modelRoute: modelRouteSchema,
    reviewTypes: z.array(reviewTypeSchema),
    reviewVersionIds: z.array(z.string().min(1)),
    policyDecisionIds: z.array(z.string().min(1)),
    recommendationIds: z.array(z.string().min(1)),
    assuranceStatus: governanceAssuranceStatusSchema,
    historicalReviewTypes: z.array(reviewTypeSchema),
    historicalReviewVersionIds: z.array(z.string().min(1)),
    historicalPolicyDecisionIds: z.array(z.string().min(1)),
    historicalRecommendationIds: z.array(z.string().min(1))
  })
  .strict();
export type GovernanceLineageNode = z.infer<typeof governanceLineageNodeSchema>;

export const governancePolicyDecisionSchema = z
  .object({
    decisionId: z.string().min(1),
    policyType: z.string().min(1),
    result: governanceDecisionResultSchema,
    reasonCodes: z.array(z.string().min(1)),
    version: z.string().min(1),
    correlationId: z.string().min(1),
    relatedFindingIds: z.array(z.string().min(1)),
    occurredAtIso: z.string().datetime()
  })
  .strict();
export type GovernancePolicyDecision = z.infer<typeof governancePolicyDecisionSchema>;

export const governanceModelRouteSchema = z
  .object({
    routeId: z.string().min(1),
    taskClass: analysisTaskClassSchema,
    modelRoute: modelRouteSchema,
    analysisRunId: z.string().min(1),
    authorityGateRole: authorityGateRoleSchema,
    primaryEvidenceIds: z.array(z.string().min(1)),
    recoveryEvidenceIds: z.array(z.string().min(1)),
    correlationId: z.string().min(1),
    analysisRequestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    questionHash: z.string().regex(/^[a-f0-9]{64}$/),
    evidenceSetHash: z.string().regex(/^[a-f0-9]{64}$/),
    promptTemplateVersion: z.string().min(1),
    routeEventIds: z.array(z.string().min(1))
  })
  .strict();
export type GovernanceModelRoute = z.infer<typeof governanceModelRouteSchema>;

export const governanceSecurityGateSchema = z
  .object({
    gateId: z.string().min(1),
    name: z.string().min(1),
    outcome: securityGateOutcomeSchema,
    evidenceId: z.string().min(1).optional(),
    failClosedOutcome: z.string().min(1)
  })
  .strict();
export type GovernanceSecurityGate = z.infer<typeof governanceSecurityGateSchema>;

export const auditExportPreviewSchema = z
  .object({
    status: auditExportStatusSchema,
    missingItems: z.array(z.string().min(1)),
    previewSections: z.array(z.string().min(1))
  })
  .strict();
export type AuditExportPreview = z.infer<typeof auditExportPreviewSchema>;

export const governanceViewSchema = z
  .object({
    lineage: z.array(governanceLineageNodeSchema),
    policyDecisions: z.array(governancePolicyDecisionSchema),
    modelRoutes: z.array(governanceModelRouteSchema),
    securityGates: z.array(governanceSecurityGateSchema),
    auditExport: auditExportPreviewSchema
  })
  .strict();
export type GovernanceView = z.infer<typeof governanceViewSchema>;

export interface DemoApiError {
  readonly code:
    | "INVALID_CONTRACT"
    | "UNAUTHENTICATED"
    | "POLICY_DENIED"
    | "STATE_CONFLICT"
    | "EVIDENCE_INCOMPLETE"
    | "DEPENDENCY_UNAVAILABLE";
  readonly message: string;
  readonly correlationId: string;
}
