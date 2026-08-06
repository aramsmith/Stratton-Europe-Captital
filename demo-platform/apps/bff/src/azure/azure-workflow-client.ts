import type { AnalysisTaskClass, ModelRoute, ScenarioState } from "@stratton/contracts";
import { DemoHttpError } from "../errors.js";
import type { WorkflowSupportingOperations } from "../phase5/phase5-client.js";
import {
  createRedactedLogger,
  type RedactedLogger
} from "../telemetry/redacted-logger.js";
import type { GovernedAnalysisOutput, OpenAiEvidenceChunk } from "./openai-analysis-adapter.js";
import type { SearchEvidenceChunk } from "./search-adapter.js";

interface EvidenceReference {
  readonly blobName: string;
}

interface BlobEvidenceAdapter {
  readEvidence(blobName: string): Promise<Buffer>;
}

interface DocumentIntelligenceAdapter {
  analyseLayout(input: {
    documentBodyBase64: string;
    locale?: string;
    correlationId?: string;
  }): Promise<{
    content: string;
    contentFormat: "text" | "markdown";
    modelId: "prebuilt-layout";
    pageCount: number;
  }>;
}

interface SearchAdapter {
  retrieve(input: {
    tenantId: string;
    caseId: string;
    query: string;
    top?: number;
    callerFilter?: string;
  }): Promise<readonly SearchEvidenceChunk[]>;
}

interface OpenAiAdapter {
  analyse(input: {
    route: ModelRoute;
    taskClass: AnalysisTaskClass;
    question: string;
    promptTemplateVersion: string;
    analysisRequestFingerprint: string;
    evidenceChunks: readonly OpenAiEvidenceChunk[];
    correlationId?: string;
  }): Promise<{
    route: ModelRoute;
    deploymentId: string;
    geography: "EU_DATA_ZONE";
    resourceId: string;
    region: string;
    evidenceId: string;
    output: GovernedAnalysisOutput;
  }>;
}

interface ServiceBusAdapter {
  publish(input: {
    tenantId: string;
    caseId: string;
    messageId: string;
    correlationId: string;
    subject?: string;
    payload: unknown;
  }): Promise<void>;
}

interface CreateAzureWorkflowClientOptions {
  readonly tenantId: string;
  readonly caseId: ScenarioState["caseId"];
  readonly evidenceCatalog: Readonly<Record<string, EvidenceReference>>;
  readonly blob: BlobEvidenceAdapter;
  readonly documentIntelligence: DocumentIntelligenceAdapter;
  readonly search: SearchAdapter;
  readonly openAi: OpenAiAdapter;
  readonly serviceBus: ServiceBusAdapter;
  readonly logger?: RedactedLogger;
}

