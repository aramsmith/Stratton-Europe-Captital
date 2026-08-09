import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test("Phase 5 OpenAPI declares no investment-decision or committee-submission operation", async ({
  page
}) => {
  const openApi = await readFile(
    path.resolve("..", "5-coding-r4", "app", "openapi", "stratton-openapi-3.1.yaml"),
    "utf8"
  );
  const declaredPaths = [...openApi.matchAll(/^  (\/[^:]+):$/gmu)].map((match) => match[1]);
  const operationIds = [...openApi.matchAll(/^\s+operationId:\s*(\S+)$/gmu)].map(
    (match) => match[1]
  );
  const normalizedManifest = [...declaredPaths, ...operationIds]
    .join("\n")
    .replace(/[^a-z]/giu, "")
    .toLowerCase();
  expect(normalizedManifest).not.toContain("investmentdecision");
  expect(normalizedManifest).not.toContain("committeesubmission");

  await page.goto("/decision-room");
  await expect(page.getByRole("button", { name: /approve investment/i })).toHaveCount(0);
  await expect(page.getByText("It cannot issue an investment decision.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit to committee" })).toBeDisabled();
});

test("client-controlled authority headers are rejected", async ({ request }) => {
  const response = await request.post("/api/recommendation/prepare", {
    data: { caseId: "project-danube" },
    headers: {
      "x-demo-principal-type": "HUMAN",
      "x-demo-actor-id": "spoofed-committee-chair"
    }
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    code: "INVALID_CONTRACT",
    message: "CLIENT_AUTHORITY_HEADERS_NOT_ALLOWED"
  });
});
