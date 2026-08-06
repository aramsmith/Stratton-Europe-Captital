import { describe, expect, it } from "vitest";
import { scenarioStateSchema } from "./index.js";

describe("scenarioStateSchema", () => {
  it("rejects a material finding without citations", () => {
    const result = scenarioStateSchema.safeParse({
      caseId: "project-danube",
      stage: "ANALYSIS",
      evidence: [],
      findings: [
        {
          findingId: "finding-ebitda",
          title: "EBITDA quality",
          summary: "Adjustment range requires challenge",
          materiality: "HIGH",
          status: "DRAFT",
          citations: []
        }
      ],
      reviews: [],
      governanceEvents: []
    });

    expect(result.success).toBe(false);
  });
});
