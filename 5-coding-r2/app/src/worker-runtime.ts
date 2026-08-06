import { createHash } from "node:crypto";
import { QueueConsumer } from "./queue-consumer.js";
import { QueueOutboxDispatcher } from "./queue-outbox-dispatcher.js";
import { transitionCaseState } from "./state-machine.js";
import type {
  AnalysisProvider,
  AuditEvidenceExporter,
  BlobReferenceProvider,
  DocumentIntelligenceProvider,
  IdempotencyStore,
  QueueMessage,
  QueueProducer,
  QueueReceiver,
  SearchIndexProvider,
  TransitionContext,
  WorkloadRepository
} from "./types.js";
import { newPolicyDecisionRecord } from "./workload-repository.js";
import { policyInputHash } from "./policy-service.js";

export interface WorkerRuntimeConfig {
  readonly queueName: "q-ingestion" | "q-extraction" | "q-analysis" | "q-indexing" | "q-audit-export";
  readonly receiver: QueueReceiver;
  readonly producer: QueueProducer;
  readonly repository: WorkloadRepository;
  readonly idempotencyStore: IdempotencyStore;
  readonly blobProvider: BlobReferenceProvider;
  readonly documentProvider: DocumentIntelligenceProvider;
  readonly searchProvider: SearchIndexProvider;
  readonly analysisProvider: AnalysisProvider;
  readonly auditExporter: AuditEvidenceExporter;
  readonly modelProviderEvidenceId: string;
  readonly regionalDeploymentEvidenceId: string;
  readonly promptGovernanceEvidenceId: string;
  readonly maxCycles: number;
  readonly receiveWaitMs: number;
  readonly maxAttempts: number;
  readonly idempotencyLeaseDurationSeconds: number;
}

function queueOperation(queueName: WorkerRuntimeConfig["queueName"]): QueueMessage["operation"] {
  if (queueName === "q-ingestion") {
    return "REQUEST_INGESTION";
  }
  if (queueName === "q-extraction") {
    return "REQUEST_EXTRACTION";
  }
  if (queueName === "q-analysis") {
    return "REQUEST_ANALYSIS";
  }
  if (queueName === "q-indexing") {
    return "REQUEST_INDEXING";
  }
  return "EXPORT_AUDIT_EVIDENCE";
}

function deterministicMessageId(...parts: readonly string[]): string {
  return createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 32);
}

function auditSourceEventId(message: QueueMessage, action: string): string {
  return createHash("sha256")
    .update(`${message.tenantId}:${message.caseId}:${message.messageId}:${action}`)
    .digest("hex")
    .slice(0, 32);
}

function ingestionEvidenceVersionId(message: QueueMessage, payloadReference: string, evidenceId: string): string {
  return message.evidenceVersionId ?? deterministicMessageId(
    message.tenantId,
    message.caseId,
    message.messageId,
    evidenceId,
    payloadReference,
    "INGESTION_EVIDENCE_VERSION"
  );
}

function ingestionAdmissionDecisionId(message: QueueMessage, evidenceId: string): string {
  return deterministicMessageId(
    message.tenantId,
    message.caseId,
    message.messageId,
    evidenceId,
    "INGESTION_ADMISSION_DECISION"
  );
}

export class WorkerRuntime {
  private readonly consumer: QueueConsumer;
  private readonly outboxDispatcher: QueueOutboxDispatcher;

  public constructor(private readonly config: WorkerRuntimeConfig) {
    this.consumer = new QueueConsumer(
      config.repository,
      config.idempotencyStore,
      this.handlers(),
      {
        maxAttempts: config.maxAttempts,
        leaseDurationSeconds: config.idempotencyLeaseDurationSeconds
      }
    );
    this.outboxDispatcher = new QueueOutboxDispatcher(config.repository, config.producer);
  }

  private handlers(): Readonly<Record<string, (message: QueueMessage) => Promise<void>>> {
    return {
      REQUEST_INGESTION: async (message) => this.handleIngestion(message),
      REQUEST_EXTRACTION: async (message) => this.handleExtraction(message),
      REQUEST_ANALYSIS: async (message) => this.handleAnalysis(message),
      REQUEST_INDEXING: async (message) => this.handleIndexing(message),
      EXPORT_AUDIT_EVIDENCE: async (message) => this.handleAuditExport(message)
    };
  }

