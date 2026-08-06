import type { ScenarioState } from "@stratton/contracts";
import { scenarioStateSchema } from "@stratton/contracts";

const resetInstant = "2026-08-06T10:00:00.000Z";

export function createProjectDanubeState(): ScenarioState {
  return scenarioStateSchema.parse({
    caseId: "project-danube",
    stage: "INTAKE",
    evidence: [
      {
        evidenceId: "evidence-board-pack",
        title: "FY25 Board Pack",
        domain: "FINANCIAL",
        admissionStatus: "QUARANTINED",
        owner: "Finance Director",
        licenceStatus: "NOT_REQUIRED",
        sourceLocator: "fy25-board-pack.txt"
      },
      {
        evidenceId: "evidence-erp-rebates",
        title: "ERP Customer Rebate Export",
        domain: "FINANCIAL",
        admissionStatus: "QUARANTINED",
        owner: "CFO",
        licenceStatus: "NOT_REQUIRED",
        sourceLocator: "erp-rebate-export.csv"
      },
      {
        evidenceId: "evidence-qoe-report",
        title: "Quality of Earnings Report",
        domain: "FINANCIAL",
        admissionStatus: "QUARANTINED",
        owner: "Deal Lead",
        licenceStatus: "APPROVED",
        sourceLocator: "qoe-report.txt"
      },
      {
        evidenceId: "evidence-environmental-permit",
        title: "Czech Environmental Permit",
        domain: "LEGAL",
        admissionStatus: "QUARANTINED",
        owner: "General Counsel",
        licenceStatus: "NOT_REQUIRED",
        sourceLocator: "environmental-permit.txt"
      }
    ],
    findings: [],
    reviews: [],
    governanceEvents: [
      {
        eventId: "event-scenario-reset",
        type: "SCENARIO_RESET",
        outcome: "SUCCESS",
        occurredAtIso: resetInstant,
        correlationId: "scenario-reset-project-danube"
      }
    ]
  });
}
