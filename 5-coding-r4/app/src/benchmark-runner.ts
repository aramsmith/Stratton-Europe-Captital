import { ROLLOUT_ADMISSION_MAX } from "./policy-service.js";

export interface BenchmarkInput {
  readonly completedEligibleDeals: number;
  readonly citationCoveragePct: number;
  readonly extractionAccuracyPct: number;
  readonly criticalFieldAccuracyPct: number;
  readonly criticalUnsupportedClaims: number;
  readonly nonCriticalUnsupportedClaimRatePct: number;
  readonly seededHighRiskRecallPct: number;
  readonly missedCriticalRisk: number;
}

export interface BenchmarkResult {
  readonly passed: boolean;
  readonly failures: readonly string[];
}

export function runBenchmark(input: BenchmarkInput): BenchmarkResult {
  const failures: string[] = [];
  if (input.completedEligibleDeals > ROLLOUT_ADMISSION_MAX) {
    failures.push("ROLLOUT_ADMISSION_EXCEEDED");
  }
  if (input.citationCoveragePct < 100) {
    failures.push("CITATION_COVERAGE_BELOW_THRESHOLD");
  }
  if (input.extractionAccuracyPct < 95) {
    failures.push("EXTRACTION_ACCURACY_BELOW_THRESHOLD");
  }
  if (input.criticalFieldAccuracyPct < 99) {
    failures.push("CRITICAL_FIELD_ACCURACY_BELOW_THRESHOLD");
  }
  if (input.criticalUnsupportedClaims > 0) {
    failures.push("CRITICAL_UNSUPPORTED_CLAIMS_PRESENT");
  }
  if (input.nonCriticalUnsupportedClaimRatePct > 2) {
    failures.push("NON_CRITICAL_UNSUPPORTED_CLAIMS_TOO_HIGH");
  }
  if (input.seededHighRiskRecallPct < 90) {
    failures.push("SEEDED_HIGH_RISK_RECALL_BELOW_THRESHOLD");
  }
  if (input.missedCriticalRisk > 0) {
    failures.push("MISSED_CRITICAL_RISK_PRESENT");
  }
  return {
    passed: failures.length === 0,
    failures
  };
}
