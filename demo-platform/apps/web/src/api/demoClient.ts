import {
  analysisRunRequestSchema,
  analysisRunResponseSchema,
  committeeSubmissionRequestSchema,
  evidenceAdmissionRequestSchema,
  findingDispositionRequestSchema,
  governanceViewSchema,
  recommendationPreparationRequestSchema,
  reviewSubmissionRequestSchema,
  scenarioMutationResponseSchema,
  scenarioStateSchema,
  securityGateRunRequestSchema,
  type AnalysisRunRequest,
  type AnalysisRunResponse,
  type CommitteeSubmissionRequest,
  type DemoApiError,
  type EvidenceAdmissionRequest,
  type FindingDispositionRequest,
  type GovernanceView,
  type RecommendationPreparationRequest,
  type ReviewSubmissionRequest,
  type ScenarioState,
  type SecurityGateRunRequest
} from "@stratton/contracts";

const demoErrorMessages: Readonly<Record<DemoApiError["code"], string>> = {
  INVALID_CONTRACT: "Request does not satisfy the approved contract.",
  UNAUTHENTICATED: "Authenticated Microsoft Entra principal is required.",
  POLICY_DENIED: "Policy denied this operation.",
  STATE_CONFLICT: "Resource state does not permit this operation.",
  EVIDENCE_INCOMPLETE: "Required evidence is incomplete or missing.",
  DEPENDENCY_UNAVAILABLE: "Required dependency is unavailable."
};

const demoErrorCodeByStatus: Readonly<Record<number, DemoApiError["code"]>> = {
  400: "INVALID_CONTRACT",
  401: "UNAUTHENTICATED",
  403: "POLICY_DENIED",
  409: "STATE_CONFLICT",
  422: "EVIDENCE_INCOMPLETE",
  503: "DEPENDENCY_UNAVAILABLE"
};

export class DemoClient {
  public constructor(
    private readonly baseUrl = "/api",
    private readonly getAccessToken: () => Promise<string | undefined> = async () => undefined
  ) {}

  public async getScenario(signal?: AbortSignal): Promise<ScenarioState> {
    const response = await this.request("/scenario", signal ? { signal } : undefined);
    if (!response.ok) {
      throw await readDemoApiError(response);
    }

    return scenarioStateSchema.parse(await response.json());
  }

  public async getGovernanceView(signal?: AbortSignal): Promise<GovernanceView> {
    const response = await this.request("/governance", signal ? { signal } : undefined);
    if (!response.ok) {
      throw await readDemoApiError(response);
    }

    return governanceViewSchema.parse(await response.json());
  }

  public async resetScenario(): Promise<ScenarioState> {
    const response = await this.request("/scenario/reset", { method: "POST" });
    if (!response.ok) {
      throw await readDemoApiError(response);
    }

    return scenarioStateSchema.parse(await response.json());
  }

  public async admitEvidence(
    input: EvidenceAdmissionRequest & { evidenceId: string }
  ): Promise<ScenarioState> {
    const payload = evidenceAdmissionRequestSchema.parse({ caseId: input.caseId });
    const response = await this.request(`/evidence/${input.evidenceId}/admit`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw await readDemoApiError(response);
    }

    return scenarioMutationResponseSchema.parse(await response.json()).scenario;
  }

  public async runAnalysis(input: AnalysisRunRequest): Promise<AnalysisRunResponse> {
    const payload = analysisRunRequestSchema.parse(input);
    const response = await this.request("/analysis-runs", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw await readDemoApiError(response);
    }

    return analysisRunResponseSchema.parse(await response.json());
  }

  public async recordFindingDisposition(
    input: FindingDispositionRequest & { findingId: string }
  ): Promise<ScenarioState> {
    const payload = findingDispositionRequestSchema.parse({
      caseId: input.caseId,
      action: input.action,
      ...(input.editedSummary ? { editedSummary: input.editedSummary } : {})
    });
    const response = await this.request(`/findings/${input.findingId}/disposition`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw await readDemoApiError(response);
    }

    return scenarioMutationResponseSchema.parse(await response.json()).scenario;
  }

  public async submitReview(
    input: ReviewSubmissionRequest & { findingId: string }
  ): Promise<ScenarioState> {
    const payload = reviewSubmissionRequestSchema.parse({
      caseId: input.caseId,
      reviewType: input.reviewType,
      decision: input.decision,
      rationale: input.rationale,
      subjectVersion: input.subjectVersion
    });
    const response = await this.request(`/findings/${input.findingId}/reviews`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw await readDemoApiError(response);
    }

    return scenarioMutationResponseSchema.parse(await response.json()).scenario;
  }

  public async prepareRecommendation(
    input: RecommendationPreparationRequest
  ): Promise<ScenarioState> {
    const payload = recommendationPreparationRequestSchema.parse(input);
    const response = await this.request("/recommendation/prepare", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw await readDemoApiError(response);
    }

    return scenarioMutationResponseSchema.parse(await response.json()).scenario;
  }

  public async submitCommitteePack(
    input: CommitteeSubmissionRequest
  ): Promise<ScenarioState> {
    const payload = committeeSubmissionRequestSchema.parse(input);
    const response = await this.request("/recommendation/submit", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw await readDemoApiError(response);
    }

    return scenarioMutationResponseSchema.parse(await response.json()).scenario;
  }

  public async runSecurityGateSuite(
    input: SecurityGateRunRequest
  ): Promise<ScenarioState> {
    const payload = securityGateRunRequestSchema.parse(input);
    const response = await this.request("/governance/security-gates/run", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw await readDemoApiError(response);
    }
    return scenarioMutationResponseSchema.parse(await response.json()).scenario;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return fetch(`${this.baseUrl}${path}`, init);
    }

    return fetch(`${this.baseUrl}${path}`, {
      ...(init ?? {}),
      headers: {
        ...(init?.headers as Record<string, string> | undefined),
        authorization: `Bearer ${accessToken}`
      }
    });
  }
}

async function readDemoApiError(response: Response): Promise<DemoApiError> {
  const bodyText = await response.text();
  if (bodyText.trim().length > 0) {
    try {
      const payload: unknown = JSON.parse(bodyText);
      if (isDemoApiError(payload)) {
        return payload;
      }
    } catch {
      // Fail closed: fall through to a typed error derived from the HTTP status.
    }
  }

  return buildFallbackDemoApiError(response);
}

function buildFallbackDemoApiError(response: Response): DemoApiError {
  const code = demoErrorCodeByStatus[response.status] ?? "DEPENDENCY_UNAVAILABLE";
  return {
    code,
    message: demoErrorMessages[code],
    correlationId: response.headers.get("x-correlation-id") ?? response.headers.get("x-request-id") ?? "unknown"
  };
}

function isDemoApiError(value: unknown): value is DemoApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof value.code === "string" &&
    value.code in demoErrorMessages &&
    "message" in value &&
    typeof value.message === "string" &&
    "correlationId" in value &&
    typeof value.correlationId === "string"
  );
}
