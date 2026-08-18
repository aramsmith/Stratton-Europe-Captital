import { createHash, randomUUID } from "node:crypto";
import { computeAuditHash } from "./audit-outbox.js";
import { evaluateCitationAssessment } from "./claim-lineage-service.js";
import { InMemoryIdempotencyStore, SqlIdempotencyStore } from "./idempotency-store.js";
import {
  canonicalQueueMessage,
  canonicalQueueMessageIdentity
} from "./queue-outbox-dispatcher.js";
import type { SqlExecutor } from "./sql-client.js";
import type {
  AnalysisRunRecord,
  AnalysisBundleCompletionRecord,
  AnalysisBundleEvidenceRecord,
  AnalysisBundleRecord,
  AnalysisBundleReviewRecord,
  ApprovedModelRouteEvidence,
  AuditEvent,
  AuditEventInput,
  CaseAccessAssignment,
  CaseRecord,
  CaseStatus,
  CitationAssessment,
  CitationRecord,
  ClaimAssessmentInput,
  ClaimRecord,
  EligibilityDecisionType,
  EvidenceAdmissionDecision,
  ExtractionChunkRecord,
  EvidenceObjectRecord,
  EvidenceRecord,
  ExternalLicenceDecision,
  IdempotencyRecord,
  IdempotencyStore,
  PolicyDecisionRecord,
  QueueMessage,
  QueueOutboxRecord,
  QueueOutboxScope,
  ReviewDecisionSummary,
  ReviewRecord,
  WorkItemRecord,
  WorkloadRepository
} from "./types.js";

function key3(a: string, b: string, c: string): string {
  return `${a}:${b}:${c}`;
}

function key2(a: string, b: string): string {
  return `${a}:${b}`;
}

