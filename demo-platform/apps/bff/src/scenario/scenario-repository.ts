import type { ScenarioState } from "@stratton/contracts";

export interface ScenarioConcurrencyToken {
  readonly kind: "ROW_VERSION";
  readonly value: number;
}

export interface ScenarioSnapshot {
  readonly state: ScenarioState;
  readonly concurrencyToken?: ScenarioConcurrencyToken;
}

export interface ScenarioRepository {
  load(): Promise<ScenarioSnapshot>;
  save(snapshot: ScenarioSnapshot): Promise<void>;
  reset(state: ScenarioState): Promise<void>;
}
