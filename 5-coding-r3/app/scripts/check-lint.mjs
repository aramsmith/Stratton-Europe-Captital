import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd(), "src");
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (full.endsWith(".ts")) {
      files.push(full);
    }
  }
}

walk(root);

for (const file of files) {
  const content = readFileSync(file, "utf8");
  if (content.includes("TODO")) {
    throw new Error(`TODO_NOT_ALLOWED:${file}`);
  }
  if (/\bany\b/.test(content)) {
    throw new Error(`ANY_TYPE_NOT_ALLOWED:${file}`);
  }
  if (/http:\/\//i.test(content)) {
    throw new Error(`INSECURE_HTTP_REFERENCE:${file}`);
  }
}

console.log("lint checks passed");
