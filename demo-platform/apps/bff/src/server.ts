import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import express, { type Express } from "express";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { AnalysisService } from "./analysis/analysis-service.js";
import { buildApprovedDeployments, parseAzureDemoConfig } from "./azure/azure-config.js";
import { createBlobEvidenceAdapter } from "./azure/blob-evidence-adapter.js";
import { createDocumentIntelligenceAdapter } from "./azure/document-intelligence-adapter.js";
import { createManagedIdentityCredential } from "./azure/managed-identity.js";
import { createOpenAiAdapter } from "./azure/openai-analysis-adapter.js";
import { createSearchAdapter } from "./azure/search-adapter.js";
import { createServiceBusAdapter } from "./azure/service-bus-adapter.js";
import { createAzureWorkflowClient } from "./azure/azure-workflow-client.js";
import { parseDemoConfig, type DemoConfig } from "./config.js";
import { EvidenceService } from "./evidence/evidence-service.js";
import { DemoHttpError, mapDemoError } from "./errors.js";
import { GovernanceService } from "./governance/governance-service.js";
import {
  createContainerAppsIdentityResolver,
  createLocalIdentityResolver,
  type IdentityResolver
} from "./identity/identity-resolver.js";
import { createOboTokenExchange } from "./identity/obo-token-exchange.js";
import {
  getTrustedRequestContext,
  runWithTrustedRequestContext
} from "./identity/request-context.js";
import {
  createPhase5Client,
  type Phase5Client
} from "./phase5/phase5-client.js";
import { createGovernedWorkflowClient } from "./phase5/governed-workflow-client.js";
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
import { createRequestAuthorizer } from "./server-authorization.js";
import { createRedactedLogger, type RedactedLogger } from "./telemetry/redacted-logger.js";

type WithoutAuthorization<T> = Omit<T, "authorization">;

export type DemoServerDependencies = WithoutAuthorization<ScenarioRouteDependencies> &
  WithoutAuthorization<EvidenceRouteDependencies> &
  WithoutAuthorization<AnalysisRouteDependencies> &
  WithoutAuthorization<ReviewRouteDependencies> &
  WithoutAuthorization<GovernanceRouteDependencies>;

export interface DemoServerSecurityOptions {
  readonly identityResolver: IdentityResolver;
  readonly authorizationPolicy: {
    readonly expectedTenantId: string;
    readonly caseId: "project-danube";
    readonly caseAccessRole: "Stratton.Demo.ProjectDanube.Access";
    readonly purposeRole: "Stratton.Demo.EvidenceToDecision";
  };
}

const localServerSecurityOptions: DemoServerSecurityOptions = {
  identityResolver: createLocalIdentityResolver(),
  authorizationPolicy: {
    expectedTenantId: "local-stratton-demo",
    caseId: "project-danube",
    caseAccessRole: "Stratton.Demo.ProjectDanube.Access",
    purposeRole: "Stratton.Demo.EvidenceToDecision"
  }
};

