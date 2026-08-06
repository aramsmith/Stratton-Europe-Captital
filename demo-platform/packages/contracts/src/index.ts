import { z } from "zod";

export const modelRouteSchema = z.enum(["LUNA", "TERRA", "SOL"]);
export type ModelRoute = z.infer<typeof modelRouteSchema>;

export const citationSchema = z
  .object({
    citationId: z.string().min(1),
    evidenceId: z.string().min(1),
    locator: z.string().min(1),
    accessible: z.literal(true)
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
    citations: z.array(citationSchema)
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
            sourceLocator: z.string().min(1)
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
            correlationId: z.string().min(1)
          })
          .strict()
      )
  })
  .strict();

export type ScenarioState = z.infer<typeof scenarioStateSchema>;
export type EvidenceItem = ScenarioState["evidence"][number];
export type AnalysisFinding = ScenarioState["findings"][number];
export type ReviewRequirement = ScenarioState["reviews"][number];
export type GovernanceEvent = ScenarioState["governanceEvents"][number];

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
