import { ManagedIdentityCredential } from "@azure/identity";
import { SearchClient, SearchIndexClient } from "@azure/search-documents";
import { readFile } from "node:fs/promises";

const endpoint = required("AZURE_SEARCH_ENDPOINT");
const indexName = required("AZURE_SEARCH_INDEX_NAME");
const clientId = required("AZURE_MANAGED_IDENTITY_CLIENT_ID");
const credential = new ManagedIdentityCredential({ clientId });
const indexClient = new SearchIndexClient(endpoint, credential);

await indexClient.createOrUpdateIndex({
  name: indexName,
  fields: [
    { name: "chunkId", type: "Edm.String", key: true, filterable: true },
    { name: "tenantId", type: "Edm.String", filterable: true },
    { name: "caseId", type: "Edm.String", filterable: true },
    { name: "evidenceId", type: "Edm.String", filterable: true },
    { name: "content", type: "Edm.String", searchable: true },
    { name: "locator", type: "Edm.String", filterable: true },
    { name: "admissionStatus", type: "Edm.String", filterable: true },
    { name: "accessibleAtReview", type: "Edm.Boolean", filterable: true }
  ]
});

const definitions = [
  ["evidence-board-pack", "fy25-board-pack.txt"],
  ["evidence-erp-rebates", "erp-rebate-export.csv"],
  ["evidence-qoe-report", "qoe-report.txt"],
  ["evidence-environmental-permit", "environmental-permit.txt"]
];
const documents = [];
for (const [evidenceId, fileName] of definitions) {
  const source = await readFile(new URL(`./evidence/${fileName}`, import.meta.url), "utf8");
  documents.push({
    chunkId: `${evidenceId}-chunk-1`,
    tenantId: "27140306-eea5-4e7f-91e9-4c9e86864b3a",
    caseId: "project-danube",
    evidenceId,
    content: `Challenge management EBITDA quality Project Danube. ${source}`,
    locator: `${evidenceId}:1`,
    admissionStatus: "ADMITTED",
    accessibleAtReview: true
  });
}

const result = await new SearchClient(endpoint, indexName, credential).mergeOrUploadDocuments(
  documents
);
if (result.results.some((entry) => !entry.succeeded)) {
  throw new Error("SEARCH_DOCUMENT_SEED_FAILED");
}
console.info(JSON.stringify({ event: "search.seeded", documentCount: documents.length }));

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`CONFIGURATION_REQUIRED:${name}`);
  }
  return value;
}