  public async run(): Promise<void> {
    const expectedOperation = queueOperation(this.config.queueName);
    for (let index = 0; index < this.config.maxCycles; index += 1) {
      const envelope = await this.config.receiver.receiveOne(this.config.receiveWaitMs);
      if (!envelope) {
        return;
      }
      const message = envelope.message;
      if (message.queueName !== this.config.queueName || message.operation !== expectedOperation) {
        await envelope.deadLetter("QUEUE_OPERATION_MISMATCH");
        continue;
      }
      const result = await this.consumer.process(message);
      try {
        await this.outboxDispatcher.dispatchPending(25, message.tenantId, message.caseId);
      } catch {
        // durable outbox retry loop will recover on later cycles
      }
      if (result.action === "complete") {
        await envelope.complete();
        continue;
      }
      if (result.action === "abandon") {
        await envelope.abandon(result.reason);
        continue;
      }
      await envelope.deadLetter(result.reason);
    }
  }

  private async handleIngestion(message: QueueMessage): Promise<void> {
    const evidenceId = message.evidenceId;
    if (!evidenceId) {
      throw new Error("MISSING_EVIDENCE_ID");
    }
    const evidence = await this.config.repository.withCaseTransaction(
      message.tenantId,
      message.caseId,
      async (repository) => repository.getEvidence(message.tenantId, message.caseId, evidenceId)
    );
    if (!evidence) {
      throw new Error("EVIDENCE_NOT_FOUND");
    }
    await this.config.blobProvider.ensurePayloadReferenceAccessible(evidence.payloadReference);
    const inspection = await this.config.blobProvider.inspectPayloadReference(evidence.payloadReference);
    const expectedHash = evidence.contentHash;
    const missingHash = !inspection.contentHash;
    const hashMismatch = inspection.contentHash !== expectedHash;
    const scanClean = inspection.malwareScanStatus === "CLEAN";
    const retentionPresent = inspection.retentionScheduleId.trim().length > 0;
    const blockedReason = missingHash
      ? "MISSING_TRUSTED_HASH"
      : hashMismatch
        ? "CONTENT_HASH_MISMATCH"
        : !scanClean
          ? "MALWARE_SCAN_NOT_CLEAN"
          : !retentionPresent
            ? "MISSING_RETENTION_METADATA"
            : undefined;
    const stableEvidenceVersionId = ingestionEvidenceVersionId(message, evidence.payloadReference, evidenceId);
    const stableAdmissionDecisionId = ingestionAdmissionDecisionId(message, evidenceId);
    const blocked = await this.config.repository.withCaseTransaction(
      message.tenantId,
      message.caseId,
      async (repository) => {
      await repository.createEvidenceObject({
        tenantId: message.tenantId,
        caseId: message.caseId,
        evidenceVersionId: stableEvidenceVersionId,
        evidenceId,
        blobUriReference: evidence.payloadReference,
        contentHash: inspection.contentHash ?? "",
        mediaType: inspection.mediaType,
        sizeBytes: inspection.sizeBytes,
        malwareScanStatus: inspection.malwareScanStatus,
        retentionScheduleId: inspection.retentionScheduleId,
        dispositionStatus: inspection.dispositionStatus
      });
      if (blockedReason) {
        await repository.appendEvidenceAdmissionDecision({
          tenantId: message.tenantId,
          caseId: message.caseId,
          evidenceId,
          admissionDecisionId: stableAdmissionDecisionId,
          decision: "QUARANTINED",
          reasonCodes: [blockedReason],
          policyVersion: "release-1",
          deciderObjectId: "worker-ingestion",
          decidedAtIso: new Date().toISOString()
        });
        await repository.appendAuditEvent({
          tenantId: message.tenantId,
          caseId: message.caseId,
          sourceEventId: auditSourceEventId(message, "INGESTION_BLOCKED"),
          actorId: "worker-ingestion",
          action: "INGESTION_BLOCKED",
          subjectId: evidenceId,
          correlationId: message.correlationId,
          outcome: "DENY",
          payloadReference: evidence.payloadReference
        });
        return blockedReason;
      }
      await repository.appendAuditEvent({
        tenantId: message.tenantId,
        caseId: message.caseId,
        sourceEventId: auditSourceEventId(message, "INGESTION_METADATA_CAPTURED"),
        actorId: "worker-ingestion",
        action: "INGESTION_METADATA_CAPTURED",
        subjectId: evidenceId,
        correlationId: message.correlationId,
        outcome: "SUCCESS",
        payloadReference: evidence.payloadReference
      });
      return undefined;
      }
    );
    if (blocked) {
      throw new Error(blocked);
    }
  }

