import {
  analysisRunRequestSchema,
  findingDispositionRequestSchema
} from "@stratton/contracts";
import { Router, type Request, type Response } from "express";
import { DemoHttpError } from "../errors.js";
import type { AnalysisService } from "../analysis/analysis-service.js";

export interface AnalysisRouteDependencies {
  readonly analysisService: Pick<AnalysisService, "run" | "recordDisposition">;
}

export function createAnalysisRouter(dependencies: AnalysisRouteDependencies): Router {
  const router = Router();

  router.post("/api/analysis-runs", async (request, response) => {
    const payload = analysisRunRequestSchema.safeParse(request.body);
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
    const payload = findingDispositionRequestSchema.safeParse(request.body);
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
