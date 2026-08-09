import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

test("AZURE startup accepts only exact local ARM and Phase 5 route authority fixtures", async () => {
  await expect(
    run(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "--eval",
        `
          import { resolveAuthoritativeRoutes } from "./apps/bff/src/azure/route-authority.ts";

          const routes = ["LUNA", "TERRA", "SOL"];
          const regions = { LUNA: "swedencentral", TERRA: "westeurope", SOL: "francecentral" };
          const prefix = "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg-ai/providers/Microsoft.CognitiveServices/accounts/";
          const fixture = (route) => {
            const accountName = "stratton-" + route.toLowerCase();
            return {
              route,
              resourceId: prefix + accountName,
              endpoint: "https://" + accountName + ".openai.azure.com",
              deploymentId: route === "LUNA" ? "luna-evidence-triage" : route === "TERRA" ? "terra-grounded-analysis" : "sol-thesis-challenge",
              region: regions[route],
              apiVersion: "2025-01-01-preview",
              evidenceId: "SEC-EVID-" + route + "-ROUTE-v1",
              evidenceVersion: "route-evidence-" + route.toLowerCase() + "-v1",
              validFromIso: "2026-01-01T00:00:00.000Z",
              validUntilIso: "2027-01-01T00:00:00.000Z"
            };
          };
          const config = () => {
            const result = {
              DEMO_TENANT_ID: "00000000-0000-0000-0000-000000000123",
              AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: "https://docint.cognitiveservices.azure.com",
              AZURE_SEARCH_ENDPOINT: "https://search.search.windows.net",
              AZURE_SEARCH_INDEX_NAME: "governed-evidence",
              AZURE_BLOB_ACCOUNT_URL: "https://storage.blob.core.windows.net",
              AZURE_BLOB_CONTAINER_NAME: "admitted-evidence",
              AZURE_SERVICE_BUS_NAMESPACE: "stratton.servicebus.windows.net",
              AZURE_SERVICE_BUS_QUEUE_NAME: "analysis-work"
            };
            for (const route of routes) {
              const value = fixture(route);
              result["AZURE_OPENAI_" + route + "_ENDPOINT"] = value.endpoint;
              result["AZURE_OPENAI_" + route + "_RESOURCE_ID"] = value.resourceId;
              result["AZURE_OPENAI_" + route + "_REGION"] = value.region;
              result["AZURE_OPENAI_" + route + "_DEPLOYMENT_ID"] = value.deploymentId;
              result["AZURE_OPENAI_" + route + "_API_VERSION"] = value.apiVersion;
              result["AZURE_OPENAI_" + route + "_EVIDENCE_ID"] = value.evidenceId;
              result["AZURE_OPENAI_" + route + "_ROUTE_EVIDENCE_VERSION"] = value.evidenceVersion;
            }
            return result;
          };
          const dependencies = (mutate = (value) => value) => ({
            arm: {
              getAccountDeployment: async (input) => {
                const route = routes.find((candidate) => input.resourceId.includes(candidate.toLowerCase()));
                const value = mutate(fixture(route));
                return {
                  resourceId: value.resourceId,
                  accountName: value.resourceId.split("/").at(-1),
                  location: value.region,
                  endpoint: value.endpoint,
                  deploymentId: value.deploymentId
                };
              }
            },
            authority: {
              getModelRouteEvidence: async (evidenceId) => {
                const route = routes.find((candidate) => evidenceId.includes(candidate));
                const value = mutate(fixture(route));
                return {
                  evidenceId: value.evidenceId,
                  status: "APPROVED",
                  resourceId: value.resourceId,
                  deploymentId: value.deploymentId,
                  region: value.region,
                  route: value.route,
                  apiVersion: value.apiVersion,
                  evidenceVersion: value.evidenceVersion,
                  validFromIso: value.validFromIso,
                  validUntilIso: value.validUntilIso
                };
              }
            }
          });
          const now = () => new Date("2026-08-09T00:00:00.000Z");
          const bindings = await resolveAuthoritativeRoutes({ config: config(), ...dependencies(), now });
          if (
            bindings.TERRA.resourceId !== prefix + "stratton-terra" ||
            bindings.TERRA.endpoint !== "https://stratton-terra.openai.azure.com" ||
            bindings.TERRA.deploymentId !== "terra-grounded-analysis" ||
            bindings.TERRA.location !== "westeurope" ||
            bindings.TERRA.apiVersion !== "2025-01-01-preview" ||
            bindings.TERRA.evidenceId !== "SEC-EVID-TERRA-ROUTE-v1" ||
            bindings.TERRA.evidenceVersion !== "route-evidence-terra-v1"
          ) {
            throw new Error("VALID_ROUTE_FIXTURE_REJECTED");
          }

          const mutations = [
            (value) => value.route === "LUNA" ? { ...value, route: "SOL" } : value,
            (value) => value.route === "LUNA" ? { ...value, resourceId: prefix + "other-account" } : value,
            (value) => value.route === "LUNA" ? { ...value, endpoint: "https://other-account.openai.azure.com" } : value,
            (value) => value.route === "LUNA" ? { ...value, deploymentId: "unexpected-deployment" } : value,
            (value) => value.route === "LUNA" ? { ...value, region: "eastus" } : value,
            (value) => value.route === "LUNA" ? { ...value, apiVersion: "2024-01-01-preview" } : value,
            (value) => value.route === "LUNA" ? { ...value, evidenceId: "SEC-EVID-LUNA-ROUTE-v2" } : value,
            (value) => value.route === "LUNA" ? { ...value, evidenceVersion: "route-evidence-luna-v2" } : value,
            (value) => value.route === "LUNA" ? { ...value, validUntilIso: "2026-08-08T23:59:59.000Z" } : value
          ];
          for (const mutate of mutations) {
            try {
              await resolveAuthoritativeRoutes({ config: config(), ...dependencies(mutate), now });
              throw new Error("ROUTE_AUTHORITY_MISMATCH_ACCEPTED");
            } catch (error) {
              if (error?.message === "ROUTE_AUTHORITY_MISMATCH_ACCEPTED") {
                throw error;
              }
              if (
                error?.code !== "DEPENDENCY_UNAVAILABLE" ||
                error?.message !== "AUTHORITATIVE_ROUTE_VALIDATION_FAILED"
              ) {
                throw error;
              }
            }
          }
        `
      ],
      { cwd: process.cwd() }
    )
  ).resolves.toBeDefined();
});
