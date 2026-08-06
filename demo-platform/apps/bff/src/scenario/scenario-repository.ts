import type { ScenarioState } from "@stratton/contracts";

export interface ScenarioRepository {
  load(): Promise<ScenarioState>;
  save(state: ScenarioState): Promise<void>;
  reset(state: ScenarioState): Promise<void>;
}
