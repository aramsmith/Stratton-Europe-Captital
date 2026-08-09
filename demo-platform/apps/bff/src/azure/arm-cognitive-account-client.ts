import { DemoHttpError } from "../errors.js";

const accountApiVersion = "2023-05-01";
const deploymentApiVersion = "2024-10-01";
const failureMessage = "AUTHORITATIVE_ROUTE_VALIDATION_FAILED";
const approvedAccountKinds = new Set(["openai", "aiservices"]);

export interface ArmCognitiveAccountClient {
  getAccountDeployment(input: {
    readonly resourceId: string;
    readonly endpoint: string;
    readonly deploymentId: string;
  }): Promise<ArmCognitiveAccountDeployment>;
}

export interface ArmCognitiveAccountDeployment {
  readonly resourceId: string;
  readonly accountName: string;
  readonly location: string;
  readonly endpoint: string;
  readonly deploymentId: string;
}

interface CreateArmCognitiveAccountClientOptions {
  readonly getAccessToken: () => Promise<string>;
  readonly fetch?: typeof fetch;
}

interface ArmAccountResponse {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly kind: string;
  readonly location: string;
  readonly properties: {
    readonly endpoint: string;
  };
}

interface ArmDeploymentResponse {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly properties: {
    readonly model: {
      readonly name: string;
    };
  };
}

export function createArmCognitiveAccountClient(
  options: CreateArmCognitiveAccountClientOptions
): ArmCognitiveAccountClient {
  const fetchImpl = options.fetch ?? fetch;

  return {
    async getAccountDeployment(input) {
      try {
        const expectedAccountName = getCognitiveAccountName(input.resourceId);
        const token = requireAccessToken(await options.getAccessToken());
        const headers = {
          authorization: `Bearer ${token}`,
          accept: "application/json"
        };
        const account = parseAccount(
          await getJson(
            fetchImpl,
            createArmUrl(input.resourceId, accountApiVersion),
            headers
          )
        );
        assertAccount(account, input, expectedAccountName);

        const deployment = parseDeployment(
          await getJson(
            fetchImpl,
            createArmUrl(
              `${input.resourceId}/deployments/${encodeURIComponent(input.deploymentId)}`,
              deploymentApiVersion
            ),
            headers
          )
        );
        assertDeployment(deployment, input);

        return Object.freeze({
          resourceId: account.id,
          accountName: account.name,
          location: account.location,
          endpoint: normalizeEndpoint(account.properties.endpoint),
          deploymentId: deployment.name
        });
      } catch {
        throw authoritativeRouteFailure();
      }
    }
  };
}

function getCognitiveAccountName(resourceId: string): string {
  const match =
    /^\/subscriptions\/[0-9a-f-]{36}\/resourceGroups\/[a-z0-9_.()-]+\/providers\/Microsoft\.CognitiveServices\/accounts\/([a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9]))$/iu.exec(
      resourceId
    );
  if (!match?.[1]) {
    throw authoritativeRouteFailure();
  }
  return match[1];
}

function createArmUrl(resourceId: string, apiVersion: string): string {
  const url = new URL("https://management.azure.com");
  url.pathname = resourceId;
  url.searchParams.set("api-version", apiVersion);
  return url.toString();
}

async function getJson(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, { method: "GET", headers });
  } catch {
    throw authoritativeRouteFailure();
  }
  if (!response.ok) {
    throw authoritativeRouteFailure();
  }

  try {
    return await response.json();
  } catch {
    throw authoritativeRouteFailure();
  }
}

function parseAccount(value: unknown): ArmAccountResponse {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.name) ||
    !isString(value.type) ||
    !isString(value.kind) ||
    !isString(value.location) ||
    !isRecord(value.properties) ||
    !isString(value.properties.endpoint)
  ) {
    throw authoritativeRouteFailure();
  }
  return {
    id: value.id,
    name: value.name,
    type: value.type,
    kind: value.kind,
    location: value.location,
    properties: { endpoint: value.properties.endpoint }
  };
}

function parseDeployment(value: unknown): ArmDeploymentResponse {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.name) ||
    !isString(value.type) ||
    !isRecord(value.properties) ||
    !isRecord(value.properties.model) ||
    !isString(value.properties.model.name)
  ) {
    throw authoritativeRouteFailure();
  }
  return {
    id: value.id,
    name: value.name,
    type: value.type,
    properties: { model: { name: value.properties.model.name } }
  };
}

function assertAccount(
  account: ArmAccountResponse,
  input: Parameters<ArmCognitiveAccountClient["getAccountDeployment"]>[0],
  expectedAccountName: string
): void {
  if (
    !sameArmResourceId(account.id, input.resourceId) ||
    !sameArmIdentifier(account.name, expectedAccountName) ||
    account.type.toLowerCase() !== "microsoft.cognitiveservices/accounts" ||
    !approvedAccountKinds.has(account.kind.toLowerCase()) ||
    !account.location.trim() ||
    normalizeEndpoint(account.properties.endpoint) !== normalizeEndpoint(input.endpoint)
  ) {
    throw authoritativeRouteFailure();
  }
}

function assertDeployment(
  deployment: ArmDeploymentResponse,
  input: Parameters<ArmCognitiveAccountClient["getAccountDeployment"]>[0]
): void {
  if (
    !sameArmResourceId(deployment.id, `${input.resourceId}/deployments/${input.deploymentId}`) ||
    !sameArmIdentifier(deployment.name, input.deploymentId) ||
    deployment.type.toLowerCase() !== "microsoft.cognitiveservices/accounts/deployments" ||
    !deployment.properties.model.name.trim()
  ) {
    throw authoritativeRouteFailure();
  }
}

function sameArmResourceId(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function sameArmIdentifier(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
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

function requireAccessToken(value: string): string {
  const token = value.trim();
  if (!token) {
    throw authoritativeRouteFailure();
  }
  return token;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function authoritativeRouteFailure(): DemoHttpError {
  return new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", failureMessage);
}
