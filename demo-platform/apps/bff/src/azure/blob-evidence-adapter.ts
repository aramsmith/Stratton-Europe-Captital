import { BlobServiceClient } from "@azure/storage-blob";
import {
  createRedactedLogger,
  type RedactedLogger
} from "../telemetry/redacted-logger.js";
import { createManagedIdentityCredential } from "./managed-identity.js";

interface BlobContainerClientLike {
  getBlockBlobClient(blobName: string): {
    uploadData(
      data: Buffer,
      options?: { blobHTTPHeaders?: { blobContentType?: string }; metadata?: Record<string, string> }
    ): Promise<unknown>;
    downloadToBuffer(): Promise<Buffer>;
  };
}

interface CreateBlobEvidenceAdapterOptions {
  readonly accountUrl: string;
  readonly containerName: string;
  readonly managedIdentityClientId?: string;
  readonly containerClient?: BlobContainerClientLike;
  readonly logger?: RedactedLogger;
}

export function createBlobEvidenceAdapter(options: CreateBlobEvidenceAdapterOptions) {
  const logger = options.logger ?? createRedactedLogger().child({ adapter: "azure-blob" });
  const containerClient =
    options.containerClient ??
    createManagedIdentityContainerClient({
      accountUrl: options.accountUrl,
      containerName: options.containerName,
      ...(options.managedIdentityClientId
        ? { managedIdentityClientId: options.managedIdentityClientId }
        : {})
    });

  return {
    async writeSyntheticEvidence(input: {
      blobName: string;
      documentBody: string | Buffer;
      contentType: string;
      metadata?: Record<string, string>;
    }): Promise<void> {
      logger.info("azure.blob.write", {
        blobName: input.blobName,
        documentBody: input.documentBody,
        contentType: input.contentType,
        metadata: input.metadata
      });

      await containerClient.getBlockBlobClient(input.blobName).uploadData(
        typeof input.documentBody === "string"
          ? Buffer.from(input.documentBody, "utf8")
          : input.documentBody,
        {
          blobHTTPHeaders: {
            blobContentType: input.contentType
          },
          ...(input.metadata ? { metadata: input.metadata } : {})
        }
      );
    },
    async readEvidence(blobName: string): Promise<Buffer> {
      logger.info("azure.blob.read", { blobName });
      return containerClient.getBlockBlobClient(blobName).downloadToBuffer();
    }
  };
}

function createManagedIdentityContainerClient(options: {
  accountUrl: string;
  containerName: string;
  managedIdentityClientId?: string;
}): BlobContainerClientLike {
  const serviceClient = new BlobServiceClient(
    options.accountUrl,
    createManagedIdentityCredential(options.managedIdentityClientId)
  );

  return serviceClient.getContainerClient(options.containerName);
}
