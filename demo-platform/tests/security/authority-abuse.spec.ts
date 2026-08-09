import { expect, test } from "@playwright/test";

test("no investment-decision action exists", async ({ page, request }) => {
  const resetResponse = await request.post("/api/scenario/reset");
  expect(resetResponse.ok()).toBeTruthy();

  const investmentDecisionResponse = await request.post("/api/investment-decisions", {
    data: { caseId: "project-danube" }
  });
  expect(investmentDecisionResponse.status()).toBe(404);

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
