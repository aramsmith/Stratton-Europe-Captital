import { evidenceAdmissionRequestSchema } from "@stratton/contracts";
import { Router, type Response } from "express";
import { DemoHttpError } from "../errors.js";
import type { EvidenceService } from "../evidence/evidence-service.js";

export interface EvidenceRouteDependencies {
  readonly evidenceService: Pick<EvidenceService, "admit">;
}

export function createEvidenceRouter(dependencies: EvidenceRouteDependencies): Router {
  const router = Router();

  router.post("/api/evidence/:evidenceId/admit", async (request, response) => {
    const payload = evidenceAdmissionRequestSchema.safeParse(request.body);
    if (!payload.success) {
      throw new DemoHttpError(400, "INVALID_CONTRACT");
    }

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
