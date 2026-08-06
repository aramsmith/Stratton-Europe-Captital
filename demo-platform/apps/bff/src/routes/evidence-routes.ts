import { Router, type Response } from "express";
import { z } from "zod";
import { DemoHttpError } from "../errors.js";
import type { EvidenceService } from "../evidence/evidence-service.js";
import type { RequestAuthorizer } from "../server-authorization.js";

const evidenceAdmissionPayloadSchema = z
  .object({
    caseId: z.string().trim().min(1)
  })
  .strict();

export interface EvidenceRouteDependencies {
  readonly evidenceService: Pick<EvidenceService, "admit">;
  readonly authorization: RequestAuthorizer;
}

export function createEvidenceRouter(dependencies: EvidenceRouteDependencies): Router {
  const router = Router();

  router.post("/api/evidence/:evidenceId/admit", async (request, response) => {
    const payload = evidenceAdmissionPayloadSchema.safeParse(request.body);
    if (!payload.success) {
      throw new DemoHttpError(400, "INVALID_CONTRACT");
    }
    dependencies.authorization.require(
      response,
      "project-danube",
      "Stratton.Demo.Analyst"
    );

    const scenario = await dependencies.evidenceService.admit({
      ...payload.data,
      evidenceId: request.params.evidenceId,
      correlationId: getCorrelationId(response)
    });

    response.status(200).json({ scenario });
  });

  return router;
}

function getCorrelationId(response: Response): string {
  return typeof response.locals.correlationId === "string"
    ? response.locals.correlationId
    : "unknown";
}
