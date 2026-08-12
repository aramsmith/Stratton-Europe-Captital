import assert from "node:assert/strict";
import { test } from "node:test";
import { runBenchmark, type ModelRouteBenchmarkInput } from "../../../app/src/benchmark-runner.js";

function passingBenchmarkInput(): ModelRouteBenchmarkInput {
  return {
    completedEligibleDeals: 0,
    citationCoveragePct: 100,
    extractionAccuracyPct: 95,
    criticalFieldAccuracyPct: 99,
    criticalUnsupportedClaims: 0,
    nonCriticalUnsupportedClaimRatePct: 2,
    seededHighRiskRecallPct: 90,
    missedCriticalRisk: 0,
    routeId: "TERRA",
    modelName: "gpt-5.6-terra",
    modelVersion: "2026-07-09",
    representativeCaseCount: 100,
    p95LatencyMilliseconds: 5_000,
    typicalPackMinutes: 30,
    observedInputTokens: 1,
    observedOutputTokens: 1,
    observedCostUsd: 0.01
  };
}

test("benchmark rejects route evidence below the required sample, latency, and pack thresholds", () => {
  const result = runBenchmark({
    ...passingBenchmarkInput(),
    representativeCaseCount: 99,
    p95LatencyMilliseconds: 5_001,
    typicalPackMinutes: 30.01
  });

  assert.deepEqual(result, {
    passed: false,
    failures: [
      "REPRESENTATIVE_CASE_COUNT_BELOW_100",
      "INTERACTIVE_P95_ABOVE_5000_MS",
      "TYPICAL_PACK_ABOVE_30_MINUTES"
    ]
  });
});

test("benchmark fails closed for blank identity and non-positive or non-finite token or cost evidence", () => {
  const result = runBenchmark({
    ...passingBenchmarkInput(),
    modelName: " ",
    modelVersion: "\t",
    observedInputTokens: 0,
    observedOutputTokens: Number.POSITIVE_INFINITY,
    observedCostUsd: -0.01
  });

  assert.deepEqual(result, {
    passed: false,
    failures: ["MODEL_NAME_OR_VERSION_MISSING", "TOKEN_OR_COST_EVIDENCE_MISSING"]
  });
});

test("benchmark composes per-route controls with citation and unsupported-claim gates", () => {
  const result = runBenchmark({
    ...passingBenchmarkInput(),
    citationCoveragePct: 99,
    criticalUnsupportedClaims: 1,
    representativeCaseCount: 99
  });

  assert.deepEqual(result, {
    passed: false,
    failures: [
      "CITATION_COVERAGE_BELOW_THRESHOLD",
      "CRITICAL_UNSUPPORTED_CLAIMS_PRESENT",
      "REPRESENTATIVE_CASE_COUNT_BELOW_100"
    ]
  });
});

test("benchmark accepts the exact route evidence boundaries for every approved route", () => {
  const luna = runBenchmark({
    ...passingBenchmarkInput(),
    routeId: "LUNA",
    modelName: "gpt-5.6-luna"
  });
  const terra = runBenchmark(passingBenchmarkInput());
  const sol = runBenchmark({
    ...passingBenchmarkInput(),
    routeId: "SOL",
    modelName: "gpt-5.6-sol"
  });

  assert.deepEqual(luna, { passed: true, failures: [] });
  assert.deepEqual(terra, { passed: true, failures: [] });
  assert.deepEqual(sol, { passed: true, failures: [] });
});

test("benchmark rejects model evidence that does not exactly match its route and version", () => {
  const result = runBenchmark({
    ...passingBenchmarkInput(),
    routeId: "TERRA",
    modelName: "gpt-5.6-luna",
    modelVersion: "2026-07-10"
  });

  assert.deepEqual(result, {
    passed: false,
    failures: ["MODEL_NAME_OR_VERSION_MISSING"]
  });
});

test("benchmark rejects an untrusted invalid route and missing identity fields deterministically", () => {
  const invalidRoute = JSON.parse(
    '{"completedEligibleDeals":0,"citationCoveragePct":100,"extractionAccuracyPct":95,"criticalFieldAccuracyPct":99,"criticalUnsupportedClaims":0,"nonCriticalUnsupportedClaimRatePct":2,"seededHighRiskRecallPct":90,"missedCriticalRisk":0,"routeId":"ORBIT","modelName":"gpt-5.6-terra","modelVersion":"2026-07-09","representativeCaseCount":100,"p95LatencyMilliseconds":5000,"typicalPackMinutes":30,"observedInputTokens":1,"observedOutputTokens":1,"observedCostUsd":0.01}'
  );
  const missingIdentity = JSON.parse(
    '{"completedEligibleDeals":0,"citationCoveragePct":100,"extractionAccuracyPct":95,"criticalFieldAccuracyPct":99,"criticalUnsupportedClaims":0,"nonCriticalUnsupportedClaimRatePct":2,"seededHighRiskRecallPct":90,"missedCriticalRisk":0,"routeId":"LUNA","representativeCaseCount":100,"p95LatencyMilliseconds":5000,"typicalPackMinutes":30,"observedInputTokens":1,"observedOutputTokens":1,"observedCostUsd":0.01}'
  );

  assert.deepEqual(runBenchmark(invalidRoute), {
    passed: false,
    failures: ["MODEL_NAME_OR_VERSION_MISSING"]
  });
  assert.deepEqual(runBenchmark(missingIdentity), {
    passed: false,
    failures: ["MODEL_NAME_OR_VERSION_MISSING"]
  });
});

