import { describe, expect, it, vi } from "vitest";
import {
  createOpenAiAdapter,
  type ApprovedDeployment,
  type OpenAiResponsesClient
} from "./openai-analysis-adapter.js";

function approvedDeployments(): Record<"LUNA" | "TERRA" | "SOL", ApprovedDeployment> {
  return {
    LUNA: {
      endpoint: "https://luna.openai.azure.com",
      deploymentId: "luna-evidence-triage",
      apiVersion: "2025-01-01-preview",
      evidenceId: "SEC-EVID-LUNA-ROUTE",
      geography: "EU_DATA_ZONE"
    },
    TERRA: {
      endpoint: "https://terra.openai.azure.com",
      deploymentId: "terra-grounded-analysis",
      apiVersion: "2025-01-01-preview",
      evidenceId: "SEC-EVID-TERRA-ROUTE",
      geography: "EU_DATA_ZONE"
    },
    SOL: {
      endpoint: "https://sol.openai.azure.com",
      deploymentId: "sol-thesis-challenge",
      apiVersion: "2025-01-01-preview",
      evidenceId: "SEC-EVID-SOL-ROUTE",
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
    });
  });

  it("does not downgrade from Terra when the approved Terra deployment is unavailable", async () => {
    const terraCreate = vi.fn().mockRejectedValue(new Error("deployment missing"));
    const lunaCreate = vi.fn();
    const adapter = createOpenAiAdapter({
      deployments: approvedDeployments(),
      clientFactory: createClientFactory({
        "luna-evidence-triage": lunaCreate,
        "terra-grounded-analysis": terraCreate,
        "sol-thesis-challenge": vi.fn()
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
