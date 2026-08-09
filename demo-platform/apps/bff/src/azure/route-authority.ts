import type { ModelRoute } from "@stratton/contracts";
import { type ApprovedDeployment } from "./openai-analysis-adapter.js";
import type { AzureDemoConfig } from "./azure-config.js";
import {
  authoritativeRouteFailure,
  type ArmCognitiveAccountClient,
  type ArmCognitiveAccountDeployment
} from "./arm-cognitive-account-client.js";
import type { DemoAuthorityClient, ApprovedModelRouteEvidence } from "../phase5/demo-authority-client.js";
import type { RedactedLogger } from "../telemetry/redacted-logger.js";
import { createHash } from "node:crypto";

export interface AuthoritativeRouteBinding {
  readonly route: "LUNA" | "TERRA" | "SOL";
  readonly resourceId: string;
  readonly accountName: string;
  readonly location: string;
  readonly endpoint: string;
  readonly deploymentId: string;
  readonly apiVersion: string;
  readonly evidenceId: string;
  readonly evidenceVersion: string;
}

interface ResolveAuthoritativeRoutesOptions {
  readonly config: AzureDemoConfig;
  readonly arm: ArmCognitiveAccountClient;
  readonly authority: Pick<DemoAuthorityClient, "getModelRouteEvidence">;
  readonly now?: () => Date;
  readonly logger?: RedactedLogger;
}

interface DeclaredRouteBinding {
  readonly route: ModelRoute;
  readonly endpoint: string;
  readonly resourceId: string;
  readonly region: string;
  readonly deploymentId: string;
  readonly apiVersion: string;
  readonly evidenceId: string;
}

const routes = ["LUNA", "TERRA", "SOL"] as const;
const approvedEuAzureOpenAiRegions = new Set([
  "francecentral",
  "germanywestcentral",
  "italynorth",
  "northeurope",
  "polandcentral",
  "spaincentral",
  "swedencentral",
  "westeurope"
]);

export async function resolveAuthoritativeRoutes(
  options: ResolveAuthoritativeRoutesOptions
): Promise<Readonly<Record<ModelRoute, AuthoritativeRouteBinding>>> {
  const now = options.now ?? (() => new Date());
  const declared = declaredRoutes(options.config);
  const bindings = await Promise.all(
    routes.map(async (route) => {
      const binding = declared[route];
      try {
        const [arm, evidence] = await Promise.all([
          options.arm.getAccountDeployment(binding),
          options.authority.getModelRouteEvidence(binding.evidenceId)
        ]);
        const approved = createBinding(binding, arm, evidence, now());
        logOutcome(options.logger, approved, "APPROVED");
        return approved;
      } catch {
        logFailure(options.logger, binding.route);
        throw authoritativeRouteFailure();
      }
    })
  );

  return Object.freeze(
    Object.fromEntries(bindings.map((binding) => [binding.route, binding])) as Record<
      ModelRoute,
      AuthoritativeRouteBinding
    >
  );
}

export function buildApprovedDeployments(
  bindings: Readonly<Record<ModelRoute, AuthoritativeRouteBinding>>
): Readonly<Record<ModelRoute, ApprovedDeployment>> {
  return Object.freeze(
    Object.fromEntries(
      routes.map((route) => {
        const binding = bindings[route];
        return [
          route,
          Object.freeze({
            endpoint: binding.endpoint,
            resourceId: binding.resourceId,
            region: binding.location,
            deploymentId: binding.deploymentId,
            apiVersion: binding.apiVersion,
            evidenceId: binding.evidenceId,
            geography: "EU_DATA_ZONE" as const
          })
        ];
      })
    ) as Record<ModelRoute, ApprovedDeployment>
  );
}

