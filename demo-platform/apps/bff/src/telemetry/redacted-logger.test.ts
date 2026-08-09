import { describe, expect, it } from "vitest";
import { createRedactedLogger, redact } from "./redacted-logger.js";

describe("redact", () => {
  it("redacts nested bodies, tokens, and secrets without mutating safe fields", () => {
    const payload = {
      armToken: "arm-token-value",
      phase5Token: "phase5-token-value",
      promptBody: "very secret prompt",
      Authorization: "Bearer super-secret",
      nested: {
        rawDocumentPayload: "raw document body",
        accessToken: "token-value",
        safe: "kept"
      },
      items: [
        {
          clientSecret: "secret-value",
          locator: "page 42"
        }
      ],
      parserFailure: new Error("raw completion fragment")
    };

    expect(redact(payload)).toEqual({
      armToken: "[REDACTED]",
      phase5Token: "[REDACTED]",
      promptBody: "[REDACTED]",
      Authorization: "[REDACTED]",
      nested: {
        rawDocumentPayload: "[REDACTED]",
        accessToken: "[REDACTED]",
        safe: "kept"
      },
      items: [
        {
          clientSecret: "[REDACTED]",
          locator: "page 42"
        }
      ],
      parserFailure: "[REDACTED_ERROR]"
    });
  });
});

describe("createRedactedLogger", () => {
  it("emits structured entries with redacted payloads", () => {
    const entries: unknown[] = [];
    const logger = createRedactedLogger({
      now: () => "2026-08-06T18:57:34.105Z",
      sink: (entry) => {
        entries.push(entry);
      }
    });

    logger.info("azure.openai.request", {
      correlationId: "corr-1",
      promptBody: "sensitive",
      completionBody: "should-not-appear"
    });

    expect(entries).toEqual([
      {
        timestamp: "2026-08-06T18:57:34.105Z",
        level: "INFO",
        event: "azure.openai.request",
        data: {
          correlationId: "corr-1",
          promptBody: "[REDACTED]",
          completionBody: "[REDACTED]"
        }
      }
    ]);
  });
});
