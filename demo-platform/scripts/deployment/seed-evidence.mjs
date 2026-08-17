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
  const source = await readFile(new URL(`./evidence/${blobName}`, import.meta.url), "utf8");
  const body = createTextPdf(source);
  await container.getBlockBlobClient(blobName).uploadData(body, {
    blobHTTPHeaders: {
      blobContentType: "application/pdf"
    }
  });
  console.info(JSON.stringify({ event: "evidence.seeded", blobName, sizeBytes: body.length }));
}

function createTextPdf(source) {
  const normalized = source
    .replaceAll("\u20ac", "EUR ")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2014", "-")
    .replace(/[^\x20-\x7e\r\n]/gu, "?");
  const lines = normalized
    .split(/\r?\n/u)
    .flatMap((line) => line.match(/.{1,90}/gu) ?? [""]);
  const pages = [];
  for (let index = 0; index < lines.length; index += 58) {
    pages.push(lines.slice(index, index + 58));
  }
  if (pages.length === 0) {
    pages.push([""]);
  }

  const fontObject = 3 + pages.length * 2;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`
  ];
  for (const [index, pageLines] of pages.entries()) {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    const content = [
      "BT /F1 8 Tf 36 756 Td 10 TL",
      ...pageLines.map((line) => `(${escapePdfText(line)}) Tj T*`),
      "ET"
    ].join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`
    );
  }
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

function escapePdfText(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`CONFIGURATION_REQUIRED:${name}`);
  }
  return value;
}
