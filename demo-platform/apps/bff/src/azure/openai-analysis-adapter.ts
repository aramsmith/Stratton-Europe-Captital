import { getBearerTokenProvider } from "@azure/identity";
import type { AnalysisTaskClass, ModelRoute } from "@stratton/contracts";
import { AzureOpenAI } from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses.js";
import { z } from "zod";
import { routeTask } from "../analysis/model-router.js";
import { DemoHttpError } from "../errors.js";
import {
  createRedactedLogger,
  type RedactedLogger
} from "../telemetry/redacted-logger.js";
import { createManagedIdentityCredential } from "./managed-identity.js";

const approvedDeploymentSchema = z
  .object({
    endpoint: z.string().url(),
    resourceId: z.string().trim().min(1),
    region: z.string().trim().min(1),
    deploymentId: z.string().trim().min(1),
    apiVersion: z.string().trim().min(1),
    evidenceId: z.string().trim().min(1),
    evidenceVersion: z.string().trim().min(1),
    geography: z.literal("EU_DATA_ZONE")
  })
  .strict();

const approvedDeploymentByRouteSchema = z
  .object({
    LUNA: approvedDeploymentSchema,
    TERRA: approvedDeploymentSchema,
    SOL: approvedDeploymentSchema
  })
  .strict();

const evidenceChunkSchema = z
  .object({
    chunkId: z.string().trim().min(1),
    evidenceId: z.string().trim().min(1),
    content: z.string().trim().min(1),
    locator: z.string().trim().min(1).optional()
  })
  .strict();

const requestFingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);

const analysisOutputSchema = z
  .object({
    summary: z.string().trim().min(1),
    citations: z
      .array(
        z
          .object({
            evidenceId: z.string().trim().min(1),
            excerpt: z.string().trim().min(1)
          })
          .strict()
      )
      .default([]),
    riskFlags: z.array(z.string().trim().min(1)).default([])
  })
  .strict();

const openAiResponseSchema = z
  .object({
    outputText: z.string().trim().min(1)
  })
  .strict();

const openAiStructuredOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          evidenceId: { type: "string" },
          excerpt: { type: "string" }
        },
        required: ["evidenceId", "excerpt"]
      }
    },
    riskFlags: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["summary", "citations", "riskFlags"]
} as const;

export type ApprovedDeployment = z.infer<typeof approvedDeploymentSchema>;
export type OpenAiEvidenceChunk = z.infer<typeof evidenceChunkSchema>;
export type GovernedAnalysisOutput = z.infer<typeof analysisOutputSchema>;
type OpenAiResponseCreateParams = ResponseCreateParamsNonStreaming;

export interface OpenAiResponsesClient {
  create(
    request: OpenAiResponseCreateParams
  ): Promise<{ outputText?: string | null }>;
}

export interface OpenAiAdapter {
  analyse(input: {
    route: ModelRoute;
    taskClass: AnalysisTaskClass;
    question: string;
    promptTemplateVersion: string;
    analysisRequestFingerprint: string;
    evidenceChunks: readonly OpenAiEvidenceChunk[];
    correlationId?: string;
  }): Promise<{
    route: ModelRoute;
    deploymentId: string;
    geography: "EU_DATA_ZONE";
    resourceId: string;
    region: string;
    evidenceId: string;
    evidenceVersion: string;
    output: GovernedAnalysisOutput;
  }>;
}

interface CreateOpenAiAdapterOptions {
  readonly deployments: Readonly<Record<ModelRoute, ApprovedDeployment>>;
  readonly managedIdentityClientId?: string;
  readonly clientFactory?: (deployment: ApprovedDeployment) => OpenAiResponsesClient;
  readonly logger?: RedactedLogger;
}

