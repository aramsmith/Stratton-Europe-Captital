import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd(), ".");
const targets = [
  resolve(root, "src"),
  resolve(root, "scripts"),
  resolve(root, "openapi"),
  resolve(root, "migrations"),
  resolve(root, "..", "tests", "app")
];
const extensions = new Set([".ts", ".mjs", ".yaml", ".sql", ".json"]);

function walk(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    const extension = full.slice(full.lastIndexOf("."));
    if (!extensions.has(extension)) {
      continue;
    }
    const content = readFileSync(full, "utf8");
    const lines = content.replaceAll("\r\n", "\n").split("\n");
    lines.forEach((line, index) => {
      if (/[ \t]+$/.test(line)) {
        throw new Error(`TRAILING_WHITESPACE:${full}:${index + 1}`);
      }
    });
  }
}

for (const target of targets) {
  walk(target);
}

console.log("format check passed");
