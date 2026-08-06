import { scenarioStateSchema, type ScenarioState } from "@stratton/contracts";
import { DemoHttpError } from "../errors.js";
import type { ScenarioRepository, ScenarioSnapshot } from "./scenario-repository.js";

export class InMemoryScenarioRepository implements ScenarioRepository {
  #state: ScenarioState;
  #version = 0;

  public constructor(initialState: ScenarioState) {
    this.#state = scenarioStateSchema.parse(initialState);
  }

  public async load(): Promise<ScenarioSnapshot> {
    return {
      state: structuredClone(this.#state),
      concurrencyToken: {
        kind: "ROW_VERSION",
        value: this.#version
      }
    };
  }

  public async save(snapshot: ScenarioSnapshot): Promise<void> {
    this.assertCurrentVersion(snapshot);
    this.#state = scenarioStateSchema.parse(structuredClone(snapshot.state));
    this.#version += 1;
  }

  public async reset(snapshot: ScenarioSnapshot): Promise<void> {
    this.assertCurrentVersion(snapshot);
    this.#state = scenarioStateSchema.parse(structuredClone(snapshot.state));
    this.#version += 1;
  }

  public async initialize(state: ScenarioState): Promise<void> {
    scenarioStateSchema.parse(state);
    throw new DemoHttpError(
      409,
      "STATE_CONFLICT",
      "SCENARIO_PROJECTION_ALREADY_INITIALIZED"
    );
  }

  private assertCurrentVersion(snapshot: ScenarioSnapshot): void {
    if (
      snapshot.concurrencyToken.kind !== "ROW_VERSION" ||
      snapshot.concurrencyToken.value !== this.#version
    ) {
      throw new DemoHttpError(
        409,
        "STATE_CONFLICT",
        "SCENARIO_PROJECTION_VERSION_STALE"
      );
    }
  }
}
