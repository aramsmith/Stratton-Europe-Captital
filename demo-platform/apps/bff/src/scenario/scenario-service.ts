import type { ScenarioState } from "@stratton/contracts";
import {
  createScenarioFixtureState,
  type DemoScenarioFixture
} from "@stratton/scenario-data";
import type { ScenarioRepository } from "./scenario-repository.js";

export class ScenarioService {
  public constructor(private readonly repository: ScenarioRepository) {}

  public async get(): Promise<ScenarioState> {
    return (await this.repository.load()).state;
  }

  public async reset(fixture: DemoScenarioFixture = "BASELINE"): Promise<ScenarioState> {
    const state = createScenarioFixtureState(fixture);
    await this.repository.reset(state);
    return state;
  }
}
