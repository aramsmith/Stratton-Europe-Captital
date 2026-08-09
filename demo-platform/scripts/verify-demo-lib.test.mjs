import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const tempRoot = path.resolve("scripts", ".verify-demo-test-work");
await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });
const { runVerificationSequence, verificationCommands } = await import(
  new URL("./verify-demo-lib.mjs", import.meta.url)
);
let repoSequence = 0;

async function withTempRepo(run) {
  repoSequence += 1;
  const repoDir = path.join(tempRoot, `repo-${repoSequence}`);
  await mkdir(repoDir, { recursive: true });
  await mkdir(path.join(repoDir, "infra"), { recursive: true });
  try {
    await run(repoDir);
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
}

const silentLogger = { log() {}, error() {} };

test("verification builds shared package outputs before lint, typecheck, and tests", () => {
  assert.deepEqual(verificationCommands[1], {
    command: "npm",
    args: ["run", "build:packages"]
  });
});

test("verification runs Phase 5 validation before demo-platform commands from its own cwd", () => {
  assert.deepEqual(verificationCommands[0], {
    command: "npm",
    args: ["run", "validate"],
    cwd: "../5-coding-r4/app"
  });
  assert.deepEqual(verificationCommands[1], {
    command: "npm",
    args: ["run", "build:packages"]
  });
});

test("verification resolves a command cwd relative to the verification root", async () => {
  await withTempRepo(async (repoDir) => {
    const phase5Dir = path.join(repoDir, "5-coding-r4", "app");
    const scriptFile = path.join(repoDir, "write-cwd.mjs");
    const outputFile = path.join(phase5Dir, "cwd.txt");
    await mkdir(phase5Dir, { recursive: true });
    await writeFile(
      scriptFile,
      'import { writeFileSync } from "node:fs"; writeFileSync("cwd.txt", process.cwd());',
      "utf8"
    );

    await runVerificationSequence({
      cwd: repoDir,
      commands: [{ command: "node", args: [scriptFile], cwd: path.join("5-coding-r4", "app") }],
      logger: silentLogger
    });

    assert.equal(await readFile(outputFile, "utf8"), phase5Dir);
  });
});

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

test.after(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});
