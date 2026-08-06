import { expect, test } from "@playwright/test";

test("no investment-decision action exists", async ({ page, request }) => {
  const resetResponse = await request.post("/api/scenario/reset");
  expect(resetResponse.ok()).toBeTruthy();

  await page.goto("/decision-room");
  await expect(page.getByRole("button", { name: /approve investment/i })).toHaveCount(0);
  await expect(page.getByText("It cannot issue an investment decision.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit to committee" })).toBeDisabled();
});
