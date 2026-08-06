import { randomUUID } from "node:crypto";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly service: string;
  readonly message: string;
  readonly correlationId: string;
  readonly context: Record<string, unknown>;
}

const sensitiveKeyFragments = [
  "authorization",
  "password",
  "token",
  "secret",
  "connectionstring",
  "connection_string",
  "ssn",
  "dob",
  "creditcard",
  "api_key",
  "apikey",
  "clientsecret"
] as const;

const safeKeys = new Set([
  "correlationid",
  "traceparent",
  "requestid",
  "caseid",
  "tenantid",
  "subjectid"
]);

function shouldRedact(rawKey: string): boolean {
  const key = rawKey.toLowerCase();
  if (safeKeys.has(key)) {
    return false;
  }
  return sensitiveKeyFragments.some((fragment) => key.includes(fragment));
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = shouldRedact(key) ? "[REDACTED]" : redact(nested);
    }
    return out;
  }
  return value;
}

export type LogSink = (entry: LogEntry) => void;

export class StructuredLogger {
  public constructor(
    private readonly service: string,
    private readonly sink: LogSink = () => undefined
  ) {}

  public log(level: LogLevel, message: string, context: Record<string, unknown> = {}): LogEntry {
    const correlationValue = context.correlationId;
    const correlationId =
      typeof correlationValue === "string" && correlationValue.length > 0
        ? correlationValue
        : randomUUID();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      correlationId,
      context: redact(context) as Record<string, unknown>
    };
    this.sink(entry);
    return entry;
  }
}
