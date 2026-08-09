import type {
  AnalysisBundleCompletionRecord,
  AnalysisBundleEvidenceRecord,
  AnalysisBundleRecord,
  AnalysisBundleReviewRecord,
  ApprovedModelRouteEvidence
} from "./demo-authority-types.js";

export type {
  AnalysisBundleCompletionRecord,
  AnalysisBundleEvidenceRecord,
  AnalysisBundleRecord,
  AnalysisBundleReviewRecord,
  AnalysisBundleStatus,
  ApprovedModelRouteEvidence
} from "./demo-authority-types.js";

export type CaseStatus =
  | "DRAFT"
  | "EVIDENCE_QUARANTINED"
  | "EVIDENCE_ADMITTED"
  | "ANALYSIS_REQUESTED"
  | "ANALYSIS_DRAFT_READY"
  | "SPECIALIST_REVIEW_PENDING"
  | "DRAFT_RECOMMENDATION_READY";

export type CaseEvent =
  | "CREATE_CASE"
  | "REQUEST_INGESTION"
  | "PROMOTE_EVIDENCE"
  | "REQUEST_ANALYSIS"
  | "STORE_ANALYSIS_DRAFT"
  | "REQUEST_SPECIALIST_REVIEW"
  | "MARK_DRAFT_READY";

export type ReviewType = "DEAL" | "LEGAL" | "COMPLIANCE";
export type ReviewDecision = "APPROVED" | "REJECTED";

export type EligibilityDecisionType = "DEAL" | "JURISDICTION";

export interface TransitionPolicyEvidence {
  readonly actorRole: string;
  readonly isHuman: boolean;
  readonly approvedDeal: boolean;
  readonly approvedJurisdiction: boolean;
  readonly sourceActive: boolean;
  readonly permissionScopeAllowed: boolean;
  readonly purposeOfUseAllowed: boolean;
  readonly privacyLawfulBasisPresent: boolean;
  readonly externalDataLicencePresent: boolean;
  readonly externalDataLicenceCompatible: boolean;
  readonly aiRetrievalAllowed: boolean;
  readonly aiAnalysisAllowed: boolean;
  readonly specialCategoryDataPresent: boolean;
  readonly confidenceCoverageSufficient: boolean;
  readonly allMaterialClaimsCited: boolean;
  readonly criticalUnsupportedClaimCount: number;
  readonly evidenceAdmitted: boolean;
  readonly modelProviderEvidencePresent: boolean;
  readonly modelRegionEvidencePresent: boolean;
  readonly promptGovernanceEvidencePresent: boolean;
  readonly humanSpecialistReviewComplete: boolean;
}

export interface TransitionContext {
  readonly tenantId: string;
  readonly caseId: string;
  readonly currentStatus: CaseStatus;
  readonly event: CaseEvent;
  readonly evidence: TransitionPolicyEvidence;
}

export interface PolicyEvaluation {
  readonly allowed: boolean;
  readonly denialReasons: readonly string[];
}

export interface CaseRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly jurisdiction: string;
  readonly purpose: string;
  readonly status: CaseStatus;
  readonly createdBy: string;
  readonly openedAtIso: string;
  readonly committeeReadyAtIso?: string;
  readonly dealEligibilityDecisionId: string;
  readonly jurisdictionEligibilityDecisionId: string;
  readonly rolloutSequence: number;
}

export interface SourceRecord {
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
}

export interface ExternalLicenceDecision {
  readonly tenantId: string;
  readonly caseId: string;
  readonly sourceId: string;
  readonly licenceDecisionId: string;
  readonly licenceEvidenceId: string;
  readonly aiRetrievalAllowed: boolean;
  readonly aiAnalysisAllowed: boolean;
  readonly purposeId: string;
  readonly purposeApproved: boolean;
  readonly privacyApproved: boolean;
  readonly licenceCompatible: boolean;
  readonly expiresAtIso: string;
  readonly lawfulBasis: string;
  readonly approvedBy: string;
}

export interface EvidenceRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly ownerId: string;
  readonly capturedAtIso: string;
  readonly licenceDecisionId: string;
  readonly purposeId: string;
  readonly classification: string;
  readonly qualityStatus: "APPROVED" | "PENDING_REVIEW" | "REJECTED";
  readonly contentHash: string;
  readonly payloadReference: string;
  readonly hasSpecialCategoryData: boolean;
  readonly isExternalData: boolean;
  readonly admissionStatus: "QUARANTINED" | "ADMITTED";
}

