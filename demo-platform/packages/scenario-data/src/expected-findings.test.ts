import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

type ExpectedFindingsFile = {
  caseId: "project-danube";
  generatedAtIso: string;
  findings: Array<{
    findingId: string;
    title: string;
    summary: string;
    materiality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    status: "DRAFT" | "ACCEPTED" | "CHALLENGED" | "REJECTED";
    route?: "LUNA" | "TERRA" | "SOL";
    citations: Array<{
      citationId: string;
      evidenceId: string;
      locator: string;
      accessible: true;
    }>;
  }>;
  reviewGates: string[];
};

const expectedFindingsUrl = new URL("../expected/findings.json", import.meta.url);

const evidenceFixtures = {
  "evidence-board-pack": new URL("../evidence/fy25-board-pack.txt", import.meta.url),
  "evidence-erp-rebates": new URL("../evidence/erp-rebate-export.csv", import.meta.url),
  "evidence-qoe-report": new URL("../evidence/qoe-report.txt", import.meta.url)
} as const;

const canonicalFinding = {
  findingId: "finding-ebitda-quality",
  title: "Adjusted EBITDA quality",
  summary: "Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million.",
  materiality: "HIGH",
  status: "DRAFT",
  route: "TERRA",
  citations: [
    {
      citationId: "citation-board-pack-42",
      evidenceId: "evidence-board-pack",
      locator: "page 42",
      accessible: true
    },
    {
      citationId: "citation-erp-812-886",
      evidenceId: "evidence-erp-rebates",
      locator: "rows 812-886",
      accessible: true
    },
    {
      citationId: "citation-qoe-18",
      evidenceId: "evidence-qoe-report",
      locator: "page 18",
      accessible: true
    }
  ]
} satisfies ExpectedFindingsFile["findings"][number];

function resolveLocator(content: string, locator: string): void {
  const pageMatch = /^page (\d+)$/i.exec(locator);
  if (pageMatch) {
    expect(content).toContain(`Page ${pageMatch[1]}`);
    return;
  }

  const rowMatch = /^rows (\d+)-(\d+)$/i.exec(locator);
  if (rowMatch) {
    const start = Number(rowMatch[1]);
    const end = Number(rowMatch[2]);
    const lines = content.trimEnd().split(/\r?\n/);

    expect(lines.length).toBeGreaterThanOrEqual(end);
    expect(lines[start - 1]?.trim()).not.toBe("");
    expect(lines[end - 1]?.trim()).not.toBe("");
    return;
  }

  throw new Error(`Unsupported locator: ${locator}`);
}

describe("expected findings", () => {
  it("encodes the canonical EBITDA finding", async () => {
    const expected = JSON.parse(await readFile(expectedFindingsUrl, "utf8")) as ExpectedFindingsFile;

    expect(expected.caseId).toBe("project-danube");
    expect(expected.findings).toEqual([canonicalFinding]);
  });

  it.each(Object.entries(evidenceFixtures))("resolves %s citations", async (evidenceId, url) => {
    const expected = JSON.parse(await readFile(expectedFindingsUrl, "utf8")) as ExpectedFindingsFile;
    const finding = expected.findings[0];
    const citation = finding.citations.find((item) => item.evidenceId === evidenceId);

    expect(citation).toBeDefined();

    const content = await readFile(url, "utf8");
    resolveLocator(content, citation!.locator);

    if (evidenceId === "evidence-board-pack") {
      expect(content).toContain("Management normalization assumes customer rebates of EUR 4.2 million");
      expect(content).toContain("ERP control total is EUR 5.1 million");
    }

    if (evidenceId === "evidence-erp-rebates") {
      const lines = content.trimEnd().split(/\r?\n/);

      expect(lines).toHaveLength(886);
      expect(lines[811]).toContain("00812");
      expect(lines[885]).toContain("Rows 812-885 total exactly EUR 5,100,000.00");
    }

    if (evidenceId === "evidence-qoe-report") {
      expect(content).toContain("EUR 4.2 million of recurring operating costs were booked as one-off EBITDA adjustments");
      expect(content).toContain("Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million");
    }
  });
});
