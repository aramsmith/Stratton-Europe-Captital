import { createHash, randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createDemoAuthorityService, DemoAuthorityError } from "./demo-authority-service.js";
import type { BearerTokenVerifier } from "./entra-bearer-token-verifier.js";
import { health, readiness } from "./health.js";
import { StructuredLogger } from "./logger.js";
import { evaluateRolloutAdmission, policyInputHash } from "./policy-service.js";
import { QueueOutboxDispatcher } from "./queue-outbox-dispatcher.js";
import { transitionCaseState } from "./state-machine.js";
import type {
  AuthenticatedPrincipal,
  CaseRecord,
  QueueMessage,
  IdempotencyStore,
  QueueProducer,
  ReviewType,
  TransitionContext,
  TransitionPolicyEvidence,
  WorkloadRepository
} from "./types.js";
import { newPolicyDecisionRecord } from "./workload-repository.js";

type OperationId =
  | "createCase"
  | "registerSource"
  | "createExternalLicenceDecision"
  | "requestIngestion"
  | "admitEvidence"
  | "requestAnalysis"
  | "getAnalysisStatus"
  | "submitReview"
  | "prepareDraft"
  | "exportValidationEvidence"
  | "recordVerdict"
  | "createDemoAnalysisBundle"
  | "getDemoAnalysisBundle"
  | "completeDemoAnalysisBundle"
  | "submitDemoBundleReview"
  | "prepareDemoBundleDraft"
  | "getDemoModelRouteEvidence";

interface Route {
  readonly method: "GET" | "POST";
  readonly operationId: OperationId;
  readonly pattern: RegExp;
  readonly roles: readonly string[];
  readonly mutation: boolean;
  readonly authenticatedOnly?: boolean;
  readonly handler: (context: RequestContext, match: RegExpExecArray) => Promise<ResponsePayload>;
}

interface RequestContext {
  readonly request: IncomingMessage;
  readonly body: Record<string, unknown> | undefined;
  readonly principal: AuthenticatedPrincipal;
  readonly correlationId: string;
}

interface ResponsePayload {
  readonly statusCode: number;
  readonly body: unknown;
}

interface ErrorPayload {
  readonly status: number;
  readonly code:
    | "INVALID_CONTRACT"
    | "UNAUTHENTICATED"
    | "POLICY_DENIED"
    | "STATE_CONFLICT"
    | "EVIDENCE_INCOMPLETE"
    | "CAPACITY_LIMIT"
    | "DEPENDENCY_UNAVAILABLE";
  readonly message: string;
  readonly correlationId: string;
}

class HttpError extends Error {
  public constructor(
    public readonly statusCode: ErrorPayload["status"],
    public readonly code: ErrorPayload["code"]
  ) {
    super(code);
  }
}

export interface ApiRuntimeConfig {
  readonly repository: WorkloadRepository;
  readonly idempotencyStore: IdempotencyStore;
  readonly queueProducer: QueueProducer;
  readonly logger: StructuredLogger;
  readonly requestBodyLimitBytes: number;
  readonly modelProviderEvidenceId: string;
  readonly regionalDeploymentEvidenceId: string;
  readonly promptGovernanceEvidenceId: string;
  readonly idempotencyLeaseDurationSeconds: number;
  readonly analysisCapabilityEnabled: boolean;
  readonly auditExportCapabilityEnabled: boolean;
  readonly completionClientId?: string;
  readonly bearerTokenVerifier?: BearerTokenVerifier;
}

export const implementedOperations: readonly {
  readonly operationId: OperationId;
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly roles: readonly string[];
}[] = [
  { operationId: "createCase", method: "POST", path: "/v1/cases", roles: ["DealInitiator"] },
  {
    operationId: "registerSource",
    method: "POST",
    path: "/v1/cases/{caseId}/sources",
    roles: ["SourceOwner"]
  },
  {
    operationId: "createExternalLicenceDecision",
    method: "POST",
    path: "/v1/sources/{sourceId}/licence-decisions",
    roles: ["LegalApprover", "DataOwner"]
  },
  {
    operationId: "requestIngestion",
    method: "POST",
    path: "/v1/cases/{caseId}/ingestions",
    roles: ["DealContributor"]
  },
  {
    operationId: "admitEvidence",
    method: "POST",
    path: "/v1/evidence/{evidenceId}/admission",
    roles: ["DataSteward"]
  },
  {
    operationId: "requestAnalysis",
    method: "POST",
    path: "/v1/cases/{caseId}/analysis-runs",
    roles: ["DealContributor"]
  },
  {
    operationId: "getAnalysisStatus",
    method: "GET",
    path: "/v1/analysis-runs/{analysisRunId}",
    roles: ["CaseReader"]
  },
  {
    operationId: "submitReview",
    method: "POST",
    path: "/v1/cases/{caseId}/reviews",
    roles: ["DealReviewer", "LegalApprover", "ComplianceApprover"]
  },
  {
    operationId: "prepareDraft",
    method: "POST",
    path: "/v1/cases/{caseId}/draft-recommendations",
    roles: ["DealReviewer"]
  },
  {
    operationId: "exportValidationEvidence",
    method: "POST",
    path: "/v1/validation-exports",
    roles: ["ValidationProducer"]
  },
  {
    operationId: "recordVerdict",
    method: "POST",
    path: "/assurance/v1/verdicts",
    roles: ["InternalAuditValidator"]
  }
] as const;

function deterministicId(...parts: readonly string[]): string {
  return createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 32);
}

function auditSourceEventId(
  tenantId: string,
  caseId: string,
  action: string,
  subjectId: string,
  correlationId: string
): string {
  return deterministicId(tenantId, caseId, action, subjectId, correlationId);
}

function createScopedRepository(base: WorkloadRepository): {
  readonly proxy: WorkloadRepository;
  runScoped<T>(scopedRepository: WorkloadRepository, callback: () => Promise<T>): Promise<T>;
} {
  const storage = new AsyncLocalStorage<WorkloadRepository>();
  const proxy = new Proxy(base as object, {
    get(_target, property, _receiver) {
      const active = storage.getStore() ?? base;
      const value = (active as unknown as Record<PropertyKey, unknown>)[property];
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(active);
      }
      return value;
    }
  }) as WorkloadRepository;
  return {
    proxy,
    runScoped: (scopedRepository, callback) => storage.run(scopedRepository, callback)
  };
}

function createScopedQueueProducer(base: QueueProducer): {
  readonly proxy: QueueProducer;
  runScoped<T>(messages: QueueMessage[], callback: () => Promise<T>): Promise<T>;
} {
  const storage = new AsyncLocalStorage<QueueMessage[]>();
  return {
    proxy: {
      send: async (message: QueueMessage) => {
        const scoped = storage.getStore();
        if (scoped) {
          scoped.push(message);
          return;
        }
        await base.send(message);
      },
      isAvailable: async () => base.isAvailable()
    },
    runScoped: (messages, callback) => storage.run(messages, callback)
  };
}

function asRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJsonResponse(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  correlationId: string
): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.setHeader("x-correlation-id", correlationId);
  response.end(JSON.stringify(body));
}

function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "INVALID_CONTRACT");
  }
  return value.trim();
}

function requireBoolean(body: Record<string, unknown>, key: string): boolean {
  const value = body[key];
  if (typeof value !== "boolean") {
    throw new HttpError(400, "INVALID_CONTRACT");
  }
  return value;
}

function requireInteger(body: Record<string, unknown>, key: string): number {
  const value = body[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new HttpError(400, "INVALID_CONTRACT");
  }
  return value;
}

function parseIsoInstant(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new HttpError(400, "INVALID_CONTRACT");
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, "INVALID_CONTRACT");
  }
  return new Date(parsed).toISOString();
}

function readHeader(request: IncomingMessage, name: string): string | undefined {
  const raw = request.headers[name.toLowerCase()];
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (typeof first === "string" && first.trim().length > 0) {
      return first.trim();
    }
  }
  return undefined;
}

