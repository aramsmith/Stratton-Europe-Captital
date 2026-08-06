import { SearchClient } from "@azure/search-documents";
import { z } from "zod";
import { DemoHttpError } from "../errors.js";
import {
  createRedactedLogger,
  type RedactedLogger
} from "../telemetry/redacted-logger.js";
import { createManagedIdentityCredential } from "./managed-identity.js";

const searchDocumentSchema = z
  .object({
    tenantId: z.string().trim().min(1),
    caseId: z.string().trim().min(1),
    chunkId: z.string().trim().min(1),
    evidenceId: z.string().trim().min(1),
    content: z.string().trim().min(1),
    locator: z.string().trim().min(1).optional(),
    admissionStatus: z.literal("ADMITTED"),
    accessibleAtReview: z.literal(true)
  })
  .strict();

export type SearchEvidenceChunk = z.infer<typeof searchDocumentSchema>;

interface SearchExecutionClient {
  search(
    searchText: string,
    options: { filter: string; top: number }
  ): Promise<readonly SearchEvidenceChunk[]>;
}

interface CreateSearchAdapterOptions {
  readonly endpoint: string;
  readonly indexName: string;
  readonly managedIdentityClientId?: string;
  readonly client?: SearchExecutionClient;
  readonly logger?: RedactedLogger;
}

export function createSearchAdapter(options: CreateSearchAdapterOptions) {
  const logger = options.logger ?? createRedactedLogger().child({ adapter: "azure-search" });
  const client =
    options.client ??
    createManagedIdentitySearchClient({
      endpoint: options.endpoint,
      indexName: options.indexName,
      ...(options.managedIdentityClientId
        ? { managedIdentityClientId: options.managedIdentityClientId }
        : {})
    });

  return {
    async retrieve(input: {
      tenantId: string;
      caseId: string;
      query: string;
      top?: number;
      callerFilter?: string;
    }): Promise<readonly SearchEvidenceChunk[]> {
      if (input.callerFilter && input.callerFilter.trim().length > 0) {
        throw new DemoHttpError(400, "INVALID_CONTRACT", "CALLER_FILTER_NOT_ALLOWED");
      }

      const filter = buildAdmittedEvidenceFilter(input.tenantId, input.caseId);
      const top = Math.max(1, Math.min(input.top ?? 5, 20));

      logger.info("azure.search.request", {
        tenantId: input.tenantId,
        caseId: input.caseId,
        query: input.query,
        filter,
        top
      });

      const results = await client.search(input.query, { filter, top });
      return results.map((result) => searchDocumentSchema.parse(result));
    }
  };
}

export function buildAdmittedEvidenceFilter(tenantId: string, caseId: string): string {
  return [
    `tenantId eq '${escapeOData(tenantId)}'`,
    `caseId eq '${escapeOData(caseId)}'`,
    "admissionStatus eq 'ADMITTED'",
    "accessibleAtReview eq true"
  ].join(" and ");
}

function escapeOData(value: string): string {
  return value.replace(/'/g, "''");
}

function createManagedIdentitySearchClient(options: {
  endpoint: string;
  indexName: string;
  managedIdentityClientId?: string;
}): SearchExecutionClient {
  const client = new SearchClient<SearchEvidenceChunk>(
    options.endpoint,
    options.indexName,
    createManagedIdentityCredential(options.managedIdentityClientId)
  );

  return {
    async search(searchText, searchOptions) {
      const results = await client.search(searchText, {
        filter: searchOptions.filter,
        top: searchOptions.top
      });
      const documents: SearchEvidenceChunk[] = [];

      for await (const result of results.results) {
        documents.push(searchDocumentSchema.parse(result.document));
      }

      return documents;
    }
  };
}
