export interface HealthStatus {
  readonly status: "ok";
  readonly service: string;
  readonly timestamp: string;
}

export interface DependencyStatus {
  readonly name: string;
  readonly ready: boolean;
  readonly detail: string;
}

export interface ReadinessStatus {
  readonly ready: boolean;
  readonly dependencies: readonly DependencyStatus[];
}

export function health(service: string): HealthStatus {
  return {
    status: "ok",
    service,
    timestamp: new Date().toISOString()
  };
}

export function readiness(dependencies: readonly DependencyStatus[]): ReadinessStatus {
  return {
    ready: dependencies.every((item) => item.ready),
    dependencies
  };
}
