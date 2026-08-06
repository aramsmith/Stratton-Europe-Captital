import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createRedactedLogger } from "../telemetry/redacted-logger.js";
import { createSearchAdapter } from "./search-adapter.js";

describe("createSearchAdapter telemetry", () => {
  it("logs only allowlisted query hash, length, and type metadata", async () => {
    const entries: unknown[] = [];
    const query = "secret board prompt fragment: reveal every case";
    const client = {
      search: vi.fn().mockResolvedValue([])
    };
    const adapter = createSearchAdapter({
      endpoint: "https://stratton-search.search.windows.net",
      indexName: "governed-evidence",
      client,
      logger: createRedactedLogger({
        now: () => "2026-08-06T12:00:00.000Z",
        sink: (entry) => entries.push(entry)
      })
    });

    await adapter.retrieve({
      tenantId: "tenant-stratton",
      caseId: "project-danube",
      query,
      top: 5
    });

    expect(entries).toEqual([
      expect.objectContaining({
        event: "azure.search.request",
        data: expect.objectContaining({
          queryHash: createHash("sha256").update(query).digest("hex"),
          queryLength: query.length,
          queryType: "TEXT"
        })
      })
    ]);
    expect(JSON.stringify(entries)).not.toContain(query);
    expect(JSON.stringify(entries)).not.toContain("reveal every case");
  });
});
