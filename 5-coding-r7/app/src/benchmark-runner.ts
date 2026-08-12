import { ROLLOUT_ADMISSION_MAX } from "./policy-service.js";
import type { ModelTier } from "./model-routing-policy.js";

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

export interface ModelRouteBenchmarkInput extends BenchmarkInput {
  readonly routeId: ModelTier;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly representativeCaseCount: number;
  readonly p95LatencyMilliseconds: number;
  readonly typicalPackMinutes: number;
  readonly observedInputTokens: number;
  readonly observedOutputTokens: number;
  readonly observedCostUsd: number;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isValidPercentage(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function hasPositiveIntegerEvidence(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

function hasPositiveFiniteEvidence(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function hasApprovedRouteIdentity(input: ModelRouteBenchmarkInput): boolean {
  if (
    typeof input.routeId !== "string" ||
    typeof input.modelName !== "string" ||
    typeof input.modelVersion !== "string" ||
    input.modelVersion !== "2026-07-09"
  ) {
    return false;
  }
  switch (input.routeId) {
    case "LUNA":
      return input.modelName === "gpt-5.6-luna";
    case "TERRA":
      return input.modelName === "gpt-5.6-terra";
    case "SOL":
      return input.modelName === "gpt-5.6-sol";
    default:
      return false;
  }
}

export function runBenchmark(input: ModelRouteBenchmarkInput): BenchmarkResult {
  const failures: string[] = [];
  if (
    !isNonNegativeInteger(input.completedEligibleDeals) ||
    input.completedEligibleDeals > ROLLOUT_ADMISSION_MAX
  ) {
    failures.push("ROLLOUT_ADMISSION_EXCEEDED");
  }
  if (!isValidPercentage(input.citationCoveragePct) || input.citationCoveragePct < 100) {
    failures.push("CITATION_COVERAGE_BELOW_THRESHOLD");
  }
  if (!isValidPercentage(input.extractionAccuracyPct) || input.extractionAccuracyPct < 95) {
    failures.push("EXTRACTION_ACCURACY_BELOW_THRESHOLD");
  }
  if (!isValidPercentage(input.criticalFieldAccuracyPct) || input.criticalFieldAccuracyPct < 99) {
    failures.push("CRITICAL_FIELD_ACCURACY_BELOW_THRESHOLD");
  }
  if (!isNonNegativeInteger(input.criticalUnsupportedClaims) || input.criticalUnsupportedClaims > 0) {
    failures.push("CRITICAL_UNSUPPORTED_CLAIMS_PRESENT");
  }
  if (
    !isValidPercentage(input.nonCriticalUnsupportedClaimRatePct) ||
    input.nonCriticalUnsupportedClaimRatePct > 2
  ) {
    failures.push("NON_CRITICAL_UNSUPPORTED_CLAIMS_TOO_HIGH");
  }
  if (!isValidPercentage(input.seededHighRiskRecallPct) || input.seededHighRiskRecallPct < 90) {
    failures.push("SEEDED_HIGH_RISK_RECALL_BELOW_THRESHOLD");
  }
  if (!isNonNegativeInteger(input.missedCriticalRisk) || input.missedCriticalRisk > 0) {
    failures.push("MISSED_CRITICAL_RISK_PRESENT");
  }
  if (!hasPositiveIntegerEvidence(input.representativeCaseCount) || input.representativeCaseCount < 100) {
    failures.push("REPRESENTATIVE_CASE_COUNT_BELOW_100");
  }
  if (
    !Number.isFinite(input.p95LatencyMilliseconds) ||
    input.p95LatencyMilliseconds <= 0 ||
    input.p95LatencyMilliseconds > 5_000
  ) {
    failures.push("INTERACTIVE_P95_ABOVE_5000_MS");
  }
  if (
    !Number.isFinite(input.typicalPackMinutes) ||
    input.typicalPackMinutes <= 0 ||
    input.typicalPackMinutes > 30
  ) {
    failures.push("TYPICAL_PACK_ABOVE_30_MINUTES");
  }
  if (!hasApprovedRouteIdentity(input)) {
    failures.push("MODEL_NAME_OR_VERSION_MISSING");
  }
  if (
    !hasPositiveIntegerEvidence(input.observedInputTokens) ||
    !hasPositiveIntegerEvidence(input.observedOutputTokens) ||
    !hasPositiveFiniteEvidence(input.observedCostUsd)
  ) {
    failures.push("TOKEN_OR_COST_EVIDENCE_MISSING");
  }
  return {
    passed: failures.length === 0,
    failures
  };
}
