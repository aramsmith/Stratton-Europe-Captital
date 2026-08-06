import { describe, expect, it } from "vitest";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { InMemoryScenarioRepository } from "./in-memory-scenario-repository.js";

describe("InMemoryScenarioRepository", () => {
  it("requires a monotonic snapshot version and rejects stale saves", async () => {
    const repository = new InMemoryScenarioRepository(createProjectDanubeState());
    const first = await repository.load();
    const overlapping = await repository.load();

    await repository.save({
      ...first,
      state: { ...first.state, stage: "ANALYSIS" }
    });

    await expect(
      repository.save({
        ...overlapping,
        state: { ...overlapping.state, stage: "REVIEW" }
      })
    ).rejects.toMatchObject({
      code: "STATE_CONFLICT",
      message: "SCENARIO_PROJECTION_VERSION_STALE"
    });

    const current = await repository.load();
    expect(current.state.stage).toBe("ANALYSIS");
    expect(current.concurrencyToken.value).toBe(first.concurrencyToken.value + 1);
  });

  it("atomically compares and increments the version for deterministic reset", async () => {
    const repository = new InMemoryScenarioRepository(createProjectDanubeState());
    const stale = await repository.load();
    await repository.save({
      ...stale,
      state: { ...stale.state, stage: "REVIEW" }
    });

    await expect(
      repository.reset({
        ...stale,
        state: createProjectDanubeState()
      })
    ).rejects.toMatchObject({ code: "STATE_CONFLICT" });

    const current = await repository.load();
    await repository.reset({
      ...current,
      state: createProjectDanubeState()
    });
    const reset = await repository.load();

    expect(reset.state).toEqual(createProjectDanubeState());
    expect(reset.concurrencyToken.value).toBe(current.concurrencyToken.value + 1);
  });
});
