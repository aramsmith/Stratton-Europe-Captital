import { createHash } from "node:crypto";
import { DefaultAzureCredential } from "@azure/identity";
import type { BlobInspection, BlobReferenceProvider, ProviderAvailability } from "./types.js";

export interface SourceObjectLocator {
  readonly sourceId: string;
  readonly objectId: string;
  readonly version: string;
}

export interface SourceObjectMetadata {
  readonly objectId: string;
  readonly version: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly contentHash: string;
}

export interface ReadOnlySourceConnector {
  read(locator: SourceObjectLocator): Promise<SourceObjectMetadata>;
}

export class ReadOnlySourceAdapter {
  public constructor(private readonly connector: ReadOnlySourceConnector) {}

  public async read(locator: SourceObjectLocator): Promise<SourceObjectMetadata> {
    return this.connector.read(locator);
  }

  public writeBack(): never {
    throw new Error("SOURCE_WRITE_BACK_PROHIBITED");
  }
}

export class InMemoryReadOnlySourceConnector implements ReadOnlySourceConnector {
  private readonly objects = new Map<string, SourceObjectMetadata>();

  public seed(locator: SourceObjectLocator, metadata: SourceObjectMetadata): void {
    this.objects.set(this.key(locator), metadata);
  }

  public async read(locator: SourceObjectLocator): Promise<SourceObjectMetadata> {
    const value = this.objects.get(this.key(locator));
    if (!value) {
      throw new Error("SOURCE_OBJECT_NOT_FOUND");
    }
    return value;
  }

  private key(locator: SourceObjectLocator): string {
    return `${locator.sourceId}:${locator.objectId}:${locator.version}`;
  }
}

function requireHttps(reference: string): URL {
  let url: URL;
  try {
    url = new URL(reference);
  } catch {
    throw new Error("INVALID_BLOB_REFERENCE");
  }
  if (url.protocol !== "https:") {
    throw new Error("INVALID_BLOB_REFERENCE");
  }
  if (url.search.length > 0 || url.hash.length > 0 || url.username.length > 0 || url.password.length > 0) {
    throw new Error("INVALID_BLOB_REFERENCE");
  }
  return url;
}

