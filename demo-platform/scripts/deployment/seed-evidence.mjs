import { ManagedIdentityCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";
import { readFile } from "node:fs/promises";

const accountUrl = required("AZURE_BLOB_ACCOUNT_URL");
const containerName = required("AZURE_BLOB_CONTAINER_NAME");
const clientId = required("AZURE_MANAGED_IDENTITY_CLIENT_ID");
const credential = new ManagedIdentityCredential({ clientId });
const container = new BlobServiceClient(accountUrl, credential).getContainerClient(containerName);
const evidence = [
  "fy25-board-pack.txt",
  "erp-rebate-export.csv",
  "qoe-report.txt",
  "environmental-permit.txt"
];

for (const blobName of evidence) {
  const body = await readFile(new URL(`./evidence/${blobName}`, import.meta.url));
  await container.getBlockBlobClient(blobName).uploadData(body, {
    blobHTTPHeaders: {
      blobContentType: blobName.endsWith(".csv") ? "text/csv" : "text/plain"
    }
  });
  console.info(JSON.stringify({ event: "evidence.seeded", blobName, sizeBytes: body.length }));
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`CONFIGURATION_REQUIRED:${name}`);
  }
  return value;
}
