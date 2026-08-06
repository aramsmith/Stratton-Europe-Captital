import axe from "axe-core";
import {
  FluentProvider,
  webLightTheme
} from "@fluentui/react-components";
import type { GovernanceView, ScenarioState } from "@stratton/contracts";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GovernanceConsolePage } from "./GovernanceConsolePage.js";

function createScenario(): ScenarioState {
  const scenario = createProjectDanubeState();
  scenario.stage = "COMMITTEE_PREPARATION";
  scenario.evidence = scenario.evidence.map((evidence) => ({
    ...evidence,
    admissionStatus: "ADMITTED",
    provenanceStatus: "VERIFIED"
  }));
  return scenario;
}

function createGovernanceView(): GovernanceView {
  return {
    lineage: [
      {
        id: "finding-ebitda-quality",
        title: "Adjusted EBITDA quality",
        sourceLocators: ["fy25-board-pack.txt", "erp-rebate-export.csv", "qoe-report.txt"],
        evidenceIds: ["evidence-board-pack", "evidence-erp-rebates", "evidence-qoe-report"],
        modelRoute: "TERRA",
        reviewTypes: ["DEAL"],
        reviewVersionIds: ["finding-ebitda-quality-v2"],
        policyDecisionIds: [
          "event-route-selected",
          "event-policy-check",
          "event-analysis-governed",
          "review-deal"
        ],
        recommendationIds: ["event-committee-pack"],
        assuranceStatus: "CURRENT",
        historicalReviewTypes: [],
        historicalReviewVersionIds: [],
        historicalPolicyDecisionIds: [],
        historicalRecommendationIds: []
      },
      {
        id: "finding-permit-transfer",
        title: "Permit transfer readiness",
        sourceLocators: ["environmental-permit.txt"],
        evidenceIds: ["evidence-environmental-permit"],
        modelRoute: "TERRA",
        reviewTypes: [],
        reviewVersionIds: [],
        policyDecisionIds: [
          "event-route-selected",
          "event-policy-check",
          "event-analysis-governed"
        ],
        recommendationIds: [],
        assuranceStatus: "STALE",
        historicalReviewTypes: ["LEGAL"],
        historicalReviewVersionIds: ["finding-permit-transfer-v2"],
        historicalPolicyDecisionIds: ["review-legal"],
        historicalRecommendationIds: ["event-committee-pack"]
      }
    ],
    policyDecisions: [
      {
        decisionId: "event-policy-check",
        policyType: "ANALYSIS_POLICY_CHECK",
        result: "ALLOW",
        reasonCodes: ["admitted-citations-only"],
        version: "stratton-workbench-v2:9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        correlationId: "corr-analysis-1",
        relatedFindingIds: ["finding-ebitda-quality", "finding-permit-transfer"],
        occurredAtIso: "2026-08-06T10:05:01.000Z"
      },
      {
        decisionId: "review-legal",
        policyType: "SPECIALIST_REVIEW_RECORDED",
        result: "SUCCESS",
        reasonCodes: ["LEGAL", "APPROVED", "finding-permit-transfer"],
        version: "finding-permit-transfer-v2",
        correlationId: "corr-review-legal",
        relatedFindingIds: ["finding-permit-transfer"],
        occurredAtIso: "2026-08-06T10:22:00.000Z"
      }
    ],
    modelRoutes: [
      {
        routeId: "run-terra-1",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        modelRoute: "TERRA",
        analysisRunId: "run-terra-1",
        authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE",
        primaryEvidenceIds: [
          "evidence-board-pack",
          "evidence-environmental-permit",
          "evidence-erp-rebates",
          "evidence-qoe-report"
        ],
        recoveryEvidenceIds: [],
        correlationId: "corr-analysis-1",
        analysisRequestFingerprint:
          "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        questionHash: "95d4ab5821abf3ec7fa4b35f667fa5e3b71db280c5f7ab455ecb6c10f379b4e4",
        evidenceSetHash: "7a0cbdb7f6cff1ce34618a74be93fd6928840fa2712f822e7ef76a08b85c4f99",
        promptTemplateVersion:
          "stratton-workbench-v2:9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        routeEventIds: ["event-route-selected", "event-analysis-governed"]
      }
    ],
    securityGates: [
      {
        gateId: "CC002-R2-SEC-GATE-001",
        name: "Direct prompt injection",
        outcome: "NOT_RUN",
        failClosedOutcome: "Block promotion and deny affected output"
      },
      {
        gateId: "CC002-R2-SEC-GATE-002",
        name: "Indirect prompt injection",
        outcome: "NOT_RUN",
        failClosedOutcome: "Block promotion and quarantine evidence"
      },
      {
        gateId: "CC002-R2-SEC-GATE-003",
        name: "Instruction/evidence boundary escape",
        outcome: "NOT_RUN",
        failClosedOutcome: "Block promotion and stop output"
      },
      {
        gateId: "CC002-R2-SEC-GATE-004",
        name: "Citation spoofing",
        outcome: "NOT_RUN",
        failClosedOutcome: "Block promotion and material narrative"
      },
      {
        gateId: "CC002-R2-SEC-GATE-005",
        name: "Poisoned retrieval index",
        outcome: "NOT_RUN",
        failClosedOutcome: "Quarantine index, stop retrieval and block promotion"
      },
      {
        gateId: "CC002-R2-SEC-GATE-006",
        name: "Cross-case retrieval",
        outcome: "NOT_RUN",
        failClosedOutcome: "Deny query, alert and block promotion"
      },
      {
        gateId: "CC002-R2-SEC-GATE-007",
        name: "Caller filter override",
        outcome: "NOT_RUN",
        failClosedOutcome: "Deny query and block promotion"
      },
      {
        gateId: "CC002-R2-SEC-GATE-008",
        name: "Revoked/expired evidence",
        outcome: "NOT_RUN",
        failClosedOutcome: "Deny admission and block promotion"
      },
      {
        gateId: "CC002-R2-SEC-GATE-009",
        name: "Unavailable deployment",
        outcome: "NOT_RUN",
        failClosedOutcome: "Queue or controlled failure and block promotion"
      },
      {
        gateId: "CC002-R2-SEC-GATE-010",
        name: "Deployment/model/version mismatch",
        outcome: "NOT_RUN",
        failClosedOutcome: "Deny, alert and block promotion"
      },
      {
        gateId: "CC002-R2-SEC-GATE-011",
        name: "Attempted silent fallback",
        outcome: "NOT_RUN",
        failClosedOutcome: "Deny substitution, alert and block promotion"
      },
      {
        gateId: "CC002-R2-SEC-GATE-012",
        name: "Attempted autonomous authority",
        outcome: "NOT_RUN",
        failClosedOutcome: "Deny state transition, stop for human and block promotion"
      }
    ],
    auditExport: {
      status: "BLOCKED",
      missingItems: [
        "Mandatory security gates are not ready: SECURITY_GATE_CC002-R2-SEC-GATE-001_NOT_RUN."
      ],
      previewSections: ["Lineage", "Policy decisions", "Model routes", "Security & audit"]
    }
  };
}

