import { describe, expect, it } from "vitest";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { InMemoryScenarioRepository } from "./in-memory-scenario-repository.js";
import { ScenarioService } from "./scenario-service.js";

describe("ScenarioService", () => {
  it("replaces changed state with a clean scenario", async () => {
    const repository = new InMemoryScenarioRepository(createProjectDanubeState());
    await repository.save({ state: { ...createProjectDanubeState(), stage: "REVIEW" } });

    const reset = await new ScenarioService(repository).reset();

    expect(reset.stage).toBe("INTAKE");
    expect((await repository.load()).state.findings).toHaveLength(0);
  });
});
