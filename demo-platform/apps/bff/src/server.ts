import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import express, { type Express } from "express";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { parseDemoConfig } from "./config.js";
import { mapDemoError } from "./errors.js";
import {
  createScenarioRouter,
  type ScenarioRouteDependencies
} from "./routes/scenario-routes.js";
import { InMemoryScenarioRepository } from "./scenario/in-memory-scenario-repository.js";
import { ScenarioService } from "./scenario/scenario-service.js";

export type DemoServerDependencies = ScenarioRouteDependencies;

export function createDemoServer(dependencies: DemoServerDependencies): Express {
  const app = express();

  app.use(express.json());
  app.use((request, response, next) => {
    const correlationId = request.header("x-correlation-id") ?? randomUUID();
    response.setHeader("x-correlation-id", correlationId);
    response.locals.correlationId = correlationId;
    next();
  });

  app.get("/healthz", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.use(createScenarioRouter(dependencies));

  app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    void next;
    const mapped = mapDemoError(error, response.locals.correlationId as string);
    response.status(mapped.status).json({
      code: mapped.code,
      message: mapped.message,
      correlationId: mapped.correlationId
    });
  });

  return app;
}

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectRun) {
  const config = parseDemoConfig();

  createDemoServer({
    scenarioService: new ScenarioService(
      new InMemoryScenarioRepository(createProjectDanubeState())
    )
  }).listen(config.PORT, () => {
    console.log(`Stratton demo BFF listening on ${config.PORT}`);
  });
}
