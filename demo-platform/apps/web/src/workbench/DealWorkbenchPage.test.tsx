import axe from "axe-core";
import {
  FluentProvider,
  webLightTheme
} from "@fluentui/react-components";
import type {
  AnalysisFinding,
  AnalysisRunResponse,
  FindingDispositionRequest,
  ScenarioState
} from "@stratton/contracts";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { describe, expect, it, vi } from "vitest";
import { DealWorkbenchPage } from "./DealWorkbenchPage.js";

function createFinding(findingId: string, title: string, summary: string): AnalysisFinding {
  return {
    findingId,
    title,
    summary,
    materiality: findingId === "finding-ebitda-quality" ? "HIGH" : "MEDIUM",
    status: "DRAFT",
    route: "TERRA",
    originalAiSummary: summary,
    textHistory: [
      {
        versionId: `${findingId}-v1`,
        actorType: "AI",
        action: "GENERATED",
        summary,
        occurredAtIso: "2026-08-06T10:05:00.000Z"
      }
    ],
    citations:
      findingId === "finding-permit-transfer"
        ? [
            {
              citationId: "citation-permit-2049",
              evidenceId: "evidence-environmental-permit",
              locator: "Permit reference: CZ-EP-2049",
              accessible: true
            }
          ]
        : [
            {
              citationId: "citation-board-pack-42",
              evidenceId: "evidence-board-pack",
              locator: "page 42",
              accessible: true
            }
          ]
  };
}

function createWorkbenchScenario() {
  const scenario = createProjectDanubeState();
  scenario.evidence = scenario.evidence.map((evidence) => ({
    ...evidence,
    sourcePreview: `${evidence.title} preview`,
    provenanceStatus: "PENDING"
  }));
  return scenario;
}

function createCompletedScenario(): ScenarioState {
  const scenario = createWorkbenchScenario();
  scenario.stage = "ANALYSIS";
  scenario.evidence = scenario.evidence.map((evidence) => ({
    ...evidence,
    admissionStatus: "ADMITTED",
    provenanceStatus: "VERIFIED"
  }));
  scenario.findings = [
    createFinding(
      "finding-ebitda-quality",
      "Adjusted EBITDA quality",
      "Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million."
    ),
    createFinding(
      "finding-customer-concentration",
      "Customer concentration",
      "Customer rebate concentration remains above the approved downside threshold."
    ),
    createFinding(
      "finding-permit-transfer",
      "Permit transfer readiness",
      "Permit transfer requires controlled completion steps before close."
    )
  ];
  return scenario;
}

function renderWorkbench() {
  const admitEvidence = vi.fn(async (input: { evidenceId: string }) => {
    setScenario((current) => ({
      ...current,
      evidence: current.evidence.map((evidence) =>
        evidence.evidenceId === input.evidenceId
          ? { ...evidence, admissionStatus: "ADMITTED", provenanceStatus: "VERIFIED" }
          : evidence
      )
    }));
  });
  const runAnalysis = vi.fn(async (): Promise<AnalysisRunResponse> => {
    const nextScenario = createCompletedScenario();
    setScenario(nextScenario);
    return {
      analysisRunId: "run-terra-1",
      route: "TERRA",
      scenario: nextScenario,
      findings: nextScenario.findings,
      correlationId: "corr-ui-1"
    };
  });
  const recordDisposition = vi.fn(async (input: FindingDispositionRequest & { findingId: string }) => {
    setScenario((current) => ({
      ...current,
      stage: "REVIEW",
      findings: current.findings.map((finding) =>
        finding.findingId === input.findingId
          ? {
              ...finding,
              status: input.action === "CHALLENGE" ? "CHALLENGED" : input.action === "REJECT" ? "REJECTED" : "ACCEPTED",
              summary: input.editedSummary ?? finding.summary,
              textHistory: input.editedSummary
                ? [
                    ...finding.textHistory,
                    {
                      versionId: `${finding.findingId}-v2`,
                      actorType: "HUMAN",
                      action: "EDITED",
                      summary: input.editedSummary,
                      occurredAtIso: "2026-08-06T10:10:00.000Z"
                    }
                  ]
                : finding.textHistory
            }
          : finding
      )
    }));
  });

  let setScenario: Dispatch<SetStateAction<ScenarioState>> = () => undefined;

  function Harness() {
    const [scenario, updateScenario] = useState(createWorkbenchScenario());
    setScenario = updateScenario;

    return (
      <FluentProvider theme={webLightTheme}>
        <DealWorkbenchPage
          scenario={scenario}
          onAdmitEvidence={admitEvidence}
          onRunAnalysis={runAnalysis}
          onRecordDisposition={recordDisposition}
        />
      </FluentProvider>
    );
  }

  return {
    ...render(<Harness />),
    admitEvidence,
    runAnalysis,
    recordDisposition
  };
}