export interface EvidenceObjectRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly evidenceVersionId: string;
  readonly evidenceId: string;
  readonly blobUriReference: string;
  readonly contentHash: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly malwareScanStatus: "PENDING" | "CLEAN" | "FAILED" | "UNKNOWN";
  readonly retentionScheduleId: string;
  readonly legalHoldId?: string;
  readonly dispositionStatus: "ACTIVE" | "HOLD" | "DISPOSED";
}

export interface EvidenceAdmissionDecision {
  readonly tenantId: string;
  readonly caseId: string;
  readonly evidenceId: string;
  readonly admissionDecisionId: string;
  readonly decision: "ADMITTED" | "QUARANTINED";
  readonly reasonCodes: readonly string[];
  readonly policyVersion: string;
  readonly deciderObjectId: string;
  readonly decidedAtIso: string;
}

export interface AnalysisRunRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisRunId: string;
  readonly evidenceId: string;
  readonly evidenceVersionId: string;
  readonly modelDeploymentId: string;
  readonly modelProviderEvidenceId: string;
  readonly regionalDeploymentEvidenceId: string;
  readonly promptGovernanceEvidenceId: string;
  readonly promptTemplateVersion: string;
  readonly policyVersion: string;
  readonly inputManifestHash: string;
  readonly status:
    | "QUEUED"
    | "IN_PROGRESS"
    | "DRAFT_ONLY_READY"
    | "BLOCKED_MISSING_EVIDENCE"
    | "FAILED";
  readonly outputKind: "DRAFT_ONLY";
  readonly unsupportedClaims: number;
  readonly outputReference?: string;
  readonly blockedReason?: string;
  readonly outputManifestHash?: string;
}

export interface ClaimRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly claimId: string;
  readonly analysisRunId: string;
  readonly claimTextReference: string;
  readonly severity: "CRITICAL" | "NON_CRITICAL";
  readonly reviewStatus: "PENDING" | "CITED" | "UNSUPPORTED";
  readonly isMaterial: boolean;
  readonly unsupportedReason?: string;
}

export interface CitationRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly citationId: string;
  readonly claimId: string;
  readonly evidenceId: string;
  readonly evidenceVersionId: string;
  readonly locator: string;
  readonly accessibleAtReview: boolean;
}

export interface CitationAssessment {
  readonly allMaterialClaimsCited: boolean;
  readonly criticalUnsupportedClaimCount: number;
  readonly unsupportedClaimCount: number;
  readonly materialClaimCount: number;
  readonly citedMaterialClaimCount: number;
  readonly totalClaimCount: number;
  readonly citedClaimCount: number;
}

export interface ClaimAssessmentInput {
  readonly materiality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly citations: readonly { readonly citationId: string }[];
}

export interface ReviewRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly reviewId: string;
  readonly subjectId: string;
  readonly subjectVersion: string;
  readonly reviewType: ReviewType;
  readonly decision: ReviewDecision;
  readonly rationale: string;
  readonly reviewerObjectId: string;
  readonly evidenceManifestHash: string;
}

export interface CaseAccessAssignment {
  readonly tenantId: string;
  readonly caseId: string;
  readonly subjectId: string;
  readonly purpose: string;
  readonly role: string;
}

export interface PolicyDecisionRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly policyDecisionId: string;
  readonly decisionPoint: string;
  readonly policyVersion: string;
  readonly inputHash: string;
  readonly result: "ALLOW" | "DENY";
  readonly reasonCodes: readonly string[];
  readonly correlationId: string;
}

export interface AuditEventInput {
  readonly tenantId: string;
  readonly caseId: string;
  readonly sourceEventId: string;
  readonly actorId: string;
  readonly action: string;
  readonly subjectId: string;
  readonly correlationId: string;
  readonly outcome: "SUCCESS" | "DENY" | "FAILURE";
  readonly payloadReference: string;
}

export interface AuditEvent extends AuditEventInput {
  readonly sequence: number;
  readonly previousEventHash: string | null;
  readonly eventHash: string;
  readonly occurredAtIso: string;
}

export interface WorkItemRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly workItemId: string;
  readonly queueName: ApprovedQueueName;
  readonly operation: QueueOperation;
  readonly workType: string;
  readonly messageId: string;
  readonly idempotencyKey: string;
  readonly attempt: number;
  readonly status: "QUEUED" | "IN_PROGRESS" | "PROCESSED" | "DEAD_LETTER" | "REJECTED";
  readonly payloadReference: string;
  readonly correlationId: string;
  readonly queuedAtIso: string;
  readonly completedAtIso?: string;
  readonly evidenceId?: string;
  readonly evidenceVersionId?: string;
  readonly analysisRunId?: string;
}

