import axe from "axe-core";
import {
  FluentProvider,
  webLightTheme
} from "@fluentui/react-components";
import type {
  ReviewSubmissionRequest,
  ScenarioState
} from "@stratton/contracts";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { describe, expect, it, vi } from "vitest";
import { DecisionRoomPage } from "./DecisionRoomPage.js";

function createDecisionRoomScenario(
  includeLegalApproval = false,
  includeSecurityGatePasses = includeLegalApproval
): ScenarioState {
  const scenario = createProjectDanubeState();
  scenario.stage = "REVIEW";
  scenario.evidence = scenario.evidence.map((evidence) => ({
    ...evidence,
    admissionStatus: "ADMITTED",
    provenanceStatus: "VERIFIED"
  }));
  scenario.latestAnalysisRun = {
    analysisRunId: "run-terra-1",
    route: "TERRA",
    taskClass: "CROSS_DOCUMENT_COMPARISON",
    analystQuestion: "Challenge management EBITDA quality",
    questionHash: "95d4ab5821abf3ec7fa4b35f667fa5e3b71db280c5f7ab455ecb6c10f379b4e4",
    admittedEvidenceIds: [
      "evidence-board-pack",
      "evidence-environmental-permit",
      "evidence-erp-rebates",
      "evidence-qoe-report"
    ],
    evidenceSetHash: "7a0cbdb7f6cff1ce34618a74be93fd6928840fa2712f822e7ef76a08b85c4f99",
    analysisRequestFingerprint:
      "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
    promptTemplateVersion:
      "stratton-workbench-v2:9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
    authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
  };
  scenario.findings = [
    {
      findingId: "finding-ebitda-quality",
      title: "Adjusted EBITDA quality",
      summary: "Human adjusted EBITDA challenge kept for committee review.",
      originalAiSummary: "Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million.",
      materiality: "HIGH",
      status: "ACCEPTED",
      route: "TERRA",
      citations: [
        {
          citationId: "citation-board-pack-42",
          evidenceId: "evidence-board-pack",
          locator: "page 42",
          accessible: true
        },
        {
          citationId: "citation-qoe-18",
          evidenceId: "evidence-qoe-report",
          locator: "page 18",
          accessible: true
        }
      ],
      textHistory: [
        {
          versionId: "finding-ebitda-quality-v1",
          actorType: "AI",
          action: "GENERATED",
          summary: "Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million.",
          occurredAtIso: "2026-08-06T10:05:00.000Z"
        },
        {
          versionId: "finding-ebitda-quality-v2",
          actorType: "HUMAN",
          action: "ACCEPTED",
          summary: "Human adjusted EBITDA challenge kept for committee review.",
          occurredAtIso: "2026-08-06T10:10:00.000Z"
        }
      ],
      analysisRunId: "run-terra-1",
      analysisRequestFingerprint:
        "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
      authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
    },
    {
      findingId: "finding-customer-concentration",
      title: "Customer concentration",
      summary: "Customer rebate concentration remains above the approved downside threshold.",
      originalAiSummary:
        "Customer rebate concentration remains above the approved downside threshold.",
      materiality: "MEDIUM",
      status: "ACCEPTED",
      route: "TERRA",
      citations: [
        {
          citationId: "citation-erp-812-886",
          evidenceId: "evidence-erp-rebates",
          locator: "rows 812-886",
          accessible: true
        }
      ],
      textHistory: [
        {
          versionId: "finding-customer-concentration-v1",
          actorType: "AI",
          action: "GENERATED",
          summary: "Customer rebate concentration remains above the approved downside threshold.",
          occurredAtIso: "2026-08-06T10:05:00.000Z"
        }
      ],
      analysisRunId: "run-terra-1",
      analysisRequestFingerprint:
        "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
      authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
    },
    {
      findingId: "finding-permit-transfer",
      title: "Permit transfer readiness",
      summary: "Permit transfer requires controlled completion steps before close.",
      originalAiSummary: "Permit transfer requires controlled completion steps before close.",
      materiality: "HIGH",
      status: "ACCEPTED",
      route: "TERRA",
      citations: [
        {
          citationId: "citation-permit-2049",
          evidenceId: "evidence-environmental-permit",
          locator: "Permit reference: CZ-EP-2049",
          accessible: true
        }
      ],
      textHistory: [
        {
          versionId: "finding-permit-transfer-v1",
          actorType: "AI",
          action: "GENERATED",
          summary: "Permit transfer requires controlled completion steps before close.",
          occurredAtIso: "2026-08-06T10:05:00.000Z"
        },
        {
          versionId: "finding-permit-transfer-v2",
          actorType: "HUMAN",
          action: "ACCEPTED",
          summary: "Permit transfer requires controlled completion steps before close.",
          occurredAtIso: "2026-08-06T10:10:00.000Z"
        }
      ],
      analysisRunId: "run-terra-1",
      analysisRequestFingerprint:
        "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
      authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
    }
  ];
  scenario.reviews = [
    {
      reviewId: "review-deal",
      reviewType: "DEAL",
      decision: "APPROVED",
      findingId: "finding-ebitda-quality",
      subjectVersion: "finding-ebitda-quality-v2"
    },
    {
      reviewId: "review-compliance",
      reviewType: "COMPLIANCE",
      decision: "APPROVED",
      findingId: "finding-permit-transfer",
      subjectVersion: "finding-permit-transfer-v2"
    }
  ];

  if (includeLegalApproval) {
    scenario.reviews.push({
      reviewId: "review-legal",
      reviewType: "LEGAL",
      decision: "APPROVED",
      findingId: "finding-permit-transfer",
      subjectVersion: "finding-permit-transfer-v2"
    });
  }

  if (includeSecurityGatePasses) {
    const analysisRequestFingerprint =
      scenario.latestAnalysisRun?.analysisRequestFingerprint;
    if (!analysisRequestFingerprint) {
      throw new Error("analysis fingerprint required");
    }
    scenario.governanceEvents.push(
      ...Array.from({ length: 12 }, (_, index) => {
        const ordinal = String(index + 1).padStart(3, "0");
        return {
          eventId: `gate-pass-${ordinal}`,
          type: "SECURITY_GATE_EVIDENCE_RECORDED",
          outcome: "SUCCESS" as const,
          occurredAtIso: `2026-08-06T11:${String(index).padStart(2, "0")}:00.000Z`,
          correlationId: "corr-gate-suite",
          detail: `DETERMINISTIC_GATE_PASS:CC002-R2-SEC-GATE-${ordinal}`,
          metadata: {
            securityGateId: `CC002-R2-SEC-GATE-${ordinal}`,
            securityGateEvidenceId: `STRATTON-DEMO-SEC-GATE-${ordinal}-v1`,
            analysisRequestFingerprint
          }
        };
      })
    );
  }

  scenario.governanceEvents.push({
    eventId: "event-analysis-governed",
    type: "ANALYSIS_REQUEST_GOVERNED",
    outcome: "SUCCESS",
    occurredAtIso: "2026-08-06T10:05:00.000Z",
    correlationId: "corr-analysis-1",
    detail: "CROSS_DOCUMENT_COMPARISON:run-terra-1"
  });

  return scenario;
}