test("benchmark rejects zero, negative, fractional, non-finite, and missing route measurements", () => {
  const zeroMeasurements = runBenchmark({
    ...passingBenchmarkInput(),
    representativeCaseCount: 0,
    p95LatencyMilliseconds: 0,
    typicalPackMinutes: 0,
    observedInputTokens: 0,
    observedOutputTokens: 0,
    observedCostUsd: 0
  });
  const negativeMeasurements = runBenchmark({
    ...passingBenchmarkInput(),
    representativeCaseCount: -1,
    p95LatencyMilliseconds: -1,
    typicalPackMinutes: -1,
    observedInputTokens: -1,
    observedOutputTokens: -1,
    observedCostUsd: -0.01
  });
  const fractionalMeasurements = runBenchmark({
    ...passingBenchmarkInput(),
    representativeCaseCount: 100.5,
    observedInputTokens: 1.5,
    observedOutputTokens: 1.5
  });
  const nonFiniteMeasurements = runBenchmark({
    ...passingBenchmarkInput(),
    representativeCaseCount: Number.NaN,
    p95LatencyMilliseconds: Number.POSITIVE_INFINITY,
    typicalPackMinutes: Number.NaN,
    observedInputTokens: Number.NaN,
    observedOutputTokens: Number.POSITIVE_INFINITY,
    observedCostUsd: Number.NaN
  });
  const missingMeasurements = JSON.parse(
    '{"completedEligibleDeals":0,"citationCoveragePct":100,"extractionAccuracyPct":95,"criticalFieldAccuracyPct":99,"criticalUnsupportedClaims":0,"nonCriticalUnsupportedClaimRatePct":2,"seededHighRiskRecallPct":90,"missedCriticalRisk":0,"routeId":"TERRA","modelName":"gpt-5.6-terra","modelVersion":"2026-07-09"}'
  );

  assert.deepEqual(zeroMeasurements, {
    passed: false,
    failures: [
      "REPRESENTATIVE_CASE_COUNT_BELOW_100",
      "INTERACTIVE_P95_ABOVE_5000_MS",
      "TYPICAL_PACK_ABOVE_30_MINUTES",
      "TOKEN_OR_COST_EVIDENCE_MISSING"
    ]
  });
  assert.deepEqual(negativeMeasurements, {
    passed: false,
    failures: [
      "REPRESENTATIVE_CASE_COUNT_BELOW_100",
      "INTERACTIVE_P95_ABOVE_5000_MS",
      "TYPICAL_PACK_ABOVE_30_MINUTES",
      "TOKEN_OR_COST_EVIDENCE_MISSING"
    ]
  });
  assert.deepEqual(fractionalMeasurements, {
    passed: false,
    failures: [
      "REPRESENTATIVE_CASE_COUNT_BELOW_100",
      "TOKEN_OR_COST_EVIDENCE_MISSING"
    ]
  });
  assert.deepEqual(nonFiniteMeasurements, {
    passed: false,
    failures: [
      "REPRESENTATIVE_CASE_COUNT_BELOW_100",
      "INTERACTIVE_P95_ABOVE_5000_MS",
      "TYPICAL_PACK_ABOVE_30_MINUTES",
      "TOKEN_OR_COST_EVIDENCE_MISSING"
    ]
  });
  assert.deepEqual(runBenchmark(missingMeasurements), {
    passed: false,
    failures: [
      "REPRESENTATIVE_CASE_COUNT_BELOW_100",
      "INTERACTIVE_P95_ABOVE_5000_MS",
      "TYPICAL_PACK_ABOVE_30_MINUTES",
      "TOKEN_OR_COST_EVIDENCE_MISSING"
    ]
  });
});

test("benchmark maps invalid inherited evidence to existing gates before route failures", () => {
  const result = runBenchmark({
    ...passingBenchmarkInput(),
    completedEligibleDeals: -1.5,
    citationCoveragePct: 101,
    extractionAccuracyPct: Number.NaN,
    criticalFieldAccuracyPct: Number.POSITIVE_INFINITY,
    criticalUnsupportedClaims: -1.5,
    nonCriticalUnsupportedClaimRatePct: -1,
    seededHighRiskRecallPct: 101,
    missedCriticalRisk: Number.NaN,
    representativeCaseCount: 99
  });

  assert.deepEqual(result, {
    passed: false,
    failures: [
      "ROLLOUT_ADMISSION_EXCEEDED",
      "CITATION_COVERAGE_BELOW_THRESHOLD",
      "EXTRACTION_ACCURACY_BELOW_THRESHOLD",
      "CRITICAL_FIELD_ACCURACY_BELOW_THRESHOLD",
      "CRITICAL_UNSUPPORTED_CLAIMS_PRESENT",
      "NON_CRITICAL_UNSUPPORTED_CLAIMS_TOO_HIGH",
      "SEEDED_HIGH_RISK_RECALL_BELOW_THRESHOLD",
      "MISSED_CRITICAL_RISK_PRESENT",
      "REPRESENTATIVE_CASE_COUNT_BELOW_100"
    ]
  });
});
