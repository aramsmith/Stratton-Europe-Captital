import { DefaultAzureCredential } from "@azure/identity";
import type {
  AnalysisProvider,
  AnalysisProviderResult,
  AuditEvidenceExporter,
  ClaimRecord,
  DocumentIntelligenceProvider,
  ProviderAvailability,
  SearchIndexProvider
} from "./types.js";

function toClaims(text: string): readonly ClaimRecord[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => ({
      tenantId: "",
      caseId: "",
      analysisRunId: "",
      claimId: `claim-${index + 1}`,
      claimTextReference: line,
      severity: "NON_CRITICAL",
      reviewStatus: "PENDING",
      isMaterial: true
    }));
}

export class AzureDocumentIntelligenceProvider implements DocumentIntelligenceProvider {
  public constructor(private readonly endpoint: string) {}

  public async extractClaims(payloadReference: string): Promise<readonly ClaimRecord[]> {
    const credential = new DefaultAzureCredential();
    const token = await credential.getToken("https://cognitiveservices.azure.com/.default");
    if (!token?.token) {
      throw new Error("DOCUMENT_INTELLIGENCE_AUTH_FAILED");
    }
    const analyzeUrl = `${this.endpoint.replace(/\/+$/, "")}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-02-29-preview`;
    const analyzeResponse = await fetch(analyzeUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token.token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ urlSource: payloadReference })
    });
    if (!analyzeResponse.ok) {
      throw new Error("DOCUMENT_INTELLIGENCE_ANALYZE_FAILED");
    }
    const operationLocation = analyzeResponse.headers.get("operation-location");
    if (!operationLocation) {
      throw new Error("DOCUMENT_INTELLIGENCE_MISSING_OPERATION_LOCATION");
    }
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const poll = await fetch(operationLocation, {
        headers: {
          authorization: `Bearer ${token.token}`
        }
      });
      if (!poll.ok) {
        throw new Error("DOCUMENT_INTELLIGENCE_POLL_FAILED");
      }
      const payload = (await poll.json()) as { status?: string; analyzeResult?: { content?: string } };
      const status = payload.status?.toLowerCase() ?? "";
      if (status === "succeeded") {
        return toClaims(payload.analyzeResult?.content ?? "");
      }
      if (status === "failed") {
        throw new Error("DOCUMENT_INTELLIGENCE_ANALYZE_FAILED");
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("DOCUMENT_INTELLIGENCE_TIMEOUT");
  }

  public async isAvailable(): Promise<ProviderAvailability> {
    return {
      ready: this.endpoint.startsWith("https://"),
      detail: this.endpoint.startsWith("https://")
        ? "document-intelligence-configured"
        : "invalid-document-intelligence-endpoint"
    };
  }
}

export class AzureSearchIndexProvider implements SearchIndexProvider {
  public constructor(
    private readonly endpoint: string,
    private readonly indexName: string
  ) {}

  public async indexChunks(
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
  ): Promise<void> {
    void chunks;
    throw new Error("INDEX_VECTORIZATION_INTERFACE_BLOCKED");
  }

  public async isAvailable(): Promise<ProviderAvailability> {
    const validConfig = this.endpoint.startsWith("https://") && this.indexName.trim().length > 0;
    return {
      ready: false,
      detail: validConfig ? "blocked-vectorization-interface" : "invalid-search-configuration"
    };
  }
}

export class InMemoryDocumentIntelligenceProvider implements DocumentIntelligenceProvider {
  private readonly byReference = new Map<string, readonly ClaimRecord[]>();

  public seed(payloadReference: string, claims: readonly ClaimRecord[]): void {
    this.byReference.set(payloadReference, [...claims]);
  }

  public async extractClaims(payloadReference: string): Promise<readonly ClaimRecord[]> {
    return this.byReference.get(payloadReference) ?? [];
  }

  public async isAvailable(): Promise<ProviderAvailability> {
    return { ready: true, detail: "in-memory" };
  }
}

export class InMemorySearchIndexProvider implements SearchIndexProvider {
  public readonly indexed: Array<{
    chunkId: string;
    caseId: string;
    tenantId: string;
    evidenceId: string;
    evidenceVersionId: string;
    text: string;
    classification: string;
    qualityStatus: string;
    policyVersion: string;
    citationLocator: string;
  }> = [];

  public async indexChunks(
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
  ): Promise<void> {
    this.indexed.push(...chunks);
  }

  public async isAvailable(): Promise<ProviderAvailability> {
    return { ready: true, detail: "in-memory" };
  }
}

export class InMemoryAnalysisProvider implements AnalysisProvider {
  private readonly responses = new Map<string, AnalysisProviderResult>();

  public seed(analysisRunId: string, response: AnalysisProviderResult): void {
    this.responses.set(analysisRunId, response);
  }

  public async runDraftOnlyAnalysis(input: {
    readonly analysisRunId: string;
    readonly payloadReference: string;
    readonly modelDeploymentId: string;
    readonly promptTemplateVersion: string;
  }): Promise<AnalysisProviderResult> {
    const seeded = this.responses.get(input.analysisRunId);
    if (seeded) {
      return seeded;
    }
    return {
      outputReference: `draft://${input.analysisRunId}`,
      claims: [],
      citations: []
    };
  }

  public async isAvailable(): Promise<ProviderAvailability> {
    return { ready: true, detail: "in-memory" };
  }
}

export class BlockedAnalysisProvider implements AnalysisProvider {
  public constructor(private readonly reason: string) {}

  public async runDraftOnlyAnalysis(input: {
    readonly analysisRunId: string;
    readonly payloadReference: string;
    readonly modelDeploymentId: string;
    readonly promptTemplateVersion: string;
  }): Promise<AnalysisProviderResult> {
    void input;
    throw new Error(`ANALYSIS_PROVIDER_BLOCKED:${this.reason}`);
  }

  public async isAvailable(): Promise<ProviderAvailability> {
    return { ready: false, detail: this.reason };
  }
}

export class InMemoryAuditEvidenceExporter implements AuditEvidenceExporter {
  public readonly exports: Array<{
    tenantId: string;
    caseId: string;
    payloadReference: string;
    correlationId: string;
  }> = [];

  public async exportCaseEvidence(input: {
    readonly tenantId: string;
    readonly caseId: string;
    readonly payloadReference: string;
    readonly correlationId: string;
  }): Promise<void> {
    this.exports.push({ ...input });
  }

  public async isAvailable(): Promise<ProviderAvailability> {
    return { ready: true, detail: "in-memory" };
  }
}

export class BlockedAuditEvidenceExporter implements AuditEvidenceExporter {
  public constructor(private readonly reason: string) {}

  public async exportCaseEvidence(input: {
    readonly tenantId: string;
    readonly caseId: string;
    readonly payloadReference: string;
    readonly correlationId: string;
  }): Promise<void> {
    void input;
    throw new Error(`AUDIT_EXPORT_BLOCKED:${this.reason}`);
  }

  public async isAvailable(): Promise<ProviderAvailability> {
    return { ready: false, detail: this.reason };
  }
}