function toBool(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function toIso(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return new Date().toISOString();
}

function mapReplace<TValue>(target: Map<string, TValue>, source: Map<string, TValue>): void {
  target.clear();
  for (const [key, value] of source.entries()) {
    target.set(key, value);
  }
}

interface InMemorySnapshot {
  readonly cases: Map<string, CaseRecord>;
  readonly sources: Map<string, SourceRecord>;
  readonly licences: Map<string, ExternalLicenceDecision[]>;
  readonly evidence: Map<string, EvidenceRecord>;
  readonly evidenceObjects: Map<string, EvidenceObjectRecord[]>;
  readonly admissions: Map<string, EvidenceAdmissionDecision[]>;
  readonly analysisRuns: Map<string, AnalysisRunRecord>;
  readonly analysisBundles: Map<string, AnalysisBundleRecord>;
  readonly analysisBundleEvidence: Map<string, AnalysisBundleEvidenceRecord[]>;
  readonly analysisBundleReviews: Map<string, AnalysisBundleReviewRecord[]>;
  readonly claimsByRun: Map<string, ClaimRecord[]>;
  readonly citationsByRun: Map<string, CitationRecord[]>;
  readonly reviewsByCase: Map<string, ReviewRecord[]>;
  readonly extractionChunks: Map<string, ExtractionChunkRecord[]>;
  readonly access: Map<string, CaseAccessAssignment[]>;
  readonly approvedEligibility: Set<string>;
  readonly policyDecisions: PolicyDecisionRecord[];
  readonly auditByCase: Map<string, AuditEvent[]>;
  readonly workItems: Map<string, WorkItemRecord>;
  readonly queueOutbox: Map<string, QueueOutboxRecord>;
}

type SourceRecord = {
  readonly tenantId: string;
  readonly caseId: string;
  readonly sourceId: string;
  readonly ownerId: string;
  readonly domain: string;
  readonly authoritativeStatus: string;
  readonly authoritativeSystem: string;
  readonly interfaceType: "READ_ONLY_API" | "CONTROLLED_FILE_INGESTION";
  readonly permissionEvidenceId: string;
  readonly connectorEvidenceId: string;
  readonly jurisdiction: string;
  readonly sourceVersion: string;
  readonly status: "DISABLED" | "ACTIVE" | "SUSPENDED";
};

export class InMemoryWorkloadRepository implements WorkloadRepository {
  private readonly cases = new Map<string, CaseRecord>();
  private readonly sources = new Map<string, SourceRecord>();
  private readonly licences = new Map<string, ExternalLicenceDecision[]>();
  private readonly evidence = new Map<string, EvidenceRecord>();
  private readonly evidenceObjects = new Map<string, EvidenceObjectRecord[]>();
  private readonly admissions = new Map<string, EvidenceAdmissionDecision[]>();
  private readonly analysisRuns = new Map<string, AnalysisRunRecord>();
  private readonly analysisBundles = new Map<string, AnalysisBundleRecord>();
  private readonly analysisBundleEvidence = new Map<string, AnalysisBundleEvidenceRecord[]>();
  private readonly analysisBundleReviews = new Map<string, AnalysisBundleReviewRecord[]>();
  private readonly approvedModelRouteEvidence = new Map<string, ApprovedModelRouteEvidence>();
  private readonly claimsByRun = new Map<string, ClaimRecord[]>();
  private readonly citationsByRun = new Map<string, CitationRecord[]>();
  private readonly reviewsByCase = new Map<string, ReviewRecord[]>();
  private readonly extractionChunks = new Map<string, ExtractionChunkRecord[]>();
  private readonly access = new Map<string, CaseAccessAssignment[]>();
  private readonly approvedEligibility = new Set<string>();
  private readonly policyDecisions: PolicyDecisionRecord[] = [];
  private readonly auditByCase = new Map<string, AuditEvent[]>();
  private readonly workItems = new Map<string, WorkItemRecord>();
  private readonly queueOutbox = new Map<string, QueueOutboxRecord>();
  private activeIdempotencySnapshots: Map<InMemoryIdempotencyStore, Map<string, IdempotencyRecord>> | undefined;

  public constructor(options: { readonly approvedModelRouteEvidence?: readonly ApprovedModelRouteEvidence[] } = {}) {
    for (const record of options.approvedModelRouteEvidence ?? []) {
      this.approvedModelRouteEvidence.set(key2(record.tenantId, record.evidenceId), record);
    }
  }

  public seedApprovedEligibility(
    tenantId: string,
    caseId: string,
    decisionType: EligibilityDecisionType,
    decisionId: string
  ): void {
    this.approvedEligibility.add(key3(tenantId, caseId, `${decisionType}:${decisionId}`));
  }

  public listPolicyDecisions(): readonly PolicyDecisionRecord[] {
    return this.policyDecisions;
  }

  public listAuditEvents(tenantId: string, caseId: string): readonly AuditEvent[] {
    return this.auditByCase.get(key2(tenantId, caseId)) ?? [];
  }

  public async grantCaseAccess(assignment: CaseAccessAssignment): Promise<void> {
    const key = key2(assignment.tenantId, assignment.caseId);
    const values = this.access.get(key) ?? [];
    this.access.set(key, [...values, assignment]);
  }

  public async assertCaseAccess(
    tenantId: string,
    caseId: string,
    subjectId: string,
    purpose: string
  ): Promise<boolean> {
    const values = this.access.get(key2(tenantId, caseId)) ?? [];
    return values.some((row) => row.subjectId === subjectId && row.purpose === purpose);
  }

  public async createCase(record: CaseRecord): Promise<void> {
    this.cases.set(key2(record.tenantId, record.caseId), record);
  }

  public async getCase(tenantId: string, caseId: string): Promise<CaseRecord | undefined> {
    return this.cases.get(key2(tenantId, caseId));
  }

  public async updateCaseStatus(tenantId: string, caseId: string, status: CaseStatus): Promise<void> {
    const current = this.cases.get(key2(tenantId, caseId));
    if (!current) {
      return;
    }
    this.cases.set(key2(tenantId, caseId), {
      ...current,
      status,
      ...(status === "DRAFT_RECOMMENDATION_READY" ? { committeeReadyAtIso: new Date().toISOString() } : {})
    });
  }

  public async isEligibilityDecisionApproved(
    tenantId: string,
    caseId: string,
    decisionType: EligibilityDecisionType,
    decisionId: string
  ): Promise<boolean> {
    return this.approvedEligibility.has(key3(tenantId, caseId, `${decisionType}:${decisionId}`));
  }

  public async upsertSource(record: SourceRecord): Promise<void> {
    this.sources.set(key3(record.tenantId, record.caseId, record.sourceId), record);
  }

  public async getSource(
    tenantId: string,
    caseId: string,
    sourceId: string
  ): Promise<SourceRecord | undefined> {
    return this.sources.get(key3(tenantId, caseId, sourceId));
  }

  public async appendExternalLicenceDecision(record: ExternalLicenceDecision): Promise<void> {
    const key = key3(record.tenantId, record.caseId, record.sourceId);
    const values = this.licences.get(key) ?? [];
    this.licences.set(key, [...values, record]);
  }

  public async getLatestExternalLicenceDecision(
    tenantId: string,
    caseId: string,
    sourceId: string
  ): Promise<ExternalLicenceDecision | undefined> {
    const values = this.licences.get(key3(tenantId, caseId, sourceId)) ?? [];
    return values[values.length - 1];
  }

  public async createEvidence(record: EvidenceRecord): Promise<void> {
    this.evidence.set(key3(record.tenantId, record.caseId, record.evidenceId), record);
  }

  public async getEvidence(
    tenantId: string,
    caseId: string,
    evidenceId: string
  ): Promise<EvidenceRecord | undefined> {
    return this.evidence.get(key3(tenantId, caseId, evidenceId));
  }

  public async admitEvidence(tenantId: string, caseId: string, evidenceId: string): Promise<void> {
    const key = key3(tenantId, caseId, evidenceId);
    const current = this.evidence.get(key);
    if (!current) {
      return;
    }
    const decisions = this.admissions.get(key) ?? [];
    const latestDecision = decisions[decisions.length - 1];
    const latestObject = await this.getLatestEvidenceObject(tenantId, caseId, evidenceId);
    if (
      !latestDecision ||
      latestDecision.decision !== "ADMITTED" ||
      !latestObject ||
      latestObject.contentHash !== current.contentHash ||
      latestObject.malwareScanStatus !== "CLEAN"
    ) {
      throw new Error("EVIDENCE_ADMISSION_GUARD_FAILED");
    }
    this.evidence.set(key, { ...current, admissionStatus: "ADMITTED" });
  }

  public async appendEvidenceAdmissionDecision(record: EvidenceAdmissionDecision): Promise<void> {
    const key = key3(record.tenantId, record.caseId, record.evidenceId);
    const values = this.admissions.get(key) ?? [];
    const existing = values.find((value) => value.admissionDecisionId === record.admissionDecisionId);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new Error("EVIDENCE_ADMISSION_DECISION_CONFLICT");
      }
      return;
    }
    this.admissions.set(key, [...values, record]);
  }

  public async createEvidenceObject(record: EvidenceObjectRecord): Promise<void> {
    const key = key3(record.tenantId, record.caseId, record.evidenceId);
    const values = this.evidenceObjects.get(key) ?? [];
    const existing = values.find((value) => value.evidenceVersionId === record.evidenceVersionId);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new Error("EVIDENCE_OBJECT_REPLAY_CONFLICT");
      }
      return;
    }
    this.evidenceObjects.set(key, [...values, record]);
  }

  public async getLatestEvidenceObject(
    tenantId: string,
    caseId: string,
    evidenceId: string
  ): Promise<EvidenceObjectRecord | undefined> {
    const values = this.evidenceObjects.get(key3(tenantId, caseId, evidenceId)) ?? [];
    return values[values.length - 1];
  }

  public async createAnalysisRun(record: AnalysisRunRecord): Promise<void> {
    this.analysisRuns.set(key3(record.tenantId, record.caseId, record.analysisRunId), record);
  }

  public async getAnalysisRun(
    tenantId: string,
    caseId: string,
    analysisRunId: string
  ): Promise<AnalysisRunRecord | undefined> {
    return this.analysisRuns.get(key3(tenantId, caseId, analysisRunId));
  }

  public async getAnalysisRunById(
    tenantId: string,
    analysisRunId: string
  ): Promise<AnalysisRunRecord | undefined> {
    for (const value of this.analysisRuns.values()) {
      if (value.tenantId === tenantId && value.analysisRunId === analysisRunId) {
        return value;
      }
    }
    return undefined;
  }

  public async updateAnalysisRunStatus(
    tenantId: string,
    caseId: string,
    analysisRunId: string,
    status: AnalysisRunRecord["status"],
    unsupportedClaims: number,
    outputReference?: string,
    blockedReason?: string,
    outputManifestHash?: string
  ): Promise<void> {
    const key = key3(tenantId, caseId, analysisRunId);
    const current = this.analysisRuns.get(key);
    if (!current) {
      return;
    }
    this.analysisRuns.set(key, {
      ...current,
      status,
      unsupportedClaims,
      ...(outputReference ? { outputReference } : {}),
      ...(blockedReason ? { blockedReason } : {}),
      ...(outputManifestHash ? { outputManifestHash } : {})
    });
  }

  public async upsertClaims(records: readonly ClaimRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }
    const first = records[0];
    if (!first) {
      return;
    }
    const key = key3(first.tenantId, first.caseId, first.analysisRunId);
    const run = this.analysisRuns.get(key);
    if (run && (run.status === "DRAFT_ONLY_READY" || run.status === "FAILED")) {
      throw new Error("ANALYSIS_OUTPUT_IMMUTABLE");
    }
    this.claimsByRun.set(key, [...records]);
  }

  public async replaceCitations(
    tenantId: string,
    caseId: string,
    analysisRunId: string,
    citations: readonly CitationRecord[]
  ): Promise<void> {
    const run = this.analysisRuns.get(key3(tenantId, caseId, analysisRunId));
    if (run && (run.status === "DRAFT_ONLY_READY" || run.status === "FAILED")) {
      throw new Error("ANALYSIS_OUTPUT_IMMUTABLE");
    }
    this.citationsByRun.set(key3(tenantId, caseId, analysisRunId), [...citations]);
  }

  public async getCitationAssessment(
    tenantId: string,
    caseId: string,
    analysisRunId: string
  ): Promise<CitationAssessment> {
    const claimRows = this.claimsByRun.get(key3(tenantId, caseId, analysisRunId)) ?? [];
    const citationRows = this.citationsByRun.get(key3(tenantId, caseId, analysisRunId)) ?? [];
    const claimInputs: ClaimAssessmentInput[] = claimRows.map((claim) => ({
      materiality: claim.isMaterial ? (claim.severity === "CRITICAL" ? "CRITICAL" : "HIGH") : "LOW",
      citations: citationRows
        .filter((citation) => citation.claimId === claim.claimId)
        .map((citation) => ({ citationId: citation.citationId }))
    }));
    const summary = evaluateCitationAssessment(claimInputs);
    const materialClaims = claimRows.filter((claim) => claim.isMaterial).length;
    const citedMaterialClaims = claimRows.filter((claim) =>
      claim.isMaterial && citationRows.some((citation) => citation.claimId === claim.claimId)
    ).length;
    return {
      ...summary,
      materialClaimCount: materialClaims,
      citedMaterialClaimCount: citedMaterialClaims
    };
  }

  public async buildEvidenceManifestHash(
    tenantId: string,
    caseId: string,
    analysisRunId: string
  ): Promise<string> {
    const claims = (this.claimsByRun.get(key3(tenantId, caseId, analysisRunId)) ?? [])
      .map((claim) => ({ claimId: claim.claimId, claimTextReference: claim.claimTextReference }))
      .sort((a, b) => a.claimId.localeCompare(b.claimId));
    const citations = (this.citationsByRun.get(key3(tenantId, caseId, analysisRunId)) ?? [])
      .map((citation) => ({
        citationId: citation.citationId,
        claimId: citation.claimId,
        evidenceVersionId: citation.evidenceVersionId,
        locator: citation.locator
      }))
      .sort((a, b) => a.citationId.localeCompare(b.citationId));
    const payload = JSON.stringify({ tenantId, caseId, analysisRunId, claims, citations });
    return createHash("sha256").update(payload).digest("hex");
  }

  public async createAnalysisBundle(record: AnalysisBundleRecord): Promise<void> {
    const bundleKey = key3(record.tenantId, record.caseId, record.analysisBundleId);
    const existing = this.analysisBundles.get(bundleKey);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new Error("ANALYSIS_BUNDLE_CREATE_CONFLICT");
      }
      return;
    }
    for (const value of this.analysisBundles.values()) {
      if (
        value.tenantId === record.tenantId &&
        value.caseId === record.caseId &&
        value.requestFingerprint === record.requestFingerprint
      ) {
        throw new Error("ANALYSIS_BUNDLE_REQUEST_FINGERPRINT_CONFLICT");
      }
    }
    this.analysisBundles.set(bundleKey, record);
  }

  public async getAnalysisBundle(
    tenantId: string,
    caseId: string,
    bundleId: string
  ): Promise<AnalysisBundleRecord | undefined> {
    return this.analysisBundles.get(key3(tenantId, caseId, bundleId));
  }

  public async getAnalysisBundleById(
    tenantId: string,
    bundleId: string
  ): Promise<AnalysisBundleRecord | undefined> {
    return [...this.analysisBundles.values()].find(
      (record) => record.tenantId === tenantId && record.analysisBundleId === bundleId
    );
  }

  public async appendAnalysisBundleEvidence(record: AnalysisBundleEvidenceRecord): Promise<void> {
    const bundleKey = key3(record.tenantId, record.caseId, record.analysisBundleId);
    const values = this.analysisBundleEvidence.get(bundleKey) ?? [];
    const existing = values.find(
      (value) =>
        value.ordinal === record.ordinal ||
        (value.evidenceId === record.evidenceId && value.evidenceVersionId === record.evidenceVersionId)
    );
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new Error("ANALYSIS_BUNDLE_EVIDENCE_CONFLICT");
      }
      return;
    }
    this.analysisBundleEvidence.set(bundleKey, [...values, record].sort((a, b) => a.ordinal - b.ordinal));
  }

  public async listAnalysisBundleEvidence(
    tenantId: string,
    caseId: string,
    bundleId: string
  ): Promise<readonly AnalysisBundleEvidenceRecord[]> {
    return this.analysisBundleEvidence.get(key3(tenantId, caseId, bundleId)) ?? [];
  }

  public async completeAnalysisBundle(record: AnalysisBundleCompletionRecord): Promise<void> {
    const bundleKey = key3(record.tenantId, record.caseId, record.analysisBundleId);
    const current = this.analysisBundles.get(bundleKey);
    if (!current) {
      throw new Error("ANALYSIS_BUNDLE_NOT_FOUND");
    }
    if (current.subjectVersion) {
      if (
        current.subjectVersion !== record.subjectVersion ||
        current.status !== record.status ||
        current.unsupportedClaims !== record.unsupportedClaims ||
        current.totalClaims !== record.totalClaims ||
        current.citedClaims !== record.citedClaims ||
        current.materialClaims !== record.materialClaims ||
        current.citedMaterialClaims !== record.citedMaterialClaims
      ) {
        throw new Error("ANALYSIS_BUNDLE_COMPLETION_CONFLICT");
      }
      return;
    }
    this.analysisBundles.set(bundleKey, {
      ...current,
      status: record.status,
      unsupportedClaims: record.unsupportedClaims,
      totalClaims: record.totalClaims,
      citedClaims: record.citedClaims,
      materialClaims: record.materialClaims,
      citedMaterialClaims: record.citedMaterialClaims,
      subjectVersion: record.subjectVersion
    });
  }

  public async appendAnalysisBundleReview(record: AnalysisBundleReviewRecord): Promise<void> {
    const bundleKey = key3(record.tenantId, record.caseId, record.analysisBundleId);
    const values = this.analysisBundleReviews.get(bundleKey) ?? [];
    const existing = values.find((value) => value.reviewId === record.reviewId);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new Error("ANALYSIS_BUNDLE_REVIEW_CONFLICT");
      }
      return;
    }
    this.analysisBundleReviews.set(bundleKey, [...values, record]);
  }

  public async listAnalysisBundleReviews(
    tenantId: string,
    caseId: string,
    bundleId: string
  ): Promise<readonly AnalysisBundleReviewRecord[]> {
    return this.analysisBundleReviews.get(key3(tenantId, caseId, bundleId)) ?? [];
  }

  public async getApprovedModelRouteEvidence(
    tenantId: string,
    evidenceId: string
  ): Promise<ApprovedModelRouteEvidence | undefined> {
    return this.approvedModelRouteEvidence.get(key2(tenantId, evidenceId));
  }

  public async appendReview(record: ReviewRecord): Promise<void> {
    const key = key2(record.tenantId, record.caseId);
    const values = this.reviewsByCase.get(key) ?? [];
    const existing = values.find((value) => value.reviewId === record.reviewId);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new Error("REVIEW_APPEND_CONFLICT");
      }
      return;
    }
    this.reviewsByCase.set(key, [...values, record]);
  }

  public async listLatestReviewDecisions(
    tenantId: string,
    caseId: string,
    subjectId: string
  ): Promise<readonly ReviewDecisionSummary[]> {
    const values = this.reviewsByCase.get(key2(tenantId, caseId)) ?? [];
    const filtered = values.filter((value) => value.subjectId === subjectId);
    const latestByType = new Map<string, ReviewDecisionSummary>();
    for (const review of filtered) {
      latestByType.set(review.reviewType, {
        reviewType: review.reviewType,
        decision: review.decision,
        subjectVersion: review.subjectVersion
      });
    }
    return [...latestByType.values()];
  }

  public async appendPolicyDecision(record: PolicyDecisionRecord): Promise<void> {
    const existing = this.policyDecisions.find(
      (value) =>
        value.tenantId === record.tenantId &&
        value.caseId === record.caseId &&
        value.policyDecisionId === record.policyDecisionId
    );
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new Error("POLICY_DECISION_CONFLICT");
      }
      return;
    }
    this.policyDecisions.push(record);
  }

  public async appendAuditEvent(event: AuditEventInput): Promise<AuditEvent> {
    const key = key2(event.tenantId, event.caseId);
    const history = this.auditByCase.get(key) ?? [];
    const existing = history.find((item) => item.sourceEventId === event.sourceEventId);
    if (existing) {
      const equivalent =
        existing.actorId === event.actorId &&
        existing.action === event.action &&
        existing.subjectId === event.subjectId &&
        existing.correlationId === event.correlationId &&
        existing.outcome === event.outcome &&
        existing.payloadReference === event.payloadReference;
      if (!equivalent) {
        throw new Error("AUDIT_EVENT_CONFLICT");
      }
      return existing;
    }
    const previous = history[history.length - 1];
    const sequence = history.length + 1;
    const item: AuditEvent = {
      ...event,
      sequence,
      previousEventHash: previous?.eventHash ?? null,
      eventHash: computeAuditHash(previous?.eventHash ?? null, sequence, event),
      occurredAtIso: new Date().toISOString()
    };
    this.auditByCase.set(key, [...history, item]);
    return item;
  }

  public async appendWorkItem(record: WorkItemRecord): Promise<void> {
    this.workItems.set(key3(record.tenantId, record.caseId, record.workItemId), record);
  }

  public async enqueueQueueOutboxMessage(message: QueueMessage): Promise<void> {
    const key = key3(message.tenantId, message.caseId, `${message.queueName}:${message.messageId}`);
    const canonicalBody = canonicalQueueMessage(message);
    const existing = this.queueOutbox.get(key);
    if (existing) {
      const existingMessage = JSON.parse(existing.canonicalBody) as QueueMessage;
      if (
        canonicalQueueMessageIdentity(existingMessage) !==
        canonicalQueueMessageIdentity(message)
      ) {
        throw new Error("QUEUE_OUTBOX_MESSAGE_CONFLICT");
      }
      return;
    }
    this.queueOutbox.set(key, {
      tenantId: message.tenantId,
      caseId: message.caseId,
      queueName: message.queueName,
      messageId: message.messageId,
      canonicalBody,
      status: "PENDING",
      attempts: 0,
      nextAttemptAtIso: new Date().toISOString()
    });
  }

  public async listPendingQueueOutboxScopes(maxScopes: number): Promise<readonly QueueOutboxScope[]> {
    const now = Date.now();
    const grouped = new Map<string, { tenantId: string; caseId: string; nextAttemptAtIso: string }>();
    for (const item of this.queueOutbox.values()) {
      if (item.status !== "PENDING") {
        continue;
      }
      if (Date.parse(item.nextAttemptAtIso) > now) {
        continue;
      }
      const key = key2(item.tenantId, item.caseId);
      const current = grouped.get(key);
      if (!current || item.nextAttemptAtIso < current.nextAttemptAtIso) {
        grouped.set(key, {
          tenantId: item.tenantId,
          caseId: item.caseId,
          nextAttemptAtIso: item.nextAttemptAtIso
        });
      }
    }
    return [...grouped.values()]
      .sort((a, b) => a.nextAttemptAtIso.localeCompare(b.nextAttemptAtIso))
      .slice(0, Math.max(1, maxScopes))
      .map((item) => ({ tenantId: item.tenantId, caseId: item.caseId }));
  }

  public async listPendingQueueOutboxMessages(
    maxItems: number,
    tenantId?: string,
    caseId?: string
  ): Promise<readonly QueueOutboxRecord[]> {
    const now = Date.now();
    const rows = [...this.queueOutbox.values()]
      .filter((item) => item.status === "PENDING")
      .filter((item) => !tenantId || item.tenantId === tenantId)
      .filter((item) => !caseId || item.caseId === caseId)
      .filter((item) => Date.parse(item.nextAttemptAtIso) <= now)
      .sort((a, b) => a.nextAttemptAtIso.localeCompare(b.nextAttemptAtIso))
      .slice(0, Math.max(1, maxItems));
    return rows;
  }

  public async markQueueOutboxMessageDelivered(
    tenantId: string,
    caseId: string,
    queueName: QueueOutboxRecord["queueName"],
    messageId: string
  ): Promise<void> {
    const key = key3(tenantId, caseId, `${queueName}:${messageId}`);
    const current = this.queueOutbox.get(key);
    if (!current) {
      return;
    }
    this.queueOutbox.set(key, {
      ...current,
      status: "DELIVERED",
      attempts: current.attempts + 1
    });
  }

  public async markQueueOutboxMessageFailed(
    tenantId: string,
    caseId: string,
    queueName: QueueOutboxRecord["queueName"],
    messageId: string,
    nextAttemptAtIso: string,
    errorCode: string
  ): Promise<void> {
    const key = key3(tenantId, caseId, `${queueName}:${messageId}`);
    const current = this.queueOutbox.get(key);
    if (!current) {
      return;
    }
    this.queueOutbox.set(key, {
      ...current,
      status: "PENDING",
      attempts: current.attempts + 1,
      nextAttemptAtIso,
      lastError: errorCode
    });
  }

  public async markWorkItemStatus(
    tenantId: string,
    caseId: string,
    workItemId: string,
    status: WorkItemRecord["status"],
    attempt: number
  ): Promise<void> {
    const key = key3(tenantId, caseId, workItemId);
    const current = this.workItems.get(key);
    if (!current) {
      return;
    }
    this.workItems.set(key, {
      ...current,
      status,
      attempt,
      ...(status === "PROCESSED" || status === "REJECTED" || status === "DEAD_LETTER"
        ? { completedAtIso: new Date().toISOString() }
        : {})
    });
  }

  public async hasProcessedWorkItem(
    tenantId: string,
    caseId: string,
    operation: WorkItemRecord["operation"],
    payloadReference: string
  ): Promise<boolean> {
    for (const value of this.workItems.values()) {
      if (
        value.tenantId === tenantId &&
        value.caseId === caseId &&
        value.operation === operation &&
        value.payloadReference === payloadReference &&
        value.status === "PROCESSED"
      ) {
        return true;
      }
    }
    return false;
  }

  public async replaceExtractionChunks(
    tenantId: string,
    caseId: string,
    evidenceId: string,
    evidenceVersionId: string,
    chunks: readonly ExtractionChunkRecord[]
  ): Promise<void> {
    const key = key3(tenantId, caseId, `${evidenceId}:${evidenceVersionId}`);
    this.extractionChunks.set(key, [...chunks]);
  }

  public async listExtractionChunks(
    tenantId: string,
    caseId: string,
    evidenceId: string,
    evidenceVersionId: string
  ): Promise<readonly ExtractionChunkRecord[]> {
    return this.extractionChunks.get(key3(tenantId, caseId, `${evidenceId}:${evidenceVersionId}`)) ?? [];
  }

  public async markExtractionChunksIndexed(
    tenantId: string,
    caseId: string,
    evidenceId: string,
    evidenceVersionId: string
  ): Promise<void> {
    const key = key3(tenantId, caseId, `${evidenceId}:${evidenceVersionId}`);
    const existing = this.extractionChunks.get(key) ?? [];
    this.extractionChunks.set(
      key,
      existing.map((chunk) => ({ ...chunk, indexed: true }))
    );
  }

  public async isEvidenceVersionReadyForAnalysis(
    tenantId: string,
    caseId: string,
    evidenceId: string,
    evidenceVersionId: string
  ): Promise<boolean> {
    const chunks = await this.listExtractionChunks(tenantId, caseId, evidenceId, evidenceVersionId);
    return chunks.length > 0 && chunks.every((chunk) => chunk.indexed);
  }

  public async withCaseTransaction<TValue>(
    tenantId: string,
    caseId: string,
    callback: (repository: WorkloadRepository) => Promise<TValue>
  ): Promise<TValue> {
    if (this.activeIdempotencySnapshots) {
      return callback(this);
    }
    void tenantId;
    void caseId;
    this.activeIdempotencySnapshots = new Map();
    const snapshot: InMemorySnapshot = {
      cases: structuredClone(this.cases),
      sources: structuredClone(this.sources),
      licences: structuredClone(this.licences),
      evidence: structuredClone(this.evidence),
      evidenceObjects: structuredClone(this.evidenceObjects),
      admissions: structuredClone(this.admissions),
      analysisRuns: structuredClone(this.analysisRuns),
      analysisBundles: structuredClone(this.analysisBundles),
      analysisBundleEvidence: structuredClone(this.analysisBundleEvidence),
      analysisBundleReviews: structuredClone(this.analysisBundleReviews),
      claimsByRun: structuredClone(this.claimsByRun),
      citationsByRun: structuredClone(this.citationsByRun),
      reviewsByCase: structuredClone(this.reviewsByCase),
      extractionChunks: structuredClone(this.extractionChunks),
      access: structuredClone(this.access),
      approvedEligibility: structuredClone(this.approvedEligibility),
      policyDecisions: structuredClone(this.policyDecisions),
      auditByCase: structuredClone(this.auditByCase),
      workItems: structuredClone(this.workItems),
      queueOutbox: structuredClone(this.queueOutbox)
    };
    try {
      return await callback(this);
    } catch (error) {
      mapReplace(this.cases, snapshot.cases);
      mapReplace(this.sources, snapshot.sources);
      mapReplace(this.licences, snapshot.licences);
      mapReplace(this.evidence, snapshot.evidence);
      mapReplace(this.evidenceObjects, snapshot.evidenceObjects);
      mapReplace(this.admissions, snapshot.admissions);
      mapReplace(this.analysisRuns, snapshot.analysisRuns);
      mapReplace(this.analysisBundles, snapshot.analysisBundles);
      mapReplace(this.analysisBundleEvidence, snapshot.analysisBundleEvidence);
      mapReplace(this.analysisBundleReviews, snapshot.analysisBundleReviews);
      mapReplace(this.claimsByRun, snapshot.claimsByRun);
      mapReplace(this.citationsByRun, snapshot.citationsByRun);
      mapReplace(this.reviewsByCase, snapshot.reviewsByCase);
      mapReplace(this.extractionChunks, snapshot.extractionChunks);
      mapReplace(this.access, snapshot.access);
      this.approvedEligibility.clear();
      for (const value of snapshot.approvedEligibility.values()) {
        this.approvedEligibility.add(value);
      }
      this.policyDecisions.length = 0;
      this.policyDecisions.push(...snapshot.policyDecisions);
      mapReplace(this.auditByCase, snapshot.auditByCase);
      mapReplace(this.workItems, snapshot.workItems);
      mapReplace(this.queueOutbox, snapshot.queueOutbox);
      for (const [store, storeSnapshot] of this.activeIdempotencySnapshots.entries()) {
        store.restoreSnapshot(storeSnapshot);
      }
      throw error;
    } finally {
      this.activeIdempotencySnapshots = undefined;
    }
  }

  public bindIdempotencyStore(store: IdempotencyStore): IdempotencyStore {
    if (this.activeIdempotencySnapshots && store instanceof InMemoryIdempotencyStore) {
      if (!this.activeIdempotencySnapshots.has(store)) {
        this.activeIdempotencySnapshots.set(store, store.exportSnapshot());
      }
    }
    return store;
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }
}

