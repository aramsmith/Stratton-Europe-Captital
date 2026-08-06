import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { DemoHttpError } from "../errors.js";
import type { ReviewService } from "../reviews/review-service.js";

const reviewSubmissionPayloadSchema = z
  .object({
    caseId: z.string().trim().min(1),
    reviewType: z.enum(["DEAL", "LEGAL", "COMPLIANCE"]),
    decision: z.enum(["APPROVED", "REJECTED"]),
    rationale: z.string().trim().min(1),
    subjectVersion: z.string().min(1)
  })
  .strict();

const recommendationPreparationPayloadSchema = z
  .object({
    caseId: z.string().trim().min(1)
  })
  .strict();

export interface ReviewRouteDependencies {
  readonly reviewService: Pick<ReviewService, "submitReview" | "prepareRecommendation">;
}

export function createReviewRouter(dependencies: ReviewRouteDependencies): Router {
  const router = Router();

  router.post("/api/findings/:findingId/reviews", async (request, response) => {
    const payload = reviewSubmissionPayloadSchema.safeParse(request.body);
    if (!payload.success) {
      throw new DemoHttpError(400, "INVALID_CONTRACT");
    }

    const scenario = await dependencies.reviewService.submitReview({
      ...payload.data,
      findingId: request.params.findingId,
      principalType: getPrincipalType(request),
      correlationId: getCorrelationId(response)
    });

    response.status(200).json({ scenario });
  });

  router.post("/api/recommendation/prepare", async (request, response) => {
    const payload = recommendationPreparationPayloadSchema.safeParse(request.body);
    if (!payload.success) {
      throw new DemoHttpError(400, "INVALID_CONTRACT");
    }

    const scenario = await dependencies.reviewService.prepareRecommendation({
      ...payload.data,
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
