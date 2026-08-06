import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import express, { type Express } from "express";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { AnalysisService } from "./analysis/analysis-service.js";
import { parseDemoConfig } from "./config.js";
import { EvidenceService } from "./evidence/evidence-service.js";
import { DemoHttpError, mapDemoError } from "./errors.js";
import type { Phase5Client } from "./phase5/phase5-client.js";
import {
  createAnalysisRouter,
  type AnalysisRouteDependencies
} from "./routes/analysis-routes.js";
import {
  createEvidenceRouter,
  type EvidenceRouteDependencies
} from "./routes/evidence-routes.js";
import {
  createScenarioRouter,
  type ScenarioRouteDependencies
} from "./routes/scenario-routes.js";
import { InMemoryScenarioRepository } from "./scenario/in-memory-scenario-repository.js";
import { ScenarioService } from "./scenario/scenario-service.js";

export type DemoServerDependencies = ScenarioRouteDependencies &
  EvidenceRouteDependencies &
  AnalysisRouteDependencies;

export function createDemoServer(dependencies: DemoServerDependencies): Express {
  const app = express();

  app.use((request, response, next) => {
    setCorrelationId(response, request.header("x-correlation-id"));
    next();
  });
  app.use(express.json());

  app.get("/healthz", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.use(createScenarioRouter(dependencies));
  app.use(createEvidenceRouter(dependencies));
  app.use(createAnalysisRouter(dependencies));

  app.use((_request, _response, next) => {
    next(new DemoHttpError(404, "INVALID_CONTRACT", "Requested path does not match an approved route."));
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    void next;
    const mapped = mapDemoError(error, getCorrelationId(response));
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
  const repository = new InMemoryScenarioRepository(createProjectDanubeState());
  const phase5Client = createLocalPhase5Client();

  createDemoServer({
    scenarioService: new ScenarioService(repository),
    evidenceService: new EvidenceService({ repository, phase5Client }),
    analysisService: new AnalysisService({ repository, phase5Client })
  }).listen(config.PORT, () => {
    console.log(`Stratton demo BFF listening on ${config.PORT}`);
  });
}

function setCorrelationId(response: express.Response, suppliedCorrelationId?: string): string {
  const correlationId = suppliedCorrelationId ?? randomUUID();
  response.setHeader("x-correlation-id", correlationId);
  response.locals.correlationId = correlationId;
  return correlationId;
}

function getCorrelationId(response: express.Response): string {
  const existingCorrelationId = response.locals.correlationId;
  if (typeof existingCorrelationId === "string" && existingCorrelationId.length > 0) {
    return existingCorrelationId;
  }

  return setCorrelationId(response);
}

function createLocalPhase5Client(): Phase5Client {
  return {
    admitEvidence: async () => undefined,
    requestAnalysis: async (input) => ({
      analysisRunId: `local-analysis-${input.analysisRequestFingerprint.slice(0, 12)}`,
      status: "QUEUED"
    }),
    submitReview: async () => undefined,
    prepareDraft: async () => undefined
  };
}