function renderPage(
  loadGovernanceView = vi.fn().mockResolvedValue(createGovernanceView()),
  scenario = createScenario(),
  runSecurityGateSuite = vi.fn().mockResolvedValue(undefined)
) {
  return {
    ...render(
      <FluentProvider theme={webLightTheme}>
        <GovernanceConsolePage
          scenario={scenario}
          loadGovernanceView={loadGovernanceView}
          onRunSecurityGateSuite={runSecurityGateSuite}
        />
      </FluentProvider>
    ),
    loadGovernanceView,
    runSecurityGateSuite
  };
}

describe("GovernanceConsolePage", () => {
  it("renders accessible tabs for lineage, policy decisions, model routes, and security audit evidence", async () => {
    const { loadGovernanceView } = renderPage();

    expect(screen.getByRole("heading", { name: "Governance & Assurance Console" })).toBeVisible();
    expect(await screen.findByRole("tab", { name: "Lineage" })).toBeVisible();
    expect(loadGovernanceView).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Adjusted EBITDA quality")).toBeVisible();
    expect(screen.getAllByText(/Recommendation: event-committee-pack/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "Policy decisions" }));
    expect(await screen.findByRole("columnheader", { name: "Correlation ID" })).toBeVisible();
    expect(screen.getByText("corr-review-legal")).toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: "Model routes" }));
    expect(await screen.findByText("CROSS_DOCUMENT_COMPARISON")).toBeVisible();
    expect(screen.getByText(/Task route: run-terra-1/)).toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: "Security & audit" }));
    expect(screen.getAllByText("Internal Audit verdict: Not issued").length).toBeGreaterThan(0);
    expect(screen.getByText("CC002-R2-SEC-GATE-012")).toBeVisible();
    expect(screen.getAllByText("Audit export preview").length).toBeGreaterThan(0);
    expect(screen.getByText(/Mandatory security gates are not ready/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /verdict|investment/i })).not.toBeInTheDocument();
  });

  it("fails closed when governance evidence cannot be loaded", async () => {
    renderPage(vi.fn().mockRejectedValue(new Error("Governance API unavailable")));

    expect(await screen.findByRole("alert")).toHaveTextContent("Governance API unavailable");
    expect(screen.queryByRole("tab", { name: "Policy decisions" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Internal Audit verdict: Not issued").length).toBeGreaterThan(0);
  });

  it("offers a dedicated deterministic gate-evidence action without issuing an audit verdict", async () => {
    const { runSecurityGateSuite } = renderPage();

    fireEvent.click(await screen.findByRole("tab", { name: "Security & audit" }));
    fireEvent.click(screen.getByRole("button", { name: "Run security gate checks" }));

    await waitFor(() => {
      expect(runSecurityGateSuite).toHaveBeenCalledWith({ caseId: "project-danube" });
    });
    expect(screen.getAllByText("Internal Audit verdict: Not issued").length).toBeGreaterThan(0);
  });

  it("distinguishes current assurance from historical-only lineage", async () => {
    renderPage();

    expect(await screen.findByText("Adjusted EBITDA quality")).toBeVisible();
    expect(screen.getByText("Permit transfer readiness")).toBeVisible();
    expect(screen.getByText("Current assurance")).toBeVisible();
    expect(screen.getByText("Historical only")).toBeVisible();
    expect(
      screen.getByText("Historical reviews: LEGAL (finding-permit-transfer-v2)")
    ).toBeVisible();
    expect(screen.getByText("Historical recommendations: event-committee-pack")).toBeVisible();
  });

  it("has no axe violations", async () => {
    const { container } = renderPage();

    await screen.findByText("Adjusted EBITDA quality");
    const results = await axe.run(container, {
      rules: {
        "color-contrast": { enabled: false }
      }
    });

    expect(results.violations).toHaveLength(0);
  });
});
