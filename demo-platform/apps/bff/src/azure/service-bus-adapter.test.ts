import { describe, expect, it, vi } from "vitest";
import { createRedactedLogger } from "../telemetry/redacted-logger.js";
import { createServiceBusAdapter } from "./service-bus-adapter.js";

describe("createServiceBusAdapter", () => {
  it("logs only safe metadata while preserving the full queued payload", async () => {
    const entries: unknown[] = [];
    const sender = {
      sendMessages: vi.fn().mockResolvedValue(undefined)
    };
    const payload = {
      caseId: "project-danube",
      evidenceId: "evidence-board-pack",
      layout: {
        content: "DOCUMENT_LAYOUT_CONTENT_SHOULD_NOT_BE_LOGGED",
        promptBody: "PROMPT_BODY_SHOULD_NOT_BE_LOGGED",
        completionBody: "COMPLETION_BODY_SHOULD_NOT_BE_LOGGED",
        nested: {
          rawDocumentPayload: "RAW_DOCUMENT_BODY_SHOULD_NOT_BE_LOGGED"
        }
      },
      output: {
        summary: "MODEL_OUTPUT_SHOULD_NOT_BE_LOGGED",
        citations: [
          {
            excerpt: "CITATION_EXCERPT_SHOULD_NOT_BE_LOGGED"
          }
        ]
      },
      accessToken: "ACCESS_TOKEN_SHOULD_NOT_BE_LOGGED",
      clientSecret: "CLIENT_SECRET_SHOULD_NOT_BE_LOGGED"
    };
    const adapter = createServiceBusAdapter({
      namespace: "stratton.servicebus.windows.net",
      queueName: "analysis-work",
      sender,
      logger: createRedactedLogger({
        now: () => "2026-08-06T19:10:00.000Z",
        sink: (entry) => entries.push(entry)
      })
    });

    await adapter.publish({
      tenantId: "tenant-stratton-demo",
      caseId: "project-danube",
      messageId: "msg-1",
      correlationId: "corr-1",
      subject: "evidence.admitted",
      payload
    });

    expect(sender.sendMessages).toHaveBeenCalledWith({
      body: payload,
      messageId: "msg-1",
      correlationId: "corr-1",
      sessionId: "tenant-stratton-demo:project-danube",
      subject: "evidence.admitted",
      applicationProperties: {
        tenantId: "tenant-stratton-demo",
        caseId: "project-danube"
      }
    });

    expect(entries).toEqual([
      expect.objectContaining({
        timestamp: "2026-08-06T19:10:00.000Z",
        level: "INFO",
        event: "azure.servicebus.publish",
        data: expect.objectContaining({
          tenantId: "tenant-stratton-demo",
          caseId: "project-danube",
          messageId: "msg-1",
          correlationId: "corr-1",
          subject: "evidence.admitted",
          payloadKind: "object",
          payloadBytes: expect.any(Number),
          payloadPropertyCount: expect.any(Number)
        })
      })
    ]);

    const loggedJson = JSON.stringify(entries[0]);
    expect(loggedJson).not.toContain("DOCUMENT_LAYOUT_CONTENT_SHOULD_NOT_BE_LOGGED");
    expect(loggedJson).not.toContain("RAW_DOCUMENT_BODY_SHOULD_NOT_BE_LOGGED");
    expect(loggedJson).not.toContain("MODEL_OUTPUT_SHOULD_NOT_BE_LOGGED");
    expect(loggedJson).not.toContain("COMPLETION_BODY_SHOULD_NOT_BE_LOGGED");
    expect(loggedJson).not.toContain("PROMPT_BODY_SHOULD_NOT_BE_LOGGED");
    expect(loggedJson).not.toContain("ACCESS_TOKEN_SHOULD_NOT_BE_LOGGED");
    expect(loggedJson).not.toContain("CLIENT_SECRET_SHOULD_NOT_BE_LOGGED");
    expect(loggedJson).not.toContain('"payload"');
  });
});
