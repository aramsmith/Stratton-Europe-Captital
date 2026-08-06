import { Router } from "express";
import { z } from "zod";
import type { RequestAuthorizer } from "../server-authorization.js";
import type { ScenarioService } from "../scenario/scenario-service.js";

const scenarioResetRequestSchema = z
  .object({
    fixture: z
      .enum([
        "BASELINE",
        "PROMPT_INJECTION",
        "EXPIRED_LICENCE",
        "MISSING_LICENCE"
      ])
      .optional()
  })
  .strict();

export interface ScenarioRouteDependencies {
  readonly scenarioService: Pick<ScenarioService, "get" | "reset">;
  readonly authorization: RequestAuthorizer;
}

export function createScenarioRouter(dependencies: ScenarioRouteDependencies): Router {
  const router = Router();

  router.get("/api/scenario", async (_request, response) => {
    dependencies.authorization.require(response, "project-danube");
    response.json(await dependencies.scenarioService.get());
  });

  router.post("/api/scenario/reset", async (request, response) => {
    const payload = scenarioResetRequestSchema.parse(request.body ?? {});
    dependencies.authorization.require(
      response,
      "project-danube",
      "Stratton.Demo.ScenarioResetter"
    );
    response.status(200).json(await dependencies.scenarioService.reset(payload.fixture));
  });

  return router;
}
