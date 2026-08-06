import { describe, expect, it } from "vitest";
import { createProjectDanubeState } from "./project-danube.js";

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
});
