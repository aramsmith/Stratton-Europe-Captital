import { describe, expect, it, vi } from "vitest";
import { createRedactedLogger } from "../telemetry/redacted-logger.js";
import {
  createOpenAiAdapter,
  type ApprovedDeployment,
  type OpenAiResponsesClient
} from "./openai-analysis-adapter.js";

function approvedDeployments(): Record<"LUNA" | "TERRA" | "SOL", ApprovedDeployment> {
  return {
    LUNA: {
      endpoint: "https://luna.openai.azure.com",
      resourceId:
        "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg-ai/providers/Microsoft.CognitiveServices/accounts/luna",
      region: "swedencentral",
      deploymentId: "luna-evidence-triage",
      apiVersion: "2025-01-01-preview",
      evidenceId: "SEC-EVID-LUNA-ROUTE-v1",
      evidenceVersion: "route-evidence-luna-v1",
      geography: "EU_DATA_ZONE"
    },
    TERRA: {
      endpoint: "https://terra.openai.azure.com",
      resourceId:
        "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg-ai/providers/Microsoft.CognitiveServices/accounts/terra",
      region: "westeurope",
      deploymentId: "terra-grounded-analysis",
      apiVersion: "2025-01-01-preview",
      evidenceId: "SEC-EVID-TERRA-ROUTE-v1",
      evidenceVersion: "route-evidence-terra-v1",
      geography: "EU_DATA_ZONE"
    },
    SOL: {
      endpoint: "https://sol.openai.azure.com",
      resourceId:
        "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg-ai/providers/Microsoft.CognitiveServices/accounts/sol",
      region: "francecentral",
      deploymentId: "sol-thesis-challenge",
      apiVersion: "2025-01-01-preview",
      evidenceId: "SEC-EVID-SOL-ROUTE-v1",
      evidenceVersion: "route-evidence-sol-v1",
      geography: "EU_DATA_ZONE"
    }
  };
}

function admittedChunks() {
  return [
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
  ] as const;
}

function createClientFactory(
  createByDeployment: Readonly<Record<string, ReturnType<typeof vi.fn>>>
): (deployment: ApprovedDeployment) => OpenAiResponsesClient {
  return (deployment) => ({
    create: createByDeployment[deployment.deploymentId]
  });
}

describe("createOpenAiAdapter", () => {
  it("binds the exact approved deployment for the requested route and validates structured output", async () => {
    const terraCreate = vi.fn().mockResolvedValue({
      outputText: JSON.stringify({
        summary: "Governed Terra output",
        citations: [
          {
            evidenceId: "evidence-board-pack",
            excerpt: "Adjusted EBITDA excludes EUR 5.1 million of rebates."
          }
        ],
        riskFlags: ["EBITDA_NORMALISATION"]
      })
    });
    const lunaCreate = vi.fn();
    const adapter = createOpenAiAdapter({
      deployments: approvedDeployments(),
      clientFactory: createClientFactory({
        "luna-evidence-triage": lunaCreate,
        "terra-grounded-analysis": terraCreate,
        "sol-thesis-challenge": vi.fn()
      })
    });

    const result = await adapter.analyse({
      route: "TERRA",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality.",
      promptTemplateVersion: "stratton-workbench-v2:abc123",
      analysisRequestFingerprint: "a".repeat(64),
      evidenceChunks: admittedChunks()
    });

    expect(lunaCreate).not.toHaveBeenCalled();
    expect(terraCreate).toHaveBeenCalledTimes(1);
    expect(terraCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "terra-grounded-analysis",
        store: false,
        text: {
          format: expect.objectContaining({
            type: "json_schema",
            name: "governed_analysis_result",
            strict: true
          })
        }
      })
    );
    const request = terraCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect("tools" in request).toBe(false);
    expect(result).toMatchObject({
      route: "TERRA",
      deploymentId: "terra-grounded-analysis",
      geography: "EU_DATA_ZONE",
      evidenceId: "SEC-EVID-TERRA-ROUTE-v1",
      evidenceVersion: "route-evidence-terra-v1",
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
    });
  });

  it("does not downgrade from Terra when the approved Terra deployment is unavailable", async () => {
    const entries: unknown[] = [];
    const sensitiveError =
      "deployment missing after parsing prompt fragment SECRET_PROMPT and completion SECRET_COMPLETION";
    const terraCreate = vi.fn().mockRejectedValue(new Error(sensitiveError));
    const lunaCreate = vi.fn();
    const adapter = createOpenAiAdapter({
      deployments: approvedDeployments(),
      clientFactory: createClientFactory({
        "luna-evidence-triage": lunaCreate,
        "terra-grounded-analysis": terraCreate,
        "sol-thesis-challenge": vi.fn()
      }),
      logger: createRedactedLogger({
        now: () => "2026-08-06T12:00:00.000Z",
        sink: (entry) => entries.push(entry)
      })
    });

    await expect(
      adapter.analyse({
        route: "TERRA",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        question: "Challenge management EBITDA quality.",
        promptTemplateVersion: "stratton-workbench-v2:abc123",
        analysisRequestFingerprint: "b".repeat(64),
        evidenceChunks: admittedChunks()
      })
    ).rejects.toMatchObject({
      code: "DEPENDENCY_UNAVAILABLE",
      message: "TERRA_ROUTE_UNAVAILABLE"
    });
    expect(lunaCreate).not.toHaveBeenCalled();
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "azure.openai.failure",
          data: expect.objectContaining({
            errorClass: "PROVIDER_REQUEST_FAILED"
          })
        })
      ])
    );
    expect(JSON.stringify(entries)).not.toContain(sensitiveError);
    expect(JSON.stringify(entries)).not.toContain("SECRET_PROMPT");
    expect(JSON.stringify(entries)).not.toContain("SECRET_COMPLETION");
  });

  it("fails closed when a caller tries to use a route that is not approved for the task class", async () => {
    const adapter = createOpenAiAdapter({
      deployments: approvedDeployments(),
      clientFactory: createClientFactory({
        "luna-evidence-triage": vi.fn(),
        "terra-grounded-analysis": vi.fn(),
        "sol-thesis-challenge": vi.fn()
      })
    });

    await expect(
      adapter.analyse({
        route: "LUNA",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        question: "Challenge management EBITDA quality.",
        promptTemplateVersion: "stratton-workbench-v2:abc123",
        analysisRequestFingerprint: "c".repeat(64),
        evidenceChunks: admittedChunks()
      })
    ).rejects.toMatchObject({
      code: "INVALID_CONTRACT",
      message: "TASK_ROUTE_MISMATCH"
    });
  });
});