function createNoEligibleLegalFindingScenario(): ScenarioState {
  const scenario = createDecisionRoomScenario();
  scenario.findings = scenario.findings.map((finding) =>
    finding.findingId === "finding-permit-transfer"
      ? {
          ...finding,
          status: "CHALLENGED",
          textHistory: [
            ...finding.textHistory,
            {
              versionId: "finding-permit-transfer-v3",
              actorType: "HUMAN",
              action: "CHALLENGED",
              summary: finding.summary,
              occurredAtIso: "2026-08-06T10:15:00.000Z"
            }
          ]
        }
      : finding.findingId === "finding-ebitda-quality"
        ? {
            ...finding,
            status: "DRAFT",
            textHistory: [
              {
                versionId: "finding-ebitda-quality-v1",
                actorType: "AI",
                action: "GENERATED",
                summary: finding.originalAiSummary ?? finding.summary,
                occurredAtIso: "2026-08-06T10:05:00.000Z"
              }
            ]
          }
        : finding
  );

  return scenario;
}

function renderDecisionRoom(initialScenario = createDecisionRoomScenario()) {
  const submitReview = vi.fn(
    async (input: ReviewSubmissionRequest & { findingId: string }) => {
      setScenario((current) => ({
        ...current,
        reviews: [
          ...current.reviews,
          {
            reviewId: `review-${input.reviewType.toLowerCase()}`,
            reviewType: input.reviewType,
            decision: input.decision,
            findingId: input.findingId,
            subjectVersion: input.subjectVersion,
            projectionVersion: current.findings.find(
              (finding) => finding.findingId === input.findingId
            )?.projectionVersion
          }
        ],
        governanceEvents: [
          ...current.governanceEvents,
          {
            eventId: `event-${input.reviewType.toLowerCase()}`,
            type: "SPECIALIST_REVIEW_RECORDED",
            outcome: "SUCCESS",
            occurredAtIso: "2026-08-06T10:20:00.000Z",
            correlationId: "corr-ui-review",
            detail: `${input.reviewType}:${input.decision}:${input.findingId}`
          }
        ]
      }));
    }
  );
  const prepareRecommendation = vi.fn(async () => {
    setScenario((current) => ({
      ...current,
      stage: "COMMITTEE_PREPARATION",
      governanceEvents: [
        ...current.governanceEvents,
        {
          eventId: "event-committee-pack",
          type: "COMMITTEE_PACK_DRAFT_PREPARED",
          outcome: "SUCCESS",
          occurredAtIso: "2026-08-06T10:25:00.000Z",
          correlationId: "corr-ui-prepare",
          detail: "committee-pack"
        }
      ]
    }));
  });

  let setScenario: Dispatch<SetStateAction<ScenarioState>> = () => undefined;

  function Harness() {
    const [scenario, updateScenario] = useState(initialScenario);
    setScenario = updateScenario;

    return (
      <FluentProvider theme={webLightTheme}>
        <DecisionRoomPage
          scenario={scenario}
          onPrepareRecommendation={prepareRecommendation}
          onSubmitReview={submitReview}
        />
      </FluentProvider>
    );
  }

  return {
    ...render(<Harness />),
    submitReview,
    prepareRecommendation
  };
}