export class SqlWorkloadRepository implements WorkloadRepository {
  public constructor(private readonly executor: SqlExecutor) {}

  private async assertAnalysisRunMutable(
    tenantId: string,
    caseId: string,
    analysisRunId: string
  ): Promise<void> {
    const row = await this.executor.queryOne<{ status: AnalysisRunRecord["status"] }>(
      `
SELECT status
FROM dbo.analysis_runs
WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_run_id=@analysis_run_id;
      `,
      { tenant_id: tenantId, case_id: caseId, analysis_run_id: analysisRunId },
      { context: { tenantId, caseId } }
    );
    if (row && (row.status === "DRAFT_ONLY_READY" || row.status === "FAILED")) {
      throw new Error("ANALYSIS_OUTPUT_IMMUTABLE");
    }
  }

  public async grantCaseAccess(assignment: CaseAccessAssignment): Promise<void> {
    await this.executor.execute(
      `
MERGE dbo.case_access_assignments AS target
USING (SELECT @tenant_id tenant_id, @case_id case_id, @subject_id subject_id, @role_name role_name) source
ON target.tenant_id = source.tenant_id
  AND target.case_id = source.case_id
  AND target.subject_id = source.subject_id
  AND target.role_name = source.role_name
WHEN MATCHED THEN UPDATE SET purpose = @purpose, revoked_at = NULL
WHEN NOT MATCHED THEN
  INSERT (tenant_id, case_id, subject_id, purpose, role_name, granted_at)
  VALUES (@tenant_id, @case_id, @subject_id, @purpose, @role_name, SYSUTCDATETIME());
      `,
      {
        tenant_id: assignment.tenantId,
        case_id: assignment.caseId,
        subject_id: assignment.subjectId,
        purpose: assignment.purpose,
        role_name: assignment.role
      },
      { context: { tenantId: assignment.tenantId, caseId: assignment.caseId } }
    );
  }

  public async assertCaseAccess(
    tenantId: string,
    caseId: string,
    subjectId: string,
    purpose: string
  ): Promise<boolean> {
    const row = await this.executor.queryOne<{ allowed: number }>(
      `
SELECT CAST(CASE WHEN EXISTS (
  SELECT 1 FROM dbo.case_access_assignments
  WHERE tenant_id = @tenant_id
    AND case_id = @case_id
    AND subject_id = @subject_id
    AND purpose = @purpose
    AND revoked_at IS NULL
) THEN 1 ELSE 0 END AS INT) AS allowed;
      `,
      {
        tenant_id: tenantId,
        case_id: caseId,
        subject_id: subjectId,
        purpose
      },
      { context: { tenantId, caseId } }
    );
    return row?.allowed === 1;
  }

  public async createCase(record: CaseRecord): Promise<void> {
    await this.executor.execute(
      `
IF NOT EXISTS (SELECT 1 FROM dbo.case_rollout_control WHERE tenant_id=@tenant_id AND case_id=@case_id)
  INSERT INTO dbo.case_rollout_control (tenant_id, case_id, rollout_sequence)
  VALUES (@tenant_id, @case_id, @rollout_sequence);
IF NOT EXISTS (SELECT 1 FROM dbo.cases WHERE tenant_id=@tenant_id AND case_id=@case_id)
BEGIN
  INSERT INTO dbo.cases (
    tenant_id, case_id, jurisdiction, purpose, status, created_by, opened_at, committee_ready_at,
    deal_eligibility_decision_id, jurisdiction_eligibility_decision_id, rollout_sequence
  ) VALUES (
    @tenant_id, @case_id, @jurisdiction, @purpose, @status, @created_by, @opened_at, @committee_ready_at,
    @deal_eligibility_decision_id, @jurisdiction_eligibility_decision_id, @rollout_sequence
  );
END;
      `,
      {
        tenant_id: record.tenantId,
        case_id: record.caseId,
        jurisdiction: record.jurisdiction,
        purpose: record.purpose,
        status: record.status,
        created_by: record.createdBy,
        opened_at: record.openedAtIso,
        committee_ready_at: record.committeeReadyAtIso ?? null,
        deal_eligibility_decision_id: record.dealEligibilityDecisionId,
        jurisdiction_eligibility_decision_id: record.jurisdictionEligibilityDecisionId,
        rollout_sequence: record.rolloutSequence
      },
      { context: { tenantId: record.tenantId, caseId: record.caseId } }
    );
  }

  public async getCase(tenantId: string, caseId: string): Promise<CaseRecord | undefined> {
    const row = await this.executor.queryOne<{
      tenant_id: string;
      case_id: string;
      jurisdiction: string;
      purpose: string;
      status: CaseStatus;
      created_by: string;
      opened_at: string;
      committee_ready_at: string | null;
      deal_eligibility_decision_id: string;
      jurisdiction_eligibility_decision_id: string;
      rollout_sequence: number;
    }>(
      `
SELECT tenant_id, case_id, jurisdiction, purpose, status, created_by, opened_at, committee_ready_at,
  deal_eligibility_decision_id, jurisdiction_eligibility_decision_id, rollout_sequence
FROM dbo.cases
WHERE tenant_id=@tenant_id AND case_id=@case_id;
      `,
      { tenant_id: tenantId, case_id: caseId },
      { context: { tenantId, caseId } }
    );
    if (!row) {
      return undefined;
    }
    return {
      tenantId: row.tenant_id,
      caseId: row.case_id,
      jurisdiction: row.jurisdiction,
      purpose: row.purpose,
      status: row.status,
      createdBy: row.created_by,
      openedAtIso: toIso(row.opened_at),
      ...(row.committee_ready_at ? { committeeReadyAtIso: row.committee_ready_at } : {}),
      dealEligibilityDecisionId: row.deal_eligibility_decision_id,
      jurisdictionEligibilityDecisionId: row.jurisdiction_eligibility_decision_id,
      rolloutSequence: row.rollout_sequence
    };
  }

  public async updateCaseStatus(tenantId: string, caseId: string, status: CaseStatus): Promise<void> {
    await this.executor.execute(
      `
UPDATE dbo.cases
SET status=@status, updated_at=SYSUTCDATETIME(),
    committee_ready_at=CASE WHEN @status=N'DRAFT_RECOMMENDATION_READY' THEN SYSUTCDATETIME() ELSE committee_ready_at END
WHERE tenant_id=@tenant_id AND case_id=@case_id;
      `,
      { tenant_id: tenantId, case_id: caseId, status },
      { context: { tenantId, caseId } }
    );
  }

  public async isEligibilityDecisionApproved(
    tenantId: string,
    caseId: string,
    decisionType: EligibilityDecisionType,
    decisionId: string
  ): Promise<boolean> {
    const row = await this.executor.queryOne<{ approved: number }>(
      `
SELECT CAST(CASE WHEN EXISTS (
  SELECT 1 FROM dbo.eligibility_decisions
  WHERE tenant_id=@tenant_id
    AND case_id=@case_id
    AND decision_type=@decision_type
    AND eligibility_decision_id=@eligibility_decision_id
    AND decision=N'APPROVED'
) THEN 1 ELSE 0 END AS INT) AS approved;
      `,
      {
        tenant_id: tenantId,
        case_id: caseId,
        decision_type: decisionType,
        eligibility_decision_id: decisionId
      },
      { context: { tenantId, caseId } }
    );
    return row?.approved === 1;
  }