  private async handleExtraction(message: QueueMessage): Promise<void> {
    const evidenceId = message.evidenceId;
    if (!evidenceId) {
      throw new Error("MISSING_EVIDENCE_ID");
    }
    const state = await this.config.repository.withCaseTransaction(
      message.tenantId,
      message.caseId,
      async (repository) => {
        const evidence = await repository.getEvidence(message.tenantId, message.caseId, evidenceId);
        const object = await repository.getLatestEvidenceObject(message.tenantId, message.caseId, evidenceId);
        return { evidence, object };
      }
    );
    if (!state.evidence || state.evidence.admissionStatus !== "ADMITTED" || !state.object) {
      throw new Error("EVIDENCE_NOT_ADMITTED");
    }
    const evidence = state.evidence;
    const evidenceObject = state.object;
    const extractedClaims = await this.config.documentProvider.extractClaims(evidence.payloadReference);
    const chunks = extractedClaims.map((claim, index) => ({
      tenantId: message.tenantId,
      caseId: message.caseId,
      evidenceId,
      evidenceVersionId: evidenceObject.evidenceVersionId,
      chunkId: `${evidenceObject.evidenceVersionId}:chunk-${index + 1}`,
      text: claim.claimTextReference,
      classification: evidence.classification,
      qualityStatus: evidence.qualityStatus,
      policyVersion: "release-1",
      citationLocator: `chunk:${index + 1}`,
      indexed: false
    }));
    const indexingMessageId = deterministicMessageId(
      message.tenantId,
      message.caseId,
      "REQUEST_INDEXING",
      `${evidenceId}:${evidenceObject.evidenceVersionId}`
    );
    await this.config.repository.withCaseTransaction(message.tenantId, message.caseId, async (repository) => {
      await repository.replaceExtractionChunks(
        message.tenantId,
        message.caseId,
        evidenceId,
        evidenceObject.evidenceVersionId,
        chunks
      );
      await repository.appendWorkItem({
        tenantId: message.tenantId,
        caseId: message.caseId,
        workItemId: indexingMessageId,
        queueName: "q-indexing",
        operation: "REQUEST_INDEXING",
        workType: "REQUEST_INDEXING",
        messageId: indexingMessageId,
        idempotencyKey: `REQUEST_INDEXING:${evidenceId}:${evidenceObject.evidenceVersionId}`,
        attempt: 1,
        status: "QUEUED",
        payloadReference: evidence.payloadReference,
        correlationId: message.correlationId,
        queuedAtIso: new Date().toISOString(),
        evidenceId,
        evidenceVersionId: evidenceObject.evidenceVersionId
      });
      await repository.enqueueQueueOutboxMessage({
        messageId: indexingMessageId,
        tenantId: message.tenantId,
        caseId: message.caseId,
        operation: "REQUEST_INDEXING",
        queueName: "q-indexing",
        payloadReference: evidence.payloadReference,
        idempotencyKey: `REQUEST_INDEXING:${evidenceId}:${evidenceObject.evidenceVersionId}`,
        correlationId: message.correlationId,
        evidenceId,
        evidenceVersionId: evidenceObject.evidenceVersionId
      });
      await repository.appendAuditEvent({
        tenantId: message.tenantId,
        caseId: message.caseId,
        sourceEventId: auditSourceEventId(message, "EXTRACTION_COMPLETED"),
        actorId: "worker-extraction",
        action: "EXTRACTION_COMPLETED",
        subjectId: evidenceId,
        correlationId: message.correlationId,
        outcome: "SUCCESS",
        payloadReference: evidence.payloadReference
      });
    });
  }

