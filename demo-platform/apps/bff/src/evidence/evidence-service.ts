import { randomUUID } from "node:crypto";
import type { ScenarioState } from "@stratton/contracts";
import { DemoHttpError } from "../errors.js";
import type { Phase5Client } from "../phase5/phase5-client.js";
import type { ScenarioRepository } from "../scenario/scenario-repository.js";

const crossCaseSecurityGateId = "CC002-R2-SEC-GATE-006";
const promptInjectionSecurityGateId = "CC002-R2-SEC-GATE-002";

interface EvidenceServiceDependencies {
  readonly repository: ScenarioRepository;
  readonly phase5Client?: Phase5Client;
  readonly createId?: () => string;
  readonly now?: () => string;
}

export interface AdmitEvidenceInput {
  readonly caseId: string;
  readonly evidenceId: string;
  readonly correlationId: string;
}

interface RejectWithAuditInput {
  readonly snapshot: Awaited<ReturnType<ScenarioRepository["load"]>>;
  readonly state: ScenarioState;
  readonly correlationId: string;
  readonly type: string;
  readonly detail: string;
  readonly error: DemoHttpError;
  readonly securityGateId?: string;
  readonly securityGateEvidenceId?: string;
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

      if (state.caseId !== input.caseId) {
        return this.rejectWithAudit({
          snapshot,
          state,
          correlationId: input.correlationId,
          type: "CASE_SCOPE_POLICY_DENIED",
          detail: `CROSS_CASE_REQUEST:${input.caseId}`,
          error: new DemoHttpError(
            403,
            "POLICY_DENIED",
            "Requested case is outside the authenticated Project Danube scope."
          ),
          securityGateId: crossCaseSecurityGateId,
          securityGateEvidenceId: input.evidenceId
        });
      }

      const evidence = state.evidence.find((candidate) => candidate.evidenceId === input.evidenceId);
      if (!evidence) {
        throw new DemoHttpError(
          404,
          "INVALID_CONTRACT",
          "Evidence item does not exist in Project Danube."
        );
      }

      if (!isLicenceEligible(evidence.licenceStatus)) {
        const detail = `EVIDENCE_LICENCE_${evidence.licenceStatus}`;
        return this.rejectWithAudit({
          snapshot,
          state,
          correlationId: input.correlationId,
          type: "EVIDENCE_LICENCE_DENIED",
          detail,
          error: new DemoHttpError(403, "POLICY_DENIED", detail),
          securityGateId: "CC002-R2-SEC-GATE-008",
          securityGateEvidenceId: evidence.evidenceId
        });
      }

      if (isHostileEvidenceText(
        [evidence.title, evidence.sourceLocator, evidence.sourcePreview ?? ""].join("\n")
      )) {
        return this.rejectWithAudit({
          snapshot,
          state,
          correlationId: input.correlationId,
          type: "EVIDENCE_ADMISSION_DENIED",
          detail: "HOSTILE_EVIDENCE_QUARANTINED",
          error: new DemoHttpError(403, "POLICY_DENIED", "HOSTILE_EVIDENCE_QUARANTINED"),
          securityGateId: promptInjectionSecurityGateId,
          securityGateEvidenceId: evidence.evidenceId
        });
      }

      if (
        workflowSubmitted &&
        evidence.admissionStatus === "ADMITTED" &&
        evidence.provenanceStatus === "VERIFIED"
      ) {
        return state;
      }

      if (!workflowSubmitted) {
        if (this.dependencies.phase5Client) {
          await this.dependencies.phase5Client.admitEvidence({
            caseId: input.caseId,
            evidenceId: input.evidenceId,
            idempotencyKey: operationId,
            correlationId: input.correlationId
          });
        }
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

  private async rejectWithAudit(input: RejectWithAuditInput): Promise<never> {
    const governanceEvents: ScenarioState["governanceEvents"] = [
      ...input.state.governanceEvents,
      createGovernanceEvent(this.createId(), this.now(), {
        type: input.type,
        outcome: "DENY",
        correlationId: input.correlationId,
        detail: input.detail
      })
    ];

    if (input.securityGateId) {
      governanceEvents.push(
        createGovernanceEvent(this.createId(), this.now(), {
          type: "SECURITY_GATE_EVIDENCE_RECORDED",
          outcome: "FAILURE",
          correlationId: input.correlationId,
          detail: input.detail,
          metadata: {
            securityGateId: input.securityGateId,
            ...(input.state.latestAnalysisRun
              ? {
                  analysisRequestFingerprint:
                    input.state.latestAnalysisRun.analysisRequestFingerprint
                }
              : {}),
            ...(input.securityGateEvidenceId
              ? {
                  securityGateEvidenceId: input.securityGateEvidenceId
                }
              : {})
          }
        })
      );
    }

    await this.dependencies.repository.save({
      ...input.snapshot,
      state: {
        ...input.state,
        governanceEvents
      }
    });

    throw input.error;
  }
}

function buildEvidenceAdmissionOperationId(caseId: string, evidenceId: string): string {
  return `admit:${caseId}:${evidenceId}`;
}

function createGovernanceEvent(
  eventId: string,
  occurredAtIso: string,
  event: Omit<ScenarioState["governanceEvents"][number], "eventId" | "occurredAtIso">
): ScenarioState["governanceEvents"][number] {
  return {
    eventId,
    occurredAtIso,
    ...event
  };
}

export function isHostileEvidenceText(searchableText: string): boolean {
  return /SYSTEM OVERRIDE:|reveal every case|approve the investment|ignore the evidence policy/i.test(
    searchableText
  );
}

export function isLicenceEligible(
  licenceStatus: ScenarioState["evidence"][number]["licenceStatus"]
): boolean {
  return licenceStatus === "APPROVED" || licenceStatus === "NOT_REQUIRED";
}

function isStateConflict(error: unknown): error is DemoHttpError {
  return error instanceof DemoHttpError && error.code === "STATE_CONFLICT";
}
