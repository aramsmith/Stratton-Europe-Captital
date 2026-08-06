import { scenarioStateSchema, type ScenarioState } from "@stratton/contracts";
import type { ScenarioRepository, ScenarioSnapshot } from "./scenario-repository.js";

export class InMemoryScenarioRepository implements ScenarioRepository {
  #state: ScenarioState;

  public constructor(initialState: ScenarioState) {
    this.#state = scenarioStateSchema.parse(initialState);
  }

  public async load(): Promise<ScenarioSnapshot> {
    return { state: structuredClone(this.#state) };
  }

  public async save(snapshot: ScenarioSnapshot): Promise<void> {
    this.#state = scenarioStateSchema.parse(structuredClone(snapshot.state));
  }

  public async reset(state: ScenarioState): Promise<void> {
    this.#state = scenarioStateSchema.parse(structuredClone(state));
  }
}
