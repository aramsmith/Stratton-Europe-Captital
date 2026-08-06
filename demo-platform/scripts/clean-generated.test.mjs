import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  cleanGeneratedOutputs,
  generatedOutputPaths
} from "./clean-generated-lib.mjs";

const workspace = path.resolve("scripts", ".clean-generated-test-work");

test("clean generated output removes only the allowlisted workspace outputs", async () => {
  await rm(workspace, { recursive: true, force: true });
  await mkdir(workspace, { recursive: true });
  try {
    const sentinel = path.join(workspace, "user-authored.txt");
    await writeFile(sentinel, "preserve", "utf8");

    for (const relativePath of generatedOutputPaths) {
      const outputPath = path.join(workspace, relativePath);
      await mkdir(path.dirname(outputPath), { recursive: true });
      if (path.extname(outputPath)) {
        await writeFile(outputPath, "generated", "utf8");
      } else {
        await mkdir(outputPath, { recursive: true });
        await writeFile(path.join(outputPath, "artifact.txt"), "generated", "utf8");
      }
    }

    await cleanGeneratedOutputs(workspace);

    for (const relativePath of generatedOutputPaths) {
      await assert.rejects(stat(path.join(workspace, relativePath)));
    }
    assert.equal(await readFile(sentinel, "utf8"), "preserve");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
