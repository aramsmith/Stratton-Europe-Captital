import { rm } from "node:fs/promises";
import path from "node:path";

export const generatedOutputPaths = Object.freeze([
  path.join("packages", "contracts", "dist"),
  path.join("packages", "scenario-data", "dist"),
  path.join("apps", "bff", "dist"),
  path.join("apps", "web", "dist"),
  path.join("apps", "web", "dist-server"),
  "playwright-report",
  "test-results",
  "coverage",
  path.join("infra", "main.json"),
  path.join("infra", "parameters", "dev.parameters.json")
]);

export async function cleanGeneratedOutputs(rootDirectory = process.cwd()) {
  const root = path.resolve(rootDirectory);
  for (const relativePath of generatedOutputPaths) {
    const outputPath = path.resolve(root, relativePath);
    if (outputPath !== root && !outputPath.startsWith(`${root}${path.sep}`)) {
      throw new Error(`Generated output path escapes the workspace: ${relativePath}`);
    }
    await rm(outputPath, { recursive: true, force: true });
  }
}
