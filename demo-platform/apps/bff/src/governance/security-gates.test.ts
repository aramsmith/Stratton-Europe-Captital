import { describe, expect, it } from "vitest";
import type { ScenarioState } from "@stratton/contracts";
import { createProjectDanubeState } from "@stratton/scenario-data";
import {
  buildSecurityGateStatuses,
  getSecurityGateReadinessBlocker,
  mandatorySecurityGateDefinitions
} from "./security-gates.js";

function analysedState(): ScenarioState {
  const state = createProjectDanubeState();
  state.latestAnalysisRun = {
    analysisRunId: "run-terra-1",
    route: "TERRA",
    taskClass: "CROSS_DOCUMENT_COMPARISON",
    analystQuestion: "Challenge management EBITDA quality",
    questionHash: "a".repeat(64),
    admittedEvidenceIds: ["evidence-board-pack"],
    evidenceSetHash: "b".repeat(64),
    analysisRequestFingerprint: "c".repeat(64),
    promptTemplateVersion: `stratton-workbench-v2:${"c".repeat(64)}`,
    authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
  };
  return state;
}

function passEvents(
  state: ScenarioState,
  analysisRequestFingerprint = state.latestAnalysisRun!.analysisRequestFingerprint
): ScenarioState["governanceEvents"] {
  return mandatorySecurityGateDefinitions.map((gate, index) => ({
    eventId: `gate-pass-${index + 1}`,
    type: "SECURITY_GATE_EVIDENCE_RECORDED",
    outcome: "SUCCESS",
    occurredAtIso: `2026-08-06T11:${String(index).padStart(2, "0")}:00.000Z`,
    correlationId: "corr-gate-suite",
    detail: `DETERMINISTIC_GATE_PASS:${gate.gateId}`,
    metadata: {
      securityGateId: gate.gateId,
      securityGateEvidenceId: gate.evidenceId,
      analysisRequestFingerprint
    }
  }));
}

describe("mandatory security gate readiness", () => {
  it("blocks when any mandatory gate has not been run", () => {
    const state = analysedState();

    expect(buildSecurityGateStatuses(state).every((gate) => gate.outcome === "NOT_RUN")).toBe(true);
    expect(getSecurityGateReadinessBlocker(state)).toBe(
      "SECURITY_GATE_CC002-R2-SEC-GATE-001_NOT_RUN"
    );
  });

  it("requires current version-bound PASS evidence for all twelve gates", () => {
    const state = analysedState();
    state.governanceEvents.push(...passEvents(state));

    expect(buildSecurityGateStatuses(state).every((gate) => gate.outcome === "PASS")).toBe(true);
    expect(getSecurityGateReadinessBlocker(state)).toBeNull();
  });

  it("treats evidence bound to an older analysis as stale", () => {
    const state = analysedState();
    state.governanceEvents.push(...passEvents(state, "d".repeat(64)));

    expect(buildSecurityGateStatuses(state)[0]).toMatchObject({ outcome: "STALE" });
    expect(getSecurityGateReadinessBlocker(state)).toBe(
      "SECURITY_GATE_CC002-R2-SEC-GATE-001_STALE"
    );
  });

  it("lets a hostile failure override earlier PASS evidence for the current subject", () => {
    const state = analysedState();
    state.governanceEvents.push(...passEvents(state));
    state.governanceEvents.push({
      eventId: "gate-hostile-failure",
      type: "SECURITY_GATE_EVIDENCE_RECORDED",
      outcome: "FAILURE",
      occurredAtIso: "2026-08-06T12:00:00.000Z",
      correlationId: "corr-hostile",
      detail: "HOSTILE_EVIDENCE_QUARANTINED",
      metadata: {
        securityGateId: "CC002-R2-SEC-GATE-002",
        securityGateEvidenceId: "evidence-hostile-instructions",
        analysisRequestFingerprint: state.latestAnalysisRun!.analysisRequestFingerprint
      }
    });

    expect(
      buildSecurityGateStatuses(state).find(
        (gate) => gate.gateId === "CC002-R2-SEC-GATE-002"
      )
    ).toMatchObject({ outcome: "FAIL" });
    expect(getSecurityGateReadinessBlocker(state)).toBe(
      "SECURITY_GATE_CC002-R2-SEC-GATE-002_FAIL"
    );
  });
});