function parseContentLength(headerValue: string | null): number | undefined {
  if (!headerValue) {
    return undefined;
  }
  const parsed = Number.parseInt(headerValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

function isPreconditionFailure(status: number): boolean {
  return status === 409 || status === 412;
}

export class AzureBlobReferenceProvider implements BlobReferenceProvider {
  public constructor(
    private readonly accountName: string,
    private readonly allowedContainers: readonly string[],
    private readonly maxInspectableBytes = 100 * 1024 * 1024
  ) {}

  private assertReference(reference: string): void {
    const url = requireHttps(reference);
    const expectedHost = `${this.accountName}.blob.core.windows.net`;
    if (url.host.toLowerCase() !== expectedHost.toLowerCase()) {
      throw new Error("BLOB_REFERENCE_ACCOUNT_MISMATCH");
    }
    const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
    const container = segments[0];
    if (!container || !this.allowedContainers.includes(container)) {
      throw new Error("BLOB_REFERENCE_CONTAINER_NOT_ALLOWED");
    }
    if (segments.length < 2) {
      throw new Error("BLOB_REFERENCE_PATH_INVALID");
    }
  }

  private async authHeader(): Promise<string> {
    const credential = new DefaultAzureCredential();
    const token = await credential.getToken("https://storage.azure.com/.default");
    if (!token?.token) {
      throw new Error("BLOB_REFERENCE_AUTH_FAILED");
    }
    return `Bearer ${token.token}`;
  }

  private async head(reference: string): Promise<Response> {
    const auth = await this.authHeader();
    return fetch(reference, {
      method: "HEAD",
      headers: {
        authorization: auth,
        "x-ms-version": "2023-11-03"
      }
    });
  }

  private async readDefenderScanResult(reference: string, etag: string): Promise<string | undefined> {
    const auth = await this.authHeader();
    const tagsUrl = new URL(reference);
    tagsUrl.search = "comp=tags";
    const response = await fetch(tagsUrl.toString(), {
      method: "GET",
      headers: {
        authorization: auth,
        "x-ms-version": "2023-11-03",
        "if-match": etag
      }
    });
    if (isPreconditionFailure(response.status)) {
      throw new Error("BLOB_REFERENCE_CONCURRENT_MODIFICATION");
    }
    if (!response.ok) {
      return undefined;
    }
    const tagsEtag = response.headers.get("etag");
    if (tagsEtag && tagsEtag !== etag) {
      throw new Error("BLOB_REFERENCE_VERSION_MISMATCH");
    }
    const xml = await response.text();
    const tagMatches = [...xml.matchAll(/<Tag>\s*<Key>([^<]+)<\/Key>\s*<Value>([^<]*)<\/Value>\s*<\/Tag>/g)];
    for (const match of tagMatches) {
      if (match[1]?.trim() === "Malware scanning scan result") {
        return match[2]?.trim();
      }
    }
    return undefined;
  }

  private async streamHash(
    reference: string,
    etag: string,
    expectedBytes: number
  ): Promise<{ readonly contentHash: string; readonly bytesRead: number }> {
    const auth = await this.authHeader();
    const response = await fetch(reference, {
      method: "GET",
      headers: {
        authorization: auth,
        "x-ms-version": "2023-11-03",
        "if-match": etag
      }
    });
    if (isPreconditionFailure(response.status)) {
      throw new Error("BLOB_REFERENCE_CONCURRENT_MODIFICATION");
    }
    if (!response.ok || !response.body) {
      throw new Error("BLOB_REFERENCE_NOT_ACCESSIBLE");
    }
    const bodyEtag = response.headers.get("etag");
    if (bodyEtag && bodyEtag !== etag) {
      throw new Error("BLOB_REFERENCE_VERSION_MISMATCH");
    }
    const hash = createHash("sha256");
    let bytesRead = 0;
    for await (const chunk of response.body as unknown as AsyncIterable<Buffer>) {
      bytesRead += chunk.length;
      if (bytesRead > expectedBytes || bytesRead > this.maxInspectableBytes) {
        throw new Error("BLOB_SIZE_EXCEEDS_LIMIT");
      }
      hash.update(chunk);
    }
    if (bytesRead !== expectedBytes) {
      throw new Error("BLOB_SIZE_MISMATCH");
    }
    return { contentHash: hash.digest("hex"), bytesRead };
  }

  public async ensurePayloadReferenceAccessible(reference: string): Promise<void> {
    this.assertReference(reference);
    const response = await this.head(reference);
    if (!response.ok) {
      throw new Error("BLOB_REFERENCE_NOT_ACCESSIBLE");
    }
  }

  public async inspectPayloadReference(reference: string): Promise<BlobInspection> {
    this.assertReference(reference);
    const response = await this.head(reference);
    if (!response.ok) {
      throw new Error("BLOB_REFERENCE_NOT_ACCESSIBLE");
    }
    const etag = response.headers.get("etag");
    if (!etag) {
      throw new Error("BLOB_REFERENCE_ETAG_MISSING");
    }
    const mediaType = response.headers.get("content-type") ?? "application/octet-stream";
    const sizeBytes = parseContentLength(response.headers.get("content-length"));
    if (sizeBytes === undefined) {
      throw new Error("BLOB_REFERENCE_LENGTH_MISSING");
    }
    if (sizeBytes > this.maxInspectableBytes) {
      throw new Error("BLOB_SIZE_EXCEEDS_LIMIT");
    }
    const { contentHash } = await this.streamHash(reference, etag, sizeBytes);
    const defenderResult = await this.readDefenderScanResult(reference, etag);
    const malwareScanStatus: BlobInspection["malwareScanStatus"] =
      defenderResult === "No threats found"
        ? "CLEAN"
        : defenderResult === "Malicious"
          ? "FAILED"
          : "UNKNOWN";
    const retentionScheduleId = response.headers.get("x-ms-meta-retention-schedule-id") ?? "";
    const dispositionHeader = (response.headers.get("x-ms-meta-disposition-status") ?? "ACTIVE").toUpperCase();
    const dispositionStatus: BlobInspection["dispositionStatus"] =
      dispositionHeader === "HOLD" || dispositionHeader === "DISPOSED" ? dispositionHeader : "ACTIVE";
    return {
      mediaType,
      sizeBytes,
      contentHash,
      malwareScanStatus,
      retentionScheduleId,
      dispositionStatus
    };
  }

  public async isAvailable(): Promise<ProviderAvailability> {
    if (!this.accountName.trim()) {
      return { ready: false, detail: "missing-storage-account-name" };
    }
    if (this.allowedContainers.length === 0) {
      return { ready: false, detail: "missing-allowed-blob-containers" };
    }
    return { ready: true, detail: "blob-provider-configured" };
  }
}

export class InMemoryBlobReferenceProvider implements BlobReferenceProvider {
  private readonly objects = new Map<string, BlobInspection>();

  public seed(reference: string, inspection?: BlobInspection): void {
    this.objects.set(
      reference,
      inspection ?? {
        mediaType: "application/octet-stream",
        sizeBytes: 1,
        contentHash: createHash("sha256").update(reference).digest("hex"),
        malwareScanStatus: "CLEAN",
        retentionScheduleId: "RET-DEFAULT",
        dispositionStatus: "ACTIVE"
      }
    );
  }

  public async ensurePayloadReferenceAccessible(reference: string): Promise<void> {
    if (!this.objects.has(reference)) {
      throw new Error("BLOB_REFERENCE_NOT_FOUND");
    }
  }

  public async inspectPayloadReference(reference: string): Promise<BlobInspection> {
    const record = this.objects.get(reference);
    if (!record) {
      throw new Error("BLOB_REFERENCE_NOT_FOUND");
    }
    return record;
  }

  public async isAvailable(): Promise<ProviderAvailability> {
    return { ready: true, detail: "in-memory" };
  }
}