function parseEasyAuthPrincipal(encoded: string): AuthenticatedPrincipal {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new HttpError(401, "UNAUTHENTICATED");
  }
  if (!asRecord(parsed)) {
    throw new HttpError(401, "UNAUTHENTICATED");
  }
  const authType = typeof parsed.auth_typ === "string" ? parsed.auth_typ.toLowerCase() : "";
  if (authType !== "aad" && authType !== "azureactivedirectory") {
    throw new HttpError(401, "UNAUTHENTICATED");
  }
  const claims = Array.isArray(parsed.claims)
    ? parsed.claims
        .filter((claim) => asRecord(claim))
        .map((claim) => ({
          typ: typeof claim.typ === "string" ? claim.typ.toLowerCase() : "",
          val: typeof claim.val === "string" ? claim.val : ""
        }))
        .filter((claim) => claim.typ.length > 0 && claim.val.length > 0)
    : [];

  const claim = (...keys: string[]): string | undefined =>
    claims.find((entry) => keys.includes(entry.typ))?.val;
  const tenantId = claim("tid");
  const subjectId = claim("oid", "sub");
  const issuer = claim("iss", "idp");
  if (!tenantId || !subjectId || !issuer) {
    throw new HttpError(401, "UNAUTHENTICATED");
  }
  let issuerUrl: URL;
  try {
    issuerUrl = new URL(issuer);
  } catch {
    throw new HttpError(401, "UNAUTHENTICATED");
  }
  const host = issuerUrl.host.toLowerCase();
  const allowedHosts = new Set(["login.microsoftonline.com", "sts.windows.net"]);
  if (!allowedHosts.has(host)) {
    throw new HttpError(401, "UNAUTHENTICATED");
  }
  const pathTenant = issuerUrl.pathname.split("/").filter((segment) => segment.length > 0)[0];
  if (!pathTenant || pathTenant.toLowerCase() !== tenantId.toLowerCase()) {
    throw new HttpError(401, "UNAUTHENTICATED");
  }

  const roleType = typeof parsed.role_typ === "string" ? parsed.role_typ.toLowerCase() : "roles";
  const roles = claims
    .filter((entry) => entry.typ === roleType || entry.typ === "roles")
    .map((entry) => entry.val);
  const idType = claim("idtyp");
  const appId = claim("appid", "azp");
  const isHuman = idType?.toLowerCase() === "user" && !appId;
  return {
    tenantId,
    subjectId,
    roles,
    identityProvider: issuer,
    authType,
    isHuman,
    ...(appId ? { applicationId: appId } : {})
  };
}

async function parsePrincipal(
  request: IncomingMessage,
  bearerTokenVerifier?: BearerTokenVerifier
): Promise<AuthenticatedPrincipal> {
  if (bearerTokenVerifier) {
    const authorization = readHeader(request, "authorization");
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    if (!match?.[1]) {
      throw new HttpError(401, "UNAUTHENTICATED");
    }
    try {
      return await bearerTokenVerifier.verify(match[1]);
    } catch {
      throw new HttpError(401, "UNAUTHENTICATED");
    }
  }

  const encoded = readHeader(request, "x-ms-client-principal");
  if (!encoded) {
    throw new HttpError(401, "UNAUTHENTICATED");
  }
  return parseEasyAuthPrincipal(encoded);
}

function assertHumanPrincipal(principal: AuthenticatedPrincipal): void {
  if (!principal.isHuman) {
    throw new HttpError(403, "POLICY_DENIED");
  }
}

function requireRole(principal: AuthenticatedPrincipal, allowed: readonly string[]): void {
  if (!allowed.some((role) => principal.roles.includes(role))) {
    throw new HttpError(403, "POLICY_DENIED");
  }
}

async function parseBody(
  request: IncomingMessage,
  requestBodyLimitBytes: number
): Promise<Record<string, unknown> | undefined> {
  if (request.method !== "POST") {
    return undefined;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const next = Buffer.from(chunk);
    size += next.length;
    if (size > requestBodyLimitBytes) {
      throw new HttpError(400, "INVALID_CONTRACT");
    }
    chunks.push(next);
  }
  if (chunks.length === 0) {
    return {};
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "INVALID_CONTRACT");
  }
  if (!asRecord(value)) {
    throw new HttpError(400, "INVALID_CONTRACT");
  }
  return value;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonical(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(request: IncomingMessage, body: Record<string, unknown> | undefined): string {
  return createHash("sha256")
    .update(
      canonical({
        method: request.method ?? "",
        url: request.url ?? "",
        body: body ?? {}
      })
    )
    .digest("hex");
}

function isExpired(expiresAtIso: string): boolean {
  return Date.parse(expiresAtIso) <= Date.now();
}

async function assertCaseAccess(
  repository: WorkloadRepository,
  caseRecord: CaseRecord,
  principal: AuthenticatedPrincipal
): Promise<void> {
  const allowed = await repository.assertCaseAccess(
    caseRecord.tenantId,
    caseRecord.caseId,
    principal.subjectId,
    caseRecord.purpose
  );
  if (!allowed) {
    throw new HttpError(403, "POLICY_DENIED");
  }
}

async function approvalEvidence(repository: WorkloadRepository, caseRecord: CaseRecord): Promise<{
  approvedDeal: boolean;
  approvedJurisdiction: boolean;
}> {
  const approvedDeal = await repository.isEligibilityDecisionApproved(
    caseRecord.tenantId,
    caseRecord.caseId,
    "DEAL",
    caseRecord.dealEligibilityDecisionId
  );
  const approvedJurisdiction = await repository.isEligibilityDecisionApproved(
    caseRecord.tenantId,
    caseRecord.caseId,
    "JURISDICTION",
    caseRecord.jurisdictionEligibilityDecisionId
  );
  return { approvedDeal, approvedJurisdiction };
}

async function buildPolicyEvidence(
  config: ApiRuntimeConfig,
  principal: AuthenticatedPrincipal,
  caseRecord: CaseRecord,
  input: {
    readonly sourceId?: string;
    readonly evidenceId?: string;
    readonly analysisRunId?: string;
    readonly specialCategoryFromRequest?: boolean;
    readonly humanSpecialistReviewComplete?: boolean;
  }
): Promise<TransitionPolicyEvidence> {
  const source = input.sourceId
    ? await config.repository.getSource(caseRecord.tenantId, caseRecord.caseId, input.sourceId)
    : undefined;
  const licence = source
    ? await config.repository.getLatestExternalLicenceDecision(
        caseRecord.tenantId,
        caseRecord.caseId,
        source.sourceId
      )
    : undefined;
  const evidence = input.evidenceId
    ? await config.repository.getEvidence(caseRecord.tenantId, caseRecord.caseId, input.evidenceId)
    : undefined;
  const analysis = input.analysisRunId
    ? await config.repository.getAnalysisRun(caseRecord.tenantId, caseRecord.caseId, input.analysisRunId)
    : undefined;
  const citationAssessment = input.analysisRunId
    ? await config.repository.getCitationAssessment(
        caseRecord.tenantId,
        caseRecord.caseId,
        input.analysisRunId
      )
    : {
        allMaterialClaimsCited: false,
        unsupportedClaimCount: 0,
        criticalUnsupportedClaimCount: 0,
        materialClaimCount: 0,
        citedMaterialClaimCount: 0,
        totalClaimCount: 0,
        citedClaimCount: 0
      };
  const approvals = await approvalEvidence(config.repository, caseRecord);
  const licenceActive = licence !== undefined && !isExpired(licence.expiresAtIso);
  const specialCategoryPersisted =
    input.specialCategoryFromRequest ?? evidence?.hasSpecialCategoryData ?? false;
  return {
    actorRole: principal.roles[0] ?? "Unknown",
    isHuman: principal.isHuman,
    approvedDeal: approvals.approvedDeal,
    approvedJurisdiction: approvals.approvedJurisdiction,
    sourceActive: source?.status === "ACTIVE" && licenceActive,
    permissionScopeAllowed: licenceActive && (licence?.purposeApproved ?? false),
    purposeOfUseAllowed: licenceActive && (licence?.purposeApproved ?? false),
    privacyLawfulBasisPresent: licenceActive && (licence?.privacyApproved ?? false),
    externalDataLicencePresent: licenceActive,
    externalDataLicenceCompatible: licenceActive && (licence?.licenceCompatible ?? false),
    aiRetrievalAllowed: licenceActive && (licence?.aiRetrievalAllowed ?? false),
    aiAnalysisAllowed: licenceActive && (licence?.aiAnalysisAllowed ?? false),
    specialCategoryDataPresent: specialCategoryPersisted,
    confidenceCoverageSufficient: citationAssessment.criticalUnsupportedClaimCount === 0,
    allMaterialClaimsCited:
      citationAssessment.totalClaimCount > 0 && citationAssessment.allMaterialClaimsCited,
    criticalUnsupportedClaimCount: citationAssessment.criticalUnsupportedClaimCount,
    evidenceAdmitted: evidence?.admissionStatus === "ADMITTED",
    modelProviderEvidencePresent:
      analysis?.modelProviderEvidenceId === config.modelProviderEvidenceId,
    modelRegionEvidencePresent:
      analysis?.regionalDeploymentEvidenceId === config.regionalDeploymentEvidenceId,
    promptGovernanceEvidencePresent:
      analysis?.promptGovernanceEvidenceId === config.promptGovernanceEvidenceId,
    humanSpecialistReviewComplete: input.humanSpecialistReviewComplete ?? false
  };
}

async function appendPolicyDecision(
  config: ApiRuntimeConfig,
  context: TransitionContext,
  allowed: boolean,
  denialReasons: readonly string[],
  correlationId: string
): Promise<void> {
  await config.repository.appendPolicyDecision(
    newPolicyDecisionRecord(
      context.tenantId,
      context.caseId,
      context.event,
      "release-1",
      policyInputHash(context),
      allowed ? "ALLOW" : "DENY",
      denialReasons,
      correlationId
    )
  );
}

function parseReviewType(body: Record<string, unknown>): ReviewType {
  const value = requireString(body, "reviewType");
  if (value !== "DEAL" && value !== "LEGAL" && value !== "COMPLIANCE") {
    throw new HttpError(400, "INVALID_CONTRACT");
  }
  return value;
}

function parseReviewDecision(body: Record<string, unknown>): "APPROVED" | "REJECTED" {
  const value = requireString(body, "decision");
  if (value !== "APPROVED" && value !== "REJECTED") {
    throw new HttpError(400, "INVALID_CONTRACT");
  }
  return value;
}

function parseEvidenceQualityStatus(
  body: Record<string, unknown>
): "APPROVED" | "PENDING_REVIEW" | "REJECTED" {
  const value = requireString(body, "qualityStatus");
  if (value !== "APPROVED" && value !== "PENDING_REVIEW" && value !== "REJECTED") {
    throw new HttpError(400, "INVALID_CONTRACT");
  }
  return value;
}

function assertReviewRole(principal: AuthenticatedPrincipal, reviewType: ReviewType): void {
  if (reviewType === "DEAL" && !principal.roles.includes("DealReviewer")) {
    throw new HttpError(403, "POLICY_DENIED");
  }
  if (reviewType === "LEGAL" && !principal.roles.includes("LegalApprover")) {
    throw new HttpError(403, "POLICY_DENIED");
  }
  if (reviewType === "COMPLIANCE" && !principal.roles.includes("ComplianceApprover")) {
    throw new HttpError(403, "POLICY_DENIED");
  }
}

function mapError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }
  if (error instanceof DemoAuthorityError) {
    return new HttpError(error.statusCode, error.code);
  }
  return new HttpError(503, "DEPENDENCY_UNAVAILABLE");
}