describe("DecisionRoomPage", () => {
  it("renders the governed decision room with blocked committee submission until Legal approval arrives", () => {
    renderDecisionRoom();

    expect(screen.getByRole("heading", { name: "Investment Decision Room" })).toBeVisible();
    expect(screen.getByText("Committee preparation")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Claim" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Evidence" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Owner" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Disposition" })).toBeVisible();
    expect(
      screen.getByText(
        "AI assembled this draft from reviewed findings. It cannot issue an investment decision."
      )
    ).toBeVisible();
    expect(screen.getAllByText("Legal review required").length).toBeGreaterThan(0);
    expect(screen.getByText("Mandatory security gates require current PASS evidence")).toBeVisible();
    expect(screen.getAllByText("Permit transfer readiness").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/fy25-board-pack\.txt/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/environmental-permit\.txt/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Submit to committee" })).toBeDisabled();
  });

  it("enables committee-pack preparation after the missing Legal approval is recorded", async () => {
    const { prepareRecommendation, submitReview } = renderDecisionRoom(
      createDecisionRoomScenario(false, true)
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve Legal review" }));
    });

    expect(submitReview).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: "project-danube",
        findingId: "finding-permit-transfer",
        reviewType: "LEGAL",
        decision: "APPROVED",
        subjectVersion: "finding-permit-transfer-v2"
      })
    );
    expect(screen.getByRole("button", { name: "Prepare committee pack" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /approve investment/i })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Prepare committee pack" }));
    });

    expect(prepareRecommendation).toHaveBeenCalledWith({ caseId: "project-danube" });
    expect(screen.getAllByText("COMMITTEE_PREPARATION").length).toBeGreaterThan(0);
  });

  it("submits the authoritative Phase 5 completion version instead of a finding text version", async () => {
    const scenario = createDecisionRoomScenario(false, true);
    scenario.reviews = [];
    scenario.analysisAuthority = {
      analysisBundleId: "bundle-terra-1",
      evidenceManifestHash: "a".repeat(64),
      subjectVersion: "phase5-authoritative-output-manifest",
      status: "DRAFT_ONLY_READY"
    };
    const { submitReview } = renderDecisionRoom(scenario);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve Deal review" }));
    });

    expect(submitReview).toHaveBeenCalledWith(
      expect.objectContaining({
        findingId: "finding-ebitda-quality",
        subjectVersion: "phase5-authoritative-output-manifest"
      })
    );
  });

  it("reopens authoritative approvals after an edit changes the local projection version", () => {
    const scenario = createDecisionRoomScenario(true, true);
    scenario.analysisAuthority = {
      analysisBundleId: "bundle-terra-1",
      evidenceManifestHash: "a".repeat(64),
      subjectVersion: "phase5-authoritative-output-manifest",
      status: "DRAFT_ONLY_READY"
    };
    const projectionVersionByFinding: Readonly<Record<string, string>> = {
      "finding-ebitda-quality": "a".repeat(64),
      "finding-customer-concentration": "b".repeat(64),
      "finding-permit-transfer": "c".repeat(64)
    };
    scenario.findings = scenario.findings.map((finding) => ({
      ...finding,
      projectionVersion: projectionVersionByFinding[finding.findingId]!
    }));
    scenario.reviews = scenario.reviews.map((review) => ({
      ...review,
      subjectVersion: "phase5-authoritative-output-manifest",
      projectionVersion: projectionVersionByFinding[review.findingId]!
    }));
    scenario.findings = scenario.findings.map((finding) =>
      finding.findingId === "finding-permit-transfer"
        ? {
            ...finding,
            summary: "Permit transfer requires a renewed regulatory condition review.",
            projectionVersion: "d".repeat(64),
            textHistory: [
              ...finding.textHistory,
              {
                versionId: "finding-permit-transfer-v3",
                actorType: "HUMAN",
                action: "EDITED",
                summary: "Permit transfer requires a renewed regulatory condition review.",
                occurredAtIso: "2026-08-06T10:25:00.000Z"
              }
            ]
          }
        : finding
    );

    renderDecisionRoom(scenario);

    expect(screen.getAllByText("Legal review required").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Approve Legal review" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Prepare committee pack" })).toBeDisabled();
  });

  it("reopens a stale specialist approval when the accepted finding text changes", () => {
    const scenario = createDecisionRoomScenario(true);
    scenario.findings = scenario.findings.map((finding) =>
      finding.findingId === "finding-permit-transfer"
        ? {
            ...finding,
            summary: "Permit transfer requires a renewed regulatory condition review.",
            textHistory: [
              ...finding.textHistory,
              {
                versionId: "finding-permit-transfer-v3",
                actorType: "HUMAN",
                action: "EDITED",
                summary: "Permit transfer requires a renewed regulatory condition review.",
                occurredAtIso: "2026-08-06T10:25:00.000Z"
              }
            ]
          }
        : finding
    );

    renderDecisionRoom(scenario);

    expect(screen.getAllByText("Legal review required").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Approve Legal review" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Prepare committee pack" })).toBeDisabled();
  });

  it("blocks review approval affordances when no accepted eligible finding exists", () => {
    renderDecisionRoom(createNoEligibleLegalFindingScenario());

    expect(
      screen.getByText("Legal review blocked until an accepted eligible finding is available")
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Approve Legal review" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Committee-pack draft blocked until at least one accepted material finding is available.")
    ).toBeVisible();
    expect(
      screen.getByText("No accepted material claims are available for committee preparation yet.")
    ).toBeVisible();
    expect(screen.getByText("Legal review requires an accepted eligible finding")).toBeVisible();
    expect(screen.getByRole("button", { name: "Prepare committee pack" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit to committee" })).toBeDisabled();
  });

  it("has no axe violations", async () => {
    const { container } = renderDecisionRoom();
    const results = await axe.run(container, {
      rules: {
        "color-contrast": { enabled: false }
      }
    });

    expect(results.violations).toHaveLength(0);
  });
});