  public async upsertSource(record: SourceRecord): Promise<void> {
    await this.executor.execute(
      `
MERGE dbo.source_registrations AS target
USING (SELECT @tenant_id tenant_id, @case_id case_id, @source_id source_id) source
ON target.tenant_id=source.tenant_id AND target.case_id=source.case_id AND target.source_id=source.source_id
WHEN MATCHED THEN UPDATE SET
  owner_id=@owner_id,
  domain=@domain,
  authoritative_status=@authoritative_status,
  authoritative_system=@authoritative_system,
  interface_type=@interface_type,
  permission_evidence_id=@permission_evidence_id,
  connector_evidence_id=@connector_evidence_id,
  jurisdiction=@jurisdiction,
  source_version=@source_version,
  status=@status,
  updated_at=SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (
  tenant_id, case_id, source_id, owner_id, domain, authoritative_status, authoritative_system, interface_type,
  permission_evidence_id, connector_evidence_id, jurisdiction, source_version, status
) VALUES (
  @tenant_id, @case_id, @source_id, @owner_id, @domain, @authoritative_status, @authoritative_system, @interface_type,
  @permission_evidence_id, @connector_evidence_id, @jurisdiction, @source_version, @status
);
      `,
      {
        tenant_id: record.tenantId,
        case_id: record.caseId,
        source_id: record.sourceId,
        owner_id: record.ownerId,
        domain: record.domain,
        authoritative_status: record.authoritativeStatus,
        authoritative_system: record.authoritativeSystem,
        interface_type: record.interfaceType,
        permission_evidence_id: record.permissionEvidenceId,
        connector_evidence_id: record.connectorEvidenceId,
        jurisdiction: record.jurisdiction,
        source_version: record.sourceVersion,
        status: record.status
      },
      { context: { tenantId: record.tenantId, caseId: record.caseId } }
    );
  }

  public async getSource(tenantId: string, caseId: string, sourceId: string): Promise<SourceRecord | undefined> {
    const row = await this.executor.queryOne<{
      tenant_id: string;
      case_id: string;
      source_id: string;
      owner_id: string;
      domain: string;
      authoritative_status: string;
      authoritative_system: string;
      interface_type: "READ_ONLY_API" | "CONTROLLED_FILE_INGESTION";
      permission_evidence_id: string;
      connector_evidence_id: string;
      jurisdiction: string;
      source_version: string;
      status: "DISABLED" | "ACTIVE" | "SUSPENDED";
    }>(
      `
SELECT tenant_id, case_id, source_id, owner_id, domain, authoritative_status, authoritative_system, interface_type,
  permission_evidence_id, connector_evidence_id, jurisdiction, source_version, status
FROM dbo.source_registrations
WHERE tenant_id=@tenant_id AND case_id=@case_id AND source_id=@source_id;
      `,
      { tenant_id: tenantId, case_id: caseId, source_id: sourceId },
      { context: { tenantId, caseId } }
    );
    if (!row) {
      return undefined;
    }
    return {
      tenantId: row.tenant_id,
      caseId: row.case_id,
      sourceId: row.source_id,
      ownerId: row.owner_id,
      domain: row.domain,
      authoritativeStatus: row.authoritative_status,
      authoritativeSystem: row.authoritative_system,
      interfaceType: row.interface_type,
      permissionEvidenceId: row.permission_evidence_id,
      connectorEvidenceId: row.connector_evidence_id,
      jurisdiction: row.jurisdiction,
      sourceVersion: row.source_version,
      status: row.status
    };
  }

  public async appendExternalLicenceDecision(record: ExternalLicenceDecision): Promise<void> {
    await this.executor.execute(
      `
INSERT INTO dbo.external_licence_decisions (
  tenant_id, case_id, source_id, licence_decision_id, licence_evidence_id, ai_retrieval_allowed, ai_analysis_allowed,
  purpose_id, purpose_approved, privacy_approved, licence_compatible, expires_at, lawful_basis, reviewed_by, approved_by
) VALUES (
  @tenant_id, @case_id, @source_id, @licence_decision_id, @licence_evidence_id, @ai_retrieval_allowed, @ai_analysis_allowed,
  @purpose_id, @purpose_approved, @privacy_approved, @licence_compatible, @expires_at, @lawful_basis, @reviewed_by, @approved_by
);
      `,
      {
        tenant_id: record.tenantId,
        case_id: record.caseId,
        source_id: record.sourceId,
        licence_decision_id: record.licenceDecisionId,
        licence_evidence_id: record.licenceEvidenceId,
        ai_retrieval_allowed: record.aiRetrievalAllowed,
        ai_analysis_allowed: record.aiAnalysisAllowed,
        purpose_id: record.purposeId,
        purpose_approved: record.purposeApproved,
        privacy_approved: record.privacyApproved,
        licence_compatible: record.licenceCompatible,
        expires_at: record.expiresAtIso,
        lawful_basis: record.lawfulBasis,
        reviewed_by: record.approvedBy,
        approved_by: record.approvedBy
      },
      { context: { tenantId: record.tenantId, caseId: record.caseId } }
    );
  }

  public async getLatestExternalLicenceDecision(
    tenantId: string,
    caseId: string,
    sourceId: string
  ): Promise<ExternalLicenceDecision | undefined> {
    const row = await this.executor.queryOne<{
      tenant_id: string;
      case_id: string;
      source_id: string;
      licence_decision_id: string;
      licence_evidence_id: string;
      ai_retrieval_allowed: unknown;
      ai_analysis_allowed: unknown;
      purpose_id: string;
      purpose_approved: unknown;
      privacy_approved: unknown;
      licence_compatible: unknown;
      expires_at: string;
      lawful_basis: string;
      approved_by: string;
    }>(
      `
SELECT TOP (1)
  tenant_id, case_id, source_id, licence_decision_id, licence_evidence_id, ai_retrieval_allowed, ai_analysis_allowed,
  purpose_id, purpose_approved, privacy_approved, licence_compatible, expires_at, lawful_basis, approved_by
FROM dbo.external_licence_decisions
WHERE tenant_id=@tenant_id AND case_id=@case_id AND source_id=@source_id
ORDER BY created_at DESC, licence_decision_id DESC;
      `,
      { tenant_id: tenantId, case_id: caseId, source_id: sourceId },
      { context: { tenantId, caseId } }
    );
    if (!row) {
      return undefined;
    }
    return {
      tenantId: row.tenant_id,
      caseId: row.case_id,
      sourceId: row.source_id,
      licenceDecisionId: row.licence_decision_id,
      licenceEvidenceId: row.licence_evidence_id,
      aiRetrievalAllowed: toBool(row.ai_retrieval_allowed),
      aiAnalysisAllowed: toBool(row.ai_analysis_allowed),
      purposeId: row.purpose_id,
      purposeApproved: toBool(row.purpose_approved),
      privacyApproved: toBool(row.privacy_approved),
      licenceCompatible: toBool(row.licence_compatible),
      expiresAtIso: row.expires_at,
      lawfulBasis: row.lawful_basis,
      approvedBy: row.approved_by
    };
  }

  public async createEvidence(record: EvidenceRecord): Promise<void> {
    await this.executor.execute(
      `
IF NOT EXISTS (
  SELECT 1
  FROM dbo.evidence_envelopes
  WHERE tenant_id=@tenant_id AND case_id=@case_id AND evidence_id=@evidence_id
)
BEGIN
  INSERT INTO dbo.evidence_envelopes (
    tenant_id, case_id, evidence_id, source_id, source_version, owner_id, captured_at, licence_decision_id, purpose_id,
    classification, quality_status, content_hash, payload_reference, has_special_category_data, is_external_data,
    admission_status
  ) VALUES (
    @tenant_id, @case_id, @evidence_id, @source_id, @source_version, @owner_id, @captured_at, @licence_decision_id, @purpose_id,
    @classification, @quality_status, @content_hash, @payload_reference, @has_special_category_data, @is_external_data,
    @admission_status
  );
END;
      `,
      {
        tenant_id: record.tenantId,
        case_id: record.caseId,
        evidence_id: record.evidenceId,
        source_id: record.sourceId,
        source_version: record.sourceVersion,
        owner_id: record.ownerId,
        captured_at: record.capturedAtIso,
        licence_decision_id: record.licenceDecisionId,
        purpose_id: record.purposeId,
        classification: record.classification,
        quality_status: record.qualityStatus,
        content_hash: record.contentHash,
        payload_reference: record.payloadReference,
        has_special_category_data: record.hasSpecialCategoryData,
        is_external_data: record.isExternalData,
        admission_status: record.admissionStatus
      },
      { context: { tenantId: record.tenantId, caseId: record.caseId } }
    );
  }

  public async getEvidence(tenantId: string, caseId: string, evidenceId: string): Promise<EvidenceRecord | undefined> {
    const row = await this.executor.queryOne<{
      tenant_id: string;
      case_id: string;
      evidence_id: string;
      source_id: string;
      source_version: string;
      owner_id: string;
      captured_at: string;
      licence_decision_id: string;
      purpose_id: string;
      classification: string;
      quality_status: "APPROVED" | "PENDING_REVIEW" | "REJECTED";
      content_hash: string;
      payload_reference: string;
      has_special_category_data: unknown;
      is_external_data: unknown;
      admission_status: "QUARANTINED" | "ADMITTED";
    }>(
      `
SELECT tenant_id, case_id, evidence_id, source_id, source_version, owner_id, captured_at, licence_decision_id, purpose_id,
  classification, quality_status, content_hash, payload_reference, has_special_category_data, is_external_data, admission_status
FROM dbo.evidence_envelopes
WHERE tenant_id=@tenant_id AND case_id=@case_id AND evidence_id=@evidence_id;
      `,
      { tenant_id: tenantId, case_id: caseId, evidence_id: evidenceId },
      { context: { tenantId, caseId } }
    );
    if (!row) {
      return undefined;
    }
    return {
      tenantId: row.tenant_id,
      caseId: row.case_id,
      evidenceId: row.evidence_id,
      sourceId: row.source_id,
      sourceVersion: row.source_version,
      ownerId: row.owner_id,
      capturedAtIso: row.captured_at,
      licenceDecisionId: row.licence_decision_id,
      purposeId: row.purpose_id,
      classification: row.classification,
      qualityStatus: row.quality_status,
      contentHash: row.content_hash,
      payloadReference: row.payload_reference,
      hasSpecialCategoryData: toBool(row.has_special_category_data),
      isExternalData: toBool(row.is_external_data),
      admissionStatus: row.admission_status
    };
  }

  public async admitEvidence(tenantId: string, caseId: string, evidenceId: string): Promise<void> {
    await this.executor.execute(
      `
EXEC dbo.usp_admit_evidence @tenant_id=@tenant_id, @case_id=@case_id, @evidence_id=@evidence_id;
      `,
      { tenant_id: tenantId, case_id: caseId, evidence_id: evidenceId },
      { context: { tenantId, caseId } }
    );
  }

  public async appendEvidenceAdmissionDecision(record: EvidenceAdmissionDecision): Promise<void> {
    await this.executor.execute(
      `
IF EXISTS (
  SELECT 1
  FROM dbo.evidence_admission_decisions
  WHERE tenant_id=@tenant_id AND case_id=@case_id AND admission_decision_id=@admission_decision_id
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM dbo.evidence_admission_decisions
    WHERE tenant_id=@tenant_id AND case_id=@case_id AND admission_decision_id=@admission_decision_id
      AND evidence_id=@evidence_id AND decision=@decision AND reason_codes=@reason_codes
      AND policy_version=@policy_version AND decider_object_id=@decider_object_id AND decided_at=@decided_at
  )
  BEGIN
    RETURN;
  END;
  THROW 52071, 'EVIDENCE_ADMISSION_REPLAY_CONFLICT', 1;
END;
INSERT INTO dbo.evidence_admission_decisions (
  tenant_id, case_id, evidence_id, admission_decision_id, decision, reason_codes, policy_version, decider_object_id, decided_at
) VALUES (
  @tenant_id, @case_id, @evidence_id, @admission_decision_id, @decision, @reason_codes, @policy_version, @decider_object_id, @decided_at
);
      `,
      {
        tenant_id: record.tenantId,
        case_id: record.caseId,
        evidence_id: record.evidenceId,
        admission_decision_id: record.admissionDecisionId,
        decision: record.decision,
        reason_codes: JSON.stringify(record.reasonCodes),
        policy_version: record.policyVersion,
        decider_object_id: record.deciderObjectId,
        decided_at: record.decidedAtIso
      },
      { context: { tenantId: record.tenantId, caseId: record.caseId } }
    );
  }

  public async createEvidenceObject(record: EvidenceObjectRecord): Promise<void> {
    await this.executor.execute(
      `
IF EXISTS (
  SELECT 1
  FROM dbo.evidence_objects
  WHERE tenant_id=@tenant_id AND case_id=@case_id AND evidence_version_id=@evidence_version_id
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM dbo.evidence_objects
    WHERE tenant_id=@tenant_id
      AND case_id=@case_id
      AND evidence_version_id=@evidence_version_id
      AND evidence_id=@evidence_id
      AND blob_uri_reference=@blob_uri_reference
      AND content_hash=@content_hash
      AND media_type=@media_type
      AND size_bytes=@size_bytes
      AND malware_scan_status=@malware_scan_status
      AND retention_schedule_id=@retention_schedule_id
      AND ISNULL(legal_hold_id, N'') = ISNULL(@legal_hold_id, N'')
      AND disposition_status=@disposition_status
  )
  BEGIN
    RETURN;
  END;
  THROW 52075, 'EVIDENCE_OBJECT_REPLAY_CONFLICT', 1;
END;
INSERT INTO dbo.evidence_objects (
  tenant_id, case_id, evidence_version_id, evidence_id, blob_uri_reference, content_hash, media_type, size_bytes, malware_scan_status,
  retention_schedule_id, legal_hold_id, disposition_status
) VALUES (
  @tenant_id, @case_id, @evidence_version_id, @evidence_id, @blob_uri_reference, @content_hash, @media_type, @size_bytes, @malware_scan_status,
  @retention_schedule_id, @legal_hold_id, @disposition_status
);
      `,
      {
        tenant_id: record.tenantId,
        case_id: record.caseId,
        evidence_version_id: record.evidenceVersionId,
        evidence_id: record.evidenceId,
        blob_uri_reference: record.blobUriReference,
        content_hash: record.contentHash,
        media_type: record.mediaType,
        size_bytes: record.sizeBytes,
        malware_scan_status: record.malwareScanStatus,
        retention_schedule_id: record.retentionScheduleId,
        legal_hold_id: record.legalHoldId ?? null,
        disposition_status: record.dispositionStatus
      },
      { context: { tenantId: record.tenantId, caseId: record.caseId } }
    );
  }

