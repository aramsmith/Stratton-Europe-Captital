import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import express, { type Express } from "express";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { AnalysisService } from "./analysis/analysis-service.js";
import { parseAzureDemoConfig } from "./azure/azure-config.js";
import { createArmCognitiveAccountClient } from "./azure/arm-cognitive-account-client.js";
import { createBlobEvidenceAdapter } from "./azure/blob-evidence-adapter.js";
import { createDocumentIntelligenceAdapter } from "./azure/document-intelligence-adapter.js";
import { createManagedIdentityCredential } from "./azure/managed-identity.js";
import { createOpenAiAdapter } from "./azure/openai-analysis-adapter.js";
import { createSearchAdapter } from "./azure/search-adapter.js";
import { createServiceBusAdapter } from "./azure/service-bus-adapter.js";
import { createAzureSupportingAnalysis } from "./azure/azure-workflow-client.js";
import {
  buildApprovedDeployments,
  resolveAuthoritativeRoutes
} from "./azure/route-authority.js";
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
  createDemoAuthorityClient,
  type DemoAuthorityClient
} from "./phase5/demo-authority-client.js";
import {
  createAuthoritativeBundleWorkflowClient,
  createAuthoritativeEvidenceAdmissionWorkflowClient,
  type AuthoritativeBundleWorkflowClient,
  type AuthoritativeEvidenceAdmissionWorkflowClient
} from "./phase5/governed-workflow-client.js";
import { createLocalDemoAuthorityClient } from "./phase5/local-demo-authority-client.js";
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
  readonly logger?: RedactedLogger;
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
    let identityBoundaryStage = "container-principal";
    void security.identityResolver
      .resolve(request)
      .then((identity) => {
        identityBoundaryStage = "delegated-token";
        return security.identityResolver.resolveDelegatedToken(request).then((delegatedUserToken) => {
          identityBoundaryStage = "principal-match";
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
      .catch((error: unknown) => {
        security.logger?.error("identity.boundary.rejected", {
          errorClass: error instanceof DemoHttpError ? error.code : "UNEXPECTED_ERROR",
          reason: error instanceof Error ? error.message : "UNKNOWN",
          stage: identityBoundaryStage,
          hasAuthorization: Boolean(request.header("authorization")),
          hasForwardedDelegatedToken: Boolean(
            request.header("x-stratton-delegated-token")
          ),
          hasClientPrincipal: Boolean(request.header("x-ms-client-principal")),
          clientPrincipalShape: summarizeClientPrincipal(
            request.header("x-ms-client-principal")
          )
        });
        next(error);
      });
  });

  app.use(createScenarioRouter(routeDependencies));
  app.use(createEvidenceRouter(routeDependencies));
  app.use(createAnalysisRouter(routeDependencies));
  app.use(createReviewRouter(routeDependencies));
  app.use(createGovernanceRouter(routeDependencies));

  app.use((_request, _response, next) => {
    next(new DemoHttpError(404, "INVALID_CONTRACT", "Requested path does not match an approved route."));
  });

  app.use((error: unknown, request: express.Request, response: express.Response, next: express.NextFunction) => {
    void next;
    security.logger?.error("request.rejected", {
      method: request.method,
      path: request.path,
      errorClass: error instanceof DemoHttpError ? error.code : "UNEXPECTED_ERROR",
      reason: error instanceof Error ? error.message : "UNKNOWN"
    });
    const mapped = mapDemoError(error, getCorrelationId(response));
    response.status(mapped.status).json({
      code: mapped.code,
      message: mapped.message,
      correlationId: mapped.correlationId
    });
  });

  return app;
}

function summarizeClientPrincipal(
  encodedPrincipal: string | undefined
): { readonly authType?: string; readonly claimTypes: readonly string[] } | undefined {
  if (!encodedPrincipal) {
    return undefined;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPrincipal, "base64").toString("utf8")
    ) as {
      readonly auth_typ?: unknown;
      readonly claims?: readonly { readonly typ?: unknown }[];
    };
    return {
      ...(typeof decoded.auth_typ === "string" ? { authType: decoded.auth_typ } : {}),
      claimTypes: Array.isArray(decoded.claims)
        ? decoded.claims
            .map((claim) => claim.typ)
            .filter((claimType): claimType is string => typeof claimType === "string")
            .sort((left, right) => left.localeCompare(right))
        : []
    };
  } catch {
    return { claimTypes: [] };
  }
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
    const workflow = await createWorkflowClient(config, logger);
    const repository = await createScenarioRepository(config);
    const security: DemoServerSecurityOptions =
      config.DEMO_MODE === "LOCAL"
        ? localServerSecurityOptions
        : createAzureServerSecurityOptions(config, logger);

    createDemoServer({
      scenarioService: new ScenarioService(repository),
      evidenceService: new EvidenceService({
        repository,
        admissionWorkflow: workflow.evidence,
        getTenantId: () => getTrustedRequestContext().identity.tenantId
      }),
      analysisService: new AnalysisService({
        repository,
        authoritativeWorkflow: workflow.analysis,
        getTenantId: () => getTrustedRequestContext().identity.tenantId
      }),
      reviewService: new ReviewService({
        repository,
        demoAuthorityClient: workflow.authority,
        getTenantId: () => getTrustedRequestContext().identity.tenantId
      }),
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

interface AuthoritativeWorkflow {
  readonly authority: DemoAuthorityClient;
  readonly evidence: AuthoritativeEvidenceAdmissionWorkflowClient;
  readonly analysis: AuthoritativeBundleWorkflowClient;
}

type AzureDemoConfig = ReturnType<typeof parseAzureDemoConfig>;

interface WorkflowClientFactoryOverrides {
  readonly createLocalDemoAuthorityClient?: typeof createLocalDemoAuthorityClient;
  readonly parseAzureConfig?: typeof parseAzureDemoConfig;
  readonly createAzureAdapters?: typeof createAzureAdapters;
  readonly createAzureSupportingAnalysis?: typeof createAzureSupportingAnalysis;
  readonly createDemoAuthorityClient?: typeof createDemoAuthorityClient;
  readonly createArmCognitiveAccountClient?: typeof createArmCognitiveAccountClient;
  readonly resolveAuthoritativeRoutes?: typeof resolveAuthoritativeRoutes;
}

export async function createWorkflowClient(
  config: ReturnType<typeof parseDemoConfig>,
  logger: RedactedLogger,
  overrides: WorkflowClientFactoryOverrides = {}
): Promise<AuthoritativeWorkflow> {
  if (config.DEMO_MODE === "LOCAL") {
    const authority = (overrides.createLocalDemoAuthorityClient ?? createLocalDemoAuthorityClient)({
      mode: "LOCAL"
    });
    const supporting = {
      afterEvidenceAdmitted: async () => undefined,
      requestAnalysis: async () => undefined
    };
    return {
      authority,
      evidence: createAuthoritativeEvidenceAdmissionWorkflowClient({
        authority,
        supporting
      }),
      analysis: createAuthoritativeBundleWorkflowClient({
        authority,
        supporting
      })
    };
  }

  const azureConfig = (overrides.parseAzureConfig ?? parseAzureDemoConfig)();
  const authority = (overrides.createDemoAuthorityClient ?? createDemoAuthorityClient)({
    baseUrl: config.PHASE5_API_BASE_URL,
    oboTokenExchange: createOboTokenExchange({
      tokenEndpoint: config.ENTRA_TOKEN_ENDPOINT,
      phase5DelegatedScope: config.PHASE5_DELEGATED_SCOPE,
      clientId: config.BFF_ENTRA_CLIENT_ID,
      managedIdentityClientId: config.AZURE_MANAGED_IDENTITY_CLIENT_ID
    }),
    getDelegatedUserToken: async () => {
      const token = getTrustedRequestContext().delegatedUserToken;
      if (!token) {
        throw new DemoHttpError(401, "UNAUTHENTICATED", "DELEGATED_TOKEN_REQUIRED");
      }
      return token;
    },
    phase5ApplicationId: config.PHASE5_APPLICATION_ID,
    managedIdentityClientId: config.AZURE_MANAGED_IDENTITY_CLIENT_ID,
    getRequestContext: getTrustedRequestContext
  });
  const arm = (overrides.createArmCognitiveAccountClient ?? createArmCognitiveAccountClient)({
    getAccessToken: createArmAccessTokenProvider(azureConfig.AZURE_MANAGED_IDENTITY_CLIENT_ID)
  });
  const authoritativeRoutes = await (
    overrides.resolveAuthoritativeRoutes ?? resolveAuthoritativeRoutes
  )({
    config: azureConfig,
    arm,
    authority,
    logger
  });
  const adapters = (overrides.createAzureAdapters ?? createAzureAdapters)(
    azureConfig,
    logger,
    buildApprovedDeployments(authoritativeRoutes)
  );
  const supporting = (
    overrides.createAzureSupportingAnalysis ?? createAzureSupportingAnalysis
  )({
    tenantId: azureConfig.DEMO_TENANT_ID,
    caseId: "project-danube",
    evidenceCatalog: buildEvidenceCatalog(createProjectDanubeState()),
    ...adapters,
    logger: logger.child({ dependency: "workflow-supporting-operations" })
  });
  return {
    authority,
    evidence: createAuthoritativeEvidenceAdmissionWorkflowClient({
      authority,
      supporting
    }),
    analysis: createAuthoritativeBundleWorkflowClient({ authority, supporting })
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
  config: Extract<DemoConfig, { readonly DEMO_MODE: "AZURE" }>,
  logger: RedactedLogger
): DemoServerSecurityOptions {
  const expectedTenantId = requireConfigValue(
    config.DEMO_TENANT_ID,
    "DEMO_TENANT_ID"
  );
  return {
    logger: logger.child({ boundary: "container-apps-easy-auth" }),
    identityResolver: createContainerAppsIdentityResolver({
      expectedTenantId,
      delegatedTokenPolicy: {
        expectedTenantId,
        expectedAudience: config.BFF_DELEGATED_AUDIENCE,
        requiredScope: config.BFF_REQUIRED_DELEGATED_SCOPE,
        expectedClientApplicationId: config.BFF_ALLOWED_CLIENT_APPLICATION_ID
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

function createAzureAdapters(
  azureConfig: AzureDemoConfig,
  logger: RedactedLogger,
  deployments: ReturnType<typeof buildApprovedDeployments>
) {
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
      deployments,
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

function createArmAccessTokenProvider(
  managedIdentityClientId: string | undefined
): () => Promise<string> {
  const credential = createManagedIdentityCredential(managedIdentityClientId);
  return async () => {
    const token = await credential.getToken("https://management.azure.com/.default");
    if (!token?.token) {
      throw new DemoHttpError(
        503,
        "DEPENDENCY_UNAVAILABLE",
        "AUTHORITATIVE_ROUTE_VALIDATION_FAILED"
      );
    }
    return token.token;
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
