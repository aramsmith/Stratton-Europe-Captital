import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dockerfiles = ["Dockerfile.api", "Dockerfile.worker", "Dockerfile.bootstrap"];

for (const file of dockerfiles) {
  const fullPath = resolve(process.cwd(), file);
  const content = readFileSync(fullPath, "utf8");

  if (content.includes("__REQUIRED_DIGEST__")) {
    throw new Error(`BASE_IMAGE_DIGEST_SENTINEL_NOT_RESOLVED:${file}`);
  }

  if (!/@sha256:[a-f0-9]{64}/i.test(content)) {
    throw new Error(`BASE_IMAGE_DIGEST_NOT_PINNED:${file}`);
  }

  if (!/user\s+(?:nonroot|65532(?::65532)?)/i.test(content)) {
    throw new Error(`NON_ROOT_RUNTIME_USER_MISSING:${file}`);
  }
}

console.log("docker digest checks passed");