  public async getLatestEvidenceObject(
    tenantId: string,
    caseId: string,
    evidenceId: string
  ): Promise<EvidenceObjectRecord | undefined> {
    const row = await this.executor.queryOne<{
      tenant_id: string;
      case_id: string;
      evidence_version_id: string;
      evidence_id: string;
      blob_uri_reference: string;
      content_hash: string;
      media_type: string;
      size_bytes: number;
      malware_scan_status: "PENDING" | "CLEAN" | "FAILED" | "UNKNOWN";
      retention_schedule_id: string;
      legal_hold_id: string | null;
      disposition_status: "ACTIVE" | "HOLD" | "DISPOSED";
    }>(
      `
SELECT TOP (1)
  tenant_id, case_id, evidence_version_id, evidence_id, blob_uri_reference, content_hash, media_type, size_bytes, malware_scan_status,
  retention_schedule_id, legal_hold_id, disposition_status
FROM dbo.evidence_objects
WHERE tenant_id=@tenant_id AND case_id=@case_id AND evidence_id=@evidence_id
ORDER BY created_at DESC;
      `,
      { tenant_id: tenantId, case_id: caseId, evidence_id: evidenceId },
      { context: { tenantId, caseId } }
    );
    if (!row) {
      return undefined;
    }
    return {
      tenantId: row.tenant_id,
      caseId: row.case_id,
      evidenceVersionId: row.evidence_version_id,
      evidenceId: row.evidence_id,
      blobUriReference: row.blob_uri_reference,
      contentHash: row.content_hash,
      mediaType: row.media_type,
      sizeBytes: row.size_bytes,
      malwareScanStatus: row.malware_scan_status,
      retentionScheduleId: row.retention_schedule_id,
      ...(row.legal_hold_id ? { legalHoldId: row.legal_hold_id } : {}),
      dispositionStatus: row.disposition_status
    };
  }

  public async createAnalysisRun(record: AnalysisRunRecord): Promise<void> {
    await this.executor.execute(
      `
IF NOT EXISTS (
  SELECT 1
  FROM dbo.analysis_runs
  WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_run_id=@analysis_run_id
)
BEGIN
  INSERT INTO dbo.analysis_runs (
    tenant_id, case_id, analysis_run_id, evidence_id, evidence_version_id, model_deployment_id,
    model_provider_evidence_id, regional_deployment_evidence_id, prompt_governance_evidence_id,
    prompt_template_version, policy_version, input_manifest_hash, status, output_kind, unsupported_claims,
    blocked_reason, output_reference, output_manifest_hash
  ) VALUES (
    @tenant_id, @case_id, @analysis_run_id, @evidence_id, @evidence_version_id, @model_deployment_id,
    @model_provider_evidence_id, @regional_deployment_evidence_id, @prompt_governance_evidence_id,
    @prompt_template_version, @policy_version, @input_manifest_hash, @status, @output_kind, @unsupported_claims,
    @blocked_reason, @output_reference, @output_manifest_hash
  );
END;
      `,
      {
        tenant_id: record.tenantId,
        case_id: record.caseId,
        analysis_run_id: record.analysisRunId,
        evidence_id: record.evidenceId,
        evidence_version_id: record.evidenceVersionId,
        model_deployment_id: record.modelDeploymentId,
        model_provider_evidence_id: record.modelProviderEvidenceId,
        regional_deployment_evidence_id: record.regionalDeploymentEvidenceId,
        prompt_governance_evidence_id: record.promptGovernanceEvidenceId,
        prompt_template_version: record.promptTemplateVersion,
        policy_version: record.policyVersion,
        input_manifest_hash: record.inputManifestHash,
        status: record.status,
        output_kind: record.outputKind,
        unsupported_claims: record.unsupportedClaims,
        blocked_reason: record.blockedReason ?? null,
        output_reference: record.outputReference ?? null,
        output_manifest_hash: record.outputManifestHash ?? null
      },
      { context: { tenantId: record.tenantId, caseId: record.caseId } }
    );
  }

  public async getAnalysisRun(
    tenantId: string,
    caseId: string,
    analysisRunId: string
  ): Promise<AnalysisRunRecord | undefined> {
    const rows = await this.executor.queryMany<{
      tenant_id: string;
      case_id: string;
      analysis_run_id: string;
      evidence_id: string;
      evidence_version_id: string;
      model_deployment_id: string;
      model_provider_evidence_id: string;
      regional_deployment_evidence_id: string;
      prompt_governance_evidence_id: string;
      prompt_template_version: string;
      policy_version: string;
      input_manifest_hash: string;
      status: AnalysisRunRecord["status"];
      output_kind: "DRAFT_ONLY";
      unsupported_claims: number;
      output_reference: string | null;
      blocked_reason: string | null;
      output_manifest_hash: string | null;
    }>(
      `
SELECT tenant_id, case_id, analysis_run_id, evidence_id, evidence_version_id, model_deployment_id,
  model_provider_evidence_id, regional_deployment_evidence_id, prompt_governance_evidence_id,
  prompt_template_version, policy_version, input_manifest_hash, status, output_kind, unsupported_claims,
  output_reference, blocked_reason, output_manifest_hash
FROM dbo.analysis_runs
WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_run_id=@analysis_run_id;
      `,
      { tenant_id: tenantId, case_id: caseId, analysis_run_id: analysisRunId },
      { context: { tenantId, caseId } }
    );
    const row = rows[0];
    if (!row) {
      return undefined;
    }
    return {
      tenantId: row.tenant_id,
      caseId: row.case_id,
      analysisRunId: row.analysis_run_id,
      evidenceId: row.evidence_id,
      evidenceVersionId: row.evidence_version_id,
      modelDeploymentId: row.model_deployment_id,
      modelProviderEvidenceId: row.model_provider_evidence_id,
      regionalDeploymentEvidenceId: row.regional_deployment_evidence_id,
      promptGovernanceEvidenceId: row.prompt_governance_evidence_id,
      promptTemplateVersion: row.prompt_template_version,
      policyVersion: row.policy_version,
      inputManifestHash: row.input_manifest_hash,
      status: row.status,
      outputKind: row.output_kind,
      unsupportedClaims: row.unsupported_claims,
      ...(row.output_reference ? { outputReference: row.output_reference } : {}),
      ...(row.blocked_reason ? { blockedReason: row.blocked_reason } : {}),
      ...(row.output_manifest_hash ? { outputManifestHash: row.output_manifest_hash } : {})
    };
  }

  public async getAnalysisRunById(tenantId: string, analysisRunId: string): Promise<AnalysisRunRecord | undefined> {
    const row = await this.executor.queryOne<{ case_id: string }>(
      `SELECT TOP (1) case_id FROM dbo.analysis_runs WHERE tenant_id=@tenant_id AND analysis_run_id=@analysis_run_id;`,
      { tenant_id: tenantId, analysis_run_id: analysisRunId },
      { context: { tenantId, allowTenantScopedLookup: true } }
    );
    if (!row) {
      return undefined;
    }
    return this.getAnalysisRun(tenantId, row.case_id, analysisRunId);
  }

  public async updateAnalysisRunStatus(
    tenantId: string,
    caseId: string,
    analysisRunId: string,
    status: AnalysisRunRecord["status"],
    unsupportedClaims: number,
    outputReference?: string,
    blockedReason?: string,
    outputManifestHash?: string
  ): Promise<void> {
    await this.executor.execute(
      `
UPDATE dbo.analysis_runs
SET status=@status,
    unsupported_claims=@unsupported_claims,
    output_reference=@output_reference,
    blocked_reason=@blocked_reason,
    output_manifest_hash=@output_manifest_hash,
    updated_at=SYSUTCDATETIME(),
    completed_at=CASE WHEN @status IN (N'DRAFT_ONLY_READY', N'FAILED', N'BLOCKED_MISSING_EVIDENCE') THEN SYSUTCDATETIME() ELSE completed_at END
WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_run_id=@analysis_run_id;
      `,
      {
        tenant_id: tenantId,
        case_id: caseId,
        analysis_run_id: analysisRunId,
        status,
        unsupported_claims: unsupportedClaims,
        output_reference: outputReference ?? null,
        blocked_reason: blockedReason ?? null,
        output_manifest_hash: outputManifestHash ?? null
      },
      { context: { tenantId, caseId } }
    );
  }

  public async upsertClaims(records: readonly ClaimRecord[]): Promise<void> {
    if (records.length > 0) {
      const first = records[0];
      if (first) {
        await this.assertAnalysisRunMutable(first.tenantId, first.caseId, first.analysisRunId);
      }
    }
    for (const record of records) {
      await this.executor.execute(
        `
MERGE dbo.material_claims AS target
USING (SELECT @tenant_id tenant_id, @case_id case_id, @claim_id claim_id) source
ON target.tenant_id=source.tenant_id AND target.case_id=source.case_id AND target.claim_id=source.claim_id
WHEN MATCHED THEN UPDATE SET
  analysis_run_id=@analysis_run_id,
  claim_text_reference=@claim_text_reference,
  severity=@severity,
  review_status=@review_status,
  is_material=@is_material,
  unsupported_reason=@unsupported_reason,
  updated_at=SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (
  tenant_id, case_id, claim_id, analysis_run_id, claim_text_reference, severity, review_status, is_material, unsupported_reason
) VALUES (
  @tenant_id, @case_id, @claim_id, @analysis_run_id, @claim_text_reference, @severity, @review_status, @is_material, @unsupported_reason
);
        `,
        {
          tenant_id: record.tenantId,
          case_id: record.caseId,
          claim_id: record.claimId,
          analysis_run_id: record.analysisRunId,
          claim_text_reference: record.claimTextReference,
          severity: record.severity,
          review_status: record.reviewStatus,
          is_material: record.isMaterial,
          unsupported_reason: record.unsupportedReason ?? null
        },
        { context: { tenantId: record.tenantId, caseId: record.caseId } }
      );
    }
  }

  public async replaceCitations(
    tenantId: string,
    caseId: string,
    analysisRunId: string,
    citations: readonly CitationRecord[]
  ): Promise<void> {
    await this.assertAnalysisRunMutable(tenantId, caseId, analysisRunId);
    await this.executor.execute(
      `
DELETE FROM dbo.citations
WHERE tenant_id=@tenant_id AND case_id=@case_id
  AND claim_id IN (SELECT claim_id FROM dbo.material_claims WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_run_id=@analysis_run_id);
      `,
      { tenant_id: tenantId, case_id: caseId, analysis_run_id: analysisRunId },
      { context: { tenantId, caseId } }
    );
    for (const citation of citations) {
      await this.executor.execute(
        `
INSERT INTO dbo.citations (
  tenant_id, case_id, citation_id, claim_id, evidence_id, evidence_version_id, locator, accessible_at_review
) VALUES (
  @tenant_id, @case_id, @citation_id, @claim_id, @evidence_id, @evidence_version_id, @locator, @accessible_at_review
);
        `,
        {
          tenant_id: citation.tenantId,
          case_id: citation.caseId,
          citation_id: citation.citationId,
          claim_id: citation.claimId,
          evidence_id: citation.evidenceId,
          evidence_version_id: citation.evidenceVersionId,
          locator: citation.locator,
          accessible_at_review: citation.accessibleAtReview
        },
        { context: { tenantId: citation.tenantId, caseId: citation.caseId } }
      );
    }
  }

  public async getCitationAssessment(
    tenantId: string,
    caseId: string,
    analysisRunId: string
  ): Promise<CitationAssessment> {
    const claims = await this.executor.queryMany<{
      claim_id: string;
      severity: "CRITICAL" | "NON_CRITICAL";
      is_material: unknown;
    }>(
      `
SELECT claim_id, severity, is_material
FROM dbo.material_claims
WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_run_id=@analysis_run_id;
      `,
      { tenant_id: tenantId, case_id: caseId, analysis_run_id: analysisRunId },
      { context: { tenantId, caseId } }
    );
    const citations = await this.executor.queryMany<{ claim_id: string }>(
      `
SELECT c.claim_id
FROM dbo.citations c
JOIN dbo.material_claims m
  ON m.tenant_id=c.tenant_id AND m.case_id=c.case_id AND m.claim_id=c.claim_id
WHERE c.tenant_id=@tenant_id AND c.case_id=@case_id AND m.analysis_run_id=@analysis_run_id;
      `,
      { tenant_id: tenantId, case_id: caseId, analysis_run_id: analysisRunId },
      { context: { tenantId, caseId } }
    );
    const citationClaimIds = new Set(citations.map((item) => item.claim_id));
    const claimInputs: ClaimAssessmentInput[] = claims.map((claim) => ({
      materiality: toBool(claim.is_material)
        ? (claim.severity === "CRITICAL" ? "CRITICAL" : "HIGH")
        : "LOW",
      citations: citationClaimIds.has(claim.claim_id) ? [{ citationId: `c:${claim.claim_id}` }] : []
    }));
    const summary = evaluateCitationAssessment(claimInputs);
    const materialClaimCount = claims.filter((claim) => toBool(claim.is_material)).length;
    const citedMaterialClaimCount = claims.filter(
      (claim) => toBool(claim.is_material) && citationClaimIds.has(claim.claim_id)
    ).length;
    return {
      ...summary,
      materialClaimCount,
      citedMaterialClaimCount
    };
  }

