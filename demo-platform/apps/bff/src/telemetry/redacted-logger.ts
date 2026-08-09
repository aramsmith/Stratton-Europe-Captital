const prohibitedKeys = new Set([
  "documentbody",
  "promptbody",
  "completionbody",
  "rawdocumentpayload",
  "authorization",
  "armtoken",
  "phase5token",
  "accesstoken",
  "refreshtoken",
  "clientsecret",
  "apikey",
  "connectionstring",
  "password",
  "sastoken"
]);

export interface RedactedLogEntry {
  readonly timestamp: string;
  readonly level: "INFO" | "ERROR";
  readonly event: string;
  readonly data?: unknown;
}

export interface RedactedLogger {
  info(event: string, data?: unknown): void;
  error(event: string, data?: unknown): void;
  child(context: Record<string, unknown>): RedactedLogger;
}

interface CreateRedactedLoggerOptions {
  readonly now?: () => string;
  readonly sink?: (entry: RedactedLogEntry) => void;
  readonly context?: Record<string, unknown>;
}

export function redact(value: unknown): unknown {
  if (value instanceof Error) {
    return "[REDACTED_ERROR]";
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      prohibitedKeys.has(key.toLowerCase()) ? "[REDACTED]" : redact(entry)
    ])
  );
}

export function createRedactedLogger(options: CreateRedactedLoggerOptions = {}): RedactedLogger {
  const now = options.now ?? (() => new Date().toISOString());
  const sink =
    options.sink ??
    ((entry: RedactedLogEntry) => {
      const writer = entry.level === "ERROR" ? console.error : console.info;
      writer(JSON.stringify(entry));
    });
  const baseContext = options.context ? redact(options.context) : undefined;

  const emit = (level: RedactedLogEntry["level"], event: string, data?: unknown) => {
    const payload =
      baseContext && data && typeof data === "object"
        ? { ...baseContext, ...(redact(data) as Record<string, unknown>) }
        : baseContext ?? redact(data);

    sink({
      timestamp: now(),
      level,
      event,
      ...(payload === undefined ? {} : { data: payload })
    });
  };

  return {
    info(event, data) {
      emit("INFO", event, data);
    },
    error(event, data) {
      emit("ERROR", event, data);
    },
    child(context) {
      const nextContext =
        baseContext && typeof baseContext === "object"
          ? { ...(baseContext as Record<string, unknown>), ...context }
          : context;

      return createRedactedLogger({ now, sink, context: nextContext });
    }
  };
}