describe("DealWorkbenchPage", () => {
  it("renders evidence provenance, runs analysis, and opens the citation panel", async () => {
    const { runAnalysis } = renderWorkbench();

    expect(screen.getByRole("heading", { name: "AI Deal Workbench" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Evidence" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Owner" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Licence" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Provenance" })).toBeVisible();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Admit FY25 Board Pack" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Admit ERP Customer Rebate Export" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Admit Quality of Earnings Report" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Admit Czech Environmental Permit" }));
    });

    fireEvent.change(screen.getByLabelText("Analyst question"), {
      target: { value: "Challenge management EBITDA quality" }
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));
    });

    expect(runAnalysis).toHaveBeenCalledWith({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality"
    });
    expect(await screen.findByText("Completed via TERRA")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Adjusted EBITDA quality" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Customer concentration" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Permit transfer readiness" })).toBeVisible();

    const ebitdaCard = screen.getByRole("article", { name: "Adjusted EBITDA quality" });
    fireEvent.click(within(ebitdaCard).getByRole("button", { name: "Open citation citation-board-pack-42" }));

    const citationPanel = screen.getByRole("region", { name: "Citation detail" });
    expect(within(citationPanel).getByText("page 42")).toBeVisible();
    expect(within(citationPanel).getByText("FY25 Board Pack")).toBeVisible();
  });

  it("supports human accept, edit, challenge, and reject actions without losing the AI original", async () => {
    const { recordDisposition } = renderWorkbench();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Admit FY25 Board Pack" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Admit ERP Customer Rebate Export" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Admit Quality of Earnings Report" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Admit Czech Environmental Permit" }));
    });
    fireEvent.change(screen.getByLabelText("Analyst question"), {
      target: { value: "Challenge management EBITDA quality" }
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));
    });
    await screen.findByRole("heading", { name: "Adjusted EBITDA quality" });

    const ebitdaCard = screen.getByRole("article", { name: "Adjusted EBITDA quality" });
    expect(within(ebitdaCard).getByRole("button", { name: "Accept Adjusted EBITDA quality" })).toBeVisible();
    expect(within(ebitdaCard).getByRole("button", { name: "Edit Adjusted EBITDA quality" })).toBeVisible();
    expect(within(ebitdaCard).getByRole("button", { name: "Challenge Adjusted EBITDA quality" })).toBeVisible();
    expect(within(ebitdaCard).getByRole("button", { name: "Reject Adjusted EBITDA quality" })).toBeVisible();

    fireEvent.click(within(ebitdaCard).getByRole("button", { name: "Edit Adjusted EBITDA quality" }));
    fireEvent.change(screen.getByLabelText("Edited finding summary"), {
      target: { value: "Human adjusted EBITDA challenge kept for committee review." }
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save edited finding" }));
    });

    expect(recordDisposition).toHaveBeenCalledWith({
      caseId: "project-danube",
      findingId: "finding-ebitda-quality",
      action: "EDIT",
      editedSummary: "Human adjusted EBITDA challenge kept for committee review."
    });
    expect(await screen.findByText("Human adjusted EBITDA challenge kept for committee review.")).toBeVisible();
    expect(screen.getByText("Original AI text")).toBeVisible();
    expect(
      screen.getByText("Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million.")
    ).toBeVisible();
  });

  it("has no axe violations", async () => {
    const { container } = renderWorkbench();
    const results = await axe.run(container, {
      rules: {
        "color-contrast": { enabled: false }
      }
    });

    expect(results.violations).toHaveLength(0);
  });
});