  public async buildEvidenceManifestHash(
    tenantId: string,
    caseId: string,
    analysisRunId: string
  ): Promise<string> {
    const claims = await this.executor.queryMany<{ claim_id: string; claim_text_reference: string }>(
      `
SELECT claim_id, claim_text_reference
FROM dbo.material_claims
WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_run_id=@analysis_run_id
ORDER BY claim_id;
      `,
      { tenant_id: tenantId, case_id: caseId, analysis_run_id: analysisRunId },
      { context: { tenantId, caseId } }
    );
    const citations = await this.executor.queryMany<{
      citation_id: string;
      claim_id: string;
      evidence_version_id: string;
      locator: string;
    }>(
      `
SELECT c.citation_id, c.claim_id, c.evidence_version_id, c.locator
FROM dbo.citations c
JOIN dbo.material_claims m
  ON m.tenant_id=c.tenant_id AND m.case_id=c.case_id AND m.claim_id=c.claim_id
WHERE c.tenant_id=@tenant_id AND c.case_id=@case_id AND m.analysis_run_id=@analysis_run_id
ORDER BY c.citation_id;
      `,
      { tenant_id: tenantId, case_id: caseId, analysis_run_id: analysisRunId },
      { context: { tenantId, caseId } }
    );
    return createHash("sha256")
      .update(JSON.stringify({ tenantId, caseId, analysisRunId, claims, citations }))
      .digest("hex");
  }

  public async createAnalysisBundle(record: AnalysisBundleRecord): Promise<void> {
    await this.executor.execute(
      `
IF EXISTS (
  SELECT 1
  FROM dbo.analysis_bundles
  WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_bundle_id=@analysis_bundle_id
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM dbo.analysis_bundles
    WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_bundle_id=@analysis_bundle_id
      AND evidence_manifest_hash=@evidence_manifest_hash
      AND model_route=@model_route
      AND model_deployment_id=@model_deployment_id
      AND route_evidence_id=@route_evidence_id
      AND prompt_template_version=@prompt_template_version
      AND request_fingerprint=@request_fingerprint
      AND status=@status
      AND output_kind=@output_kind
      AND unsupported_claims=@unsupported_claims
      AND total_claims=@total_claims
      AND cited_claims=@cited_claims
      AND material_claims=@material_claims
      AND cited_material_claims=@cited_material_claims
      AND ISNULL(subject_version, N'') = ISNULL(@subject_version, N'')
  )
  BEGIN
    RETURN;
  END;
  THROW 52090, 'ANALYSIS_BUNDLE_CREATE_CONFLICT', 1;
END;
IF EXISTS (
  SELECT 1
  FROM dbo.analysis_bundles
  WHERE tenant_id=@tenant_id AND case_id=@case_id AND request_fingerprint=@request_fingerprint
)
BEGIN
  THROW 52091, 'ANALYSIS_BUNDLE_REQUEST_FINGERPRINT_CONFLICT', 1;
END;
INSERT INTO dbo.analysis_bundles (
  tenant_id, case_id, analysis_bundle_id, evidence_manifest_hash, model_route, model_deployment_id,
  route_evidence_id, prompt_template_version, request_fingerprint, status, output_kind, unsupported_claims,
  total_claims, cited_claims, material_claims, cited_material_claims, subject_version
) VALUES (
  @tenant_id, @case_id, @analysis_bundle_id, @evidence_manifest_hash, @model_route, @model_deployment_id,
  @route_evidence_id, @prompt_template_version, @request_fingerprint, @status, @output_kind, @unsupported_claims,
  @total_claims, @cited_claims, @material_claims, @cited_material_claims, @subject_version
);
      `,
      {
        tenant_id: record.tenantId,
        case_id: record.caseId,
        analysis_bundle_id: record.analysisBundleId,
        evidence_manifest_hash: record.evidenceManifestHash,
        model_route: record.modelRoute,
        model_deployment_id: record.modelDeploymentId,
        route_evidence_id: record.routeEvidenceId,
        prompt_template_version: record.promptTemplateVersion,
        request_fingerprint: record.requestFingerprint,
        status: record.status,
        output_kind: record.outputKind,
        unsupported_claims: record.unsupportedClaims,
        total_claims: record.totalClaims,
        cited_claims: record.citedClaims,
        material_claims: record.materialClaims,
        cited_material_claims: record.citedMaterialClaims,
        subject_version: record.subjectVersion ?? null
      },
      { context: { tenantId: record.tenantId, caseId: record.caseId } }
    );
  }

  public async getAnalysisBundle(
    tenantId: string,
    caseId: string,
    bundleId: string
  ): Promise<AnalysisBundleRecord | undefined> {
    const row = await this.executor.queryOne<{
      tenant_id: string;
      case_id: string;
      analysis_bundle_id: string;
      evidence_manifest_hash: string;
      model_route: "LUNA" | "TERRA" | "SOL";
      model_deployment_id: string;
      route_evidence_id: string;
      prompt_template_version: string;
      request_fingerprint: string;
      status: AnalysisBundleRecord["status"];
      output_kind: "DRAFT_ONLY";
      unsupported_claims: number;
      total_claims: number;
      cited_claims: number;
      material_claims: number;
      cited_material_claims: number;
      subject_version: string | null;
    }>(
      `
SELECT tenant_id, case_id, analysis_bundle_id, evidence_manifest_hash, model_route, model_deployment_id,
  route_evidence_id, prompt_template_version, request_fingerprint, status, output_kind, unsupported_claims,
  total_claims, cited_claims, material_claims, cited_material_claims, subject_version
FROM dbo.analysis_bundles
WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_bundle_id=@analysis_bundle_id;
      `,
      { tenant_id: tenantId, case_id: caseId, analysis_bundle_id: bundleId },
      { context: { tenantId, caseId } }
    );
    if (!row) {
      return undefined;
    }
    return {
      tenantId: row.tenant_id,
      caseId: row.case_id,
      analysisBundleId: row.analysis_bundle_id,
      evidenceManifestHash: row.evidence_manifest_hash,
      modelRoute: row.model_route,
      modelDeploymentId: row.model_deployment_id,
      routeEvidenceId: row.route_evidence_id,
      promptTemplateVersion: row.prompt_template_version,
      requestFingerprint: row.request_fingerprint,
      status: row.status,
      outputKind: row.output_kind,
      unsupportedClaims: row.unsupported_claims,
      totalClaims: row.total_claims,
      citedClaims: row.cited_claims,
      materialClaims: row.material_claims,
      citedMaterialClaims: row.cited_material_claims,
      ...(row.subject_version ? { subjectVersion: row.subject_version } : {})
    };
  }

  public async getAnalysisBundleById(
    tenantId: string,
    bundleId: string
  ): Promise<AnalysisBundleRecord | undefined> {
    const row = await this.executor.queryOne<{ case_id: string }>(
      `
SELECT case_id
FROM dbo.analysis_bundles
WHERE tenant_id=@tenant_id AND analysis_bundle_id=@analysis_bundle_id;
      `,
      { tenant_id: tenantId, analysis_bundle_id: bundleId },
      { context: { tenantId, allowTenantScopedLookup: true } }
    );
    return row ? this.getAnalysisBundle(tenantId, row.case_id, bundleId) : undefined;
  }

  public async appendAnalysisBundleEvidence(record: AnalysisBundleEvidenceRecord): Promise<void> {
    await this.executor.execute(
      `
IF EXISTS (
  SELECT 1
  FROM dbo.analysis_bundle_evidence
  WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_bundle_id=@analysis_bundle_id
    AND (ordinal=@ordinal OR (evidence_id=@evidence_id AND evidence_version_id=@evidence_version_id))
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM dbo.analysis_bundle_evidence
    WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_bundle_id=@analysis_bundle_id
      AND evidence_id=@evidence_id AND evidence_version_id=@evidence_version_id AND ordinal=@ordinal
  )
  BEGIN
    RETURN;
  END;
  THROW 52092, 'ANALYSIS_BUNDLE_EVIDENCE_CONFLICT', 1;
END;
INSERT INTO dbo.analysis_bundle_evidence (
  tenant_id, case_id, analysis_bundle_id, evidence_id, evidence_version_id, ordinal
) VALUES (
  @tenant_id, @case_id, @analysis_bundle_id, @evidence_id, @evidence_version_id, @ordinal
);
      `,
      {
        tenant_id: record.tenantId,
        case_id: record.caseId,
        analysis_bundle_id: record.analysisBundleId,
        evidence_id: record.evidenceId,
        evidence_version_id: record.evidenceVersionId,
        ordinal: record.ordinal
      },
      { context: { tenantId: record.tenantId, caseId: record.caseId } }
    );
  }

  public async listAnalysisBundleEvidence(
    tenantId: string,
    caseId: string,
    bundleId: string
  ): Promise<readonly AnalysisBundleEvidenceRecord[]> {
    const rows = await this.executor.queryMany<{
      tenant_id: string;
      case_id: string;
      analysis_bundle_id: string;
      evidence_id: string;
      evidence_version_id: string;
      ordinal: number;
    }>(
      `
SELECT tenant_id, case_id, analysis_bundle_id, evidence_id, evidence_version_id, ordinal
FROM dbo.analysis_bundle_evidence
WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_bundle_id=@analysis_bundle_id
ORDER BY ordinal;
      `,
      { tenant_id: tenantId, case_id: caseId, analysis_bundle_id: bundleId },
      { context: { tenantId, caseId } }
    );
    return rows.map((row) => ({
      tenantId: row.tenant_id,
      caseId: row.case_id,
      analysisBundleId: row.analysis_bundle_id,
      evidenceId: row.evidence_id,
      evidenceVersionId: row.evidence_version_id,
      ordinal: row.ordinal
    }));
  }

  public async completeAnalysisBundle(record: AnalysisBundleCompletionRecord): Promise<void> {
    const result = await this.executor.execute(
      `
UPDATE dbo.analysis_bundles
SET status=@status,
    unsupported_claims=@unsupported_claims,
    total_claims=@total_claims,
    cited_claims=@cited_claims,
    material_claims=@material_claims,
    cited_material_claims=@cited_material_claims,
    subject_version=@subject_version,
    completed_at=SYSUTCDATETIME(),
    updated_at=SYSUTCDATETIME()
WHERE tenant_id=@tenant_id
  AND case_id=@case_id
  AND analysis_bundle_id=@analysis_bundle_id
  AND status=N'QUEUED'
  AND subject_version IS NULL;
      `,
      {
        tenant_id: record.tenantId,
        case_id: record.caseId,
        analysis_bundle_id: record.analysisBundleId,
        subject_version: record.subjectVersion,
        status: record.status,
        unsupported_claims: record.unsupportedClaims,
        total_claims: record.totalClaims,
        cited_claims: record.citedClaims,
        material_claims: record.materialClaims,
        cited_material_claims: record.citedMaterialClaims
      },
      { context: { tenantId: record.tenantId, caseId: record.caseId } }
    );
    if (result.rowsAffected > 0) {
      return;
    }
    const current = await this.getAnalysisBundle(record.tenantId, record.caseId, record.analysisBundleId);
    if (!current) {
      throw new Error("ANALYSIS_BUNDLE_NOT_FOUND");
    }
    if (
      current.subjectVersion === record.subjectVersion &&
      current.status === record.status &&
      current.unsupportedClaims === record.unsupportedClaims &&
      current.totalClaims === record.totalClaims &&
      current.citedClaims === record.citedClaims &&
      current.materialClaims === record.materialClaims &&
      current.citedMaterialClaims === record.citedMaterialClaims
    ) {
      return;
    }
    throw new Error("ANALYSIS_BUNDLE_COMPLETION_CONFLICT");
  }

  public async appendAnalysisBundleReview(record: AnalysisBundleReviewRecord): Promise<void> {
    await this.executor.execute(
      `
IF EXISTS (
  SELECT 1
  FROM dbo.analysis_bundle_reviews
  WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_bundle_id=@analysis_bundle_id AND review_id=@review_id
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM dbo.analysis_bundle_reviews
    WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_bundle_id=@analysis_bundle_id AND review_id=@review_id
      AND subject_version=@subject_version AND review_type=@review_type AND decision=@decision
      AND rationale=@rationale AND reviewer_object_id=@reviewer_object_id
      AND evidence_manifest_hash=@evidence_manifest_hash
  )
  BEGIN
    RETURN;
  END;
  THROW 52095, 'ANALYSIS_BUNDLE_REVIEW_CONFLICT', 1;
END;
INSERT INTO dbo.analysis_bundle_reviews (
  tenant_id, case_id, analysis_bundle_id, review_id, subject_version, review_type, decision,
  rationale, reviewer_object_id, evidence_manifest_hash
) VALUES (
  @tenant_id, @case_id, @analysis_bundle_id, @review_id, @subject_version, @review_type, @decision,
  @rationale, @reviewer_object_id, @evidence_manifest_hash
);
      `,
      {
        tenant_id: record.tenantId,
        case_id: record.caseId,
        analysis_bundle_id: record.analysisBundleId,
        review_id: record.reviewId,
        subject_version: record.subjectVersion,
        review_type: record.reviewType,
        decision: record.decision,
        rationale: record.rationale,
        reviewer_object_id: record.reviewerObjectId,
        evidence_manifest_hash: record.evidenceManifestHash
      },
      { context: { tenantId: record.tenantId, caseId: record.caseId } }
    );
  }

