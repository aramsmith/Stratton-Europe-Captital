import { describe, expect, it, vi } from "vitest";
import { createAzureWorkflowClient } from "./azure-workflow-client.js";

function createClient() {
  const blob = {
    readEvidence: vi.fn().mockResolvedValue(Buffer.from("Board pack evidence body", "utf8")),
    writeSyntheticEvidence: vi.fn()
  };
  const documentIntelligence = {
    analyseLayout: vi.fn().mockResolvedValue({
      content: "Board pack evidence body",
      contentFormat: "markdown",
      modelId: "prebuilt-layout",
      pageCount: 2
    })
  };
  const search = {
    retrieve: vi.fn().mockResolvedValue([
      {
        chunkId: "chunk-1",
        evidenceId: "evidence-board-pack",
        content: "Adjusted EBITDA excludes EUR 5.1 million of rebates.",
        locator: "page 42",
        tenantId: "tenant-stratton-demo",
        caseId: "project-danube",
        admissionStatus: "ADMITTED",
        accessibleAtReview: true
      },
      {
        chunkId: "chunk-2",
        evidenceId: "evidence-qoe-report",
        content: "Quality of earnings challenges the normalization bridge.",
        locator: "page 18",
        tenantId: "tenant-stratton-demo",
        caseId: "project-danube",
        admissionStatus: "ADMITTED",
        accessibleAtReview: true
      },
      {
        chunkId: "chunk-3",
        evidenceId: "evidence-environmental-permit",
        content: "Permit reference: CZ-EP-2049.",
        locator: "page 1",
        tenantId: "tenant-stratton-demo",
        caseId: "project-danube",
        admissionStatus: "ADMITTED",
        accessibleAtReview: true
      }
    ])
  };
  const openAi = {
    analyse: vi.fn().mockResolvedValue({
      route: "TERRA",
      deploymentId: "terra-grounded-analysis",
      geography: "EU_DATA_ZONE",
      evidenceId: "SEC-EVID-TERRA-ROUTE",
      output: {
        summary: "Governed Terra output",
        citations: [
          {
            evidenceId: "evidence-board-pack",
            excerpt: "Adjusted EBITDA excludes EUR 5.1 million of rebates."
          }
        ],
        riskFlags: ["EBITDA_NORMALISATION"]
      }
    })
  };
  const serviceBus = {
    publish: vi.fn().mockResolvedValue(undefined)
  };

  return {
    blob,
    documentIntelligence,
    search,
    openAi,
    serviceBus,
    client: createAzureWorkflowClient({
      tenantId: "tenant-stratton-demo",
      caseId: "project-danube",
      evidenceCatalog: {
        "evidence-board-pack": { blobName: "fy25-board-pack.txt" },
        "evidence-qoe-report": { blobName: "qoe-report.txt" },
        "evidence-environmental-permit": { blobName: "environmental-permit.txt" }
      },
      blob,
      documentIntelligence,
      search,
      openAi,
      serviceBus
    })
  };
}

