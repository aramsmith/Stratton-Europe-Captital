import { scenarioStateSchema, type DemoApiError, type ScenarioState } from "@stratton/contracts";

const demoErrorCodes = new Set<DemoApiError["code"]>([
  "INVALID_CONTRACT",
  "UNAUTHENTICATED",
  "POLICY_DENIED",
  "STATE_CONFLICT",
  "EVIDENCE_INCOMPLETE",
  "DEPENDENCY_UNAVAILABLE"
]);

export class DemoClient {
  public constructor(private readonly baseUrl = "/api") {}

  public async getScenario(signal?: AbortSignal): Promise<ScenarioState> {
    const response = await fetch(`${this.baseUrl}/scenario`, signal ? { signal } : undefined);
    if (!response.ok) {
      throw await readDemoApiError(response);
    }

    return scenarioStateSchema.parse(await response.json());
  }

  public async resetScenario(): Promise<ScenarioState> {
    const response = await fetch(`${this.baseUrl}/scenario/reset`, { method: "POST" });
    if (!response.ok) {
      throw await readDemoApiError(response);
    }

    return scenarioStateSchema.parse(await response.json());
  }
}

async function readDemoApiError(response: Response): Promise<DemoApiError> {
  const payload: unknown = await response.json();

  if (isDemoApiError(payload)) {
    return payload;
  }

  throw new Error("Demo API returned an invalid error envelope.");
}

function isDemoApiError(value: unknown): value is DemoApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof value.code === "string" &&
    demoErrorCodes.has(value.code as DemoApiError["code"]) &&
    "message" in value &&
    typeof value.message === "string" &&
    "correlationId" in value &&
    typeof value.correlationId === "string"
  );
}
