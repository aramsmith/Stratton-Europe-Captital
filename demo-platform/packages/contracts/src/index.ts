import { z } from "zod";

export const modelRouteSchema = z.enum(["LUNA", "TERRA", "SOL"]);
export type ModelRoute = z.infer<typeof modelRouteSchema>;
export const provenanceStatusSchema = z.enum(["PENDING", "VERIFIED"]);
export type ProvenanceStatus = z.infer<typeof provenanceStatusSchema>;

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
    textHistory: z.array(findingTextVersionSchema).default([])
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

export const scenarioStateSchema = z
  .object({
    caseId: z.literal("project-danube"),
    stage: z.enum(["INTAKE", "ANALYSIS", "REVIEW", "COMMITTEE_PREPARATION"]),
    evidence: z
      .array(
        z
          .object({
            evidenceId: z.string().min(1),
            title: z.string().min(1),
            domain: z.enum(["FINANCIAL", "COMMERCIAL", "LEGAL", "ESG", "OPERATIONAL"]),
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
            reviewType: z.enum(["DEAL", "LEGAL", "COMPLIANCE"]),
            decision: z.enum(["PENDING", "APPROVED", "REJECTED"]),
            findingId: z.string().min(1)
          })
          .strict()
      ),
    governanceEvents: z
      .array(
        z
          .object({
            eventId: z.string().min(1),
            type: z.string().min(1),
            outcome: z.enum(["ALLOW", "DENY", "SUCCESS", "FAILURE"]),
            occurredAtIso: z.string().datetime(),
            correlationId: z.string().min(1),
            detail: z.string().min(1).optional()
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

        if (evidence?.admissionStatus !== "ADMITTED") {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "MATERIAL_FINDING_CITATION_MUST_REFERENCE_ADMITTED_EVIDENCE",
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
    correlationId: z.string().min(1).default("unknown")
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