export interface QueueOutboxRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly queueName: ApprovedQueueName;
  readonly messageId: string;
  readonly canonicalBody: string;
  readonly status: "PENDING" | "DELIVERED";
  readonly attempts: number;
  readonly nextAttemptAtIso: string;
  readonly lastError?: string;
}

export interface QueueOutboxScope {
  readonly tenantId: string;
  readonly caseId: string;
}

export type QueueOperation =
  | "REQUEST_INGESTION"
  | "REQUEST_EXTRACTION"
  | "REQUEST_ANALYSIS"
  | "REQUEST_INDEXING"
  | "EXPORT_AUDIT_EVIDENCE";

export type ApprovedQueueName =
  | "q-ingestion"
  | "q-extraction"
  | "q-analysis"
  | "q-indexing"
  | "q-audit-export";

export interface QueueMessage {
  readonly messageId: string;
  readonly tenantId: string;
  readonly caseId: string;
  readonly operation: QueueOperation;
  readonly queueName: ApprovedQueueName;
  readonly payloadReference: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly deliveryCount?: number;
  readonly analysisRunId?: string;
  readonly sourceId?: string;
  readonly evidenceId?: string;
  readonly evidenceVersionId?: string;
}

export interface QueueEnvelope {
  readonly message: QueueMessage;
  complete(): Promise<void>;
  abandon(reason: string): Promise<void>;
  deadLetter(reason: string): Promise<void>;
}

export interface QueueReceiver {
  receiveOne(maxWaitMs: number): Promise<QueueEnvelope | undefined>;
  isAvailable(): Promise<boolean>;
}

export interface QueueProducer {
  send(message: QueueMessage): Promise<void>;
  isAvailable(): Promise<boolean>;
}

export interface AuthenticatedPrincipal {
  readonly tenantId: string;
  readonly subjectId: string;
  readonly roles: readonly string[];
  readonly identityProvider: string;
  readonly authType: string;
  readonly isHuman: boolean;
  readonly applicationId?: string;
}

export interface IdempotencyRecord {
  readonly scopedKey: string;
  readonly tenantId: string;
  readonly caseId: string;
  readonly subjectId: string;
  readonly operationId: string;
  readonly fingerprint: string;
  readonly status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  readonly correlationId: string;
  readonly claimId: string;
  readonly leaseExpiresAtEpochMs: number;
  readonly responseCode?: number;
  readonly responseBody?: string;
}

export interface IdempotencyBeginInput {
  readonly scopedKey: string;
  readonly tenantId: string;
  readonly caseId: string;
  readonly subjectId: string;
  readonly operationId: string;
  readonly fingerprint: string;
  readonly correlationId: string;
  readonly leaseDurationSeconds: number;
}

export interface IdempotencyCompleteInput {
  readonly scopedKey: string;
  readonly tenantId: string;
  readonly caseId: string;
  readonly subjectId: string;
  readonly operationId: string;
  readonly fingerprint: string;
  readonly claimId: string;
}

export interface IdempotencyFailInput extends IdempotencyCompleteInput {}

export type IdempotencyBeginResult =
  | { readonly type: "STARTED"; readonly leaseExpiresAtEpochMs: number; readonly claimId: string }
  | { readonly type: "REPLAY"; readonly responseCode: number; readonly responseBody: string }
  | { readonly type: "CONFLICT" }
  | { readonly type: "IN_PROGRESS" };

export interface IdempotencyStore {
  begin(record: IdempotencyBeginInput): Promise<IdempotencyBeginResult>;
  complete(input: IdempotencyCompleteInput, responseCode: number, responseBody: string): Promise<void>;
  fail(input: IdempotencyFailInput): Promise<void>;
  isAvailable(): Promise<boolean>;
}

export interface ProviderAvailability {
  readonly ready: boolean;
  readonly detail: string;
}

export interface BlobInspection {
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly contentHash?: string;
  readonly malwareScanStatus: "CLEAN" | "FAILED" | "UNKNOWN";
  readonly retentionScheduleId: string;
  readonly dispositionStatus: "ACTIVE" | "HOLD" | "DISPOSED";
}

export interface BlobReferenceProvider {
  ensurePayloadReferenceAccessible(reference: string): Promise<void>;
  inspectPayloadReference(reference: string): Promise<BlobInspection>;
  isAvailable(): Promise<ProviderAvailability>;
}

