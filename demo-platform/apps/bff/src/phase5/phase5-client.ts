import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AnalysisTaskClass, DemoApiError, ModelRoute } from "@stratton/contracts";
import { DemoHttpError } from "../errors.js";

const phase5ErrorSchema = z
  .object({
    code: z.enum([
      "INVALID_CONTRACT",
      "UNAUTHENTICATED",
      "POLICY_DENIED",
      "STATE_CONFLICT",
      "EVIDENCE_INCOMPLETE",
      "DEPENDENCY_UNAVAILABLE"
    ]),
    message: z.string().min(1),
    correlationId: z.string().min(1)
  })
  .strict();

const analysisAcceptedSchema = z
  .object({
    analysisRunId: z.string().min(1),
    status: z.literal("QUEUED")
  })
  .strict();

type ReviewType = "DEAL" | "LEGAL" | "COMPLIANCE";
type ReviewDecision = "APPROVED" | "REJECTED";

export interface Phase5Client {
  admitEvidence(input: {
    caseId: string;
    evidenceId: string;
    idempotencyKey: string;
    correlationId?: string;
  }): Promise<void>;
  requestAnalysis(input: {
    caseId: string;
    evidenceIds: string[];
    analystQuestion: string;
    route?: ModelRoute;
    taskClass?: AnalysisTaskClass;
    modelDeploymentId: string;
    promptTemplateVersion: string;
    analysisRequestFingerprint: string;
    idempotencyKey: string;
    correlationId?: string;
  }): Promise<{ analysisRunId: string; status: "QUEUED" }>;
  submitReview(input: {
    caseId: string;
    analysisRunId: string;
    reviewType: ReviewType;
    decision: ReviewDecision;
    rationale: string;
    subjectVersion: string;
    idempotencyKey: string;
    correlationId?: string;
  }): Promise<void>;
  prepareDraft(input: {
    caseId: string;
    analysisRunId: string;
    subjectVersion: string;
    idempotencyKey: string;
    correlationId?: string;
  }): Promise<void>;
}

export interface Phase5ClientDependencies {
  readonly baseUrl: string;
  readonly accessToken?: string;
  readonly correlationId?: string;
  readonly traceparent?: string;
  readonly fetch?: typeof fetch;
}

export function createPhase5Client(dependencies: Phase5ClientDependencies): Phase5Client {
  const fetchImpl = dependencies.fetch ?? fetch;

  return {
    admitEvidence: async (input) => {
      await send(fetchImpl, dependencies, {
        path: `/v1/evidence/${encodeURIComponent(input.evidenceId)}/admission`,
        body: { caseId: input.caseId },
        idempotencyKey: input.idempotencyKey
      });
    },
    requestAnalysis: async (input) =>
      send(fetchImpl, dependencies, {
        path: `/v1/cases/${encodeURIComponent(input.caseId)}/analysis-runs`,
        body: {
          caseId: input.caseId,
          evidenceIds: input.evidenceIds,
          analystQuestion: input.analystQuestion,
          modelDeploymentId: input.modelDeploymentId,
          promptTemplateVersion: input.promptTemplateVersion,
          analysisRequestFingerprint: input.analysisRequestFingerprint
        },
        idempotencyKey: input.idempotencyKey,
        responseSchema: analysisAcceptedSchema
      }),
    submitReview: async (input) => {
      await send(fetchImpl, dependencies, {
        path: `/v1/cases/${encodeURIComponent(input.caseId)}/reviews`,
        body: {
          caseId: input.caseId,
          analysisRunId: input.analysisRunId,
          reviewType: input.reviewType,
          decision: input.decision,
          rationale: input.rationale,
          subjectVersion: input.subjectVersion
        },
        idempotencyKey: input.idempotencyKey
      });
    },
    prepareDraft: async (input) => {
      await send(fetchImpl, dependencies, {
        path: `/v1/cases/${encodeURIComponent(input.caseId)}/draft-recommendations`,
        body: {
          caseId: input.caseId,
          analysisRunId: input.analysisRunId,
          subjectVersion: input.subjectVersion
        },
        idempotencyKey: input.idempotencyKey
      });
    }
  };
}

interface BaseSendRequest {
  readonly path: string;
  readonly body: Record<string, unknown>;
  readonly idempotencyKey: string;
}

interface VoidSendRequest extends BaseSendRequest {
  readonly responseSchema?: undefined;
}

interface TypedSendRequest<TResponseSchema extends z.ZodTypeAny> extends BaseSendRequest {
  readonly responseSchema?: TResponseSchema;
}

async function send(
  fetchImpl: typeof fetch,
  dependencies: Phase5ClientDependencies,
  request: VoidSendRequest
): Promise<void>;
async function send<TResponseSchema extends z.ZodTypeAny>(
  fetchImpl: typeof fetch,
  dependencies: Phase5ClientDependencies,
  request: TypedSendRequest<TResponseSchema>
): Promise<z.infer<TResponseSchema>>;
async function send(
  fetchImpl: typeof fetch,
  dependencies: Phase5ClientDependencies,
  request: VoidSendRequest | TypedSendRequest<z.ZodTypeAny>
): Promise<unknown> {
  const accessToken = dependencies.accessToken?.trim();
  if (!accessToken) {
    throw new DemoHttpError(401, "UNAUTHENTICATED");
  }

  const response = await fetchImpl(`${dependencies.baseUrl}${request.path}`, {
    method: "POST",
    headers: createHeaders(dependencies, accessToken, request.idempotencyKey),
    body: JSON.stringify(request.body)
  });

  if (!response.ok) {
    throw await mapPhase5Error(response);
  }

  if (!request.responseSchema) {
    return;
  }

  const payload = await parseJson(response);
  const result = request.responseSchema.safeParse(payload);
  if (!result.success) {
    throw new DemoHttpError(
      400,
      "INVALID_CONTRACT",
      "Phase 5 response does not satisfy the approved contract."
    );
  }

  return result.data;
}

function createHeaders(
  dependencies: Phase5ClientDependencies,
  accessToken: string,
  idempotencyKey: string
): Record<string, string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    accept: "application/json",
    "idempotency-key": idempotencyKey.trim() || randomUUID()
  };

  if (dependencies.traceparent) {
    headers.traceparent = dependencies.traceparent;
  }

  if (dependencies.correlationId) {
    headers["x-correlation-id"] = dependencies.correlationId;
  }

  return headers;
}

async function mapPhase5Error(response: Response): Promise<DemoApiError> {
  const payload = await parseJson(response);
  const result = phase5ErrorSchema.safeParse(payload);

  if (result.success) {
    return result.data;
  }

  throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE");
}

async function parseJson(response: Response): Promise<unknown> {
  const body = await response.text();
  if (body.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE");
  }
}
