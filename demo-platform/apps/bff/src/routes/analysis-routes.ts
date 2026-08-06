import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { DemoHttpError } from "../errors.js";
import type { AnalysisService } from "../analysis/analysis-service.js";

const analysisRunPayloadSchema = z
  .object({
    caseId: z.string().trim().min(1),
    taskClass: z.enum([
      "EVIDENCE_TRIAGE",
      "QUERY_REWRITE",
      "FIRST_PASS_SUMMARY",
      "GROUNDED_ANALYSIS",
      "CROSS_DOCUMENT_COMPARISON",
      "ESG_NORMALISATION",
      "COMPLEX_RISK_SYNTHESIS",
      "INVESTMENT_THESIS_CHALLENGE"
    ]),
    question: z.string().trim().min(1)
  })
  .strict();

const findingDispositionPayloadSchema = z
  .object({
    caseId: z.string().trim().min(1),
    action: z.enum(["ACCEPT", "EDIT", "CHALLENGE", "REJECT"]),
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

export interface AnalysisRouteDependencies {
  readonly analysisService: Pick<AnalysisService, "run" | "recordDisposition">;
}

export function createAnalysisRouter(dependencies: AnalysisRouteDependencies): Router {
  const router = Router();

  router.post("/api/analysis-runs", async (request, response) => {
    const payload = analysisRunPayloadSchema.safeParse(request.body);
    if (!payload.success) {
      throw new DemoHttpError(400, "INVALID_CONTRACT");
    }

    response.status(200).json(
      await dependencies.analysisService.run({
        ...payload.data,
        correlationId: getCorrelationId(response)
      })
    );
  });

  router.post("/api/findings/:findingId/disposition", async (request, response) => {
    const payload = findingDispositionPayloadSchema.safeParse(request.body);
    if (!payload.success) {
      throw new DemoHttpError(400, "INVALID_CONTRACT");
    }

    const scenario = await dependencies.analysisService.recordDisposition({
      ...payload.data,
      findingId: request.params.findingId,
      principalType: getPrincipalType(request),
      correlationId: getCorrelationId(response)
    });

    response.status(200).json({ scenario });
  });

  return router;
}

function getPrincipalType(request: Request): "HUMAN" | "SERVICE" {
  return request.header("x-demo-principal-type")?.toUpperCase() === "HUMAN"
    ? "HUMAN"
    : "SERVICE";
}

function getCorrelationId(response: Response): string {
  return typeof response.locals.correlationId === "string"
    ? response.locals.correlationId
    : "unknown";
}
