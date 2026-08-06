import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

const appRoot = resolve(process.cwd(), "..", "app");
const distRoot = resolve(appRoot, "dist");
const scratchRoot = resolve(process.cwd(), "..", "tests", "app", "integration", ".runtime");

function launch(script: string, env: NodeJS.ProcessEnv) {
  return spawn(process.execPath, [script], {
    cwd: appRoot,
    env: { ...process.env, ...env },
    stdio: "pipe"
  });
}

async function waitForExit(child: ReturnType<typeof spawn>) {
  let stderr = "";
  if (child.stderr) {
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
  }
  const code = await new Promise<number | null>((resolveCode) => {
    child.on("exit", (value) => resolveCode(value));
  });
  return { code, stderr };
}

test("api production mode fails closed without Azure config", async () => {
  const child = launch(resolve(distRoot, "api-main.js"), {
    APP_ENV: "prd",
    ROLLOUT_ADMISSION_MAX: "20",
    LOG_LEVEL: "INFO",
    MODEL_PROVIDER_EVIDENCE_ID: "model",
    REGIONAL_DEPLOYMENT_EVIDENCE_ID: "region",
    PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt",
    API_PORT: "40101",
    API_RUNTIME_MODE: "production"
  });

  test("api production mode rejects blocked capability overrides", async () => {
    const child = launch(resolve(distRoot, "api-main.js"), {
      APP_ENV: "prd",
      ROLLOUT_ADMISSION_MAX: "20",
      LOG_LEVEL: "INFO",
      MODEL_PROVIDER_EVIDENCE_ID: "model",
      REGIONAL_DEPLOYMENT_EVIDENCE_ID: "region",
      PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt",
      API_PORT: "40102",
      API_RUNTIME_MODE: "production",
      ANALYSIS_CAPABILITY_ENABLED: "true"
    });
    const result = await waitForExit(child);
    assert.notEqual(result.code, 0);
    assert.equal(result.stderr.includes("BLOCKED_CAPABILITY_OVERRIDE"), true);
  });
  const result = await waitForExit(child);
  assert.notEqual(result.code, 0);
});

test("worker production mode fails closed without Azure config", async () => {
  const child = launch(resolve(distRoot, "worker-main.js"), {
    APP_ENV: "prd",
    ROLLOUT_ADMISSION_MAX: "20",
    LOG_LEVEL: "INFO",
    MODEL_PROVIDER_EVIDENCE_ID: "model",
    REGIONAL_DEPLOYMENT_EVIDENCE_ID: "region",
    PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt",
    WORKER_MODE: "production",
    WORKER_QUEUE_NAME: "q-ingestion"
  });

  test("worker production mode blocks unapproved analysis/vectorization/export queues", async () => {
    for (const queueName of ["q-analysis", "q-indexing", "q-audit-export"] as const) {
      const child = launch(resolve(distRoot, "worker-main.js"), {
        APP_ENV: "prd",
        ROLLOUT_ADMISSION_MAX: "20",
        LOG_LEVEL: "INFO",
        MODEL_PROVIDER_EVIDENCE_ID: "model",
        REGIONAL_DEPLOYMENT_EVIDENCE_ID: "region",
        PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt",
        WORKER_MODE: "production",
        WORKER_QUEUE_NAME: queueName
      });
      const result = await waitForExit(child);
      assert.notEqual(result.code, 0);
      const expected =
        queueName === "q-analysis"
          ? "BLOCKED_ANALYSIS_CONTRACT_UNAPPROVED"
          : queueName === "q-indexing"
            ? "BLOCKED_VECTORIZATION_CONTRACT_UNAPPROVED"
            : "BLOCKED_AUDIT_EXPORT_CONTRACT_UNAPPROVED";
      assert.equal(result.stderr.includes(expected), true);
    }
  });
  const result = await waitForExit(child);
  assert.notEqual(result.code, 0);
});

test("api test mode serves readiness and health", async () => {
  const port = 41000 + Math.floor(Math.random() * 1000);
  const child = launch(resolve(distRoot, "api-main.js"), {
    APP_ENV: "tst",
    ROLLOUT_ADMISSION_MAX: "20",
    LOG_LEVEL: "INFO",
    MODEL_PROVIDER_EVIDENCE_ID: "model",
    REGIONAL_DEPLOYMENT_EVIDENCE_ID: "region",
    PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt",
    API_PORT: `${port}`,
    API_RUNTIME_MODE: "test",
    ALLOW_TEST_ADAPTERS: "true"
  });
  try {
    let healthResponse: Response | undefined;
    let readinessResponse: Response | undefined;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
      try {
        healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
        readinessResponse = await fetch(`http://127.0.0.1:${port}/readiness`);
        break;
      } catch {
        continue;
      }
    }
    assert.ok(healthResponse);
    assert.ok(readinessResponse);
    assert.equal(healthResponse.status, 200);
    assert.equal(readinessResponse.status, 200);
  } finally {
    child.kill("SIGTERM");
    await waitForExit(child);
  }
});

test("worker test mode processes configured queue file", async () => {
  mkdirSync(scratchRoot, { recursive: true });
  const queueFile = join(scratchRoot, "queue.json");
  writeFileSync(
    queueFile,
    JSON.stringify([
      {
        messageId: "m1",
        tenantId: "tenant-a",
        caseId: "case-a",
        queueName: "q-ingestion",
        operation: "REQUEST_INGESTION",
        payloadReference: "blob://payload",
        idempotencyKey: "idem-1",
        correlationId: "corr-1",
        evidenceId: "ev-1"
      }
    ]),
    "utf8"
  );

  const child = launch(resolve(distRoot, "worker-main.js"), {
    APP_ENV: "tst",
    ROLLOUT_ADMISSION_MAX: "20",
    LOG_LEVEL: "INFO",
    MODEL_PROVIDER_EVIDENCE_ID: "model",
    REGIONAL_DEPLOYMENT_EVIDENCE_ID: "region",
    PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt",
    WORKER_MODE: "test",
    ALLOW_TEST_ADAPTERS: "true",
    WORKER_QUEUE_NAME: "q-ingestion",
    WORKER_TEST_QUEUE_FILE: queueFile,
    WORKER_MAX_CYCLES: "3",
    WORKER_RECEIVE_WAIT_MS: "5"
  });
  const result = await waitForExit(child);
  rmSync(scratchRoot, { recursive: true, force: true });
  assert.equal(result.code, 0, result.stderr);
});
