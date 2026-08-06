import { describe, expect, it, vi } from "vitest";
import {
  createProjectDanubePromptInjectionState,
  createProjectDanubeState
} from "@stratton/scenario-data";
import { DemoHttpError } from "../errors.js";
import type { Phase5Client } from "../phase5/phase5-client.js";
import { InMemoryScenarioRepository } from "../scenario/in-memory-scenario-repository.js";
import { EvidenceService } from "./evidence-service.js";

function createPhase5ClientDouble() {
  return {
    admitEvidence: vi.fn<Phase5Client["admitEvidence"]>().mockResolvedValue(undefined),
    requestAnalysis: vi.fn<Phase5Client["requestAnalysis"]>().mockResolvedValue({
      analysisRunId: "unused",
      status: "QUEUED"
    }),
    submitReview: vi.fn<Phase5Client["submitReview"]>().mockResolvedValue(undefined),
    prepareDraft: vi.fn<Phase5Client["prepareDraft"]>().mockResolvedValue(undefined)
  } satisfies Phase5Client;
}

describe("EvidenceService", () => {
  it("admits evidence through Phase 5 and records governed provenance state", async () => {
    const repository = new InMemoryScenarioRepository(createProjectDanubeState());
    const phase5Client = createPhase5ClientDouble();

    const service = new EvidenceService({ repository, phase5Client });
    const nextState = await service.admit({
      caseId: "project-danube",
      evidenceId: "evidence-board-pack",
      correlationId: "corr-admit-1"
    });

    expect(phase5Client.admitEvidence).toHaveBeenCalledWith({
      caseId: "project-danube",
      evidenceId: "evidence-board-pack",
      idempotencyKey: "admit:project-danube:evidence-board-pack",
      correlationId: "corr-admit-1"
    });
    expect(nextState.evidence.find((evidence) => evidence.evidenceId === "evidence-board-pack")).toMatchObject({
      admissionStatus: "ADMITTED",
      provenanceStatus: "VERIFIED"
    });
    expect(nextState.governanceEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "EVIDENCE_ADMITTED",
          outcome: "SUCCESS",
          correlationId: "corr-admit-1",
          detail: "evidence-board-pack"
        })
      ])
    );
  });

  it("retries a stale save without repeating the governed admission call", async () => {
    const initialState = createProjectDanubeState();
    let loadCount = 0;
    let savedState = createProjectDanubeState();
    const repository = {
      load: vi.fn(async () => {
        loadCount += 1;
        return {
          state: structuredClone(loadCount === 1 ? initialState : savedState),
          concurrencyToken: { kind: "ROW_VERSION" as const, value: loadCount - 1 }
        };
      }),
      save: vi
        .fn()
        .mockRejectedValueOnce(new DemoHttpError(409, "STATE_CONFLICT", "SCENARIO_PROJECTION_VERSION_STALE"))
        .mockImplementationOnce(async (snapshot) => {
          savedState = structuredClone(snapshot.state);
        }),
      reset: vi.fn(async () => undefined)
    };
    const phase5Client = createPhase5ClientDouble();

    const service = new EvidenceService({ repository, phase5Client });
    const nextState = await service.admit({
      caseId: "project-danube",
      evidenceId: "evidence-board-pack",
      correlationId: "corr-admit-retry"
    });

    expect(phase5Client.admitEvidence).toHaveBeenCalledTimes(1);
    expect(phase5Client.admitEvidence).toHaveBeenCalledWith({
      caseId: "project-danube",
      evidenceId: "evidence-board-pack",
      idempotencyKey: "admit:project-danube:evidence-board-pack",
      correlationId: "corr-admit-retry"
    });
    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(nextState.evidence.find((evidence) => evidence.evidenceId === "evidence-board-pack")).toMatchObject({
      admissionStatus: "ADMITTED",
      provenanceStatus: "VERIFIED"
    });
  });

  it("denies cross-case evidence admission attempts with a security gate failure", async () => {
    const repository = new InMemoryScenarioRepository(createProjectDanubeState());
    const phase5Client = createPhase5ClientDouble();

    const service = new EvidenceService({ repository, phase5Client });

    await expect(
      service.admit({
        caseId: "project-vltava",
        evidenceId: "evidence-board-pack",
        correlationId: "corr-cross-case"
      })
    ).rejects.toMatchObject({ code: "POLICY_DENIED" });

    const state = (await repository.load()).state;
    expect(state.governanceEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "CASE_SCOPE_POLICY_DENIED",
          outcome: "DENY",
          detail: "CROSS_CASE_REQUEST:project-vltava"
        }),
        expect.objectContaining({
          type: "SECURITY_GATE_EVIDENCE_RECORDED",
          outcome: "FAILURE",
          metadata: {
            securityGateId: "CC002-R2-SEC-GATE-006",
            securityGateEvidenceId: "evidence-board-pack"
          }
        })
      ])
    );
  });

  it("keeps hostile evidence quarantined and records a prompt-injection gate failure", async () => {
    const repository = new InMemoryScenarioRepository(createProjectDanubePromptInjectionState());
    const phase5Client = createPhase5ClientDouble();

    const service = new EvidenceService({ repository, phase5Client });

    await expect(
      service.admit({
        caseId: "project-danube",
        evidenceId: "evidence-hostile-instructions",
        correlationId: "corr-prompt-injection"
      })
    ).rejects.toMatchObject({ code: "POLICY_DENIED", message: "HOSTILE_EVIDENCE_QUARANTINED" });

    expect(phase5Client.admitEvidence).not.toHaveBeenCalled();
    const state = (await repository.load()).state;
    expect(
      state.evidence.find((item) => item.evidenceId === "evidence-hostile-instructions")
    ).toMatchObject({ admissionStatus: "QUARANTINED" });
    expect(state.governanceEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "EVIDENCE_ADMISSION_DENIED",
          outcome: "DENY",
          detail: "HOSTILE_EVIDENCE_QUARANTINED"
        }),
        expect.objectContaining({
          type: "SECURITY_GATE_EVIDENCE_RECORDED",
          outcome: "FAILURE",
          metadata: {
            securityGateId: "CC002-R2-SEC-GATE-002",
            securityGateEvidenceId: "evidence-hostile-instructions"
          }
        })
      ])
    );
  });
});
