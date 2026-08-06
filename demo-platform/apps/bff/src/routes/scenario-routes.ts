import { Router } from "express";
import type { ScenarioService } from "../scenario/scenario-service.js";

export interface ScenarioRouteDependencies {
  readonly scenarioService: Pick<ScenarioService, "get" | "reset">;
}

export function createScenarioRouter(dependencies: ScenarioRouteDependencies): Router {
  const router = Router();

  router.get("/api/scenario", async (_request, response) => {
    response.json(await dependencies.scenarioService.get());
  });

  router.post("/api/scenario/reset", async (_request, response) => {
    response.status(200).json(await dependencies.scenarioService.reset());
  });

  return router;
}
