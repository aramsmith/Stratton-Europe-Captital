import { scenarioStateSchema, type ScenarioState } from "@stratton/contracts";
import type { ScenarioRepository } from "./scenario-repository.js";

export class InMemoryScenarioRepository implements ScenarioRepository {
  #state: ScenarioState;

  public constructor(initialState: ScenarioState) {
    this.#state = scenarioStateSchema.parse(initialState);
  }

  public async load(): Promise<ScenarioState> {
    return structuredClone(this.#state);
  }

  public async save(state: ScenarioState): Promise<void> {
    this.#state = scenarioStateSchema.parse(structuredClone(state));
  }

  public async reset(state: ScenarioState): Promise<void> {
    this.#state = scenarioStateSchema.parse(structuredClone(state));
  }
}
