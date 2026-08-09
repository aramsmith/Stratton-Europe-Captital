import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { DemoApiError } from "@stratton/contracts";
import { DemoHttpError } from "../errors.js";
import type { DelegatedUserToken } from "../identity/delegated-token.js";
import {
  createManagedIdentityApplicationTokenProvider,
  type FederatedAssertionCredential,
  type OboTokenExchange
} from "../identity/obo-token-exchange.js";
import {
  getTrustedRequestContext,
  type TrustedRequestContext
} from "../identity/request-context.js";

const errorSchema = z
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

const analysisBundleStatusSchema = z
  .object({
    tenantId: z.string().min(1),
    caseId: z.string().min(1),
    analysisBundleId: z.string().min(1),
    evidenceManifestHash: z.string().min(1),
    modelRoute: z.enum(["LUNA", "TERRA", "SOL"]),
    modelDeploymentId: z.string().min(1),
    routeEvidenceId: z.string().min(1),
    promptTemplateVersion: z.string().min(1),
    requestFingerprint: z.string().min(1),
    status: z.enum([
      "QUEUED",
      "IN_PROGRESS",
      "DRAFT_ONLY_READY",
      "BLOCKED_MISSING_EVIDENCE",
      "FAILED"
    ]),
    outputKind: z.literal("DRAFT_ONLY"),
    unsupportedClaims: z.number().int().min(0),
    subjectVersion: z.string().min(1).optional(),
    evidence: z.array(
      z
        .object({
          evidenceId: z.string().min(1),
          evidenceVersionId: z.string().min(1),
          ordinal: z.number().int().min(1)
        })
        .strict()
    ),
    citationCounts: z
      .object({
        totalClaims: z.number().int().min(0),
        citedClaims: z.number().int().min(0),
        materialClaims: z.number().int().min(0),
        citedMaterialClaims: z.number().int().min(0),
        unsupportedClaims: z.number().int().min(0)
      })
      .strict()
  })
  .strict();

const reviewResultSchema = z
  .object({
    analysisBundleId: z.string().min(1),
    reviewType: z.enum(["DEAL", "LEGAL", "COMPLIANCE"]),
    decision: z.enum(["APPROVED", "REJECTED"])
  })
  .strict();

const draftResultSchema = z
  .object({
    caseId: z.string().min(1),
    analysisBundleId: z.string().min(1),
    status: z.literal("DRAFT_RECOMMENDATION_READY"),
    outputKind: z.literal("DRAFT_ONLY"),
    citationCounts: z
      .object({
        totalClaims: z.number().int().min(0),
        citedClaims: z.number().int().min(0),
        materialClaims: z.number().int().min(0),
        citedMaterialClaims: z.number().int().min(0),
        unsupportedClaims: z.number().int().min(0)
      })
      .strict()
  })
  .strict();

const approvedModelRouteEvidenceSchema = z
  .object({
    evidenceId: z.string().min(1),
    status: z.enum(["APPROVED", "SUSPENDED", "EXPIRED"]),
    resourceId: z.string().min(1),
    deploymentId: z.string().min(1),
    region: z.string().min(1),
    route: z.enum(["LUNA", "TERRA", "SOL"]),
    apiVersion: z.string().min(1),
    evidenceVersion: z.string().min(1),
    validFromIso: z.string().datetime(),
    validUntilIso: z.string().datetime()
  })
  .strict();

const evidenceAdmissionResultSchema = z
  .object({
    evidenceId: z.string().min(1),
    status: z.literal("ADMITTED")
  })
  .strict();

export type AnalysisBundleStatus = z.infer<typeof analysisBundleStatusSchema>;
export type AnalysisBundleAccepted = AnalysisBundleStatus;
export type AnalysisBundleReady = AnalysisBundleStatus;
export type ApprovedModelRouteEvidence = z.infer<typeof approvedModelRouteEvidenceSchema>;

export interface AdmitEvidenceAuthorityInput {
  readonly tenantId: string;
  readonly caseId: string;
  readonly evidenceId: string;
  readonly idempotencyKey: string;
  readonly correlationId?: string;
}

