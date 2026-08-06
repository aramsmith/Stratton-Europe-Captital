import { randomUUID } from "node:crypto";
import type { ScenarioState } from "@stratton/contracts";
import { DemoHttpError } from "../errors.js";
import type { Phase5Client } from "../phase5/phase5-client.js";
import type { ScenarioRepository } from "../scenario/scenario-repository.js";

interface EvidenceServiceDependencies {
  readonly repository: ScenarioRepository;
  readonly phase5Client: Phase5Client;
  readonly createId?: () => string;
  readonly now?: () => string;
}

export interface AdmitEvidenceInput {
  readonly caseId: string;
  readonly evidenceId: string;
  readonly correlationId: string;
}

export class EvidenceService {
  private readonly createId: () => string;
  private readonly now: () => string;

  public constructor(private readonly dependencies: EvidenceServiceDependencies) {
    this.createId = dependencies.createId ?? randomUUID;
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  public async admit(input: AdmitEvidenceInput): Promise<ScenarioState> {
    const operationId = buildEvidenceAdmissionOperationId(input.caseId, input.evidenceId);
    let workflowSubmitted = false;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const snapshot = await this.dependencies.repository.load();
      const state = snapshot.state;
      assertCaseId(state, input.caseId);

      const evidence = state.evidence.find((candidate) => candidate.evidenceId === input.evidenceId);
      if (!evidence) {
        throw new DemoHttpError(
          404,
          "INVALID_CONTRACT",
          "Evidence item does not exist in Project Danube."
        );
      }

      if (
        workflowSubmitted &&
        evidence.admissionStatus === "ADMITTED" &&
        evidence.provenanceStatus === "VERIFIED"
      ) {
        return state;
      }

      if (!workflowSubmitted) {
        await this.dependencies.phase5Client.admitEvidence({
          caseId: input.caseId,
          evidenceId: input.evidenceId,
          idempotencyKey: operationId,
          correlationId: input.correlationId
        });
        workflowSubmitted = true;
      }

      const nextState: ScenarioState = {
        ...state,
        evidence: state.evidence.map((candidate) =>
          candidate.evidenceId === input.evidenceId
            ? { ...candidate, admissionStatus: "ADMITTED", provenanceStatus: "VERIFIED" }
            : candidate
        ),
        governanceEvents: [
          ...state.governanceEvents,
          {
            eventId: this.createId(),
            type: "EVIDENCE_ADMITTED",
            outcome: "SUCCESS",
            occurredAtIso: this.now(),
            correlationId: input.correlationId,
            detail: input.evidenceId
          }
        ]
      };

      try {
        await this.dependencies.repository.save({
          ...snapshot,
          state: nextState
        });
        return nextState;
      } catch (error) {
        if (attempt === 0 && isStateConflict(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new DemoHttpError(409, "STATE_CONFLICT", "EVIDENCE_ADMISSION_RETRY_EXHAUSTED");
  }
}

function assertCaseId(state: ScenarioState, caseId: string): void {
  if (state.caseId !== caseId) {
    throw new DemoHttpError(400, "INVALID_CONTRACT", "Requested case does not match Project Danube.");
  }
}

function buildEvidenceAdmissionOperationId(caseId: string, evidenceId: string): string {
  return `admit:${caseId}:${evidenceId}`;
}

function isStateConflict(error: unknown): error is DemoHttpError {
  return error instanceof DemoHttpError && error.code === "STATE_CONFLICT";
}
