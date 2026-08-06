import { expect, test } from "@playwright/test";

test("cross-case requests are denied with POLICY_DENIED", async ({ request }) => {
  const resetResponse = await request.post("/api/scenario/reset");
  expect(resetResponse.ok()).toBeTruthy();

  const response = await request.post("/api/evidence/evidence-board-pack/admit", {
    data: { caseId: "project-vltava" }
  });

  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toMatchObject({
    code: "POLICY_DENIED"
  });

  const governanceResponse = await request.get("/api/governance");
  const governance = await governanceResponse.json();
  expect(governance.policyDecisions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        result: "DENY",
        reasonCodes: expect.arrayContaining(["project-vltava"])
      })
    ])
  );
  expect(governance.securityGates).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        gateId: "CC002-R2-SEC-GATE-006",
        outcome: "FAIL"
      })
    ])
  );
});