export interface CreateAnalysisBundleInput {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisBundleId: string;
  readonly modelRoute: "LUNA" | "TERRA" | "SOL";
  readonly modelDeploymentId: string;
  readonly routeEvidenceId: string;
  readonly promptTemplateVersion: string;
  readonly requestFingerprint: string;
  readonly evidenceIds: readonly string[];
}

export interface CompleteAnalysisBundleInput {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisBundleId: string;
  readonly outputManifestHash: string;
  readonly evidenceManifestHash: string;
  readonly modelRoute: "LUNA" | "TERRA" | "SOL";
  readonly modelDeploymentId: string;
  readonly routeEvidenceId: string;
  readonly status: "DRAFT_ONLY_READY";
  readonly citationCounts: AnalysisBundleStatus["citationCounts"];
}

export interface SubmitBundleReviewInput {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisBundleId: string;
  readonly reviewId: string;
  readonly subjectVersion: string;
  readonly reviewType: "DEAL" | "LEGAL" | "COMPLIANCE";
  readonly decision: "APPROVED" | "REJECTED";
  readonly rationale: string;
  readonly evidenceManifestHash: string;
}

export interface PrepareBundleDraftInput {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisBundleId: string;
  readonly subjectVersion: string;
}

export interface DemoAuthorityClient {
  admitEvidence(input: AdmitEvidenceAuthorityInput): Promise<void>;
  createAnalysisBundle(input: CreateAnalysisBundleInput): Promise<AnalysisBundleAccepted>;
  completeAnalysisBundle(input: CompleteAnalysisBundleInput): Promise<AnalysisBundleReady>;
  getAnalysisBundle(bundleId: string): Promise<AnalysisBundleStatus>;
  submitBundleReview(input: SubmitBundleReviewInput): Promise<void>;
  prepareBundleDraft(input: PrepareBundleDraftInput): Promise<void>;
  getModelRouteEvidence(tenantId: string, evidenceId: string): Promise<ApprovedModelRouteEvidence>;
}

export interface CreateDemoAuthorityClientOptions {
  readonly baseUrl: string;
  readonly oboTokenExchange: OboTokenExchange;
  readonly getDelegatedUserToken: () => Promise<DelegatedUserToken>;
  readonly getApplicationToken?: () => Promise<string>;
  readonly phase5ApplicationId?: string;
  readonly managedIdentityClientId?: string;
  readonly managedIdentityCredential?: FederatedAssertionCredential;
  readonly getRequestContext?: () => TrustedRequestContext;
  readonly fetch?: typeof fetch;
}

