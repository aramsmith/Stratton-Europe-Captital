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
    const state = await this.dependencies.repository.load();
    assertCaseId(state, input.caseId);

    const evidence = state.evidence.find((candidate) => candidate.evidenceId === input.evidenceId);
    if (!evidence) {
      throw new DemoHttpError(404, "INVALID_CONTRACT", "Evidence item does not exist in Project Danube.");
    }

    await this.dependencies.phase5Client.admitEvidence({
      caseId: input.caseId,
      evidenceId: input.evidenceId,
      idempotencyKey: this.createId()
    });

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

    await this.dependencies.repository.save(nextState);
    return nextState;
  }
}

function assertCaseId(state: ScenarioState, caseId: string): void {
  if (state.caseId !== caseId) {
    throw new DemoHttpError(400, "INVALID_CONTRACT", "Requested case does not match Project Danube.");
  }
}
