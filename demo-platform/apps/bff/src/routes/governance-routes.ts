import { Router } from "express";
import type { GovernanceService } from "../governance/governance-service.js";

export interface GovernanceRouteDependencies {
  readonly governanceService: Pick<GovernanceService, "getView">;
}

export function createGovernanceRouter(dependencies: GovernanceRouteDependencies): Router {
  const router = Router();

  router.get("/api/governance", async (_request, response) => {
    response.json(await dependencies.governanceService.getView("project-danube"));
  });

  return router;
}