export interface DocumentIntelligenceProvider {
  extractClaims(payloadReference: string): Promise<readonly ClaimRecord[]>;
  isAvailable(): Promise<ProviderAvailability>;
}

export interface SearchIndexProvider {
  indexChunks(
    chunks: readonly {
      readonly chunkId: string;
      readonly caseId: string;
      readonly tenantId: string;
      readonly evidenceId: string;
      readonly evidenceVersionId: string;
      readonly text: string;
      readonly classification: string;
      readonly qualityStatus: string;
      readonly policyVersion: string;
      readonly citationLocator: string;
    }[]
  ): Promise<void>;
  isAvailable(): Promise<ProviderAvailability>;
}

export interface ExtractionChunkRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly evidenceId: string;
  readonly evidenceVersionId: string;
  readonly chunkId: string;
  readonly text: string;
  readonly classification: string;
  readonly qualityStatus: string;
  readonly policyVersion: string;
  readonly citationLocator: string;
  readonly indexed: boolean;
}

export interface AnalysisResultClaim {
  readonly claimId: string;
  readonly claimTextReference: string;
  readonly severity: "CRITICAL" | "NON_CRITICAL";
  readonly isMaterial: boolean;
  readonly unsupportedReason?: string;
}

export interface AnalysisResultCitation {
  readonly citationId: string;
  readonly claimId: string;
  readonly evidenceId: string;
  readonly evidenceVersionId: string;
  readonly locator: string;
  readonly accessibleAtReview: boolean;
}

export interface AnalysisProviderResult {
  readonly outputReference: string;
  readonly claims: readonly AnalysisResultClaim[];
  readonly citations: readonly AnalysisResultCitation[];
}

export interface AnalysisProvider {
  runDraftOnlyAnalysis(input: {
    readonly analysisRunId: string;
    readonly payloadReference: string;
    readonly modelDeploymentId: string;
    readonly promptTemplateVersion: string;
  }): Promise<AnalysisProviderResult>;
  isAvailable(): Promise<ProviderAvailability>;
}

export interface AuditEvidenceExporter {
  exportCaseEvidence(input: {
    readonly tenantId: string;
    readonly caseId: string;
    readonly payloadReference: string;
    readonly correlationId: string;
  }): Promise<void>;
  isAvailable(): Promise<ProviderAvailability>;
}

export interface ReviewDecisionSummary {
  readonly reviewType: ReviewType;
  readonly decision: ReviewDecision;
  readonly subjectVersion: string;
}