  public async listAnalysisBundleReviews(
    tenantId: string,
    caseId: string,
    bundleId: string
  ): Promise<readonly AnalysisBundleReviewRecord[]> {
    const rows = await this.executor.queryMany<{
      tenant_id: string;
      case_id: string;
      analysis_bundle_id: string;
      review_id: string;
      subject_version: string;
      review_type: ReviewRecord["reviewType"];
      decision: ReviewRecord["decision"];
      rationale: string;
      reviewer_object_id: string;
      evidence_manifest_hash: string;
    }>(
      `
SELECT tenant_id, case_id, analysis_bundle_id, review_id, subject_version, review_type, decision,
  rationale, reviewer_object_id, evidence_manifest_hash
FROM dbo.analysis_bundle_reviews
WHERE tenant_id=@tenant_id AND case_id=@case_id AND analysis_bundle_id=@analysis_bundle_id
ORDER BY decided_at, review_id;
      `,
      { tenant_id: tenantId, case_id: caseId, analysis_bundle_id: bundleId },
      { context: { tenantId, caseId } }
    );
    return rows.map((row) => ({
      tenantId: row.tenant_id,
      caseId: row.case_id,
      analysisBundleId: row.analysis_bundle_id,
      reviewId: row.review_id,
      subjectVersion: row.subject_version,
      reviewType: row.review_type,
      decision: row.decision,
      rationale: row.rationale,
      reviewerObjectId: row.reviewer_object_id,
      evidenceManifestHash: row.evidence_manifest_hash
    }));
  }

  public async getApprovedModelRouteEvidence(
    tenantId: string,
    evidenceId: string
  ): Promise<ApprovedModelRouteEvidence | undefined> {
    const row = await this.executor.queryOne<{
      tenant_id: string;
      evidence_id: string;
      status: "APPROVED" | "SUSPENDED" | "EXPIRED";
      resource_id: string;
      deployment_id: string;
      region: string;
      route: "LUNA" | "TERRA" | "SOL";
      api_version: string;
      evidence_version: string;
      valid_from: string | Date;
      valid_until: string | Date;
    }>(
      `
SELECT tenant_id, evidence_id, status, resource_id, deployment_id, region, route, api_version, evidence_version,
  valid_from, valid_until
FROM dbo.approved_model_route_evidence
WHERE tenant_id=@tenant_id AND evidence_id=@evidence_id;
      `,
      { tenant_id: tenantId, evidence_id: evidenceId },
      { context: { tenantId, allowTenantScopedLookup: true } }
    );
    if (!row) {
      return undefined;
    }
    return {
      tenantId: row.tenant_id,
      evidenceId: row.evidence_id,
      status: row.status,
      resourceId: row.resource_id,
      deploymentId: row.deployment_id,
      region: row.region,
      route: row.route,
      apiVersion: row.api_version,
      evidenceVersion: row.evidence_version,
      validFromIso: toIso(row.valid_from),
      validUntilIso: toIso(row.valid_until)
    };
  }

  public async appendReview(record: ReviewRecord): Promise<void> {
    await this.executor.execute(
      `
IF EXISTS (
  SELECT 1
  FROM dbo.review_approvals
  WHERE tenant_id=@tenant_id AND case_id=@case_id AND review_id=@review_id
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM dbo.review_approvals
    WHERE tenant_id=@tenant_id AND case_id=@case_id AND review_id=@review_id
      AND subject_id=@subject_id AND subject_version=@subject_version
      AND review_type=@review_type AND decision=@decision
      AND rationale=@rationale AND reviewer_object_id=@reviewer_object_id
      AND reviewer_version=@reviewer_version AND evidence_manifest_hash=@evidence_manifest_hash
  )
  BEGIN
    RETURN;
  END;
  THROW 52072, 'REVIEW_REPLAY_CONFLICT', 1;
END;
INSERT INTO dbo.review_approvals (
  tenant_id, case_id, review_id, subject_id, subject_version, review_type, decision, rationale,
  reviewer_object_id, reviewer_version, evidence_manifest_hash, decided_at
) VALUES (
  @tenant_id, @case_id, @review_id, @subject_id, @subject_version, @review_type, @decision, @rationale,
  @reviewer_object_id, @reviewer_version, @evidence_manifest_hash, SYSUTCDATETIME()
);
      `,
      {
        tenant_id: record.tenantId,
        case_id: record.caseId,
        review_id: record.reviewId,
        subject_id: record.subjectId,
        subject_version: record.subjectVersion,
        review_type: record.reviewType,
        decision: record.decision,
        rationale: record.rationale,
        reviewer_object_id: record.reviewerObjectId,
        reviewer_version: record.subjectVersion,
        evidence_manifest_hash: record.evidenceManifestHash
      },
      { context: { tenantId: record.tenantId, caseId: record.caseId } }
    );
  }

  public async listLatestReviewDecisions(
    tenantId: string,
    caseId: string,
    subjectId: string
  ): Promise<readonly ReviewDecisionSummary[]> {
    const rows = await this.executor.queryMany<{
      review_type: "DEAL" | "LEGAL" | "COMPLIANCE";
      decision: "APPROVED" | "REJECTED";
      subject_version: string;
    }>(
      `
WITH latest AS (
  SELECT review_type, decision, subject_version,
         ROW_NUMBER() OVER (PARTITION BY review_type ORDER BY decided_at DESC, review_id DESC) AS rn
  FROM dbo.review_approvals
  WHERE tenant_id=@tenant_id AND case_id=@case_id AND subject_id=@subject_id
)
SELECT review_type, decision, subject_version
FROM latest
WHERE rn = 1;
      `,
      { tenant_id: tenantId, case_id: caseId, subject_id: subjectId },
      { context: { tenantId, caseId } }
    );
    return rows.map((row) => ({
      reviewType: row.review_type,
      decision: row.decision,
      subjectVersion: row.subject_version
    }));
  }

  public async listPendingQueueOutboxScopes(maxScopes: number): Promise<readonly QueueOutboxScope[]> {
    const rows = await this.executor.queryMany<{
      tenant_id: string;
      case_id: string;
      first_next_attempt_at: string;
    }>(
      `
EXEC dbo.usp_list_pending_queue_outbox_scopes @max_scopes=@max_scopes;
      `,
      { max_scopes: Math.max(1, maxScopes) }
    );
    return rows.map((row) => ({ tenantId: row.tenant_id, caseId: row.case_id }));
  }

  public async appendPolicyDecision(record: PolicyDecisionRecord): Promise<void> {
    await this.executor.execute(
      `
IF EXISTS (
  SELECT 1
  FROM dbo.policy_decisions
  WHERE tenant_id=@tenant_id AND case_id=@case_id AND policy_decision_id=@policy_decision_id
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM dbo.policy_decisions
    WHERE tenant_id=@tenant_id AND case_id=@case_id AND policy_decision_id=@policy_decision_id
      AND decision_point=@decision_point AND policy_version=@policy_version AND input_hash=@input_hash
      AND result=@result AND reason_codes=@reason_codes AND correlation_id=@correlation_id
  )
  BEGIN
    RETURN;
  END;
  THROW 52073, 'POLICY_DECISION_REPLAY_CONFLICT', 1;
END;
INSERT INTO dbo.policy_decisions (
  tenant_id, case_id, policy_decision_id, decision_point, policy_version, input_hash, result, reason_codes, correlation_id, decided_at
) VALUES (
  @tenant_id, @case_id, @policy_decision_id, @decision_point, @policy_version, @input_hash, @result, @reason_codes, @correlation_id, SYSUTCDATETIME()
);
      `,
      {
        tenant_id: record.tenantId,
        case_id: record.caseId,
        policy_decision_id: record.policyDecisionId,
        decision_point: record.decisionPoint,
        policy_version: record.policyVersion,
        input_hash: record.inputHash,
        result: record.result,
        reason_codes: JSON.stringify(record.reasonCodes),
        correlation_id: record.correlationId
      },
      { context: { tenantId: record.tenantId, caseId: record.caseId } }
    );
  }

  public async appendAuditEvent(event: AuditEventInput): Promise<AuditEvent> {
    return this.executor.runInTransaction(
      { tenantId: event.tenantId, caseId: event.caseId },
      async (scoped) => {
        const existing = await scoped.queryOne<{
          event_sequence: number;
          previous_event_hash: string | null;
          event_hash: string;
          created_at: string;
          actor_id: string;
          action: string;
          subject_id: string;
          correlation_id: string;
          outcome: "SUCCESS" | "DENY" | "FAILURE";
          payload_reference: string;
        }>(
          `
SELECT event_sequence, previous_event_hash, event_hash, created_at, actor_id, action, subject_id, correlation_id, outcome, payload_reference
FROM dbo.audit_outbox
WHERE tenant_id=@tenant_id AND case_id=@case_id AND source_event_id=@source_event_id;
          `,
          {
            tenant_id: event.tenantId,
            case_id: event.caseId,
            source_event_id: event.sourceEventId
          },
          { context: { tenantId: event.tenantId, caseId: event.caseId } }
        );
        if (existing) {
          const samePayload =
            existing.actor_id === event.actorId &&
            existing.action === event.action &&
            existing.subject_id === event.subjectId &&
            existing.correlation_id === event.correlationId &&
            existing.outcome === event.outcome &&
            existing.payload_reference === event.payloadReference;
          if (!samePayload) {
            throw new Error("AUDIT_EVENT_REPLAY_CONFLICT");
          }
          return {
            ...event,
            sequence: existing.event_sequence,
            previousEventHash: existing.previous_event_hash,
            eventHash: existing.event_hash,
            occurredAtIso: toIso(existing.created_at)
          };
        }
        const lockRow = await scoped.queryOne<{
          next_sequence: number;
          previous_hash: string | null;
        }>(
          `
SELECT
  ISNULL(MAX(event_sequence), 0) + 1 AS next_sequence,
  (SELECT TOP (1) event_hash FROM dbo.audit_outbox WHERE tenant_id=@tenant_id AND case_id=@case_id ORDER BY event_sequence DESC) AS previous_hash
FROM dbo.audit_outbox WITH (UPDLOCK, HOLDLOCK)
WHERE tenant_id=@tenant_id AND case_id=@case_id;
          `,
          { tenant_id: event.tenantId, case_id: event.caseId },
          { context: { tenantId: event.tenantId, caseId: event.caseId } }
        );
        const sequence = lockRow?.next_sequence ?? 1;
        const previousEventHash = lockRow?.previous_hash ?? null;
        const eventHash = computeAuditHash(previousEventHash, sequence, event);
        const occurredAtIso = new Date().toISOString();
        await scoped.execute(
          `
INSERT INTO dbo.audit_outbox (
  tenant_id, case_id, source_event_id, event_sequence, actor_id, action, subject_id, correlation_id, outcome, payload_reference,
  previous_event_hash, event_hash, created_at
) VALUES (
  @tenant_id, @case_id, @source_event_id, @event_sequence, @actor_id, @action, @subject_id, @correlation_id, @outcome, @payload_reference,
  @previous_event_hash, @event_hash, @created_at
);
          `,
          {
            tenant_id: event.tenantId,
            case_id: event.caseId,
            source_event_id: event.sourceEventId,
            event_sequence: sequence,
            actor_id: event.actorId,
            action: event.action,
            subject_id: event.subjectId,
            correlation_id: event.correlationId,
            outcome: event.outcome,
            payload_reference: event.payloadReference,
            previous_event_hash: previousEventHash,
            event_hash: eventHash,
            created_at: occurredAtIso
          },
          { context: { tenantId: event.tenantId, caseId: event.caseId } }
        );
        return {
          ...event,
          sequence,
          previousEventHash,
          eventHash,
          occurredAtIso
        };
      }
    );
  }

  public async appendWorkItem(record: WorkItemRecord): Promise<void> {
    await this.executor.execute(
      `
MERGE dbo.work_items AS target
USING (SELECT @tenant_id tenant_id, @case_id case_id, @work_item_id work_item_id) source
ON target.tenant_id=source.tenant_id AND target.case_id=source.case_id AND target.work_item_id=source.work_item_id
WHEN MATCHED THEN UPDATE SET
  queue_name=@queue_name, operation=@operation, work_type=@work_type, message_id=@message_id, idempotency_key=@idempotency_key,
  attempt=@attempt, status=@status, payload_reference=@payload_reference, correlation_id=@correlation_id, queued_at=@queued_at,
  evidence_id=@evidence_id, evidence_version_id=@evidence_version_id, analysis_run_id=@analysis_run_id
WHEN NOT MATCHED THEN INSERT (
  tenant_id, case_id, work_item_id, queue_name, operation, work_type, message_id, idempotency_key, attempt, status,
  payload_reference, correlation_id, queued_at, evidence_id, evidence_version_id, analysis_run_id
) VALUES (
  @tenant_id, @case_id, @work_item_id, @queue_name, @operation, @work_type, @message_id, @idempotency_key, @attempt, @status,
  @payload_reference, @correlation_id, @queued_at, @evidence_id, @evidence_version_id, @analysis_run_id
);
      `,
      {
        tenant_id: record.tenantId,
        case_id: record.caseId,
        work_item_id: record.workItemId,
        queue_name: record.queueName,
        operation: record.operation,
        work_type: record.workType,
        message_id: record.messageId,
        idempotency_key: record.idempotencyKey,
        attempt: record.attempt,
        status: record.status,
        payload_reference: record.payloadReference,
        correlation_id: record.correlationId,
        queued_at: record.queuedAtIso,
        evidence_id: record.evidenceId ?? null,
        evidence_version_id: record.evidenceVersionId ?? null,
        analysis_run_id: record.analysisRunId ?? null
      },
      { context: { tenantId: record.tenantId, caseId: record.caseId } }
    );
  }

