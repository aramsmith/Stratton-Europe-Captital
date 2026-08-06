import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "verify-demo-lib-"));
const { runVerificationSequence } = await import(new URL("./verify-demo-lib.mjs", import.meta.url));

async function withTempRepo(run) {
  const repoDir = await mkdtemp(path.join(tempRoot, "repo-"));
  await mkdir(path.join(repoDir, "infra"), { recursive: true });
  try {
    await run(repoDir);
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
}

const silentLogger = { log() {}, error() {} };

test("verification removes generated infra/main.json after a successful build step", async () => {
  await withTempRepo(async (repoDir) => {
    const outputFile = path.join(repoDir, "infra", "main.json");
    const scriptFile = path.join(repoDir, "success-script.mjs");
    await writeFile(
      scriptFile,
      'import { mkdirSync, writeFileSync } from "node:fs"; mkdirSync("infra", { recursive: true }); writeFileSync("infra/main.json", "generated");',
      "utf8"
    );

    await runVerificationSequence({
      cwd: repoDir,
      commands: [
        {
          command: "node",
          args: [scriptFile],
          cleanupGeneratedFile: path.join("infra", "main.json")
        }
      ],
      logger: silentLogger
    });

    await assert.rejects(stat(outputFile));
  });
});

test("verification removes generated infra/main.json after a failing build step and preserves the child exit code", async () => {
  await withTempRepo(async (repoDir) => {
    const outputFile = path.join(repoDir, "infra", "main.json");
    const scriptFile = path.join(repoDir, "failure-script.mjs");
    await writeFile(
      scriptFile,
      'import { mkdirSync, writeFileSync } from "node:fs"; mkdirSync("infra", { recursive: true }); writeFileSync("infra/main.json", "generated"); process.exit(23);',
      "utf8"
    );

    await assert.rejects(
      () =>
        runVerificationSequence({
          cwd: repoDir,
          commands: [
            {
              command: "node",
              args: [scriptFile],
              cleanupGeneratedFile: path.join("infra", "main.json")
            }
          ],
          logger: silentLogger
        }),
      (error) => error?.exitCode === 23
    );

    await assert.rejects(stat(outputFile));
  });
});

test("verification fails closed when infra/main.json already exists and leaves it untouched", async () => {
  await withTempRepo(async (repoDir) => {
    const outputFile = path.join(repoDir, "infra", "main.json");
    const scriptFile = path.join(repoDir, "noop-script.mjs");
    await writeFile(scriptFile, 'process.exit(0);', "utf8");
    await writeFile(outputFile, "user-owned-content", "utf8");

    await assert.rejects(
      () =>
        runVerificationSequence({
          cwd: repoDir,
          commands: [
            {
              command: "node",
              args: [scriptFile],
              cleanupGeneratedFile: path.join("infra", "main.json")
            }
          ],
          logger: silentLogger
        }),
      (error) => /already exists/i.test(String(error?.message)) && error?.exitCode === 1
    );

    assert.equal(await readFile(outputFile, "utf8"), "user-owned-content");
  });
});
