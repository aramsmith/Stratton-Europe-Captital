import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const baseEvidenceTitles = [
  "FY25 Board Pack",
  "ERP Customer Rebate Export",
  "Quality of Earnings Report",
  "Czech Environmental Permit"
] as const;

async function resetProject(page: Page): Promise<void> {
  await page.goto("/workbench");
  await page.getByRole("button", { name: "Reset Project Danube" }).click();
  await expect(page.getByRole("dialog", { name: "Reset Project Danube" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm reset" }).click();
  await expect(page.getByText("INTAKE")).toBeVisible();
}

async function admitEvidence(page: Page): Promise<void> {
  for (const title of baseEvidenceTitles) {
    const row = page.getByRole("row", { name: new RegExp(title) });
    await row.getByRole("button", { name: "Admit evidence" }).click();
    await expect(row.getByText("ADMITTED")).toBeVisible();
  }
}

async function runHappyPathAnalysis(page: Page): Promise<void> {
  await page.getByLabel("Analysis task").selectOption("CROSS_DOCUMENT_COMPARISON");
  await page.getByLabel("Question").fill("Challenge management EBITDA quality");
  await page.getByRole("button", { name: "Run grounded analysis" }).click();
}

async function prepareCommitteePack(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Investment Decision Room" }).click();
  await expect(page.getByRole("heading", { name: "Investment Decision Room" })).toBeVisible();

  for (const reviewType of ["Deal", "Legal", "Compliance"] as const) {
    await page.getByRole("button", { name: `Approve ${reviewType} review` }).click();
  }

  await page.getByRole("button", { name: "Prepare committee pack" }).click();
  await expect(page.getByText(/Current scenario stage: COMMITTEE_PREPARATION\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit to committee" })).toBeDisabled();
}

async function driveScenarioToCommitteePreparation(page: Page): Promise<void> {
  await resetProject(page);
  await admitEvidence(page);
  await runHappyPathAnalysis(page);

  const ebitdaFinding = page.getByRole("article", { name: "Adjusted EBITDA quality" });
  await expect(ebitdaFinding.getByText("EUR 4.2–5.1 million")).toBeVisible();
  await expect(ebitdaFinding.getByText("3 citations")).toBeVisible();
  await ebitdaFinding.getByRole("button", { name: "Accept finding" }).click();

  const permitFinding = page.getByRole("article", { name: "Permit transfer readiness" });
  await permitFinding.getByRole("button", { name: "Accept finding" }).click();

  await prepareCommitteePack(page);
}

async function driveScenarioToReviewReadyViaApi(request: APIRequestContext): Promise<void> {
  const resetResponse = await request.post("/api/scenario/reset");
  expect(resetResponse.ok()).toBeTruthy();

  for (const evidenceId of [
    "evidence-board-pack",
    "evidence-erp-rebates",
    "evidence-qoe-report",
    "evidence-environmental-permit"
  ]) {
    const response = await request.post(`/api/evidence/${evidenceId}/admit`, {
      data: { caseId: "project-danube" }
    });
    expect(response.ok()).toBeTruthy();
  }

  const analysisResponse = await request.post("/api/analysis-runs", {
    data: {
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality"
    }
  });
  expect(analysisResponse.ok()).toBeTruthy();

  for (const findingId of ["finding-ebitda-quality", "finding-permit-transfer"]) {
    const response = await request.post(`/api/findings/${findingId}/disposition`, {
      data: {
        caseId: "project-danube",
        action: "ACCEPT"
      },
      headers: {
        "x-demo-principal-type": "HUMAN"
      }
    });
    expect(response.ok()).toBeTruthy();
  }
}

async function driveScenarioToCommitteePreparationViaApi(request: APIRequestContext): Promise<void> {
  await driveScenarioToReviewReadyViaApi(request);

  const scenarioResponse = await request.get("/api/scenario");
  const scenario = await scenarioResponse.json();
  const versionByFindingId = new Map(
    scenario.findings.map((finding: { findingId: string; textHistory: Array<{ versionId: string }> }) => [
      finding.findingId,
      finding.textHistory.at(-1)?.versionId ?? finding.findingId
    ])
  );

  for (const [reviewType, findingId] of [
    ["DEAL", "finding-ebitda-quality"],
    ["LEGAL", "finding-permit-transfer"],
    ["COMPLIANCE", "finding-ebitda-quality"]
  ] as const) {
    const response = await request.post(`/api/findings/${findingId}/reviews`, {
      data: {
        caseId: "project-danube",
        reviewType,
        decision: "APPROVED",
        rationale: `${reviewType} review confirms committee-pack readiness.`,
        subjectVersion: versionByFindingId.get(findingId)
      },
      headers: {
        "x-demo-principal-type": "HUMAN"
      }
    });
    expect(response.ok()).toBeTruthy();
  }

  const prepareResponse = await request.post("/api/recommendation/prepare", {
    data: { caseId: "project-danube" },
    headers: {
      "x-demo-principal-type": "HUMAN"
    }
  });
  expect(prepareResponse.ok()).toBeTruthy();
}

test.describe("Stratton evidence-to-decision demo", () => {
  test("Project Danube moves from evidence to committee preparation", async ({ page }) => {
    await driveScenarioToCommitteePreparation(page);

    await page.getByRole("link", { name: "Governance & Assurance Console" }).click();
    await expect(page.getByText("Internal Audit verdict: Not issued")).toBeVisible();
    await expect(page.getByRole("button", { name: /approve investment/i })).toHaveCount(0);
  });

  test("axe reports zero serious or critical violations on Workbench, Decision Room, and Governance", async ({ page, request }) => {
    await driveScenarioToCommitteePreparationViaApi(request);

    for (const route of ["/workbench", "/decision-room", "/governance"] as const) {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).exclude('[data-tabster-dummy]').analyze();
      const blockingViolations = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? "")
      );
      expect(blockingViolations, `${route} should not have serious or critical axe violations`).toEqual([]);
    }
  });

  test("keyboard-only flows reach navigation, citations, findings, reviews, tabs, and reset confirmation", async ({ page, request }) => {
    await driveScenarioToReviewReadyViaApi(request);

    await page.goto("/workbench");
    await page.getByRole("link", { name: "Skip to main content" }).focus();
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Reset Project Danube" })).toBeFocused();

    const workbenchLink = page.getByRole("link", { name: "AI Deal Workbench" });
    const decisionRoomLink = page.getByRole("link", { name: "Investment Decision Room" });
    const governanceLink = page.getByRole("link", { name: "Governance & Assurance Console" });
    await workbenchLink.focus();
    await expect(workbenchLink).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(decisionRoomLink).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(governanceLink).toBeFocused();

    await page.goto("/workbench");
    const ebitdaFinding = page.getByRole("article", { name: "Adjusted EBITDA quality" });
    const citationButtons = ebitdaFinding.getByRole("button", { name: /Open citation/i });
    await citationButtons.last().focus();
    await expect(citationButtons.last()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(ebitdaFinding.getByRole("button", { name: "Accept finding" })).toBeFocused();

    await page.goto("/decision-room");
    await page.getByRole("textbox", { name: "Deal review rationale" }).focus();
    await expect(page.getByRole("textbox", { name: "Deal review rationale" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Approve Deal review" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("textbox", { name: "Legal review rationale" })).toBeFocused();

    await page.goto("/governance");
    await page.getByRole("tab", { name: "Lineage" }).focus();
    await expect(page.getByRole("tab", { name: "Lineage" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Policy decisions" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Model routes" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Security & audit" })).toBeFocused();

    await page.goto("/workbench");
    await page.getByRole("button", { name: "Reset Project Danube" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Reset Project Danube" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm reset" })).toBeFocused();
  });
});
