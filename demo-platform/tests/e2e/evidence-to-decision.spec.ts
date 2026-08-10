import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const remoteBaseUrl = process.env.STRATTON_E2E_BASE_URL;
const remoteSessionStorageStatePath =
  process.env.STRATTON_E2E_SESSION_STORAGE_STATE;

function readRemoteSessionStorageState(): Readonly<Record<string, string>> | undefined {
  if (!remoteBaseUrl) {
    return undefined;
  }
  if (!remoteSessionStorageStatePath) {
    throw new Error("PLAYWRIGHT_AUTH_SESSION_STORAGE_STATE_REQUIRED");
  }

  try {
    const parsed: unknown = JSON.parse(
      readFileSync(remoteSessionStorageStatePath, "utf8")
    );
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      Object.values(parsed).some((value) => typeof value !== "string")
    ) {
      throw new Error("INVALID");
    }
    return parsed as Readonly<Record<string, string>>;
  } catch {
    throw new Error("PLAYWRIGHT_AUTH_SESSION_STORAGE_STATE_INVALID");
  }
}

const remoteSessionStorageState = readRemoteSessionStorageState();

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
  await page.getByRole("link", { name: "Governance & Assurance Console" }).click();
  await page.getByRole("tab", { name: "Security & audit" }).click();
  await page.getByRole("button", { name: "Run security gate checks" }).click();
  await expect(page.getByText("CC002-R2-SEC-GATE-012")).toBeVisible();
  await expect(page.getByRole("cell", { name: "PASS" })).toHaveCount(12);

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

async function admitBaselineEvidenceViaApi(request: APIRequestContext): Promise<void> {
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
}

async function driveScenarioToAnalysisDraftViaApi(request: APIRequestContext): Promise<void> {
  await admitBaselineEvidenceViaApi(request);

  const analysisResponse = await request.post("/api/analysis-runs", {
    data: {
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality"
    }
  });
  expect(analysisResponse.ok()).toBeTruthy();
}

async function driveScenarioToReviewReadyViaApi(request: APIRequestContext): Promise<void> {
  await driveScenarioToAnalysisDraftViaApi(request);

  for (const findingId of ["finding-ebitda-quality", "finding-permit-transfer"]) {
    const response = await request.post(`/api/findings/${findingId}/disposition`, {
      data: {
        caseId: "project-danube",
        action: "ACCEPT"
      }
    });
    expect(response.ok()).toBeTruthy();
  }
}

async function driveScenarioToCommitteePreparationViaApi(request: APIRequestContext): Promise<void> {
  await driveScenarioToReviewReadyViaApi(request);
  const gateResponse = await request.post("/api/governance/security-gates/run", {
    data: { caseId: "project-danube" }
  });
  expect(gateResponse.ok()).toBeTruthy();

  const scenarioResponse = await request.get("/api/scenario");
  const scenario = await scenarioResponse.json();
  const subjectVersion = scenario.analysisAuthority?.subjectVersion;
  expect(typeof subjectVersion).toBe("string");
  expect(subjectVersion).not.toHaveLength(0);

  for (const [reviewType, findingId] of [
    ["DEAL", "finding-ebitda-quality"],
    ["LEGAL", "finding-permit-transfer"],
    ["COMPLIANCE", "finding-permit-transfer"]
  ] as const) {
    const response = await request.post(`/api/findings/${findingId}/reviews`, {
      data: {
        caseId: "project-danube",
        reviewType,
        decision: "APPROVED",
        rationale: `${reviewType} review confirms committee-pack readiness.`,
        subjectVersion
      }
    });
    expect(response.ok()).toBeTruthy();
  }

  const prepareResponse = await request.post("/api/recommendation/prepare", {
    data: { caseId: "project-danube" }
  });
  expect(prepareResponse.ok()).toBeTruthy();
}

async function pressKeyTimes(page: Page, key: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press(key);
  }
}