  public async enqueueQueueOutboxMessage(message: QueueMessage): Promise<void> {
    const canonicalBody = canonicalQueueMessage(message);
    const canonicalIdentity = canonicalQueueMessageIdentity(message);
    await this.executor.execute(
      `
IF EXISTS (
  SELECT 1
  FROM dbo.queue_outbox
  WHERE tenant_id=@tenant_id AND case_id=@case_id AND queue_name=@queue_name AND message_id=@message_id
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM dbo.queue_outbox
    WHERE tenant_id=@tenant_id AND case_id=@case_id AND queue_name=@queue_name AND message_id=@message_id
      AND JSON_MODIFY(
        JSON_MODIFY(canonical_body, '$.correlationId', NULL),
        '$.deliveryCount',
        NULL
      )=@canonical_identity
  )
  BEGIN
    RETURN;
  END;
  THROW 52074, 'QUEUE_OUTBOX_MESSAGE_CONFLICT', 1;
END;
INSERT INTO dbo.queue_outbox (
  tenant_id, case_id, queue_name, message_id, canonical_body, status, attempts, next_attempt_at
) VALUES (
  @tenant_id, @case_id, @queue_name, @message_id, @canonical_body, N'PENDING', 0, SYSUTCDATETIME()
);
      `,
      {
        tenant_id: message.tenantId,
        case_id: message.caseId,
        queue_name: message.queueName,
        message_id: message.messageId,
        canonical_body: canonicalBody,
        canonical_identity: canonicalIdentity
      },
      { context: { tenantId: message.tenantId, caseId: message.caseId } }
    );
  }

  public async listPendingQueueOutboxMessages(
    maxItems: number,
    tenantId?: string,
    caseId?: string
  ): Promise<readonly QueueOutboxRecord[]> {
    const options =
      tenantId === undefined
        ? undefined
        : caseId === undefined
          ? { context: { tenantId, allowTenantScopedLookup: true } }
          : { context: { tenantId, caseId } };
    const rows = await this.executor.queryMany<{
      tenant_id: string;
      case_id: string;
      queue_name: QueueOutboxRecord["queueName"];
      message_id: string;
      canonical_body: string;
      status: "PENDING" | "DELIVERED";
      attempts: number;
      next_attempt_at: string;
      delivered_at: string | null;
      last_error_code: string | null;
    }>(
      `
SELECT TOP (@max_items)
  tenant_id, case_id, queue_name, message_id, canonical_body, status, attempts, next_attempt_at, delivered_at, last_error_code
FROM dbo.queue_outbox
WHERE status=N'PENDING'
  AND (@tenant_id IS NULL OR tenant_id=@tenant_id)
  AND (@case_id IS NULL OR case_id=@case_id)
  AND next_attempt_at <= SYSUTCDATETIME()
ORDER BY next_attempt_at ASC;
      `,
      {
        max_items: Math.max(1, maxItems),
        tenant_id: tenantId ?? null,
        case_id: caseId ?? null
      },
      options
    );
    return rows.map((row) => ({
      tenantId: row.tenant_id,
      caseId: row.case_id,
      queueName: row.queue_name,
      messageId: row.message_id,
      canonicalBody: row.canonical_body,
      status: row.status,
      attempts: row.attempts,
      nextAttemptAtIso: toIso(row.next_attempt_at),
      ...(row.last_error_code ? { lastError: row.last_error_code } : {})
    }));
  }

  public async markQueueOutboxMessageDelivered(
    tenantId: string,
    caseId: string,
    queueName: QueueOutboxRecord["queueName"],
    messageId: string
  ): Promise<void> {
    await this.executor.execute(
      `
UPDATE dbo.queue_outbox
SET status=N'DELIVERED',
    delivered_at=COALESCE(delivered_at, SYSUTCDATETIME()),
    last_error_code=NULL,
    updated_at=SYSUTCDATETIME()
WHERE tenant_id=@tenant_id AND case_id=@case_id AND queue_name=@queue_name AND message_id=@message_id;
      `,
      {
        tenant_id: tenantId,
        case_id: caseId,
        queue_name: queueName,
        message_id: messageId
      },
      { context: { tenantId, caseId } }
    );
  }

  public async markQueueOutboxMessageFailed(
    tenantId: string,
    caseId: string,
    queueName: QueueOutboxRecord["queueName"],
    messageId: string,
    nextAttemptAtIso: string,
    errorCode: string
  ): Promise<void> {
    await this.executor.execute(
      `
UPDATE dbo.queue_outbox
SET attempts=attempts + 1,
    next_attempt_at=@next_attempt_at,
    last_error_code=@last_error_code,
    updated_at=SYSUTCDATETIME()
WHERE tenant_id=@tenant_id AND case_id=@case_id AND queue_name=@queue_name AND message_id=@message_id AND status=N'PENDING';
      `,
      {
        tenant_id: tenantId,
        case_id: caseId,
        queue_name: queueName,
        message_id: messageId,
        next_attempt_at: nextAttemptAtIso,
        last_error_code: errorCode
      },
      { context: { tenantId, caseId } }
    );
  }

  public async markWorkItemStatus(
    tenantId: string,
    caseId: string,
    workItemId: string,
    status: WorkItemRecord["status"],
    attempt: number
  ): Promise<void> {
    await this.executor.execute(
      `
UPDATE dbo.work_items
SET status=@status, attempt=@attempt, completed_at=CASE WHEN @status IN (N'PROCESSED', N'REJECTED', N'DEAD_LETTER') THEN SYSUTCDATETIME() ELSE completed_at END,
    updated_at=SYSUTCDATETIME()
WHERE tenant_id=@tenant_id AND case_id=@case_id AND work_item_id=@work_item_id;
      `,
      {
        tenant_id: tenantId,
        case_id: caseId,
        work_item_id: workItemId,
        status,
        attempt
      },
      { context: { tenantId, caseId } }
    );
  }

  public async hasProcessedWorkItem(
    tenantId: string,
    caseId: string,
    operation: WorkItemRecord["operation"],
    payloadReference: string
  ): Promise<boolean> {
    const row = await this.executor.queryOne<{ processed: number }>(
      `
SELECT CAST(CASE WHEN EXISTS (
  SELECT 1
  FROM dbo.work_items
  WHERE tenant_id=@tenant_id
    AND case_id=@case_id
    AND operation=@operation
    AND payload_reference=@payload_reference
    AND status=N'PROCESSED'
) THEN 1 ELSE 0 END AS INT) AS processed;
      `,
      {
        tenant_id: tenantId,
        case_id: caseId,
        operation,
        payload_reference: payloadReference
      },
      { context: { tenantId, caseId } }
    );
    return row?.processed === 1;
  }

  public async replaceExtractionChunks(
    tenantId: string,
    caseId: string,
    evidenceId: string,
    evidenceVersionId: string,
    chunks: readonly ExtractionChunkRecord[]
  ): Promise<void> {
    await this.executor.execute(
      `
DELETE FROM dbo.extraction_chunks
WHERE tenant_id=@tenant_id AND case_id=@case_id AND evidence_id=@evidence_id AND evidence_version_id=@evidence_version_id;
      `,
      {
        tenant_id: tenantId,
        case_id: caseId,
        evidence_id: evidenceId,
        evidence_version_id: evidenceVersionId
      },
      { context: { tenantId, caseId } }
    );
    for (const chunk of chunks) {
      await this.executor.execute(
        `
INSERT INTO dbo.extraction_chunks (
  tenant_id, case_id, evidence_id, evidence_version_id, chunk_id, chunk_text,
  classification, quality_status, policy_version, citation_locator, indexed_at
) VALUES (
  @tenant_id, @case_id, @evidence_id, @evidence_version_id, @chunk_id, @chunk_text,
  @classification, @quality_status, @policy_version, @citation_locator, @indexed_at
);
        `,
        {
          tenant_id: chunk.tenantId,
          case_id: chunk.caseId,
          evidence_id: chunk.evidenceId,
          evidence_version_id: chunk.evidenceVersionId,
          chunk_id: chunk.chunkId,
          chunk_text: chunk.text,
          classification: chunk.classification,
          quality_status: chunk.qualityStatus,
          policy_version: chunk.policyVersion,
          citation_locator: chunk.citationLocator,
          indexed_at: chunk.indexed ? new Date().toISOString() : null
        },
        { context: { tenantId, caseId } }
      );
    }
  }

  public async listExtractionChunks(
    tenantId: string,
    caseId: string,
    evidenceId: string,
    evidenceVersionId: string
  ): Promise<readonly ExtractionChunkRecord[]> {
    const rows = await this.executor.queryMany<{
      tenant_id: string;
      case_id: string;
      evidence_id: string;
      evidence_version_id: string;
      chunk_id: string;
      chunk_text: string;
      classification: string;
      quality_status: string;
      policy_version: string;
      citation_locator: string;
      indexed_at: string | null;
    }>(
      `
SELECT tenant_id, case_id, evidence_id, evidence_version_id, chunk_id, chunk_text,
  classification, quality_status, policy_version, citation_locator, indexed_at
FROM dbo.extraction_chunks
WHERE tenant_id=@tenant_id AND case_id=@case_id AND evidence_id=@evidence_id AND evidence_version_id=@evidence_version_id
ORDER BY chunk_id;
      `,
      {
        tenant_id: tenantId,
        case_id: caseId,
        evidence_id: evidenceId,
        evidence_version_id: evidenceVersionId
      },
      { context: { tenantId, caseId } }
    );
    return rows.map((row) => ({
      tenantId: row.tenant_id,
      caseId: row.case_id,
      evidenceId: row.evidence_id,
      evidenceVersionId: row.evidence_version_id,
      chunkId: row.chunk_id,
      text: row.chunk_text,
      classification: row.classification,
      qualityStatus: row.quality_status,
      policyVersion: row.policy_version,
      citationLocator: row.citation_locator,
      indexed: row.indexed_at !== null
    }));
  }

  public async markExtractionChunksIndexed(
    tenantId: string,
    caseId: string,
    evidenceId: string,
    evidenceVersionId: string
  ): Promise<void> {
    await this.executor.execute(
      `
UPDATE dbo.extraction_chunks
SET indexed_at = SYSUTCDATETIME()
WHERE tenant_id=@tenant_id AND case_id=@case_id AND evidence_id=@evidence_id AND evidence_version_id=@evidence_version_id;
      `,
      {
        tenant_id: tenantId,
        case_id: caseId,
        evidence_id: evidenceId,
        evidence_version_id: evidenceVersionId
      },
      { context: { tenantId, caseId } }
    );
  }

  public async isEvidenceVersionReadyForAnalysis(
    tenantId: string,
    caseId: string,
    evidenceId: string,
    evidenceVersionId: string
  ): Promise<boolean> {
    const row = await this.executor.queryOne<{ ready: number }>(
      `
SELECT CAST(CASE WHEN EXISTS (
  SELECT 1
  FROM dbo.extraction_chunks
  WHERE tenant_id=@tenant_id
    AND case_id=@case_id
    AND evidence_id=@evidence_id
    AND evidence_version_id=@evidence_version_id
) AND NOT EXISTS (
  SELECT 1
  FROM dbo.extraction_chunks
  WHERE tenant_id=@tenant_id
    AND case_id=@case_id
    AND evidence_id=@evidence_id
    AND evidence_version_id=@evidence_version_id
    AND indexed_at IS NULL
) THEN 1 ELSE 0 END AS INT) AS ready;
      `,
      {
        tenant_id: tenantId,
        case_id: caseId,
        evidence_id: evidenceId,
        evidence_version_id: evidenceVersionId
      },
      { context: { tenantId, caseId } }
    );
    return row?.ready === 1;
  }

  public async withCaseTransaction<TValue>(
    tenantId: string,
    caseId: string,
    callback: (repository: WorkloadRepository) => Promise<TValue>
  ): Promise<TValue> {
    return this.executor.runInTransaction({ tenantId, caseId }, async (scoped) =>
      callback(new SqlWorkloadRepository(scoped))
    );
  }

  public bindIdempotencyStore(store: IdempotencyStore): IdempotencyStore {
    if (store instanceof SqlIdempotencyStore) {
      return new SqlIdempotencyStore(this.executor);
    }
    return store;
  }

  public async isAvailable(): Promise<boolean> {
    return this.executor.isAvailable();
  }
}

export function newPolicyDecisionRecord(
  tenantId: string,
  caseId: string,
  decisionPoint: string,
  policyVersion: string,
  inputHash: string,
  result: "ALLOW" | "DENY",
  reasonCodes: readonly string[],
  correlationId: string
): PolicyDecisionRecord {
  return {
    tenantId,
    caseId,
    policyDecisionId: randomUUID(),
    decisionPoint,
    policyVersion,
    inputHash,
    result,
    reasonCodes,
    correlationId
  };
}