describe("createAzureWorkflowClient", () => {
  it("uses blob, document intelligence, and service bus for evidence admission", async () => {
    const { client, blob, documentIntelligence, serviceBus } = createClient();

    await client.admitEvidence({
      caseId: "project-danube",
      evidenceId: "evidence-board-pack",
      idempotencyKey: "idem-admit-1",
      correlationId: "corr-admit-1"
    });

    expect(blob.readEvidence).toHaveBeenCalledWith("fy25-board-pack.txt");
    expect(documentIntelligence.analyseLayout).toHaveBeenCalledWith({
      documentBodyBase64: Buffer.from("Board pack evidence body", "utf8").toString("base64"),
      correlationId: "corr-admit-1"
    });
    expect(serviceBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-stratton-demo",
        caseId: "project-danube",
        messageId: "idem-admit-1",
        correlationId: "corr-admit-1",
        subject: "evidence.admitted"
      })
    );
  });

  it("uses Search, OpenAI, and Service Bus for governed analysis requests", async () => {
    const { client, search, openAi, serviceBus } = createClient();

    const result = await client.requestAnalysis({
      caseId: "project-danube",
      evidenceIds: ["evidence-board-pack", "evidence-qoe-report"],
      analystQuestion: "Challenge management EBITDA quality.",
      route: "TERRA",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      modelDeploymentId: "terra-grounded-analysis",
      promptTemplateVersion: "stratton-workbench-v2:abc123",
      analysisRequestFingerprint: "a".repeat(64),
      idempotencyKey: "analysis:aaaaaaaaaaaa",
      correlationId: "corr-analysis-1"
    });

    expect(search.retrieve).toHaveBeenCalledWith({
      tenantId: "tenant-stratton-demo",
      caseId: "project-danube",
      query: "Challenge management EBITDA quality.",
      top: 6
    });
    expect(openAi.analyse).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "TERRA",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        question: "Challenge management EBITDA quality.",
        promptTemplateVersion: "stratton-workbench-v2:abc123",
        analysisRequestFingerprint: "a".repeat(64),
        correlationId: "corr-analysis-1",
        evidenceChunks: [
          {
            chunkId: "chunk-1",
            evidenceId: "evidence-board-pack",
            content: "Adjusted EBITDA excludes EUR 5.1 million of rebates.",
            locator: "page 42"
          },
          {
            chunkId: "chunk-2",
            evidenceId: "evidence-qoe-report",
            content: "Quality of earnings challenges the normalization bridge.",
            locator: "page 18"
          }
        ]
      })
    );
    expect(serviceBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "analysis.requested",
        messageId: "analysis:aaaaaaaaaaaa",
        correlationId: "corr-analysis-1"
      })
    );
    expect(result).toEqual({
      analysisRunId: "run-aaaaaaaaaaaa",
      status: "QUEUED"
    });
  });

  it("fails closed when Azure Search cannot supply every admitted evidence source", async () => {
    const { client, search, openAi, serviceBus } = createClient();
    search.retrieve.mockResolvedValueOnce([
      {
        chunkId: "chunk-1",
        evidenceId: "evidence-board-pack",
        content: "Adjusted EBITDA excludes EUR 5.1 million of rebates.",
        locator: "page 42",
        tenantId: "tenant-stratton-demo",
        caseId: "project-danube",
        admissionStatus: "ADMITTED",
        accessibleAtReview: true
      }
    ]);

    await expect(
      client.requestAnalysis({
        caseId: "project-danube",
        evidenceIds: ["evidence-board-pack", "evidence-qoe-report"],
        analystQuestion: "Challenge management EBITDA quality.",
        route: "TERRA",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        modelDeploymentId: "terra-grounded-analysis",
        promptTemplateVersion: "stratton-workbench-v2:abc123",
        analysisRequestFingerprint: "b".repeat(64),
        idempotencyKey: "analysis:bbbbbbbbbbbb",
        correlationId: "corr-analysis-2"
      })
    ).rejects.toMatchObject({
      code: "DEPENDENCY_UNAVAILABLE",
      message: "ADMITTED_EVIDENCE_CHUNKS_UNAVAILABLE"
    });
    expect(openAi.analyse).not.toHaveBeenCalled();
    expect(serviceBus.publish).not.toHaveBeenCalled();
  });

  it("publishes review and recommendation operations through Service Bus", async () => {
    const { client, serviceBus } = createClient();

    await client.submitReview({
      caseId: "project-danube",
      analysisRunId: "run-terra-1",
      reviewType: "LEGAL",
      decision: "APPROVED",
      rationale: "Permit transfer completion steps are documented.",
      subjectVersion: "finding-permit-transfer-v2",
      idempotencyKey: "review-1",
      correlationId: "corr-review-1"
    });
    await client.prepareDraft({
      caseId: "project-danube",
      analysisRunId: "run-terra-1",
      subjectVersion: "recommendation-v1",
      idempotencyKey: "draft-1",
      correlationId: "corr-draft-1"
    });

    expect(serviceBus.publish).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        messageId: "review-1",
        correlationId: "corr-review-1",
        subject: "review.submitted"
      })
    );
    expect(serviceBus.publish).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        messageId: "draft-1",
        correlationId: "corr-draft-1",
        subject: "recommendation.prepared"
      })
    );
  });
});