function errorMessage(code: ErrorPayload["code"]): string {
  const map: Readonly<Record<ErrorPayload["code"], string>> = {
    INVALID_CONTRACT: "Request does not satisfy the approved contract.",
    UNAUTHENTICATED: "Authenticated Microsoft Entra principal is required.",
    POLICY_DENIED: "Policy denied this operation.",
    STATE_CONFLICT: "Resource state does not permit this operation.",
    EVIDENCE_INCOMPLETE: "Required evidence is incomplete or missing.",
    CAPACITY_LIMIT: "Rollout admission limit reached.",
    DEPENDENCY_UNAVAILABLE: "Required dependency is unavailable."
  };
  return map[code];
}

function routeByPath(routes: readonly Route[], method: string, path: string): { route: Route; match: RegExpExecArray } | undefined {
  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }
    const match = route.pattern.exec(path);
    if (match) {
      return { route, match };
    }
  }
  return undefined;
}

function routeCaseId(
  operationId: OperationId,
  match: RegExpExecArray,
  body: Record<string, unknown> | undefined
): string {
  if (
    operationId === "createCase" ||
    operationId === "exportValidationEvidence" ||
    operationId === "completeDemoAnalysisBundle"
  ) {
    return body && typeof body.caseId === "string" ? body.caseId : "unknown";
  }
  if (operationId === "admitEvidence") {
    return body && typeof body.caseId === "string" ? body.caseId : "unknown";
  }
  return match[1] ?? "unknown";
}