test.describe("Stratton evidence-to-decision demo", () => {
  test.beforeEach(async ({ page }) => {
    if (!remoteBaseUrl || !remoteSessionStorageState) {
      return;
    }
    await page.addInitScript(
      ({ origin, entries }) => {
        if (window.location.origin !== origin) {
          return;
        }
        for (const [name, value] of Object.entries(entries)) {
          window.sessionStorage.setItem(name, value);
        }
      },
      {
        origin: new URL(remoteBaseUrl).origin,
        entries: remoteSessionStorageState
      }
    );
  });

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
    await driveScenarioToAnalysisDraftViaApi(request);

    await page.goto("/workbench");
    await expect(page.getByRole("heading", { name: "AI Deal Workbench" })).toBeVisible();
    await pressKeyTimes(page, "Tab", 1);
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await pressKeyTimes(page, "Tab", 1);
    await expect(page.getByRole("button", { name: "Reset Project Danube" })).toBeFocused();
    await pressKeyTimes(page, "Tab", 1);
    await expect(page.getByRole("button", { name: /^Stratton demos$/ })).toBeFocused();
    await pressKeyTimes(page, "Tab", 1);
    await expect(page.getByRole("button", { name: /^Project Danube$/ })).toBeFocused();
    await pressKeyTimes(page, "Tab", 1);
    await expect(page.getByRole("button", { name: /^AI Deal Workbench$/ })).toBeFocused();
    await pressKeyTimes(page, "Tab", 1);
    await expect(page.getByRole("link", { name: "AI Deal Workbench" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("link", { name: "Investment Decision Room" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("link", { name: "Governance & Assurance Console" })).toBeFocused();

    await page.goto("/workbench");
    const ebitdaFinding = page.getByRole("article", { name: "Adjusted EBITDA quality" });
    await expect(ebitdaFinding).toBeVisible();
    await pressKeyTimes(page, "Tab", 9);
    await expect(ebitdaFinding.getByRole("button", { name: "Open citation page 42" })).toBeFocused();
    await page.keyboard.press("Enter");
    const citationPanel = page.getByRole("region", { name: "Citation detail" });
    await expect(citationPanel.getByText("page 42", { exact: true })).toBeVisible();
    await expect(citationPanel.getByText("FY25 Board Pack")).toBeVisible();
    await pressKeyTimes(page, "Tab", 3);
    await expect(ebitdaFinding.getByRole("button", { name: "Accept finding" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(ebitdaFinding.getByText("ACCEPTED")).toBeVisible();

    await driveScenarioToReviewReadyViaApi(request);
    await page.goto("/decision-room");
    await expect(page.getByRole("heading", { name: "Investment Decision Room" })).toBeVisible();
    await pressKeyTimes(page, "Tab", 7);
    await expect(page.getByRole("textbox", { name: "Deal review rationale" })).toBeFocused();
    await pressKeyTimes(page, "Tab", 1);
    await expect(page.getByRole("button", { name: "Approve Deal review" })).toBeFocused();
    await pressKeyTimes(page, "Tab", 1);
    await expect(page.getByRole("textbox", { name: "Legal review rationale" })).toBeFocused();

    await driveScenarioToCommitteePreparationViaApi(request);
    await page.goto("/governance");
    await expect(page.getByRole("heading", { name: "Governance & Assurance Console" })).toBeVisible();
    await pressKeyTimes(page, "Tab", 7);
    await expect(page.getByRole("tab", { name: "Lineage" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Policy decisions" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Model routes" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Security & audit" })).toBeFocused();

    await page.goto("/workbench");
    await expect(page.getByRole("heading", { name: "AI Deal Workbench" })).toBeVisible();
    await pressKeyTimes(page, "Tab", 2);
    await expect(page.getByRole("button", { name: "Reset Project Danube" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Reset Project Danube" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm reset" })).toBeFocused();
  });
});