export interface WorkloadRepository {
  grantCaseAccess(assignment: CaseAccessAssignment): Promise<void>;
  assertCaseAccess(
    tenantId: string,
    caseId: string,
    subjectId: string,
    purpose: string
  ): Promise<boolean>;
  createCase(record: CaseRecord): Promise<void>;
  getCase(tenantId: string, caseId: string): Promise<CaseRecord | undefined>;
  updateCaseStatus(tenantId: string, caseId: string, status: CaseStatus): Promise<void>;
  isEligibilityDecisionApproved(
    tenantId: string,
    caseId: string,
    decisionType: EligibilityDecisionType,
    decisionId: string
  ): Promise<boolean>;
  upsertSource(record: SourceRecord): Promise<void>;
  getSource(tenantId: string, caseId: string, sourceId: string): Promise<SourceRecord | undefined>;
  appendExternalLicenceDecision(record: ExternalLicenceDecision): Promise<void>;
  getLatestExternalLicenceDecision(
    tenantId: string,
    caseId: string,
    sourceId: string
  ): Promise<ExternalLicenceDecision | undefined>;
  createEvidence(record: EvidenceRecord): Promise<void>;
  getEvidence(tenantId: string, caseId: string, evidenceId: string): Promise<EvidenceRecord | undefined>;
  admitEvidence(tenantId: string, caseId: string, evidenceId: string): Promise<void>;
  appendEvidenceAdmissionDecision(record: EvidenceAdmissionDecision): Promise<void>;
  createEvidenceObject(record: EvidenceObjectRecord): Promise<void>;
  getLatestEvidenceObject(
    tenantId: string,
    caseId: string,
    evidenceId: string
  ): Promise<EvidenceObjectRecord | undefined>;
  createAnalysisRun(record: AnalysisRunRecord): Promise<void>;
  getAnalysisRun(
    tenantId: string,
    caseId: string,
    analysisRunId: string
  ): Promise<AnalysisRunRecord | undefined>;
  getAnalysisRunById(tenantId: string, analysisRunId: string): Promise<AnalysisRunRecord | undefined>;
  updateAnalysisRunStatus(
    tenantId: string,
    caseId: string,
    analysisRunId: string,
    status: AnalysisRunRecord["status"],
    unsupportedClaims: number,
    outputReference?: string,
    blockedReason?: string,
    outputManifestHash?: string
  ): Promise<void>;
  upsertClaims(records: readonly ClaimRecord[]): Promise<void>;
  replaceCitations(
    tenantId: string,
    caseId: string,
    analysisRunId: string,
    citations: readonly CitationRecord[]
  ): Promise<void>;
  getCitationAssessment(tenantId: string, caseId: string, analysisRunId: string): Promise<CitationAssessment>;
  buildEvidenceManifestHash(tenantId: string, caseId: string, analysisRunId: string): Promise<string>;
  createAnalysisBundle(record: AnalysisBundleRecord): Promise<void>;
  getAnalysisBundle(
    tenantId: string,
    caseId: string,
    bundleId: string
  ): Promise<AnalysisBundleRecord | undefined>;
  appendAnalysisBundleEvidence(record: AnalysisBundleEvidenceRecord): Promise<void>;
  listAnalysisBundleEvidence(
    tenantId: string,
    caseId: string,
    bundleId: string
  ): Promise<readonly AnalysisBundleEvidenceRecord[]>;
  completeAnalysisBundle(record: AnalysisBundleCompletionRecord): Promise<void>;
  appendAnalysisBundleReview(record: AnalysisBundleReviewRecord): Promise<void>;
  listAnalysisBundleReviews(
    tenantId: string,
    caseId: string,
    bundleId: string
  ): Promise<readonly AnalysisBundleReviewRecord[]>;
  getApprovedModelRouteEvidence(evidenceId: string): Promise<ApprovedModelRouteEvidence | undefined>;
  appendReview(record: ReviewRecord): Promise<void>;
  listLatestReviewDecisions(
    tenantId: string,
    caseId: string,
    subjectId: string
  ): Promise<readonly ReviewDecisionSummary[]>;
  appendPolicyDecision(record: PolicyDecisionRecord): Promise<void>;
  appendAuditEvent(event: AuditEventInput): Promise<AuditEvent>;
  appendWorkItem(record: WorkItemRecord): Promise<void>;
  enqueueQueueOutboxMessage(message: QueueMessage): Promise<void>;
  listPendingQueueOutboxScopes(maxScopes: number): Promise<readonly QueueOutboxScope[]>;
  listPendingQueueOutboxMessages(
    maxItems: number,
    tenantId?: string,
    caseId?: string
  ): Promise<readonly QueueOutboxRecord[]>;
  markQueueOutboxMessageDelivered(
    tenantId: string,
    caseId: string,
    queueName: ApprovedQueueName,
    messageId: string
  ): Promise<void>;
  markQueueOutboxMessageFailed(
    tenantId: string,
    caseId: string,
    queueName: ApprovedQueueName,
    messageId: string,
    nextAttemptAtIso: string,
    errorCode: string
  ): Promise<void>;
  markWorkItemStatus(
    tenantId: string,
    caseId: string,
    workItemId: string,
    status: WorkItemRecord["status"],
    attempt: number
  ): Promise<void>;
  hasProcessedWorkItem(
    tenantId: string,
    caseId: string,
    operation: QueueOperation,
    payloadReference: string
  ): Promise<boolean>;
  replaceExtractionChunks(
    tenantId: string,
    caseId: string,
    evidenceId: string,
    evidenceVersionId: string,
    chunks: readonly ExtractionChunkRecord[]
  ): Promise<void>;
  listExtractionChunks(
    tenantId: string,
    caseId: string,
    evidenceId: string,
    evidenceVersionId: string
  ): Promise<readonly ExtractionChunkRecord[]>;
  markExtractionChunksIndexed(
    tenantId: string,
    caseId: string,
    evidenceId: string,
    evidenceVersionId: string
  ): Promise<void>;
  isEvidenceVersionReadyForAnalysis(
    tenantId: string,
    caseId: string,
    evidenceId: string,
    evidenceVersionId: string
  ): Promise<boolean>;
  withCaseTransaction<TValue>(
    tenantId: string,
    caseId: string,
    callback: (repository: WorkloadRepository) => Promise<TValue>
  ): Promise<TValue>;
  bindIdempotencyStore?(store: IdempotencyStore): IdempotencyStore;
  isAvailable(): Promise<boolean>;
}
