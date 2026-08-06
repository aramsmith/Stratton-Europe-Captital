import { ManagedIdentityCredential } from "@azure/identity";
import express, { type Express } from "express";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";

const principalSchema = z
  .object({
    auth_typ: z.literal("aad"),
    claims: z
      .array(
        z
          .object({
            typ: z.string().min(1),
            val: z.string()
          })
          .strip()
      )
      .min(1)
  })
  .strip();

const webServerConfigSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    BFF_INTERNAL_BASE_URL: z
      .string()
      .url()
      .refine((value) => new URL(value).protocol === "https:", "BFF_INTERNAL_BASE_URL_REQUIRES_HTTPS"),
    BFF_TOKEN_SCOPE: z.string().trim().min(1),
    AZURE_MANAGED_IDENTITY_CLIENT_ID: z.string().uuid(),
    WEB_STATIC_ROOT: z.string().trim().min(1).optional()
  })
  .strict();

const webServerConfigKeys = [
  "PORT",
  "BFF_INTERNAL_BASE_URL",
  "BFF_TOKEN_SCOPE",
  "AZURE_MANAGED_IDENTITY_CLIENT_ID",
  "WEB_STATIC_ROOT"
] as const;

export interface ProductionWebServerConfig {
  readonly port: number;
  readonly bffInternalBaseUrl: string;
  readonly bffTokenScope: string;
  readonly managedIdentityClientId: string;
  readonly staticRoot: string;
}

interface CreateProductionWebServerOptions {
  readonly config: ProductionWebServerConfig;
  readonly getAccessToken: () => Promise<string>;
  readonly fetch?: typeof fetch;
}

export function parseWebServerConfig(
  environment: NodeJS.ProcessEnv = process.env
): ProductionWebServerConfig {
  const approvedEnvironment = Object.fromEntries(
    webServerConfigKeys.flatMap((key) => {
      const value = environment[key];
      return value === undefined ? [] : [[key, value]];
    })
  );
  const parsed = webServerConfigSchema.parse(approvedEnvironment);
  return {
    port: parsed.PORT,
    bffInternalBaseUrl: parsed.BFF_INTERNAL_BASE_URL.replace(/\/+$/u, ""),
    bffTokenScope: parsed.BFF_TOKEN_SCOPE,
    managedIdentityClientId: parsed.AZURE_MANAGED_IDENTITY_CLIENT_ID,
    staticRoot:
      parsed.WEB_STATIC_ROOT ??
      getDefaultStaticRoot()
  };
}

function getDefaultStaticRoot(): string {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const parentDirectory = path.dirname(moduleDirectory);
  return path.basename(moduleDirectory) === "server" &&
    path.basename(parentDirectory) === "dist"
    ? parentDirectory
    : path.resolve(moduleDirectory, "..", "dist");
}

export function createProductionWebServer(options: CreateProductionWebServerOptions): Express {
  const app = express();
  const fetchImpl = options.fetch ?? fetch;
  const staticRoot = path.resolve(options.config.staticRoot);

  app.get("/healthz", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.use("/api", express.raw({ type: "*/*", limit: "1mb" }), async (request, response) => {
    const principalHeader = request.header("x-ms-client-principal");
    if (!principalHeader || !isValidPrincipalHeader(principalHeader)) {
      response.status(401).json({
        code: "UNAUTHENTICATED",
        message: "Authenticated Microsoft Entra principal is required."
      });
      return;
    }

    let accessToken: string;
    try {
      accessToken = await options.getAccessToken();
    } catch {
      response.status(503).json({
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Private BFF authentication is unavailable."
      });
      return;
    }

    const upstreamHeaders: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      accept: request.header("accept") ?? "application/json",
      "x-stratton-forwarded-principal": principalHeader
    };
    copyHeader(request, upstreamHeaders, "content-type");
    copyHeader(request, upstreamHeaders, "x-correlation-id");
    copyHeader(request, upstreamHeaders, "traceparent");

    const body = Buffer.isBuffer(request.body) && request.body.byteLength > 0
      ? request.body
      : undefined;
    let upstream: Response;
    try {
      upstream = await fetchImpl(
        `${options.config.bffInternalBaseUrl}${request.originalUrl}`,
        {
          method: request.method,
          headers: upstreamHeaders,
          ...(body ? { body } : {})
        }
      );
    } catch {
      response.status(503).json({
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Private BFF route is unavailable."
      });
      return;
    }

    copyResponseHeader(upstream, response, "content-type");
    copyResponseHeader(upstream, response, "x-correlation-id");
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    response.status(upstream.status).send(responseBody);
  });

  app.use(express.static(staticRoot, { fallthrough: true, index: false }));
  app.get("/{*splat}", (_request, response) => {
    response.sendFile("index.html", { root: staticRoot });
  });

  return app;
}

function isValidPrincipalHeader(value: string): boolean {
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return principalSchema.safeParse(JSON.parse(decoded) as unknown).success;
  } catch {
    return false;
  }
}

function copyHeader(
  request: express.Request,
  destination: Record<string, string>,
  name: string
): void {
  const value = request.header(name);
  if (value) {
    destination[name] = value;
  }
}

function copyResponseHeader(
  upstream: Response,
  response: express.Response,
  name: string
): void {
  const value = upstream.headers.get(name);
  if (value) {
    response.setHeader(name, value);
  }
}

async function startProductionWebServer(): Promise<void> {
  const config = parseWebServerConfig();
  const credential = new ManagedIdentityCredential(
    config.managedIdentityClientId
  );
  const app = createProductionWebServer({
    config,
    getAccessToken: async () => {
      const token = await credential.getToken(config.bffTokenScope);
      if (!token?.token) {
        throw new Error("BFF_MANAGED_IDENTITY_TOKEN_UNAVAILABLE");
      }
      return token.token;
    }
  });

  app.listen(config.port, () => {
    console.log(`Stratton demo web server listening on ${config.port}`);
  });
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectRun) {
  void startProductionWebServer().catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "web.startup.failure",
        errorClass:
          error instanceof Error && error.name === "ZodError"
            ? "CONFIGURATION_INVALID"
            : "STARTUP_FAILED"
      })
    );
    process.exitCode = 1;
  });
}
