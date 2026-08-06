import { createHash } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AzureBlobReferenceProvider,
  InMemoryBlobReferenceProvider,
  InMemoryReadOnlySourceConnector,
  ReadOnlySourceAdapter
} from "../../../app/src/source-connector.js";

const blobUrl = "https://acct.blob.core.windows.net/allowed/path/file.pdf";

interface AzureMockOptions {
  readonly headStatus?: number;
  readonly headLength?: number;
  readonly includeHeadLength?: boolean;
  readonly headEtag?: string | null;
  readonly body?: string;
  readonly getStatus?: number;
  readonly getEtag?: string | null;
  readonly tagResponse?: { readonly status: number; readonly xml: string; readonly etag?: string | null };
  readonly expectIfMatch?: boolean;
}

function withAzureMocks(options: AzureMockOptions, run: (provider: AzureBlobReferenceProvider) => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const asRequest = input as { url?: string; toString?: () => string };
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : typeof asRequest.url === "string"
            ? asRequest.url
            : (asRequest.toString?.() ?? "");
    const method = (init?.method ?? "GET").toUpperCase();
    if (options.expectIfMatch && method !== "HEAD") {
      let ifMatch: string | undefined;
      if (init?.headers instanceof Headers) {
        ifMatch = init.headers.get("if-match") ?? undefined;
      } else if (Array.isArray(init?.headers)) {
        ifMatch = init.headers.find(([name]) => name.toLowerCase() === "if-match")?.[1];
      } else if (init?.headers && typeof init.headers === "object") {
        ifMatch = (init.headers as Record<string, string>)["if-match"];
      }
      assert.equal((ifMatch?.length ?? 0) > 0, true);
    }
    if (method === "HEAD") {
      const length = options.headLength ?? Buffer.byteLength(options.body ?? "blob-data");
      const headers: Record<string, string> = {
        "content-type": "application/pdf",
        "x-ms-meta-retention-schedule-id": "RET-001",
        "x-ms-meta-disposition-status": "ACTIVE"
      };
      if (options.includeHeadLength !== false) {
        headers["content-length"] = String(length);
      }
      if (options.headEtag !== null) {
        headers.etag = options.headEtag ?? "\"etag-1\"";
      }
      return new Response(null, {
        status: options.headStatus ?? 200,
        headers
      });
    }
    if (url.includes("comp=tags")) {
      const tagResponse = options.tagResponse ?? {
        status: 200,
        xml: `<?xml version="1.0"?><Tags><TagSet><Tag><Key>Malware scanning scan result</Key><Value>No threats found</Value></Tag></TagSet></Tags>`,
        etag: options.headEtag ?? "\"etag-1\""
      };
      return new Response(tagResponse.xml, {
        status: tagResponse.status,
        headers: tagResponse.etag ? { etag: tagResponse.etag } : {}
      });
    }
    const getHeaders: Record<string, string> = {};
    if (options.getEtag !== null) {
      getHeaders.etag = options.getEtag ?? options.headEtag ?? "\"etag-1\"";
    }
    return new Response(options.body ?? "blob-data", {
      status: options.getStatus ?? 200,
      headers: getHeaders
    });
  }) as typeof fetch;
  const provider = new AzureBlobReferenceProvider("acct", ["allowed"], 10_000_000);
  (provider as unknown as { authHeader: () => Promise<string> }).authHeader = async () => "Bearer test-token";
  return run(provider).finally(() => {
    globalThis.fetch = originalFetch;
  });
}

test("source adapter forbids write-back", () => {
  const connector = new InMemoryReadOnlySourceConnector();
  const adapter = new ReadOnlySourceAdapter(connector);
  assert.throws(() => adapter.writeBack(), /SOURCE_WRITE_BACK_PROHIBITED/);
});

test("read-only connector reads seeded object", async () => {
  const connector = new InMemoryReadOnlySourceConnector();
  connector.seed(
    { sourceId: "source-1", objectId: "obj-1", version: "v1" },
    {
      objectId: "obj-1",
      version: "v1",
      mediaType: "application/pdf",
      sizeBytes: 42,
      contentHash: "hash"
    }
  );
  const adapter = new ReadOnlySourceAdapter(connector);
  const object = await adapter.read({ sourceId: "source-1", objectId: "obj-1", version: "v1" });
  assert.equal(object.objectId, "obj-1");
});

test("blob provider exposes deterministic inspection metadata", async () => {
  const provider = new InMemoryBlobReferenceProvider();
  provider.seed("blob://payload");
  await provider.ensurePayloadReferenceAccessible("blob://payload");
  const inspection = await provider.inspectPayloadReference("blob://payload");
  assert.equal(inspection.malwareScanStatus, "CLEAN");
  assert.equal(inspection.dispositionStatus, "ACTIVE");
});

