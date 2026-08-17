import express, { type Express } from "express";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";

const entraClientId = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
);
const entraTenantId = entraClientId;

const webServerConfigSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    BFF_INTERNAL_BASE_URL: z
      .string()
      .url()
      .refine((value) => new URL(value).protocol === "https:", "BFF_INTERNAL_BASE_URL_REQUIRES_HTTPS"),
    DEMO_MODE: z.literal("AZURE"),
    DEMO_TENANT_ID: entraTenantId,
    WEB_ENTRA_CLIENT_ID: entraClientId,
    WEB_BFF_DELEGATED_SCOPE: z.string().trim().min(1),
    WEB_STATIC_ROOT: z.string().trim().min(1).optional()
  })
  .strict();

const webServerConfigKeys = [
  "PORT",
  "BFF_INTERNAL_BASE_URL",
  "DEMO_MODE",
  "DEMO_TENANT_ID",
  "WEB_ENTRA_CLIENT_ID",
  "WEB_BFF_DELEGATED_SCOPE",
  "WEB_STATIC_ROOT"
] as const;

export interface RuntimeAuthConfig {
  readonly mode: "AZURE";
  readonly authority: string;
  readonly clientId: string;
  readonly bffScope: string;
}

export interface ProductionWebServerConfig {
  readonly port: number;
  readonly bffInternalBaseUrl: string;
  readonly staticRoot: string;
  readonly auth: RuntimeAuthConfig;
}

interface CreateProductionWebServerOptions {
  readonly config: ProductionWebServerConfig;
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
    auth: {
      mode: parsed.DEMO_MODE,
      authority: `https://login.microsoftonline.com/${encodeURIComponent(parsed.DEMO_TENANT_ID)}`,
      clientId: parsed.WEB_ENTRA_CLIENT_ID,
      bffScope: parsed.WEB_BFF_DELEGATED_SCOPE
    },
    staticRoot: parsed.WEB_STATIC_ROOT ?? getDefaultStaticRoot()
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

  app.get("/auth/config", (_request, response) => {
    response.status(200).json(options.config.auth);
  });

  app.use("/api", express.raw({ type: "*/*", limit: "1mb" }), async (request, response) => {
    const authorization = readSingleBearerAuthorization(request);
    if (!authorization) {
      response.status(401).json({
        code: "UNAUTHENTICATED",
        message: "Delegated Microsoft Entra access token is required."
      });
      return;
    }

    const upstreamHeaders: Record<string, string> = {
      authorization,
      "x-stratton-delegated-token": authorization.slice("Bearer ".length),
      accept: request.header("accept") ?? "application/json"
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

function readSingleBearerAuthorization(request: express.Request): string | undefined {
  const values: string[] = [];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index]?.toLowerCase() === "authorization") {
      values.push(request.rawHeaders[index + 1] ?? "");
    }
  }
  if (values.length !== 1) {
    return undefined;
  }

  const authorization = values[0];
  return authorization && /^Bearer [A-Za-z0-9\-._~+/]+=*$/iu.test(authorization)
    ? authorization
    : undefined;
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
  const app = createProductionWebServer({ config });

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
