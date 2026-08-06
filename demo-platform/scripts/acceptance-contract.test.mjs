import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

async function readRepoFile(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("Playwright acceptance config always starts fresh LOCAL-only servers", async () => {
  const configText = await readRepoFile("playwright.config.ts");

  assert.equal((configText.match(/reuseExistingServer:\s*false/g) ?? []).length, 2);
  assert.equal(configText.includes("reuseExistingServer: !process.env.CI"), false);
  assert.equal((configText.match(/DEMO_MODE:\s*"LOCAL"/g) ?? []).length >= 2, true);
});

test("production packaging includes a same-origin web proxy and immutable container entrypoints", async () => {
  const webPackage = JSON.parse(await readRepoFile(path.join("apps", "web", "package.json")));
  const webDockerfile = await readRepoFile(path.join("apps", "web", "Dockerfile"));
  const bffDockerfile = await readRepoFile(path.join("apps", "bff", "Dockerfile"));

  assert.equal(webPackage.scripts.start, "node dist/server/server.js");
  assert.match(webDockerfile, /npm run build --workspace @stratton\/demo-web/);
  assert.match(webDockerfile, /"start", "--workspace", "@stratton\/demo-web"/);
  assert.match(bffDockerfile, /npm run build --workspace @stratton\/demo-bff/);
  assert.match(bffDockerfile, /"node", "apps\/bff\/dist\/server\.js"/);
  assert.doesNotMatch(webDockerfile, /:latest\b/);
  assert.doesNotMatch(bffDockerfile, /:latest\b/);
});

test("keyboard-only acceptance coverage does not use focus or pointer shortcuts", async () => {
  const specText = await readRepoFile(path.join("tests", "e2e", "evidence-to-decision.spec.ts"));
  const marker = 'test("keyboard-only flows reach navigation, citations, findings, reviews, tabs, and reset confirmation"';
  const startIndex = specText.indexOf(marker);
  assert.notEqual(startIndex, -1, "keyboard-only test block should exist");
  const keyboardBlock = specText.slice(startIndex);

  for (const forbiddenToken of [".focus(", ".click(", ".hover(", "page.mouse", "locator.evaluate", "page.evaluate"]) {
    assert.equal(
      keyboardBlock.includes(forbiddenToken),
      false,
      `keyboard-only test must not contain ${forbiddenToken}`
    );
  }

  assert.equal(keyboardBlock.includes('pressKeyTimes(page, "Tab"'), true);
  assert.equal(keyboardBlock.includes('page.keyboard.press("Arrow'), true);
  assert.equal(keyboardBlock.includes('page.keyboard.press("Enter")'), true);
});