export function createDemoAuthorityClient(
  options: CreateDemoAuthorityClientOptions
): DemoAuthorityClient {
  const baseUrl = requireHttpsBaseUrl(options.baseUrl);
  const fetchImpl = options.fetch ?? fetch;
  const getRequestContext = options.getRequestContext ?? getTrustedRequestContext;
  const getApplicationToken =
    options.getApplicationToken ??
    createManagedIdentityApplicationTokenProvider({
      phase5ApplicationId: requireApplicationId(options.phase5ApplicationId),
      ...(options.managedIdentityClientId
        ? { managedIdentityClientId: options.managedIdentityClientId }
        : {}),
      ...(options.managedIdentityCredential
        ? { managedIdentityCredential: options.managedIdentityCredential }
        : {})
    });

  const delegatedToken = async (): Promise<string> => {
    const context = getRequestContext();
    const token = await options.getDelegatedUserToken();
    if (token.tenantId !== context.identity.tenantId) {
      throw new DemoHttpError(403, "POLICY_DENIED", "DELEGATED_TOKEN_TENANT_MISMATCH");
    }
    return options.oboTokenExchange.acquirePhase5Token(token.accessToken);
  };

  return {
    admitEvidence: async (input) => {
      await send(
        fetchImpl,
        baseUrl,
        getRequestContext,
        delegatedToken,
        "POST",
        `/v1/evidence/${encodeURIComponent(input.evidenceId)}/admission`,
        { caseId: input.caseId },
        evidenceAdmissionResultSchema,
        input.idempotencyKey
      );
    },
    createAnalysisBundle: async (input) =>
      send(
        fetchImpl,
        baseUrl,
        getRequestContext,
        delegatedToken,
        "POST",
        `/v1/demo-authority/cases/${encodeURIComponent(input.caseId)}/analysis-bundles`,
        input,
        analysisBundleStatusSchema
      ),
    completeAnalysisBundle: async (input) =>
      send(
        fetchImpl,
        baseUrl,
        getRequestContext,
        async () => requireToken(await getApplicationToken()),
        "POST",
        `/v1/demo-authority/analysis-bundles/${encodeURIComponent(input.analysisBundleId)}/completion`,
        input,
        analysisBundleStatusSchema
      ),
    getAnalysisBundle: async (bundleId) =>
      send(
        fetchImpl,
        baseUrl,
        getRequestContext,
        delegatedToken,
        "GET",
        `/v1/demo-authority/analysis-bundles/${encodeURIComponent(bundleId)}`,
        undefined,
        analysisBundleStatusSchema
      ),
    submitBundleReview: async (input) => {
      await send(
        fetchImpl,
        baseUrl,
        getRequestContext,
        delegatedToken,
        "POST",
        `/v1/demo-authority/cases/${encodeURIComponent(input.caseId)}/analysis-bundles/${encodeURIComponent(input.analysisBundleId)}/reviews`,
        input,
        reviewResultSchema
      );
    },
    prepareBundleDraft: async (input) => {
      await send(
        fetchImpl,
        baseUrl,
        getRequestContext,
        delegatedToken,
        "POST",
        `/v1/demo-authority/cases/${encodeURIComponent(input.caseId)}/analysis-bundles/${encodeURIComponent(input.analysisBundleId)}/draft-recommendations`,
        input,
        draftResultSchema
      );
    },
    getModelRouteEvidence: async (tenantId, evidenceId) =>
      send(
        fetchImpl,
        baseUrl,
        () => ({ correlationId: randomUUID() }),
        async () => requireToken(await getApplicationToken()),
        "GET",
        `/v1/demo-authority/model-route-evidence/${encodeURIComponent(evidenceId)}?tenantId=${encodeURIComponent(tenantId)}`,
        undefined,
        approvedModelRouteEvidenceSchema
      )
  };
}

async function send<TSchema extends z.ZodType>(
  fetchImpl: typeof fetch,
  baseUrl: string,
  getRequestContext: () => Pick<TrustedRequestContext, "correlationId" | "traceparent">,
  getAccessToken: () => Promise<string>,
  method: "GET" | "POST",
  path: string,
  body: object | undefined,
  responseSchema: TSchema,
  idempotencyKey?: string
): Promise<z.infer<TSchema>> {
  const accessToken = requireToken(await getAccessToken());
  const context = getRequestContext();
  const headers: Record<string, string> = {
    authorization: `Bearer ${accessToken}`,
    accept: "application/json",
    "x-correlation-id": context.correlationId
  };
  if (context.traceparent) {
    headers.traceparent = context.traceparent;
  }
  if (body) {
    headers["content-type"] = "application/json";
    headers["idempotency-key"] =
      idempotencyKey?.trim() || createIdempotencyKey(method, path, body);
  }

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE");
  }

  if (!response.ok) {
    throw await mapAuthorityError(response);
  }
  const parsed = responseSchema.safeParse(await parseJson(response));
  if (!parsed.success) {
    throw new DemoHttpError(400, "INVALID_CONTRACT", "PHASE5_RESPONSE_CONTRACT_INVALID");
  }
  return parsed.data;
}

function createIdempotencyKey(method: string, path: string, body: object): string {
  return createHash("sha256")
    .update(JSON.stringify({ method, path, body: canonicalize(body) }))
    .digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function requireHttpsBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      throw new Error("invalid base url");
    }
    return url.toString().replace(/\/$/u, "");
  } catch {
    throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "PHASE5_BASE_URL_INVALID");
  }
}

function requireToken(value: string): string {
  const token = value.trim();
  if (!token) {
    throw new DemoHttpError(401, "UNAUTHENTICATED");
  }
  return token;
}

function requireApplicationId(value: string | undefined): string {
  if (!value?.trim()) {
    throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "PHASE5_APPLICATION_ID_REQUIRED");
  }
  return value;
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

async function mapAuthorityError(response: Response): Promise<DemoApiError> {
  const result = errorSchema.safeParse(await parseJson(response));
  if (result.success) {
    return result.data;
  }
  throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE");
}
