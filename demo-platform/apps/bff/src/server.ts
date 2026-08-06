import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import express, { type Express } from "express";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { AnalysisService } from "./analysis/analysis-service.js";
import { buildApprovedDeployments, parseAzureDemoConfig } from "./azure/azure-config.js";
import { createBlobEvidenceAdapter } from "./azure/blob-evidence-adapter.js";
import { createDocumentIntelligenceAdapter } from "./azure/document-intelligence-adapter.js";
import { createOpenAiAdapter } from "./azure/openai-analysis-adapter.js";
import { createSearchAdapter } from "./azure/search-adapter.js";
import { createServiceBusAdapter } from "./azure/service-bus-adapter.js";
import { createAzureWorkflowClient } from "./azure/azure-workflow-client.js";
import { parseDemoConfig } from "./config.js";
import { EvidenceService } from "./evidence/evidence-service.js";
import { DemoHttpError, mapDemoError } from "./errors.js";
import { GovernanceService } from "./governance/governance-service.js";
import type { Phase5Client } from "./phase5/phase5-client.js";
import {
  AzureSqlScenarioRepository,
  createManagedIdentitySqlExecutor
} from "./repositories/azure-sql-scenario-repository.js";
import {
  createAnalysisRouter,
  type AnalysisRouteDependencies
} from "./routes/analysis-routes.js";
import {
  createEvidenceRouter,
  type EvidenceRouteDependencies
} from "./routes/evidence-routes.js";
import {
  createGovernanceRouter,
  type GovernanceRouteDependencies
} from "./routes/governance-routes.js";
import {
  createReviewRouter,
  type ReviewRouteDependencies
} from "./routes/review-routes.js";
import {
  createScenarioRouter,
  type ScenarioRouteDependencies
} from "./routes/scenario-routes.js";
import { ReviewService } from "./reviews/review-service.js";
import { InMemoryScenarioRepository } from "./scenario/in-memory-scenario-repository.js";
import type { ScenarioRepository } from "./scenario/scenario-repository.js";
import { ScenarioService } from "./scenario/scenario-service.js";
import { createRedactedLogger, type RedactedLogger } from "./telemetry/redacted-logger.js";

export type DemoServerDependencies = ScenarioRouteDependencies &
  EvidenceRouteDependencies &
  AnalysisRouteDependencies &
  ReviewRouteDependencies &
  GovernanceRouteDependencies;

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
  app.use(createReviewRouter(dependencies));
  app.use(createGovernanceRouter(dependencies));

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
  void startServer();
}