  private async handleAnalysis(message: QueueMessage): Promise<void> {
    const analysisRunId = message.analysisRunId;
    const evidenceId = message.evidenceId;
    if (!analysisRunId || !evidenceId) {
      throw new Error("MISSING_ANALYSIS_INPUT");
    }
    const state = await this.config.repository.withCaseTransaction(
      message.tenantId,
      message.caseId,
      async (repository) => {
        const run = await repository.getAnalysisRun(message.tenantId, message.caseId, analysisRunId);
        const caseRecord = await repository.getCase(message.tenantId, message.caseId);
        const evidence = await repository.getEvidence(message.tenantId, message.caseId, evidenceId);
        if (!run || !caseRecord || !evidence) {
          throw new Error("ANALYSIS_STATE_NOT_FOUND");
        }
        const source = await repository.getSource(message.tenantId, message.caseId, evidence.sourceId);
        const licence = source
          ? await repository.getLatestExternalLicenceDecision(
              message.tenantId,
              message.caseId,
              source.sourceId
            )
          : undefined;
        const approvedDeal = await repository.isEligibilityDecisionApproved(
          message.tenantId,
          message.caseId,
          "DEAL",
          caseRecord.dealEligibilityDecisionId
        );
        const approvedJurisdiction = await repository.isEligibilityDecisionApproved(
          message.tenantId,
          message.caseId,
          "JURISDICTION",
          caseRecord.jurisdictionEligibilityDecisionId
        );
        if (evidence.admissionStatus !== "ADMITTED") {
          await repository.updateAnalysisRunStatus(
            message.tenantId,
            message.caseId,
            analysisRunId,
            "BLOCKED_MISSING_EVIDENCE",
            0,
            undefined,
            "EVIDENCE_NOT_ADMITTED"
          );
          await repository.appendAuditEvent({
            tenantId: message.tenantId,
            caseId: message.caseId,
            sourceEventId: auditSourceEventId(message, "ANALYSIS_BLOCKED_EVIDENCE"),
            actorId: "worker-analysis",
            action: "ANALYSIS_BLOCKED",
            subjectId: analysisRunId,
            correlationId: message.correlationId,
            outcome: "DENY",
            payloadReference: evidence.payloadReference
          });
          return {
            blockedReason: "EVIDENCE_NOT_ADMITTED",
            run,
            caseRecord,
            evidence,
            source,
            licence,
            approvedDeal,
            approvedJurisdiction
          };
        }
        await repository.updateAnalysisRunStatus(
          message.tenantId,
          message.caseId,
          analysisRunId,
          "IN_PROGRESS",
          0
        );
        return { run, caseRecord, evidence, source, licence, approvedDeal, approvedJurisdiction };
      }
    );
    if ("blockedReason" in state) {
      throw new Error(state.blockedReason);
    }
    let providerResult: Awaited<ReturnType<AnalysisProvider["runDraftOnlyAnalysis"]>>;
    try {
      providerResult = await this.config.analysisProvider.runDraftOnlyAnalysis({
        analysisRunId,
        payloadReference: state.evidence.payloadReference,
        modelDeploymentId: state.run.modelDeploymentId,
        promptTemplateVersion: state.run.promptTemplateVersion
      });
    } catch (error) {
      await this.config.repository.withCaseTransaction(message.tenantId, message.caseId, async (repository) => {
        await repository.updateAnalysisRunStatus(
          message.tenantId,
          message.caseId,
          analysisRunId,
          "BLOCKED_MISSING_EVIDENCE",
          0,
          undefined,
          error instanceof Error ? error.message : "ANALYSIS_PROVIDER_ERROR"
        );
        await repository.appendAuditEvent({
          tenantId: message.tenantId,
          caseId: message.caseId,
          sourceEventId: auditSourceEventId(message, "ANALYSIS_BLOCKED_PROVIDER"),
          actorId: "worker-analysis",
          action: "ANALYSIS_BLOCKED",
          subjectId: analysisRunId,
          correlationId: message.correlationId,
          outcome: "FAILURE",
          payloadReference: state.evidence.payloadReference
        });
      });
      throw error;
    }
    const denialMarker = await this.config.repository.withCaseTransaction(
      message.tenantId,
      message.caseId,
      async (repository) => {
      const claims = providerResult.claims.map((claim) => ({
        tenantId: message.tenantId,
        caseId: message.caseId,
        analysisRunId,
        claimId: claim.claimId,
        claimTextReference: claim.claimTextReference,
        severity: claim.severity,
        reviewStatus: claim.unsupportedReason
          ? ("UNSUPPORTED" as const)
          : ("PENDING" as const),
        isMaterial: claim.isMaterial,
        ...(claim.unsupportedReason ? { unsupportedReason: claim.unsupportedReason } : {})
      }));
      const citations = providerResult.citations.map((citation) => ({
        tenantId: message.tenantId,
        caseId: message.caseId,
        citationId: citation.citationId,
        claimId: citation.claimId,
        evidenceId: citation.evidenceId,
        evidenceVersionId: citation.evidenceVersionId,
        locator: citation.locator,
        accessibleAtReview: citation.accessibleAtReview
      }));
      await repository.upsertClaims(claims);
      await repository.replaceCitations(message.tenantId, message.caseId, analysisRunId, citations);
      const assessment = await repository.getCitationAssessment(message.tenantId, message.caseId, analysisRunId);
      const outputManifestHash = await repository.buildEvidenceManifestHash(
        message.tenantId,
        message.caseId,
        analysisRunId
      );
      await repository.updateAnalysisRunStatus(
        message.tenantId,
        message.caseId,
        analysisRunId,
        "DRAFT_ONLY_READY",
        assessment.unsupportedClaimCount,
        providerResult.outputReference,
        undefined,
        outputManifestHash
      );
      const transition: TransitionContext = {
        tenantId: message.tenantId,
        caseId: message.caseId,
        currentStatus: state.caseRecord.status,
        event: "STORE_ANALYSIS_DRAFT",
        evidence: {
          actorRole: "WorkerAnalysis",
          isHuman: false,
          approvedDeal: state.approvedDeal,
          approvedJurisdiction: state.approvedJurisdiction,
          sourceActive: state.source?.status === "ACTIVE",
          permissionScopeAllowed: state.licence?.purposeApproved ?? false,
          purposeOfUseAllowed: state.licence?.purposeApproved ?? false,
          privacyLawfulBasisPresent: state.licence?.privacyApproved ?? false,
          externalDataLicencePresent: state.licence !== undefined,
          externalDataLicenceCompatible: state.licence?.licenceCompatible ?? false,
          aiRetrievalAllowed: state.licence?.aiRetrievalAllowed ?? false,
          aiAnalysisAllowed: state.licence?.aiAnalysisAllowed ?? false,
          specialCategoryDataPresent: state.evidence.hasSpecialCategoryData,
          confidenceCoverageSufficient: assessment.criticalUnsupportedClaimCount === 0,
          allMaterialClaimsCited: assessment.totalClaimCount > 0 && assessment.allMaterialClaimsCited,
          criticalUnsupportedClaimCount: assessment.criticalUnsupportedClaimCount,
          evidenceAdmitted: state.evidence.admissionStatus === "ADMITTED",
          modelProviderEvidencePresent:
            state.run.modelProviderEvidenceId === this.config.modelProviderEvidenceId,
          modelRegionEvidencePresent:
            state.run.regionalDeploymentEvidenceId === this.config.regionalDeploymentEvidenceId,
          promptGovernanceEvidencePresent:
            state.run.promptGovernanceEvidenceId === this.config.promptGovernanceEvidenceId,
          humanSpecialistReviewComplete: false
        }
      };
      const decision = transitionCaseState(transition);
      await repository.appendPolicyDecision(
        newPolicyDecisionRecord(
          message.tenantId,
          message.caseId,
          "STORE_ANALYSIS_DRAFT",
          state.run.policyVersion,
          policyInputHash(transition),
          decision.allowed ? "ALLOW" : "DENY",
          decision.denialReasons,
          message.correlationId
        )
      );
      if (!decision.allowed) {
        await repository.updateAnalysisRunStatus(
          message.tenantId,
          message.caseId,
          analysisRunId,
          "FAILED",
          assessment.unsupportedClaimCount,
          providerResult.outputReference,
          decision.denialReasons.join(","),
          outputManifestHash
        );
        await repository.appendAuditEvent({
          tenantId: message.tenantId,
          caseId: message.caseId,
          sourceEventId: auditSourceEventId(message, "ANALYSIS_BLOCKED_POLICY"),
          actorId: "worker-analysis",
          action: "ANALYSIS_BLOCKED",
          subjectId: analysisRunId,
          correlationId: message.correlationId,
          outcome: "DENY",
          payloadReference: providerResult.outputReference
        });
        return "ANALYSIS_POLICY_DENIED";
      }
      await repository.updateCaseStatus(message.tenantId, message.caseId, decision.nextStatus);
      await repository.appendAuditEvent({
        tenantId: message.tenantId,
        caseId: message.caseId,
        sourceEventId: auditSourceEventId(message, "ANALYSIS_DRAFT_STORED"),
        actorId: "worker-analysis",
        action: "ANALYSIS_DRAFT_STORED",
        subjectId: analysisRunId,
        correlationId: message.correlationId,
        outcome: "SUCCESS",
        payloadReference: providerResult.outputReference
      });
      return undefined;
      }
    );
    if (denialMarker) {
      throw new Error(denialMarker);
    }
  }

