import { describe, expect, it } from "vitest";
import {
  createProjectDanubeExpiredLicenceState,
  createProjectDanubeMissingLicenceState,
  createProjectDanubeState
} from "./project-danube.js";

describe("createProjectDanubeState", () => {
  it("returns the same case and evidence identifiers on every reset", () => {
    const first = createProjectDanubeState();
    const second = createProjectDanubeState();

    expect(first).toEqual(second);
    expect(first.caseId).toBe("project-danube");
    expect(first.evidence.map((item) => item.evidenceId)).toEqual([
      "evidence-board-pack",
      "evidence-erp-rebates",
      "evidence-qoe-report",
      "evidence-environmental-permit"
    ]);
  });

  it("provides deterministic expired and missing licence fixtures", () => {
    expect(
      createProjectDanubeExpiredLicenceState().evidence.find(
        (item) => item.evidenceId === "evidence-qoe-report"
      )
    ).toMatchObject({ licenceStatus: "EXPIRED", admissionStatus: "QUARANTINED" });
    expect(
      createProjectDanubeMissingLicenceState().evidence.find(
        (item) => item.evidenceId === "evidence-qoe-report"
      )
    ).toMatchObject({ licenceStatus: "MISSING", admissionStatus: "QUARANTINED" });
  });
});