test("azure blob provider enforces account/container/path and URL boundaries", async () => {
  const provider = new AzureBlobReferenceProvider("acct", ["allowed"]);
  await assert.rejects(
    () => provider.ensurePayloadReferenceAccessible("https://other.blob.core.windows.net/allowed/path/file.pdf"),
    /BLOB_REFERENCE_ACCOUNT_MISMATCH/
  );
  await assert.rejects(
    () => provider.ensurePayloadReferenceAccessible("https://acct.blob.core.windows.net/blocked/path/file.pdf"),
    /BLOB_REFERENCE_CONTAINER_NOT_ALLOWED/
  );
  await assert.rejects(
    () => provider.ensurePayloadReferenceAccessible("https://acct.blob.core.windows.net/allowed"),
    /BLOB_REFERENCE_PATH_INVALID/
  );
  await assert.rejects(
    () => provider.ensurePayloadReferenceAccessible("https://acct.blob.core.windows.net/allowed/path/file.pdf?sig=abc"),
    /INVALID_BLOB_REFERENCE/
  );
  await assert.rejects(
    () => provider.ensurePayloadReferenceAccessible("https://user@acct.blob.core.windows.net/allowed/path/file.pdf"),
    /INVALID_BLOB_REFERENCE/
  );
});

test("azure blob inspection streams SHA-256 and parses defender clean tag", async () => {
  await withAzureMocks({ body: "trusted payload", expectIfMatch: true }, async (provider) => {
    const inspection = await provider.inspectPayloadReference(blobUrl);
    assert.equal(inspection.contentHash, createHash("sha256").update("trusted payload").digest("hex"));
    assert.equal(inspection.malwareScanStatus, "CLEAN");
  });
});

test("azure blob inspection marks malicious/missing/error defender tags fail-closed", async () => {
  await withAzureMocks(
    {
      body: "payload",
      tagResponse: {
        status: 200,
        xml: `<?xml version="1.0"?><Tags><TagSet><Tag><Key>Malware scanning scan result</Key><Value>Malicious</Value></Tag></TagSet></Tags>`
      }
    },
    async (provider) => {
      const malicious = await provider.inspectPayloadReference(blobUrl);
      assert.equal(malicious.malwareScanStatus, "FAILED");
    }
  );
  await withAzureMocks(
    {
      body: "payload",
      tagResponse: {
        status: 200,
        xml: `<?xml version="1.0"?><Tags><TagSet><Tag><Key>Other</Key><Value>X</Value></Tag></TagSet></Tags>`
      }
    },
    async (provider) => {
      const missing = await provider.inspectPayloadReference(blobUrl);
      assert.equal(missing.malwareScanStatus, "UNKNOWN");
    }
  );
  await withAzureMocks(
    {
      body: "payload",
      tagResponse: { status: 500, xml: "error" }
    },
    async (provider) => {
      const error = await provider.inspectPayloadReference(blobUrl);
      assert.equal(error.malwareScanStatus, "UNKNOWN");
    }
  );
});

test("azure blob inspection rejects missing length and oversized payload", async () => {
  await withAzureMocks({ includeHeadLength: false }, async (provider) => {
    await assert.rejects(() => provider.inspectPayloadReference(blobUrl), /BLOB_REFERENCE_LENGTH_MISSING/);
  });
  await withAzureMocks({ headLength: 20_000_000 }, async () => {
    const strictProvider = new AzureBlobReferenceProvider("acct", ["allowed"], 1_024);
    (strictProvider as unknown as { authHeader: () => Promise<string> }).authHeader = async () => "Bearer test-token";
    await assert.rejects(() => strictProvider.inspectPayloadReference(blobUrl), /BLOB_SIZE_EXCEEDS_LIMIT/);
  });
});

test("azure blob inspection fails closed on etag/version drift and oversize stream", async () => {
  await withAzureMocks({ headEtag: "\"etag-1\"", getStatus: 412 }, async (provider) => {
    await assert.rejects(() => provider.inspectPayloadReference(blobUrl), /BLOB_REFERENCE_CONCURRENT_MODIFICATION/);
  });
  await withAzureMocks(
    {
      body: "payload",
      headEtag: "\"etag-1\"",
      getEtag: "\"etag-1\"",
      tagResponse: {
        status: 200,
        etag: "\"etag-2\"",
        xml: `<?xml version="1.0"?><Tags><TagSet><Tag><Key>Malware scanning scan result</Key><Value>No threats found</Value></Tag></TagSet></Tags>`
      }
    },
    async (provider) => {
      await assert.rejects(() => provider.inspectPayloadReference(blobUrl), /BLOB_REFERENCE_VERSION_MISMATCH/);
    }
  );
  await withAzureMocks({ headLength: 3, body: "12345" }, async (provider) => {
    await assert.rejects(() => provider.inspectPayloadReference(blobUrl), /BLOB_SIZE_EXCEEDS_LIMIT/);
  });
});