  private async handleIndexing(message: QueueMessage): Promise<void> {
    const evidenceId = message.evidenceId;
    if (!evidenceId) {
      throw new Error("MISSING_EVIDENCE_ID");
    }
    const state = await this.config.repository.withCaseTransaction(
      message.tenantId,
      message.caseId,
      async (repository) => {
        const evidence = await repository.getEvidence(message.tenantId, message.caseId, evidenceId);
        const object = await repository.getLatestEvidenceObject(message.tenantId, message.caseId, evidenceId);
        if (!evidence || evidence.admissionStatus !== "ADMITTED" || !object) {
          throw new Error("EVIDENCE_NOT_ADMITTED");
        }
        const chunks = await repository.listExtractionChunks(
          message.tenantId,
          message.caseId,
          evidenceId,
          object.evidenceVersionId
        );
        return { evidence, object, chunks };
      }
    );
    if (state.chunks.length === 0) {
      throw new Error("EXTRACTION_CHUNKS_MISSING");
    }
    await this.config.searchProvider.indexChunks(
      state.chunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        caseId: chunk.caseId,
        tenantId: chunk.tenantId,
        evidenceId: chunk.evidenceId,
        evidenceVersionId: chunk.evidenceVersionId,
        text: chunk.text,
        classification: chunk.classification,
        qualityStatus: chunk.qualityStatus,
        policyVersion: chunk.policyVersion,
        citationLocator: chunk.citationLocator
      }))
    );
    await this.config.repository.withCaseTransaction(message.tenantId, message.caseId, async (repository) => {
      await repository.markExtractionChunksIndexed(
        message.tenantId,
        message.caseId,
        evidenceId,
        state.object.evidenceVersionId
      );
      await repository.appendAuditEvent({
        tenantId: message.tenantId,
        caseId: message.caseId,
        sourceEventId: auditSourceEventId(message, "INDEXING_COMPLETED"),
        actorId: "worker-indexing",
        action: "INDEXING_COMPLETED",
        subjectId: evidenceId,
        correlationId: message.correlationId,
        outcome: "SUCCESS",
        payloadReference: state.evidence.payloadReference
      });
    });
  }

  private async handleAuditExport(message: QueueMessage): Promise<void> {
    await this.config.auditExporter.exportCaseEvidence({
      tenantId: message.tenantId,
      caseId: message.caseId,
      payloadReference: message.payloadReference,
      correlationId: message.correlationId
    });
    await this.config.repository.withCaseTransaction(message.tenantId, message.caseId, async (repository) => {
      await repository.appendAuditEvent({
        tenantId: message.tenantId,
        caseId: message.caseId,
        sourceEventId: auditSourceEventId(message, "AUDIT_EXPORT_COMPLETED"),
        actorId: "worker-audit-export",
        action: "AUDIT_EXPORT_COMPLETED",
        subjectId: message.caseId,
        correlationId: message.correlationId,
        outcome: "SUCCESS",
        payloadReference: message.payloadReference
      });
    });
  }
}
