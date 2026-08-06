import { Router, type Response } from "express";
import { z } from "zod";
import { DemoHttpError } from "../errors.js";
import type { ReviewService } from "../reviews/review-service.js";
import type { RequestAuthorizer } from "../server-authorization.js";

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
  readonly authorization: RequestAuthorizer;
}

export function createReviewRouter(dependencies: ReviewRouteDependencies): Router {
  const router = Router();

  router.post("/api/findings/:findingId/reviews", async (request, response) => {
    const payload = reviewSubmissionPayloadSchema.safeParse(request.body);
    if (!payload.success) {
      throw new DemoHttpError(400, "INVALID_CONTRACT");
    }
    const identity = dependencies.authorization.require(
      response,
      payload.data.caseId,
      roleForReviewType(payload.data.reviewType)
    );

    const scenario = await dependencies.reviewService.submitReview({
      ...payload.data,
      findingId: request.params.findingId,
      principalType: identity.principalType,
      correlationId: getCorrelationId(response)
    });

    response.status(200).json({ scenario });
  });

  router.post("/api/recommendation/prepare", async (request, response) => {
    const payload = recommendationPreparationPayloadSchema.safeParse(request.body);
    if (!payload.success) {
      throw new DemoHttpError(400, "INVALID_CONTRACT");
    }
    const identity = dependencies.authorization.require(
      response,
      payload.data.caseId,
      "Stratton.Demo.CommitteePreparer"
    );

    const scenario = await dependencies.reviewService.prepareRecommendation({
      ...payload.data,
      principalType: identity.principalType,
      correlationId: getCorrelationId(response)
    });

    response.status(200).json({ scenario });
  });

  return router;
}

function roleForReviewType(
  reviewType: "DEAL" | "LEGAL" | "COMPLIANCE"
):
  | "Stratton.Demo.DealReviewer"
  | "Stratton.Demo.LegalReviewer"
  | "Stratton.Demo.ComplianceReviewer" {
  switch (reviewType) {
    case "DEAL":
      return "Stratton.Demo.DealReviewer";
    case "LEGAL":
      return "Stratton.Demo.LegalReviewer";
    case "COMPLIANCE":
      return "Stratton.Demo.ComplianceReviewer";
  }
}

function getCorrelationId(response: Response): string {
  return typeof response.locals.correlationId === "string"
    ? response.locals.correlationId
    : "unknown";
}