export function createDemoServer(
  dependencies: DemoServerDependencies,
  security: DemoServerSecurityOptions
): Express {
  const app = express();
  const authorization = createRequestAuthorizer(security.authorizationPolicy);
  const routeDependencies = {
    ...dependencies,
    authorization
  };

  app.use((request, response, next) => {
    setCorrelationId(response, request.header("x-correlation-id"));
    next();
  });

  app.get("/healthz", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.use(express.json());
  app.use("/api", (request, response, next) => {
    void security.identityResolver
      .resolve(request)
      .then((identity) => {
        return security.identityResolver.resolveDelegatedToken(request).then((delegatedUserToken) => {
          if (
            delegatedUserToken.tenantId !== identity.tenantId ||
            delegatedUserToken.actorId !== identity.actorId
          ) {
            throw new DemoHttpError(403, "POLICY_DENIED", "DELEGATED_TOKEN_PRINCIPAL_MISMATCH");
          }
          return { identity, delegatedUserToken };
        });
      })
      .then(({ identity, delegatedUserToken }) => {
        response.locals.trustedIdentity = identity;
        const traceparent = request.header("traceparent");
        runWithTrustedRequestContext(
          {
            identity,
            correlationId: getCorrelationId(response),
            delegatedUserToken,
            ...(traceparent ? { traceparent } : {})
          },
          next
        );
      })
      .catch(next);
  });

  app.use(createScenarioRouter(routeDependencies));
  app.use(createEvidenceRouter(routeDependencies));
  app.use(createAnalysisRouter(routeDependencies));
  app.use(createReviewRouter(routeDependencies));
  app.use(createGovernanceRouter(routeDependencies));

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

export function createLocalDemoServer(
  dependencies: DemoServerDependencies
): Express {
  return createDemoServer(dependencies, localServerSecurityOptions);
}

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectRun) {
  void startServer();
}

async function startServer(): Promise<void> {
  const logger = createRedactedLogger();
  try {
    const config = parseDemoConfig();
    const repository = await createScenarioRepository(config);
    const phase5Client = createWorkflowClient(config, logger);
    const security: DemoServerSecurityOptions =
      config.DEMO_MODE === "LOCAL"
        ? localServerSecurityOptions
        : createAzureServerSecurityOptions(config);

    createDemoServer({
      scenarioService: new ScenarioService(repository),
      evidenceService: new EvidenceService({ repository, phase5Client }),
      analysisService: new AnalysisService({ repository, phase5Client }),
      reviewService: new ReviewService({ repository, phase5Client }),
      governanceService: new GovernanceService({ repository })
    }, security).listen(config.PORT, () => {
      console.log(`Stratton demo BFF listening on ${config.PORT}`);
    });
  } catch (error) {
    logger.error("server.startup.failure", {
      errorClass:
        error instanceof DemoHttpError
          ? error.code
          : error instanceof Error && error.name === "ZodError"
            ? "CONFIGURATION_INVALID"
            : "STARTUP_FAILED"
    });
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
  readonly createAzureSupportingOperations?: typeof createAzureWorkflowClient;
  readonly createPhase5AuthorityClient?: typeof createPhase5Client;
  readonly createGovernedWorkflowClient?: typeof createGovernedWorkflowClient;
  readonly getPhase5AccessToken?: () => Promise<string>;
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
  const supporting = (
    overrides.createAzureSupportingOperations ?? createAzureWorkflowClient
  )({
    tenantId: azureConfig.DEMO_TENANT_ID,
    caseId: "project-danube",
    evidenceCatalog: buildEvidenceCatalog(createProjectDanubeState()),
    ...adapters,
    logger: logger.child({ dependency: "workflow-supporting-operations" })
  });
  const getAccessToken =
    overrides.getPhase5AccessToken ??
    createDelegatedPhase5AccessTokenProvider(
      config.ENTRA_TOKEN_ENDPOINT,
      config.PHASE5_DELEGATED_SCOPE,
      config.AZURE_MANAGED_IDENTITY_CLIENT_ID
    );
  const authority = (overrides.createPhase5AuthorityClient ?? createPhase5Client)({
    baseUrl: config.PHASE5_API_BASE_URL,
    getAccessToken,
    getRequestContext: getTrustedRequestContext
  });

  return (overrides.createGovernedWorkflowClient ?? createGovernedWorkflowClient)({
    authority,
    supporting
  });
}

function createDelegatedPhase5AccessTokenProvider(
  tokenEndpoint: string,
  phase5DelegatedScope: string,
  managedIdentityClientId: string
): () => Promise<string> {
  const exchange = createOboTokenExchange({
    tokenEndpoint,
    phase5DelegatedScope,
    managedIdentityClientId
  });
  return async () => {
    const userAssertion = getTrustedRequestContext().delegatedUserToken?.accessToken;
    if (!userAssertion) {
      throw new DemoHttpError(401, "UNAUTHENTICATED", "DELEGATED_TOKEN_REQUIRED");
    }
    return exchange.acquirePhase5Token(userAssertion);
  };
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
      server: requireConfigValue(
        config.AZURE_SQL_SERVER_FQDN,
        "AZURE_SQL_SERVER_FQDN"
      ),
      database: requireConfigValue(
        config.AZURE_SQL_DATABASE_NAME,
        "AZURE_SQL_DATABASE_NAME"
      ),
      ...(azureConfig.AZURE_MANAGED_IDENTITY_CLIENT_ID
        ? { managedIdentityClientId: azureConfig.AZURE_MANAGED_IDENTITY_CLIENT_ID }
        : {})
    }),
    tenantId: azureConfig.DEMO_TENANT_ID,
    caseId: "project-danube"
  });

  return initializeScenarioRepository(repository);
}

function createAzureServerSecurityOptions(
  config: Extract<DemoConfig, { readonly DEMO_MODE: "AZURE" }>
): DemoServerSecurityOptions {
  const expectedTenantId = requireConfigValue(
    config.DEMO_TENANT_ID,
    "DEMO_TENANT_ID"
  );
  const trustedProxyPrincipalId = requireConfigValue(
    config.TRUSTED_WEB_PROXY_PRINCIPAL_ID,
    "TRUSTED_WEB_PROXY_PRINCIPAL_ID"
  );
  return {
    identityResolver: createContainerAppsIdentityResolver({
      expectedTenantId,
      trustedProxyPrincipalId,
      delegatedTokenPolicy: {
        expectedTenantId,
        expectedAudience: config.BFF_DELEGATED_AUDIENCE,
        requiredScope: config.BFF_REQUIRED_DELEGATED_SCOPE
      }
    }),
    authorizationPolicy: {
      expectedTenantId,
      caseId: "project-danube",
      caseAccessRole: "Stratton.Demo.ProjectDanube.Access",
      purposeRole: "Stratton.Demo.EvidenceToDecision"
    }
  };
}

function requireConfigValue(
  value: string | undefined,
  name: string
): string {
  if (!value) {
    throw new DemoHttpError(
      503,
      "DEPENDENCY_UNAVAILABLE",
      `CONFIGURATION_REQUIRED:${name}`
    );
  }
  return value;
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
      try {
        await repository.initialize(createProjectDanubeState());
      } catch (initializeError) {
        if (
          !(
            initializeError instanceof DemoHttpError &&
            initializeError.code === "STATE_CONFLICT" &&
            initializeError.message === "SCENARIO_PROJECTION_ALREADY_INITIALIZED"
          )
        ) {
          throw initializeError;
        }
        await repository.load();
      }
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
