import DocumentIntelligence, {
  getLongRunningPoller,
  isUnexpected
} from "@azure-rest/ai-document-intelligence";
import { z } from "zod";
import { DemoHttpError } from "../errors.js";
import {
  createRedactedLogger,
  type RedactedLogger
} from "../telemetry/redacted-logger.js";
import { createManagedIdentityCredential } from "./managed-identity.js";

const documentAnalysisSchema = z
  .object({
    content: z.string().trim().min(1),
    contentFormat: z.enum(["text", "markdown"]).default("markdown"),
    modelId: z.literal("prebuilt-layout"),
    pageCount: z.number().int().min(0)
  })
  .strict();

interface CreateDocumentIntelligenceAdapterOptions {
  readonly endpoint: string;
  readonly managedIdentityClientId?: string;
  readonly client?: ReturnType<typeof DocumentIntelligence>;
  readonly logger?: RedactedLogger;
}

export function createDocumentIntelligenceAdapter(
  options: CreateDocumentIntelligenceAdapterOptions
) {
  const logger =
    options.logger ?? createRedactedLogger().child({ adapter: "document-intelligence" });
  const client =
    options.client ??
    DocumentIntelligence(
      options.endpoint,
      createManagedIdentityCredential(options.managedIdentityClientId)
    );

  return {
    async analyseLayout(input: {
      documentBodyBase64: string;
      locale?: string;
      correlationId?: string;
    }): Promise<z.infer<typeof documentAnalysisSchema>> {
      logger.info("azure.document-intelligence.request", {
        correlationId: input.correlationId,
        rawDocumentPayload: input.documentBodyBase64,
        locale: input.locale
      });

      const initialResponse = await client
        .path("/documentModels/{modelId}:analyze", "prebuilt-layout")
        .post({
          contentType: "application/json",
          body: {
            base64Source: input.documentBodyBase64
          },
          queryParameters: {
            ...(input.locale ? { locale: input.locale } : {}),
            outputContentFormat: "markdown"
          }
        });

      if (isUnexpected(initialResponse)) {
        throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "DOCUMENT_INTELLIGENCE_UNAVAILABLE");
      }

      const poller = getLongRunningPoller(client, initialResponse);
      const result = await poller.pollUntilDone();

      if (isUnexpected(result)) {
        throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "DOCUMENT_INTELLIGENCE_UNAVAILABLE");
      }

      const analyzeResult = (result.body as { analyzeResult?: { content?: string; contentFormat?: "text" | "markdown"; pages?: unknown[] } })
        .analyzeResult;

      return documentAnalysisSchema.parse({
        content: analyzeResult?.content ?? "",
        contentFormat: analyzeResult?.contentFormat ?? "markdown",
        modelId: "prebuilt-layout",
        pageCount: analyzeResult?.pages?.length ?? 0
      });
    }
  };
}