export function createAzureWorkflowClient(
  options: CreateAzureWorkflowClientOptions
): WorkflowSupportingOperations {
  const logger = options.logger ?? createRedactedLogger().child({ workflow: "azure" });

  return {
    async afterEvidenceAdmitted(input) {
      assertCaseId(options.caseId, input.caseId);
      const evidence = options.evidenceCatalog[input.evidenceId];
      if (!evidence) {
        throw new DemoHttpError(400, "INVALID_CONTRACT", "EVIDENCE_SOURCE_NOT_APPROVED");
      }

      const documentBody = await options.blob.readEvidence(evidence.blobName);
      const layout = await options.documentIntelligence.analyseLayout({
        documentBodyBase64: documentBody.toString("base64"),
        ...(input.correlationId ? { correlationId: input.correlationId } : {})
      });

      await options.serviceBus.publish({
        tenantId: options.tenantId,
        caseId: options.caseId,
        messageId: input.idempotencyKey,
        correlationId: input.correlationId ?? input.idempotencyKey,
        subject: "evidence.admitted",
        payload: {
          caseId: input.caseId,
          evidenceId: input.evidenceId,
          blobName: evidence.blobName,
          layout
        }
      });

      logger.info("azure.workflow.evidence.admitted", {
        caseId: input.caseId,
        evidenceId: input.evidenceId,
        blobName: evidence.blobName
      });
    },

    async afterAnalysisAccepted(input) {
      assertCaseId(options.caseId, input.caseId);
      if (!input.route || !input.taskClass) {
        throw new DemoHttpError(400, "INVALID_CONTRACT", "ANALYSIS_ROUTE_AND_TASK_REQUIRED");
      }

      const retrievedChunks = await options.search.retrieve({
        tenantId: options.tenantId,
        caseId: options.caseId,
        query: input.analystQuestion,
        top: Math.max(input.evidenceIds.length * 3, 5)
      });
      const evidenceIdSet = new Set(input.evidenceIds);
      const evidenceChunks = retrievedChunks
        .filter((chunk) => evidenceIdSet.has(chunk.evidenceId))
        .map(mapSearchChunkToOpenAiChunk);
      const retrievedEvidenceIds = new Set(evidenceChunks.map((chunk) => chunk.evidenceId));

      if (input.evidenceIds.some((evidenceId) => !retrievedEvidenceIds.has(evidenceId))) {
        throw new DemoHttpError(
          503,
          "DEPENDENCY_UNAVAILABLE",
          "ADMITTED_EVIDENCE_CHUNKS_UNAVAILABLE"
        );
      }

      const analysis = await options.openAi.analyse({
        route: input.route,
        taskClass: input.taskClass,
        question: input.analystQuestion,
        promptTemplateVersion: input.promptTemplateVersion,
        analysisRequestFingerprint: input.analysisRequestFingerprint,
        evidenceChunks,
        ...(input.correlationId ? { correlationId: input.correlationId } : {})
      });
      const analysisRunId = input.analysisRunId;

      await options.serviceBus.publish({
        tenantId: options.tenantId,
        caseId: options.caseId,
        messageId: input.idempotencyKey,
        correlationId: input.correlationId ?? input.idempotencyKey,
        subject: "analysis.requested",
        payload: {
          caseId: input.caseId,
          route: analysis.route,
          taskClass: input.taskClass,
          analysisRunId,
          deploymentId: analysis.deploymentId,
          geography: analysis.geography,
          resourceId: analysis.resourceId,
          region: analysis.region,
          evidenceId: analysis.evidenceId,
          output: analysis.output
        }
      });

      logger.info("azure.workflow.analysis.requested", {
        caseId: input.caseId,
        route: input.route,
        taskClass: input.taskClass,
        analysisRunId
      });

    },

    async afterReviewAccepted(input) {
      assertCaseId(options.caseId, input.caseId);

      await options.serviceBus.publish({
        tenantId: options.tenantId,
        caseId: options.caseId,
        messageId: input.idempotencyKey,
        correlationId: input.correlationId ?? input.idempotencyKey,
        subject: "review.submitted",
        payload: {
          caseId: input.caseId,
          analysisRunId: input.analysisRunId,
          reviewType: input.reviewType,
          decision: input.decision,
          rationale: input.rationale,
          subjectVersion: input.subjectVersion
        }
      });
    },

    async afterDraftAccepted(input) {
      assertCaseId(options.caseId, input.caseId);

      await options.serviceBus.publish({
        tenantId: options.tenantId,
        caseId: options.caseId,
        messageId: input.idempotencyKey,
        correlationId: input.correlationId ?? input.idempotencyKey,
        subject: "recommendation.prepared",
        payload: {
          caseId: input.caseId,
          analysisRunId: input.analysisRunId,
          subjectVersion: input.subjectVersion
        }
      });
    }
  };
}

function assertCaseId(expectedCaseId: string, caseId: string): void {
  if (caseId !== expectedCaseId) {
    throw new DemoHttpError(400, "INVALID_CONTRACT", "Requested case does not match Project Danube.");
  }
}

function mapSearchChunkToOpenAiChunk(chunk: SearchEvidenceChunk): OpenAiEvidenceChunk {
  return {
    chunkId: chunk.chunkId,
    evidenceId: chunk.evidenceId,
    content: chunk.content,
    ...(chunk.locator ? { locator: chunk.locator } : {})
  };
}