function buildRoutes(config: ApiRuntimeConfig): readonly Route[] {
  const demoAuthority = createDemoAuthorityService({
    repository: config.repository,
    completionClientId: config.completionClientId ?? ""
  });
  return [
    {
      method: "POST",
      operationId: "createCase",
      pattern: /^\/v1\/cases$/,
      roles: ["DealInitiator"],
      mutation: true,
      handler: async ({ body, principal, correlationId }) => {
        if (!body) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        assertHumanPrincipal(principal);
        const tenantId = requireString(body, "tenantId");
        const caseId = requireString(body, "caseId");
        if (tenantId !== principal.tenantId) {
          throw new HttpError(403, "POLICY_DENIED");
        }
        const rolloutSequence = requireInteger(body, "rolloutSequence");
        if (rolloutSequence < 1 || rolloutSequence > 20) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        const rollout = evaluateRolloutAdmission(rolloutSequence - 1);
        if (!rollout.allowed) {
          throw new HttpError(429, "CAPACITY_LIMIT");
        }
        const dealDecisionId = requireString(body, "dealEligibilityDecisionId");
        const jurisdictionDecisionId = requireString(body, "jurisdictionEligibilityDecisionId");
        const approvedDeal = await config.repository.isEligibilityDecisionApproved(
          tenantId,
          caseId,
          "DEAL",
          dealDecisionId
        );
        const approvedJurisdiction = await config.repository.isEligibilityDecisionApproved(
          tenantId,
          caseId,
          "JURISDICTION",
          jurisdictionDecisionId
        );
        if (!approvedDeal || !approvedJurisdiction) {
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        await config.repository.createCase({
          tenantId,
          caseId,
          jurisdiction: requireString(body, "jurisdiction"),
          purpose: requireString(body, "purpose"),
          status: "DRAFT",
          createdBy: principal.subjectId,
          openedAtIso: new Date().toISOString(),
          dealEligibilityDecisionId: dealDecisionId,
          jurisdictionEligibilityDecisionId: jurisdictionDecisionId,
          rolloutSequence
        });
        await config.repository.grantCaseAccess({
          tenantId,
          caseId,
          subjectId: principal.subjectId,
          purpose: requireString(body, "purpose"),
          role: "DealInitiator"
        });
        await config.repository.appendPolicyDecision(
          newPolicyDecisionRecord(
            tenantId,
            caseId,
            "CREATE_CASE",
            "release-1",
            createHash("sha256").update(`${tenantId}:${caseId}`).digest("hex"),
            "ALLOW",
            [],
            correlationId
          )
        );
        await config.repository.appendAuditEvent({
          tenantId,
          caseId,
          sourceEventId: auditSourceEventId(tenantId, caseId, "CREATE_CASE", caseId, correlationId),
          actorId: principal.subjectId,
          action: "CREATE_CASE",
          subjectId: caseId,
          correlationId,
          outcome: "SUCCESS",
          payloadReference: caseId
        });
        return { statusCode: 201, body: { tenantId, caseId, status: "DRAFT", rolloutSequence } };
      }
    },
    {
      method: "POST",
      operationId: "registerSource",
      pattern: /^\/v1\/cases\/([^/]+)\/sources$/,
      roles: ["SourceOwner"],
      mutation: true,
      handler: async ({ body, principal, correlationId, request }, match) => {
        if (!body) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        const caseId = match[1];
        if (!caseId) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        const caseRecord = await config.repository.getCase(principal.tenantId, caseId);
        if (!caseRecord) {
          throw new HttpError(409, "STATE_CONFLICT");
        }
        await assertCaseAccess(config.repository, caseRecord, principal);
        const interfaceType = requireString(body, "interfaceType");
        if (interfaceType !== "READ_ONLY_API" && interfaceType !== "CONTROLLED_FILE_INGESTION") {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        const sourceId = requireString(body, "sourceId");
        await config.repository.upsertSource({
          tenantId: principal.tenantId,
          caseId,
          sourceId,
          ownerId: requireString(body, "ownerId"),
          domain: requireString(body, "domain"),
          authoritativeStatus: requireString(body, "authoritativeStatus"),
          authoritativeSystem: requireString(body, "authoritativeSystem"),
          interfaceType,
          permissionEvidenceId: requireString(body, "permissionEvidenceId"),
          connectorEvidenceId: requireString(body, "connectorEvidenceId"),
          jurisdiction: requireString(body, "jurisdiction"),
          sourceVersion: requireString(body, "sourceVersion"),
          status: "DISABLED"
        });
        await config.repository.appendAuditEvent({
          tenantId: principal.tenantId,
          caseId,
          sourceEventId: auditSourceEventId(principal.tenantId, caseId, "REGISTER_SOURCE", sourceId, correlationId),
          actorId: principal.subjectId,
          action: "REGISTER_SOURCE",
          subjectId: sourceId,
          correlationId,
          outcome: "SUCCESS",
          payloadReference: sourceId
        });
        return { statusCode: 201, body: { sourceId, status: "DISABLED" } };
      }
    },
    {
      method: "POST",
      operationId: "createExternalLicenceDecision",
      pattern: /^\/v1\/sources\/([^/]+)\/licence-decisions$/,
      roles: ["LegalApprover", "DataOwner"],
      mutation: true,
      handler: async ({ body, principal, correlationId, request }, match) => {
        if (!body) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        assertHumanPrincipal(principal);
        const sourceId = match[1];
        const caseId = requireString(body, "caseId");
        if (!sourceId) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        const caseRecord = await config.repository.getCase(principal.tenantId, caseId);
        if (!caseRecord) {
          throw new HttpError(409, "STATE_CONFLICT");
        }
        await assertCaseAccess(config.repository, caseRecord, principal);
        const source = await config.repository.getSource(principal.tenantId, caseId, sourceId);
        if (!source) {
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        const expiresAtIso = parseIsoInstant(requireString(body, "expiresAtIso"));
        const decision = {
          tenantId: principal.tenantId,
          caseId,
          sourceId,
          licenceDecisionId: randomUUID(),
          licenceEvidenceId: requireString(body, "licenceEvidenceId"),
          aiRetrievalAllowed: requireBoolean(body, "aiRetrievalAllowed"),
          aiAnalysisAllowed: requireBoolean(body, "aiAnalysisAllowed"),
          purposeId: requireString(body, "purposeId"),
          purposeApproved: requireBoolean(body, "purposeApproved"),
          privacyApproved: requireBoolean(body, "privacyApproved"),
          licenceCompatible: requireBoolean(body, "licenceCompatible"),
          expiresAtIso,
          lawfulBasis: requireString(body, "lawfulBasis"),
          approvedBy: principal.subjectId
        } as const;
        await config.repository.appendExternalLicenceDecision(decision);
        const active =
          decision.aiRetrievalAllowed &&
          decision.aiAnalysisAllowed &&
          decision.purposeApproved &&
          decision.privacyApproved &&
          decision.licenceCompatible &&
          !isExpired(decision.expiresAtIso);
        await config.repository.upsertSource({
          ...source,
          status: active ? "ACTIVE" : "SUSPENDED"
        });
        await config.repository.appendAuditEvent({
          tenantId: principal.tenantId,
          caseId,
          sourceEventId: auditSourceEventId(
            principal.tenantId,
            caseId,
            "CREATE_EXTERNAL_LICENCE_DECISION",
            sourceId,
            correlationId
          ),
          actorId: principal.subjectId,
          action: "CREATE_EXTERNAL_LICENCE_DECISION",
          subjectId: sourceId,
          correlationId,
          outcome: "SUCCESS",
          payloadReference: sourceId
        });
        return { statusCode: 201, body: { sourceId, status: active ? "ACTIVE" : "SUSPENDED" } };
      }
    },
    {
      method: "POST",
      operationId: "requestIngestion",
      pattern: /^\/v1\/cases\/([^/]+)\/ingestions$/,
      roles: ["DealContributor"],
      mutation: true,
      handler: async ({ body, principal, correlationId, request }, match) => {
        if (!body) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        const caseId = match[1];
        if (!caseId) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        if (requireString(body, "caseId") !== caseId) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        const caseRecord = await config.repository.getCase(principal.tenantId, caseId);
        if (!caseRecord) {
          throw new HttpError(409, "STATE_CONFLICT");
        }
        await assertCaseAccess(config.repository, caseRecord, principal);
        const sourceId = requireString(body, "sourceId");
        const source = await config.repository.getSource(principal.tenantId, caseId, sourceId);
        if (!source) {
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        const licence = await config.repository.getLatestExternalLicenceDecision(
          principal.tenantId,
          caseId,
          sourceId
        );
        if (!licence || isExpired(licence.expiresAtIso)) {
          await config.repository.upsertSource({ ...source, status: "SUSPENDED" });
          throw new HttpError(403, "POLICY_DENIED");
        }
        const hasSpecialCategoryData = requireBoolean(body, "hasSpecialCategoryData");
        if (hasSpecialCategoryData) {
          throw new HttpError(403, "POLICY_DENIED");
        }
        const evidenceForTransition = await buildPolicyEvidence(config, principal, caseRecord, {
          sourceId,
          specialCategoryFromRequest: hasSpecialCategoryData
        });
        const transitionContext: TransitionContext = {
          tenantId: principal.tenantId,
          caseId,
          currentStatus: caseRecord.status,
          event: "REQUEST_INGESTION",
          evidence: evidenceForTransition
        };
        const transition = transitionCaseState(transitionContext);
        await appendPolicyDecision(
          config,
          transitionContext,
          transition.allowed,
          transition.denialReasons,
          correlationId
        );
        if (!transition.allowed) {
          throw new HttpError(403, "POLICY_DENIED");
        }
        const evidenceId = requireString(body, "evidenceId");
        const payloadReference = requireString(body, "payloadReference");
        const requestIdempotencyKey = readHeader(request, "idempotency-key") ?? "missing-idempotency-key";
        await config.repository.createEvidence({
          tenantId: principal.tenantId,
          caseId,
          evidenceId,
          sourceId,
          sourceVersion: requireString(body, "sourceVersion"),
          ownerId: source.ownerId,
          capturedAtIso: new Date().toISOString(),
          licenceDecisionId: licence.licenceDecisionId,
          purposeId: caseRecord.purpose,
          classification: requireString(body, "classification"),
          qualityStatus: parseEvidenceQualityStatus(body),
          contentHash: requireString(body, "contentHash"),
          payloadReference,
          hasSpecialCategoryData,
          isExternalData: true,
          admissionStatus: "QUARANTINED"
        });
        await config.repository.updateCaseStatus(principal.tenantId, caseId, transition.nextStatus);
        const workItemId = deterministicId(
          principal.tenantId,
          caseId,
          "REQUEST_INGESTION",
          requestIdempotencyKey
        );
        const queueIdempotencyKey = `ingestion:${requestIdempotencyKey}`;
        await config.repository.appendWorkItem({
          tenantId: principal.tenantId,
          caseId,
          workItemId,
          queueName: "q-ingestion",
          operation: "REQUEST_INGESTION",
          workType: "REQUEST_INGESTION",
          messageId: workItemId,
          idempotencyKey: queueIdempotencyKey,
          attempt: 1,
          status: "QUEUED",
          payloadReference,
          correlationId,
          queuedAtIso: new Date().toISOString(),
          evidenceId
        });
        await config.queueProducer.send({
          messageId: workItemId,
          tenantId: principal.tenantId,
          caseId,
          operation: "REQUEST_INGESTION",
          queueName: "q-ingestion",
          payloadReference,
          idempotencyKey: queueIdempotencyKey,
          correlationId,
          sourceId,
          evidenceId
        });
        await config.repository.appendAuditEvent({
          tenantId: principal.tenantId,
          caseId,
          sourceEventId: auditSourceEventId(principal.tenantId, caseId, "REQUEST_INGESTION", evidenceId, correlationId),
          actorId: principal.subjectId,
          action: "REQUEST_INGESTION",
          subjectId: evidenceId,
          correlationId,
          outcome: "SUCCESS",
          payloadReference
        });
        return { statusCode: 202, body: { workItemId, status: "QUEUED" } };
      }
    },
    {
      method: "POST",
      operationId: "admitEvidence",
      pattern: /^\/v1\/evidence\/([^/]+)\/admission$/,
      roles: ["DataSteward"],
      mutation: true,
      handler: async ({ body, principal, correlationId, request }, match) => {
        if (!body) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        assertHumanPrincipal(principal);
        const evidenceId = match[1];
        const caseId = requireString(body, "caseId");
        if (!evidenceId) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        const caseRecord = await config.repository.getCase(principal.tenantId, caseId);
        if (!caseRecord) {
          throw new HttpError(409, "STATE_CONFLICT");
        }
        await assertCaseAccess(config.repository, caseRecord, principal);
        const evidence = await config.repository.getEvidence(principal.tenantId, caseId, evidenceId);
        if (!evidence) {
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        const latestObject = await config.repository.getLatestEvidenceObject(
          principal.tenantId,
          caseId,
          evidenceId
        );
        if (
          !latestObject ||
          latestObject.contentHash !== evidence.contentHash ||
          latestObject.malwareScanStatus !== "CLEAN" ||
          latestObject.dispositionStatus === "DISPOSED" ||
          evidence.qualityStatus !== "APPROVED"
        ) {
          await config.repository.appendEvidenceAdmissionDecision({
            tenantId: principal.tenantId,
            caseId,
            evidenceId,
            admissionDecisionId: randomUUID(),
            decision: "QUARANTINED",
            reasonCodes: ["EVIDENCE_OBJECT_INCOMPLETE"],
            policyVersion: "release-1",
            deciderObjectId: principal.subjectId,
            decidedAtIso: new Date().toISOString()
          });
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        const transitionEvidence = await buildPolicyEvidence(config, principal, caseRecord, {
          sourceId: evidence.sourceId,
          evidenceId
        });
        const context: TransitionContext = {
          tenantId: principal.tenantId,
          caseId,
          currentStatus: caseRecord.status,
          event: "PROMOTE_EVIDENCE",
          evidence: transitionEvidence
        };
        const transition = transitionCaseState(context);
        await appendPolicyDecision(config, context, transition.allowed, transition.denialReasons, correlationId);
        await config.repository.appendEvidenceAdmissionDecision({
          tenantId: principal.tenantId,
          caseId,
          evidenceId,
          admissionDecisionId: randomUUID(),
          decision: transition.allowed ? "ADMITTED" : "QUARANTINED",
          reasonCodes: transition.denialReasons,
          policyVersion: "release-1",
          deciderObjectId: principal.subjectId,
          decidedAtIso: new Date().toISOString()
        });
        if (!transition.allowed) {
          throw new HttpError(403, "POLICY_DENIED");
        }
        await config.repository.admitEvidence(principal.tenantId, caseId, evidenceId);
        await config.repository.updateCaseStatus(principal.tenantId, caseId, transition.nextStatus);
        const requestIdempotencyKey = readHeader(request, "idempotency-key") ?? "missing-idempotency-key";
        const extractionMessageId = deterministicId(
          principal.tenantId,
          caseId,
          "REQUEST_EXTRACTION",
          `${evidenceId}:${latestObject.evidenceVersionId}:${requestIdempotencyKey}`
        );
        await config.repository.appendWorkItem({
          tenantId: principal.tenantId,
          caseId,
          workItemId: extractionMessageId,
          queueName: "q-extraction",
          operation: "REQUEST_EXTRACTION",
          workType: "REQUEST_EXTRACTION",
          messageId: extractionMessageId,
          idempotencyKey: `REQUEST_EXTRACTION:${evidenceId}:${latestObject.evidenceVersionId}`,
          attempt: 1,
          status: "QUEUED",
          payloadReference: evidence.payloadReference,
          correlationId,
          queuedAtIso: new Date().toISOString(),
          evidenceId,
          evidenceVersionId: latestObject.evidenceVersionId
        });
        await config.queueProducer.send({
          messageId: extractionMessageId,
          tenantId: principal.tenantId,
          caseId,
          queueName: "q-extraction",
          operation: "REQUEST_EXTRACTION",
          payloadReference: evidence.payloadReference,
          idempotencyKey: `REQUEST_EXTRACTION:${evidenceId}:${latestObject.evidenceVersionId}`,
          correlationId,
          sourceId: evidence.sourceId,
          evidenceId,
          evidenceVersionId: latestObject.evidenceVersionId
        });
        await config.repository.appendAuditEvent({
          tenantId: principal.tenantId,
          caseId,
          sourceEventId: auditSourceEventId(principal.tenantId, caseId, "PROMOTE_EVIDENCE", evidenceId, correlationId),
          actorId: principal.subjectId,
          action: "PROMOTE_EVIDENCE",
          subjectId: evidenceId,
          correlationId,
          outcome: "SUCCESS",
          payloadReference: evidence.payloadReference
        });
        return { statusCode: 200, body: { evidenceId, status: "ADMITTED" } };
      }
    },
    {
      method: "POST",
      operationId: "requestAnalysis",
      pattern: /^\/v1\/cases\/([^/]+)\/analysis-runs$/,
      roles: ["DealContributor"],
      mutation: true,
      handler: async ({ body, principal, correlationId, request }, match) => {
        if (!body) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        if (!config.analysisCapabilityEnabled) {
          throw new HttpError(503, "DEPENDENCY_UNAVAILABLE");
        }
        const caseId = match[1];
        if (!caseId || requireString(body, "caseId") !== caseId) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        const caseRecord = await config.repository.getCase(principal.tenantId, caseId);
        if (!caseRecord) {
          throw new HttpError(409, "STATE_CONFLICT");
        }
        await assertCaseAccess(config.repository, caseRecord, principal);
        const evidenceId = requireString(body, "evidenceId");
        const evidence = await config.repository.getEvidence(principal.tenantId, caseId, evidenceId);
        if (!evidence || evidence.admissionStatus !== "ADMITTED") {
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        const source = await config.repository.getSource(principal.tenantId, caseId, evidence.sourceId);
        const licence = source
          ? await config.repository.getLatestExternalLicenceDecision(
              principal.tenantId,
              caseId,
              source.sourceId
            )
          : undefined;
        if (!source || source.status !== "ACTIVE" || !licence || isExpired(licence.expiresAtIso)) {
          if (source && licence && isExpired(licence.expiresAtIso)) {
            await config.repository.upsertSource({ ...source, status: "SUSPENDED" });
          }
          throw new HttpError(403, "POLICY_DENIED");
        }
        const extractionComplete = await config.repository.hasProcessedWorkItem(
          principal.tenantId,
          caseId,
          "REQUEST_EXTRACTION",
          evidence.payloadReference
        );
        const indexingComplete = await config.repository.hasProcessedWorkItem(
          principal.tenantId,
          caseId,
          "REQUEST_INDEXING",
          evidence.payloadReference
        );
        if (!extractionComplete || !indexingComplete) {
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        const evidenceObject = await config.repository.getLatestEvidenceObject(
          principal.tenantId,
          caseId,
          evidenceId
        );
        if (!evidenceObject) {
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        const evidenceVersionReady = await config.repository.isEvidenceVersionReadyForAnalysis(
          principal.tenantId,
          caseId,
          evidenceId,
          evidenceObject.evidenceVersionId
        );
        if (!evidenceVersionReady) {
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        const requestIdempotencyKey = readHeader(request, "idempotency-key") ?? "missing-idempotency-key";
        const analysisRunId = deterministicId(
          principal.tenantId,
          caseId,
          "analysis-run",
          requestIdempotencyKey
        );
        const run = {
          tenantId: principal.tenantId,
          caseId,
          analysisRunId,
          evidenceId,
          evidenceVersionId: evidenceObject.evidenceVersionId,
          modelDeploymentId: requireString(body, "modelDeploymentId"),
          modelProviderEvidenceId: config.modelProviderEvidenceId,
          regionalDeploymentEvidenceId: config.regionalDeploymentEvidenceId,
          promptGovernanceEvidenceId: config.promptGovernanceEvidenceId,
          promptTemplateVersion: requireString(body, "promptTemplateVersion"),
          policyVersion: "release-1",
          inputManifestHash: createHash("sha256")
            .update(`${principal.tenantId}:${caseId}:${evidenceId}:${evidenceObject.evidenceVersionId}`)
            .digest("hex"),
          status: "QUEUED",
          outputKind: "DRAFT_ONLY",
          unsupportedClaims: 0
        } as const;

        const transitionEvidence = await buildPolicyEvidence(config, principal, caseRecord, {
          sourceId: evidence.sourceId,
          evidenceId,
          analysisRunId
        });
        const context: TransitionContext = {
          tenantId: principal.tenantId,
          caseId,
          currentStatus: caseRecord.status,
          event: "REQUEST_ANALYSIS",
          evidence: {
            ...transitionEvidence,
            modelProviderEvidencePresent: config.modelProviderEvidenceId.length > 0,
            modelRegionEvidencePresent: config.regionalDeploymentEvidenceId.length > 0,
            promptGovernanceEvidencePresent: config.promptGovernanceEvidenceId.length > 0,
            aiAnalysisAllowed: licence.aiAnalysisAllowed
          }
        };
        const transition = transitionCaseState(context);
        await appendPolicyDecision(config, context, transition.allowed, transition.denialReasons, correlationId);
        if (!transition.allowed) {
          await config.repository.createAnalysisRun({
            ...run,
            status: "BLOCKED_MISSING_EVIDENCE",
            blockedReason: transition.denialReasons.join(",")
          });
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        await config.repository.createAnalysisRun(run);
        await config.repository.updateCaseStatus(principal.tenantId, caseId, transition.nextStatus);
        const messageId = deterministicId(
          principal.tenantId,
          caseId,
          "REQUEST_ANALYSIS",
          requestIdempotencyKey
        );
        await config.repository.appendWorkItem({
          tenantId: principal.tenantId,
          caseId,
          workItemId: messageId,
          queueName: "q-analysis",
          operation: "REQUEST_ANALYSIS",
          workType: "REQUEST_ANALYSIS",
          messageId,
          idempotencyKey: `analysis:${requestIdempotencyKey}`,
          attempt: 1,
          status: "QUEUED",
          payloadReference: evidence.payloadReference,
          correlationId,
          queuedAtIso: new Date().toISOString(),
          evidenceId,
          evidenceVersionId: evidenceObject.evidenceVersionId,
          analysisRunId
        });
        await config.queueProducer.send({
          messageId,
          tenantId: principal.tenantId,
          caseId,
          operation: "REQUEST_ANALYSIS",
          queueName: "q-analysis",
          payloadReference: evidence.payloadReference,
          idempotencyKey: `analysis:${requestIdempotencyKey}`,
          correlationId,
          analysisRunId,
          sourceId: source.sourceId,
          evidenceId,
          evidenceVersionId: evidenceObject.evidenceVersionId
        });
        await config.repository.appendAuditEvent({
          tenantId: principal.tenantId,
          caseId,
          sourceEventId: auditSourceEventId(principal.tenantId, caseId, "REQUEST_ANALYSIS", analysisRunId, correlationId),
          actorId: principal.subjectId,
          action: "REQUEST_ANALYSIS",
          subjectId: analysisRunId,
          correlationId,
          outcome: "SUCCESS",
          payloadReference: evidence.payloadReference
        });
        return { statusCode: 202, body: { analysisRunId, status: "QUEUED" } };
      }
    },
    {
      method: "GET",
      operationId: "getAnalysisStatus",
      pattern: /^\/v1\/analysis-runs\/([^/]+)$/,
      roles: ["CaseReader"],
      mutation: false,
      handler: async ({ principal }, match) => {
        const analysisRunId = match[1];
        if (!analysisRunId) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        const run = await config.repository.getAnalysisRunById(principal.tenantId, analysisRunId);
        if (!run) {
          throw new HttpError(409, "STATE_CONFLICT");
        }
        const caseRecord = await config.repository.getCase(principal.tenantId, run.caseId);
        if (!caseRecord) {
          throw new HttpError(409, "STATE_CONFLICT");
        }
        await assertCaseAccess(config.repository, caseRecord, principal);
        return {
          statusCode: 200,
          body: {
            analysisRunId: run.analysisRunId,
            caseId: run.caseId,
            status: run.status,
            outputKind: run.outputKind,
            unsupportedClaims: run.unsupportedClaims
          }
        };
      }
    },
    {
      method: "POST",
      operationId: "submitReview",
      pattern: /^\/v1\/cases\/([^/]+)\/reviews$/,
      roles: ["DealReviewer", "LegalApprover", "ComplianceApprover"],
      mutation: true,
      handler: async ({ body, principal, correlationId, request }, match) => {
        if (!body) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        assertHumanPrincipal(principal);
        const caseId = match[1];
        if (!caseId || requireString(body, "caseId") !== caseId) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        const caseRecord = await config.repository.getCase(principal.tenantId, caseId);
        if (!caseRecord) {
          throw new HttpError(409, "STATE_CONFLICT");
        }
        await assertCaseAccess(config.repository, caseRecord, principal);
        const analysisRunId = requireString(body, "analysisRunId");
        const run = await config.repository.getAnalysisRun(principal.tenantId, caseId, analysisRunId);
        if (!run || run.status !== "DRAFT_ONLY_READY") {
          throw new HttpError(409, "STATE_CONFLICT");
        }
        if (caseRecord.status !== "ANALYSIS_DRAFT_READY" && caseRecord.status !== "SPECIALIST_REVIEW_PENDING") {
          throw new HttpError(409, "STATE_CONFLICT");
        }
        const reviewType = parseReviewType(body);
        assertReviewRole(principal, reviewType);
        const decision = parseReviewDecision(body);
        const requestIdempotencyKey = readHeader(request, "idempotency-key") ?? "missing-idempotency-key";
        const manifestHash = run.outputManifestHash;
        if (!manifestHash) {
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        const subjectVersion = requireString(body, "subjectVersion");
        if (subjectVersion !== manifestHash) {
          throw new HttpError(409, "STATE_CONFLICT");
        }
        const evidenceEnvelope = await config.repository.getEvidence(
          principal.tenantId,
          caseId,
          run.evidenceId
        );
        if (!evidenceEnvelope) {
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        const citation = await config.repository.getCitationAssessment(
          principal.tenantId,
          caseId,
          analysisRunId
        );
        if (!citation.allMaterialClaimsCited || citation.totalClaimCount === 0) {
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        await config.repository.appendReview({
          tenantId: principal.tenantId,
          caseId,
          reviewId: deterministicId(
            principal.tenantId,
            caseId,
            analysisRunId,
            reviewType,
            requestIdempotencyKey
          ),
          subjectId: analysisRunId,
          subjectVersion,
          reviewType,
          decision,
          rationale: requireString(body, "rationale"),
          reviewerObjectId: principal.subjectId,
          evidenceManifestHash: manifestHash
        });
        if (caseRecord.status === "ANALYSIS_DRAFT_READY") {
          const evidence = await buildPolicyEvidence(config, principal, caseRecord, {
            sourceId: evidenceEnvelope.sourceId,
            evidenceId: run.evidenceId,
            analysisRunId
          });
          const transition: TransitionContext = {
            tenantId: principal.tenantId,
            caseId,
            currentStatus: caseRecord.status,
            event: "REQUEST_SPECIALIST_REVIEW",
            evidence
          };
          const state = transitionCaseState(transition);
          await appendPolicyDecision(config, transition, state.allowed, state.denialReasons, correlationId);
          if (!state.allowed) {
            if (state.denialReasons.includes("INVALID_TRANSITION")) {
              throw new HttpError(409, "STATE_CONFLICT");
            }
            throw new HttpError(403, "POLICY_DENIED");
          }
          await config.repository.updateCaseStatus(principal.tenantId, caseId, state.nextStatus);
        }
        await config.repository.appendAuditEvent({
          tenantId: principal.tenantId,
          caseId,
          sourceEventId: auditSourceEventId(principal.tenantId, caseId, "SUBMIT_REVIEW", analysisRunId, correlationId),
          actorId: principal.subjectId,
          action: "SUBMIT_REVIEW",
          subjectId: analysisRunId,
          correlationId,
          outcome: "SUCCESS",
          payloadReference: manifestHash
        });
        return { statusCode: 201, body: { analysisRunId, reviewType, decision } };
      }
    },
    {
      method: "POST",
      operationId: "prepareDraft",
      pattern: /^\/v1\/cases\/([^/]+)\/draft-recommendations$/,
      roles: ["DealReviewer"],
      mutation: true,
      handler: async ({ body, principal, correlationId }, match) => {
        if (!body) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        assertHumanPrincipal(principal);
        const caseId = match[1];
        if (!caseId || requireString(body, "caseId") !== caseId) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        const caseRecord = await config.repository.getCase(principal.tenantId, caseId);
        if (!caseRecord) {
          throw new HttpError(409, "STATE_CONFLICT");
        }
        await assertCaseAccess(config.repository, caseRecord, principal);
        const analysisRunId = requireString(body, "analysisRunId");
        const run = await config.repository.getAnalysisRun(principal.tenantId, caseId, analysisRunId);
        if (!run || run.status !== "DRAFT_ONLY_READY") {
          throw new HttpError(409, "STATE_CONFLICT");
        }
        const requestedVersion = requireString(body, "subjectVersion");
        const manifestHash = run.outputManifestHash;
        if (!manifestHash) {
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        if (requestedVersion !== manifestHash) {
          throw new HttpError(409, "STATE_CONFLICT");
        }
        const decisions = await config.repository.listLatestReviewDecisions(
          principal.tenantId,
          caseId,
          analysisRunId
        );
        const required = new Set(["DEAL", "LEGAL", "COMPLIANCE"]);
        for (const type of required) {
          const current = decisions.find((decisionRow) => decisionRow.reviewType === type);
          if (!current || current.decision !== "APPROVED" || current.subjectVersion !== requestedVersion) {
            throw new HttpError(403, "POLICY_DENIED");
          }
        }
        const citation = await config.repository.getCitationAssessment(
          principal.tenantId,
          caseId,
          analysisRunId
        );
        if (!citation.allMaterialClaimsCited || citation.totalClaimCount === 0) {
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        const evidenceEnvelope = await config.repository.getEvidence(
          principal.tenantId,
          caseId,
          run.evidenceId
        );
        if (!evidenceEnvelope) {
          throw new HttpError(422, "EVIDENCE_INCOMPLETE");
        }
        const source = await config.repository.getSource(
          principal.tenantId,
          caseId,
          evidenceEnvelope.sourceId
        );
        const licence = source
          ? await config.repository.getLatestExternalLicenceDecision(
              principal.tenantId,
              caseId,
              source.sourceId
            )
          : undefined;
        if (!source || source.status !== "ACTIVE" || !licence || isExpired(licence.expiresAtIso)) {
          if (source && licence && isExpired(licence.expiresAtIso)) {
            await config.repository.upsertSource({ ...source, status: "SUSPENDED" });
          }
          throw new HttpError(403, "POLICY_DENIED");
        }
        const evidence = await buildPolicyEvidence(config, principal, caseRecord, {
          sourceId: evidenceEnvelope.sourceId,
          evidenceId: run.evidenceId,
          analysisRunId,
          humanSpecialistReviewComplete: true
        });
        const transition: TransitionContext = {
          tenantId: principal.tenantId,
          caseId,
          currentStatus: caseRecord.status,
          event: "MARK_DRAFT_READY",
          evidence
        };
        const state = transitionCaseState(transition);
        await appendPolicyDecision(config, transition, state.allowed, state.denialReasons, correlationId);
        if (!state.allowed) {
          throw new HttpError(403, "POLICY_DENIED");
        }
        await config.repository.updateCaseStatus(principal.tenantId, caseId, state.nextStatus);
        await config.repository.appendAuditEvent({
          tenantId: principal.tenantId,
          caseId,
          sourceEventId: auditSourceEventId(principal.tenantId, caseId, "PREPARE_DRAFT", analysisRunId, correlationId),
          actorId: principal.subjectId,
          action: "PREPARE_DRAFT",
          subjectId: analysisRunId,
          correlationId,
          outcome: "SUCCESS",
          payloadReference: `draft://${analysisRunId}`
        });
        return {
          statusCode: 200,
          body: { caseId, analysisRunId, status: "DRAFT_RECOMMENDATION_READY", outputKind: "DRAFT_ONLY" }
        };
      }
    },
    {
      method: "POST",
      operationId: "exportValidationEvidence",
      pattern: /^\/v1\/validation-exports$/,
      roles: ["ValidationProducer"],
      mutation: true,
      handler: async ({ body, principal, correlationId, request }) => {
        if (!body) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        if (!config.auditExportCapabilityEnabled) {
          throw new HttpError(503, "DEPENDENCY_UNAVAILABLE");
        }
        const caseId = requireString(body, "caseId");
        const caseRecord = await config.repository.getCase(principal.tenantId, caseId);
        if (!caseRecord) {
          throw new HttpError(409, "STATE_CONFLICT");
        }
        await assertCaseAccess(config.repository, caseRecord, principal);
        const payloadReference = requireString(body, "payloadReference");
        const requestIdempotencyKey = readHeader(request, "idempotency-key") ?? "missing-idempotency-key";
        const messageId = deterministicId(
          principal.tenantId,
          caseId,
          "EXPORT_AUDIT_EVIDENCE",
          requestIdempotencyKey
        );
        await config.queueProducer.send({
          messageId,
          tenantId: principal.tenantId,
          caseId,
          operation: "EXPORT_AUDIT_EVIDENCE",
          queueName: "q-audit-export",
          payloadReference,
          idempotencyKey: `validation:${requestIdempotencyKey}`,
          correlationId
        });
        await config.repository.appendWorkItem({
          tenantId: principal.tenantId,
          caseId,
          workItemId: messageId,
          queueName: "q-audit-export",
          operation: "EXPORT_AUDIT_EVIDENCE",
          workType: "EXPORT_AUDIT_EVIDENCE",
          messageId,
          idempotencyKey: `validation:${requestIdempotencyKey}`,
          attempt: 1,
          status: "QUEUED",
          payloadReference,
          correlationId,
          queuedAtIso: new Date().toISOString()
        });
        await config.repository.appendAuditEvent({
          tenantId: principal.tenantId,
          caseId,
          sourceEventId: auditSourceEventId(
            principal.tenantId,
            caseId,
            "EXPORT_VALIDATION_EVIDENCE",
            requireString(body, "validationManifestId"),
            correlationId
          ),
          actorId: principal.subjectId,
          action: "EXPORT_VALIDATION_EVIDENCE",
          subjectId: requireString(body, "validationManifestId"),
          correlationId,
          outcome: "SUCCESS",
          payloadReference
        });
        return { statusCode: 202, body: { workItemId: messageId, status: "QUEUED" } };
      }
    },
    {
      method: "POST",
      operationId: "createDemoAnalysisBundle",
      pattern: /^\/v1\/demo-authority\/cases\/([^/]+)\/analysis-bundles$/,
      roles: ["DealContributor"],
      mutation: true,
      handler: async ({ body, principal }, match) => {
        if (!body || !match[1] || requireString(body, "caseId") !== match[1]) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        return {
          statusCode: 202,
          body: await demoAuthority.createBundle(principal, body as never)
        };
      }
    },
    {
      method: "GET",
      operationId: "getDemoAnalysisBundle",
      pattern: /^\/v1\/demo-authority\/analysis-bundles\/([^/]+)$/,
      roles: ["CaseReader"],
      mutation: false,
      handler: async ({ principal }, match) => {
        const analysisBundleId = match[1];
        if (!analysisBundleId) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        return { statusCode: 200, body: await demoAuthority.getBundle(principal, analysisBundleId) };
      }
    },
    {
      method: "POST",
      operationId: "completeDemoAnalysisBundle",
      pattern: /^\/v1\/demo-authority\/analysis-bundles\/([^/]+)\/completion$/,
      roles: [],
      authenticatedOnly: true,
      mutation: true,
      handler: async ({ body, principal }, match) => {
        if (
          principal.isHuman ||
          !principal.applicationId ||
          principal.applicationId !== (config.completionClientId ?? "")
        ) {
          throw new HttpError(403, "POLICY_DENIED");
        }
        if (!body || !match[1] || requireString(body, "analysisBundleId") !== match[1]) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        return { statusCode: 200, body: await demoAuthority.completeBundle(principal, body as never) };
      }
    },
    {
      method: "POST",
      operationId: "submitDemoBundleReview",
      pattern: /^\/v1\/demo-authority\/cases\/([^/]+)\/analysis-bundles\/([^/]+)\/reviews$/,
      roles: ["DealReviewer", "LegalApprover", "ComplianceApprover"],
      mutation: true,
      handler: async ({ body, principal }, match) => {
        if (!principal.isHuman) {
          throw new HttpError(403, "POLICY_DENIED");
        }
        if (
          !body ||
          !match[1] ||
          !match[2] ||
          requireString(body, "caseId") !== match[1] ||
          requireString(body, "analysisBundleId") !== match[2]
        ) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        return { statusCode: 201, body: await demoAuthority.submitReview(principal, body as never) };
      }
    },
    {
      method: "POST",
      operationId: "prepareDemoBundleDraft",
      pattern: /^\/v1\/demo-authority\/cases\/([^/]+)\/analysis-bundles\/([^/]+)\/draft-recommendations$/,
      roles: ["DealReviewer"],
      mutation: true,
      handler: async ({ body, principal }, match) => {
        if (
          !body ||
          !match[1] ||
          !match[2] ||
          requireString(body, "caseId") !== match[1] ||
          requireString(body, "analysisBundleId") !== match[2]
        ) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        return { statusCode: 200, body: await demoAuthority.prepareDraft(principal, body as never) };
      }
    },
    {
      method: "GET",
      operationId: "getDemoModelRouteEvidence",
      pattern: /^\/v1\/demo-authority\/model-route-evidence\/([^/]+)$/,
      roles: ["CaseReader"],
      authenticatedOnly: true,
      mutation: false,
      handler: async ({ request, principal }, match) => {
        const evidenceId = match[1];
        const tenantId = new URL(request.url ?? "/", "https://runtime.local").searchParams.get("tenantId");
        if (!evidenceId || !tenantId) {
          throw new HttpError(400, "INVALID_CONTRACT");
        }
        return {
          statusCode: 200,
          body: await demoAuthority.getRouteEvidence(principal, tenantId, evidenceId)
        };
      }
    },
    {
      method: "POST",
      operationId: "recordVerdict",
      pattern: /^\/assurance\/v1\/verdicts$/,
      roles: ["InternalAuditValidator"],
      mutation: false,
      handler: async () => {
        throw new HttpError(403, "POLICY_DENIED");
      }
    }
  ];
}

async function readinessDependencies(config: ApiRuntimeConfig): Promise<
  readonly { readonly name: string; readonly ready: boolean; readonly detail: string }[]
> {
  const repositoryReady = await config.repository.isAvailable();
  const idempotencyReady = await config.idempotencyStore.isAvailable();
  const queueReady = await config.queueProducer.isAvailable();
  return [
    { name: "repository", ready: repositoryReady, detail: repositoryReady ? "ok" : "unavailable" },
    { name: "idempotency", ready: idempotencyReady, detail: idempotencyReady ? "ok" : "unavailable" },
    { name: "queue", ready: queueReady, detail: queueReady ? "ok" : "unavailable" }
  ];
}

export function createApiServer(config: ApiRuntimeConfig): { server: Server } {
  const scopedRepository = createScopedRepository(config.repository);
  const scopedQueueProducer = createScopedQueueProducer(config.queueProducer);
  const outboxDispatcher = new QueueOutboxDispatcher(config.repository, config.queueProducer);
  const outboxTimer = setInterval(() => {
    void outboxDispatcher.dispatchPendingAcrossScopes(100, 50).catch((error) => {
      config.logger.log("WARN", "queue-outbox-dispatch-error", {
        error: error instanceof Error ? error.message : "UNKNOWN"
      });
    });
  }, 2_000);
  outboxTimer.unref();
  const runtimeConfig: ApiRuntimeConfig = {
    ...config,
    repository: scopedRepository.proxy,
    queueProducer: scopedQueueProducer.proxy
  };
  const routes = buildRoutes(runtimeConfig);
  const server = createServer(async (request, response) => {
    const correlationId = readHeader(request, "x-correlation-id") ?? randomUUID();
    try {
      const url = new URL(request.url ?? "/", "https://runtime.local");
      if (request.method === "GET" && url.pathname === "/health") {
        toJsonResponse(response, 200, health("stratton-api"), correlationId);
        return;
      }
      if (request.method === "GET" && url.pathname === "/readiness") {
        const deps = await readinessDependencies(config);
        const allReady = deps.every((item) => item.ready);
        toJsonResponse(
          response,
          allReady ? 200 : 503,
          readiness(deps),
          correlationId
        );
        return;
      }

      const routeResult = routeByPath(routes, request.method ?? "", url.pathname);
      if (!routeResult) {
        throw new HttpError(400, "INVALID_CONTRACT");
      }
      const { route, match } = routeResult;
      const principal = await parsePrincipal(request, config.bearerTokenVerifier);
      if (!route.authenticatedOnly) {
        requireRole(principal, route.roles);
      }
      const body = await parseBody(request, config.requestBodyLimitBytes);
      const context: RequestContext = { request, body, principal, correlationId };

      if (!route.mutation) {
        const result = await route.handler(context, match);
        toJsonResponse(response, result.statusCode, result.body, correlationId);
        return;
      }

      const idempotencyKey = readHeader(request, "idempotency-key");
      if (!idempotencyKey) {
        throw new HttpError(400, "INVALID_CONTRACT");
      }
      const caseId = routeCaseId(route.operationId, match, body);
      const scopedKey = `${principal.tenantId}:${caseId}:${principal.subjectId}:${route.operationId}:${idempotencyKey}`;
      const requestHash = fingerprint(request, body);
      const result = await config.repository.withCaseTransaction(
        principal.tenantId,
        caseId,
        async (transactionRepository) =>
          scopedRepository.runScoped(transactionRepository, async () => {
            const scopedIdempotency =
              typeof transactionRepository.bindIdempotencyStore === "function"
                ? transactionRepository.bindIdempotencyStore(config.idempotencyStore)
                : config.idempotencyStore;
            const begin = await scopedIdempotency.begin({
              scopedKey,
              tenantId: principal.tenantId,
              caseId,
              subjectId: principal.subjectId,
              operationId: route.operationId,
              fingerprint: requestHash,
              correlationId,
              leaseDurationSeconds: config.idempotencyLeaseDurationSeconds
            });
            if (begin.type === "CONFLICT" || begin.type === "IN_PROGRESS") {
              throw new HttpError(409, "STATE_CONFLICT");
            }
            if (begin.type === "REPLAY") {
              let replayBody: unknown;
              try {
                replayBody = JSON.parse(begin.responseBody);
              } catch {
                replayBody = { value: begin.responseBody };
              }
              return {
                statusCode: begin.responseCode,
                body: replayBody
              } satisfies ResponsePayload;
            }
            const queuedMessages: QueueMessage[] = [];
            const handlerResult = await scopedQueueProducer.runScoped(queuedMessages, async () =>
              route.handler(context, match)
            );
            for (const message of queuedMessages) {
              await transactionRepository.enqueueQueueOutboxMessage(message);
            }
            const bodyText = JSON.stringify(handlerResult.body);
            await scopedIdempotency.complete(
              {
                scopedKey,
                tenantId: principal.tenantId,
                caseId,
                subjectId: principal.subjectId,
                operationId: route.operationId,
                fingerprint: requestHash,
                claimId: begin.claimId
              },
              handlerResult.statusCode,
              bodyText
            );
            return handlerResult;
          })
      );
      void outboxDispatcher.dispatchPending(50, principal.tenantId, caseId).catch((error) => {
        config.logger.log("WARN", "queue-outbox-dispatch-error", {
          correlationId,
          tenantId: principal.tenantId,
          caseId,
          error: error instanceof Error ? error.message : "UNKNOWN"
        });
      });
      toJsonResponse(response, result.statusCode, result.body, correlationId);
      return;
    } catch (error) {
      const mapped = mapError(error);
      config.logger.log("WARN", "api-request-failed", {
        correlationId,
        code: mapped.code,
        statusCode: mapped.statusCode,
        error: summarizeRequestError(error)
      });
      const payload: ErrorPayload = {
        status: mapped.statusCode,
        code: mapped.code,
        message:
          mapped.code === "DEPENDENCY_UNAVAILABLE"
            ? `Required dependency is unavailable: ${JSON.stringify(summarizeRequestError(error))}`
            : errorMessage(mapped.code),
        correlationId
      };
      toJsonResponse(response, mapped.statusCode, payload, correlationId);
    }

    function summarizeRequestError(error: unknown): Record<string, unknown> {
      if (!(error instanceof Error)) {
        return { type: "UNKNOWN" };
      }
      const candidate = error as Error & {
        code?: unknown;
        number?: unknown;
        cause?: { code?: unknown; number?: unknown };
      };
      return {
        type: error.name,
        ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
        ...(typeof candidate.number === "number" ? { number: candidate.number } : {}),
        ...(typeof candidate.cause?.code === "string"
          ? { causeCode: candidate.cause.code }
          : {}),
        ...(typeof candidate.cause?.number === "number"
          ? { causeNumber: candidate.cause.number }
          : {})
      };
    }
  });
  server.on("close", () => clearInterval(outboxTimer));
  return { server };
}
