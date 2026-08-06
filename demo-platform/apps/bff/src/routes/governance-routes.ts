import { Router } from "express";
import { z } from "zod";
import { DemoHttpError } from "../errors.js";
import type { GovernanceService } from "../governance/governance-service.js";
import type { RequestAuthorizer } from "../server-authorization.js";

export interface GovernanceRouteDependencies {
  readonly governanceService: Pick<
    GovernanceService,
    "getView" | "recordSecurityGateEvidence"
  >;
  readonly authorization: RequestAuthorizer;
}

const securityGateRunRequestSchema = z
  .object({
    caseId: z.literal("project-danube")
  })
  .strict();

export function createGovernanceRouter(dependencies: GovernanceRouteDependencies): Router {
  const router = Router();

  router.get("/api/governance", async (_request, response) => {
    dependencies.authorization.require(response, "project-danube");
    response.json(await dependencies.governanceService.getView("project-danube"));
  });

  router.post("/api/governance/security-gates/run", async (request, response) => {
    const payload = securityGateRunRequestSchema.safeParse(request.body);
    if (!payload.success) {
      throw new DemoHttpError(400, "INVALID_CONTRACT");
    }
    dependencies.authorization.require(
      response,
      payload.data.caseId,
      "Stratton.Demo.GovernanceOperator"
    );
    const scenario = await dependencies.governanceService.recordSecurityGateEvidence({
      caseId: payload.data.caseId,
      correlationId:
        typeof response.locals.correlationId === "string"
          ? response.locals.correlationId
          : "unknown"
    });
    response.status(200).json({ scenario });
  });

  return router;
}