export function createOpenAiAdapter(options: CreateOpenAiAdapterOptions): OpenAiAdapter {
  const deployments = approvedDeploymentByRouteSchema.parse(options.deployments);
  const clientFactory =
    options.clientFactory ??
    createManagedIdentityOpenAiClientFactory(options.managedIdentityClientId);
  const logger = options.logger ?? createRedactedLogger().child({ adapter: "azure-openai" });

  return {
    async analyse(input) {
      const evidenceChunks = z.array(evidenceChunkSchema).min(1).parse(input.evidenceChunks);
      requestFingerprintSchema.parse(input.analysisRequestFingerprint);

      if (routeTask(input.taskClass) !== input.route) {
        throw new DemoHttpError(400, "INVALID_CONTRACT", "TASK_ROUTE_MISMATCH");
      }

      const deployment = deployments[input.route];
      if (!deployment) {
        throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", `${input.route}_ROUTE_UNAVAILABLE`);
      }

      const client = clientFactory(deployment);
      const promptBody = buildPrompt({
        taskClass: input.taskClass,
        question: input.question,
        promptTemplateVersion: input.promptTemplateVersion,
        analysisRequestFingerprint: input.analysisRequestFingerprint,
        evidenceChunks
      });

      logger.info("azure.openai.request", {
        route: input.route,
        taskClass: input.taskClass,
        analysisRequestFingerprint: input.analysisRequestFingerprint,
        promptBody,
        deploymentId: deployment.deploymentId,
        geography: deployment.geography,
        resourceId: deployment.resourceId,
        region: deployment.region,
        evidenceId: deployment.evidenceId,
        evidenceVersion: deployment.evidenceVersion
      });

      try {
        const request: OpenAiResponseCreateParams = {
          model: deployment.deploymentId,
          store: false,
          input: promptBody,
          text: {
            format: {
              type: "json_schema",
              name: "governed_analysis_result",
              strict: true,
              schema: openAiStructuredOutputJsonSchema
            }
          }
        };
        const response = openAiResponseSchema.parse(
          await client.create(request)
        );
        const parsedOutput = analysisOutputSchema.parse(JSON.parse(response.outputText) as unknown);

        logger.info("azure.openai.response", {
          route: input.route,
          analysisRequestFingerprint: input.analysisRequestFingerprint,
          completionBody: response.outputText
        });

        return {
          route: input.route,
          deploymentId: deployment.deploymentId,
          geography: deployment.geography,
          resourceId: deployment.resourceId,
          region: deployment.region,
          evidenceId: deployment.evidenceId,
          evidenceVersion: deployment.evidenceVersion,
          output: parsedOutput
        };
      } catch (error) {
        if (error instanceof DemoHttpError) {
          throw error;
        }

        logger.error("azure.openai.failure", {
          route: input.route,
          analysisRequestFingerprint: input.analysisRequestFingerprint,
          errorType: error instanceof Error ? error.constructor.name : "UnknownError",
          providerStatus: safeNumberProperty(error, "status"),
          providerCode: safeStringProperty(error, "code"),
          errorClass:
            error instanceof SyntaxError || error instanceof z.ZodError
              ? "MODEL_OUTPUT_INVALID"
              : "PROVIDER_REQUEST_FAILED"
        });

        throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", `${input.route}_ROUTE_UNAVAILABLE`);
      }
    }
  };
}

function safeNumberProperty(value: unknown, property: string): number | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const candidate = Reflect.get(value, property);
  return typeof candidate === "number" ? candidate : undefined;
}

function safeStringProperty(value: unknown, property: string): string | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const candidate = Reflect.get(value, property);
  return typeof candidate === "string" && /^[A-Z0-9_.-]{1,80}$/i.test(candidate)
    ? candidate
    : undefined;
}

function createManagedIdentityOpenAiClientFactory(
  managedIdentityClientId?: string
): (deployment: ApprovedDeployment) => OpenAiResponsesClient {
  const credential = createManagedIdentityCredential(managedIdentityClientId);
  const tokenProvider = getBearerTokenProvider(
    credential,
    "https://cognitiveservices.azure.com/.default"
  );

  return (deployment) => {
    const client = new AzureOpenAI({
      endpoint: deployment.endpoint,
      deployment: deployment.deploymentId,
      apiVersion: deployment.apiVersion,
      azureADTokenProvider: tokenProvider,
      maxRetries: 0
    });

    return {
      async create(request) {
        const response = await client.responses.create(request);
        return {
          outputText: response.output_text ?? null
        };
      }
    };
  };
}

function buildPrompt(input: {
  taskClass: AnalysisTaskClass;
  question: string;
  promptTemplateVersion: string;
  analysisRequestFingerprint: string;
  evidenceChunks: readonly OpenAiEvidenceChunk[];
}): string {
  const evidenceLines = input.evidenceChunks.map(
    (chunk, index) =>
      `${index + 1}. [${chunk.evidenceId}] ${chunk.locator ?? "locator unavailable"} :: ${chunk.content}`
  );

  return [
    "You are producing governed due-diligence analysis.",
    `Task class: ${input.taskClass}`,
    `Prompt template version: ${input.promptTemplateVersion}`,
    `Analysis request fingerprint: ${input.analysisRequestFingerprint}`,
    `Question: ${input.question.trim()}`,
    "Use only the admitted evidence below and return JSON with summary, citations, and riskFlags.",
    ...evidenceLines
  ].join("\n");
}
