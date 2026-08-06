import { spawnSync } from "node:child_process";
import { expect, test } from "@playwright/test";

const repoRoot = process.cwd();

test("reset-scenario.mjs restores the exact Project Danube baseline", async ({ request }) => {
  const resetResponse = await request.post("/api/scenario/reset");
  expect(resetResponse.ok()).toBeTruthy();

  const analysisResponse = await request.post("/api/analysis-runs", {
    data: {
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality"
    }
  });
  expect(analysisResponse.status()).toBe(422);

  const admitResponse = await request.post("/api/evidence/evidence-board-pack/admit", {
    data: { caseId: "project-danube" }
  });
  expect(admitResponse.ok()).toBeTruthy();

  const result = spawnSync(process.execPath, ["./scripts/reset-scenario.mjs"], {
    cwd: repoRoot,
    encoding: "utf-8"
  });

  expect(result.status, result.stderr || result.stdout).toBe(0);

  const scenarioResponse = await request.get("/api/scenario");
  expect(scenarioResponse.ok()).toBeTruthy();
  const scenario = await scenarioResponse.json();

  expect(scenario).toMatchObject({
    caseId: "project-danube",
    stage: "INTAKE",
    findings: [],
    reviews: []
  });
  expect(scenario.evidence.map((item: { evidenceId: string }) => item.evidenceId)).toEqual([
    "evidence-board-pack",
    "evidence-erp-rebates",
    "evidence-qoe-report",
    "evidence-environmental-permit"
  ]);
  expect(scenario.evidence.every((item: { admissionStatus: string; provenanceStatus: string }) => item.admissionStatus === "QUARANTINED" && item.provenanceStatus === "PENDING")).toBe(true);
  expect(scenario.governanceEvents).toEqual([
    {
      eventId: "event-scenario-reset",
      type: "SCENARIO_RESET",
      outcome: "SUCCESS",
      occurredAtIso: "2026-08-06T10:00:00.000Z",
      correlationId: "scenario-reset-project-danube"
    }
  ]);
});