async function startServer(): Promise<void> {
  try {
    const config = parseDemoConfig();
    const logger = createRedactedLogger();
    const repository = await createScenarioRepository(config);
    const phase5Client = createWorkflowClient(config, logger);

    createDemoServer({
      scenarioService: new ScenarioService(repository),
      evidenceService: new EvidenceService({ repository, phase5Client }),
      analysisService: new AnalysisService({ repository, phase5Client }),
      reviewService: new ReviewService({ repository, phase5Client }),
      governanceService: new GovernanceService({ repository })
    }).listen(config.PORT, () => {
      console.log(`Stratton demo BFF listening on ${config.PORT}`);
    });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
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

export function createLocalPhase5Client(): Phase5Client {
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

type AzureDemoConfig = ReturnType<typeof parseAzureDemoConfig>;

interface WorkflowClientFactoryOverrides {
  readonly createLocalPhase5Client?: typeof createLocalPhase5Client;
  readonly parseAzureConfig?: typeof parseAzureDemoConfig;
  readonly createAzureAdapters?: typeof createAzureAdapters;
  readonly createAzureWorkflowClient?: typeof createAzureWorkflowClient;
}

export function createWorkflowClient(
  config: ReturnType<typeof parseDemoConfig>,
  logger: RedactedLogger,
  overrides: WorkflowClientFactoryOverrides = {}
): Phase5Client {
  if (config.DEMO_MODE === "LOCAL") {
    return (overrides.createLocalPhase5Client ?? createLocalPhase5Client)();
  }

  const azureConfig = (overrides.parseAzureConfig ?? parseAzureDemoConfig)();
  const adapters = (overrides.createAzureAdapters ?? createAzureAdapters)(azureConfig, logger);

  return (overrides.createAzureWorkflowClient ?? createAzureWorkflowClient)({
    tenantId: azureConfig.DEMO_TENANT_ID,
    caseId: "project-danube",
    evidenceCatalog: buildEvidenceCatalog(createProjectDanubeState()),
    ...adapters,
    logger: logger.child({ dependency: "workflow" })
  });
}

async function createScenarioRepository(
  config: ReturnType<typeof parseDemoConfig>
): Promise<ScenarioRepository> {
  if (config.DEMO_MODE === "LOCAL") {
    return new InMemoryScenarioRepository(createProjectDanubeState());
  }

  const azureConfig = parseAzureDemoConfig();
  const repository = new AzureSqlScenarioRepository({
    executor: createManagedIdentitySqlExecutor({
      server: config.AZURE_SQL_SERVER_FQDN!,
      database: config.AZURE_SQL_DATABASE_NAME!,
      ...(azureConfig.AZURE_MANAGED_IDENTITY_CLIENT_ID
        ? { managedIdentityClientId: azureConfig.AZURE_MANAGED_IDENTITY_CLIENT_ID }
        : {})
    }),
    tenantId: azureConfig.DEMO_TENANT_ID,
    caseId: "project-danube"
  });

  return initializeScenarioRepository(repository);
}

export async function initializeScenarioRepository(
  repository: ScenarioRepository
): Promise<ScenarioRepository> {
  try {
    await repository.load();
    return repository;
  } catch (error) {
    if (
      error instanceof DemoHttpError &&
      error.code === "DEPENDENCY_UNAVAILABLE" &&
      error.message === "SCENARIO_PROJECTION_NOT_FOUND"
    ) {
      await repository.reset(createProjectDanubeState());
      return repository;
    }

    throw error;
  }
}

function createAzureAdapters(azureConfig: AzureDemoConfig, logger: RedactedLogger) {
  return {
    documentIntelligence: createDocumentIntelligenceAdapter({
      endpoint: azureConfig.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
      ...(azureConfig.AZURE_MANAGED_IDENTITY_CLIENT_ID
        ? { managedIdentityClientId: azureConfig.AZURE_MANAGED_IDENTITY_CLIENT_ID }
        : {}),
      logger: logger.child({ dependency: "document-intelligence" })
    }),
    search: createSearchAdapter({
      endpoint: azureConfig.AZURE_SEARCH_ENDPOINT,
      indexName: azureConfig.AZURE_SEARCH_INDEX_NAME,
      ...(azureConfig.AZURE_MANAGED_IDENTITY_CLIENT_ID
        ? { managedIdentityClientId: azureConfig.AZURE_MANAGED_IDENTITY_CLIENT_ID }
        : {}),
      logger: logger.child({ dependency: "search" })
    }),
    openAi: createOpenAiAdapter({
      deployments: buildApprovedDeployments(azureConfig),
      ...(azureConfig.AZURE_MANAGED_IDENTITY_CLIENT_ID
        ? { managedIdentityClientId: azureConfig.AZURE_MANAGED_IDENTITY_CLIENT_ID }
        : {}),
      logger: logger.child({ dependency: "openai" })
    }),
    blob: createBlobEvidenceAdapter({
      accountUrl: azureConfig.AZURE_BLOB_ACCOUNT_URL,
      containerName: azureConfig.AZURE_BLOB_CONTAINER_NAME,
      ...(azureConfig.AZURE_MANAGED_IDENTITY_CLIENT_ID
        ? { managedIdentityClientId: azureConfig.AZURE_MANAGED_IDENTITY_CLIENT_ID }
        : {}),
      logger: logger.child({ dependency: "blob" })
    }),
    serviceBus: createServiceBusAdapter({
      namespace: azureConfig.AZURE_SERVICE_BUS_NAMESPACE,
      queueName: azureConfig.AZURE_SERVICE_BUS_QUEUE_NAME,
      ...(azureConfig.AZURE_MANAGED_IDENTITY_CLIENT_ID
        ? { managedIdentityClientId: azureConfig.AZURE_MANAGED_IDENTITY_CLIENT_ID }
        : {}),
      logger: logger.child({ dependency: "service-bus" })
    })
  };
}

function buildEvidenceCatalog(state: ReturnType<typeof createProjectDanubeState>) {
  return Object.fromEntries(
    state.evidence.map((evidence) => [
      evidence.evidenceId,
      {
        blobName: evidence.sourceLocator
      }
    ])
  );
}