function declaredRoutes(config: AzureDemoConfig): Readonly<Record<ModelRoute, DeclaredRouteBinding>> {
  return {
    LUNA: {
      route: "LUNA",
      endpoint: config.AZURE_OPENAI_LUNA_ENDPOINT,
      resourceId: config.AZURE_OPENAI_LUNA_RESOURCE_ID,
      region: config.AZURE_OPENAI_LUNA_REGION,
      deploymentId: config.AZURE_OPENAI_LUNA_DEPLOYMENT_ID,
      apiVersion: config.AZURE_OPENAI_LUNA_API_VERSION,
      evidenceId: config.AZURE_OPENAI_LUNA_EVIDENCE_ID
    },
    TERRA: {
      route: "TERRA",
      endpoint: config.AZURE_OPENAI_TERRA_ENDPOINT,
      resourceId: config.AZURE_OPENAI_TERRA_RESOURCE_ID,
      region: config.AZURE_OPENAI_TERRA_REGION,
      deploymentId: config.AZURE_OPENAI_TERRA_DEPLOYMENT_ID,
      apiVersion: config.AZURE_OPENAI_TERRA_API_VERSION,
      evidenceId: config.AZURE_OPENAI_TERRA_EVIDENCE_ID
    },
    SOL: {
      route: "SOL",
      endpoint: config.AZURE_OPENAI_SOL_ENDPOINT,
      resourceId: config.AZURE_OPENAI_SOL_RESOURCE_ID,
      region: config.AZURE_OPENAI_SOL_REGION,
      deploymentId: config.AZURE_OPENAI_SOL_DEPLOYMENT_ID,
      apiVersion: config.AZURE_OPENAI_SOL_API_VERSION,
      evidenceId: config.AZURE_OPENAI_SOL_EVIDENCE_ID
    }
  };
}

function createBinding(
  declared: DeclaredRouteBinding,
  arm: ArmCognitiveAccountDeployment,
  evidence: ApprovedModelRouteEvidence,
  now: Date
): AuthoritativeRouteBinding {
  if (
    evidence.evidenceId !== declared.evidenceId ||
    evidence.status !== "APPROVED" ||
    !isCurrentlyValid(evidence, now) ||
    evidence.route !== declared.route ||
    !sameArmResourceId(evidence.resourceId, declared.resourceId) ||
    !sameArmResourceId(evidence.resourceId, arm.resourceId) ||
    evidence.deploymentId !== declared.deploymentId ||
    evidence.deploymentId !== arm.deploymentId ||
    evidence.apiVersion !== declared.apiVersion ||
    normalizeEndpoint(arm.endpoint) !== normalizeEndpoint(declared.endpoint) ||
    !hasApprovedMatchingRegion(declared.region, arm.location, evidence.region) ||
    getAccountName(evidence.resourceId) !== arm.accountName.toLowerCase()
  ) {
    throw authoritativeRouteFailure();
  }

  return Object.freeze({
    route: declared.route,
    resourceId: arm.resourceId,
    accountName: arm.accountName,
    location: arm.location,
    endpoint: arm.endpoint,
    deploymentId: arm.deploymentId,
    apiVersion: evidence.apiVersion,
    evidenceId: evidence.evidenceId,
    evidenceVersion: evidence.evidenceVersion
  });
}

function hasApprovedMatchingRegion(
  declaredRegion: string,
  armLocation: string,
  evidenceRegion: string
): boolean {
  const declared = normalizeLocation(declaredRegion);
  const arm = normalizeLocation(armLocation);
  const evidence = normalizeLocation(evidenceRegion);
  return declared === arm && arm === evidence && approvedEuAzureOpenAiRegions.has(arm);
}

function sameArmResourceId(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function isCurrentlyValid(evidence: ApprovedModelRouteEvidence, now: Date): boolean {
  const validFrom = new Date(evidence.validFromIso);
  const validUntil = new Date(evidence.validUntilIso);
  return (
    !Number.isNaN(validFrom.getTime()) &&
    !Number.isNaN(validUntil.getTime()) &&
    validFrom <= now &&
    now < validUntil
  );
}

function getAccountName(resourceId: string): string {
  const match = /\/accounts\/([^/]+)$/iu.exec(resourceId);
  if (!match?.[1]) {
    throw authoritativeRouteFailure();
  }
  return match[1].toLowerCase();
}

function normalizeLocation(location: string): string {
  const normalized = location.trim().toLowerCase();
  if (!normalized) {
    throw authoritativeRouteFailure();
  }
  return normalized;
}

function normalizeEndpoint(endpoint: string): string {
  const url = new URL(endpoint);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw authoritativeRouteFailure();
  }
  return url.origin.toLowerCase();
}

function logOutcome(
  logger: RedactedLogger | undefined,
  binding: AuthoritativeRouteBinding,
  outcome: "APPROVED"
): void {
  logger?.info("azure.route.authority.validation", {
    route: binding.route,
    resourceIdHash: hash(binding.resourceId),
    location: binding.location,
    deploymentIdHash: hash(binding.deploymentId),
    evidenceId: binding.evidenceId,
    evidenceVersion: binding.evidenceVersion,
    outcome
  });
}

function logFailure(logger: RedactedLogger | undefined, route: ModelRoute): void {
  logger?.error("azure.route.authority.validation", { route, outcome: "FAILED" });
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
