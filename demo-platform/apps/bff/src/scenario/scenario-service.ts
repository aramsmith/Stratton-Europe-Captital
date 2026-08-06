import { type ScenarioState } from "@stratton/contracts";
import { createProjectDanubeState } from "@stratton/scenario-data";
import type { ScenarioRepository } from "./scenario-repository.js";

export class ScenarioService {
  public constructor(private readonly repository: ScenarioRepository) {}

  public async get(): Promise<ScenarioState> {
    return (await this.repository.load()).state;
  }

  public async reset(): Promise<ScenarioState> {
    const state = createProjectDanubeState();
    await this.repository.reset(state);
    return state;
  }
}
