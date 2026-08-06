import type { DemoApiError } from "@stratton/contracts";
import { z } from "zod";

export type DemoErrorCode = DemoApiError["code"];

const defaultMessages: Readonly<Record<DemoErrorCode, string>> = {
  INVALID_CONTRACT: "Request does not satisfy the approved contract.",
  UNAUTHENTICATED: "Authenticated human bearer token is required.",
  POLICY_DENIED: "Policy denied this operation.",
  STATE_CONFLICT: "Resource state does not permit this operation.",
  EVIDENCE_INCOMPLETE: "Required evidence is incomplete or missing.",
  DEPENDENCY_UNAVAILABLE: "Required dependency is unavailable."
};

const statusByCode: Readonly<Record<DemoErrorCode, number>> = {
  INVALID_CONTRACT: 400,
  UNAUTHENTICATED: 401,
  POLICY_DENIED: 403,
  STATE_CONFLICT: 409,
  EVIDENCE_INCOMPLETE: 422,
  DEPENDENCY_UNAVAILABLE: 503
};

export interface MappedDemoError extends DemoApiError {
  readonly status: number;
}

export class DemoHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: DemoErrorCode,
    message?: string
  ) {
    super(message ?? defaultMessages[code]);
  }
}

export function mapDemoError(error: unknown, correlationId: string): MappedDemoError {
  if (error instanceof DemoHttpError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      correlationId
    };
  }

  if (isBodyParserParseError(error)) {
    return {
      status: 400,
      code: "INVALID_CONTRACT",
      message: defaultMessages.INVALID_CONTRACT,
      correlationId
    };
  }

  if (error instanceof z.ZodError) {
    return {
      status: 400,
      code: "INVALID_CONTRACT",
      message: defaultMessages.INVALID_CONTRACT,
      correlationId
    };
  }

  if (isDemoApiError(error)) {
    return {
      status: statusByCode[error.code],
      ...error,
      correlationId
    };
  }

  if (isKnownCodeError(error)) {
    return {
      status: statusByCode[error.code],
      code: error.code,
      message: error.message ?? defaultMessages[error.code],
      correlationId
    };
  }

  return {
    status: 503,
    code: "DEPENDENCY_UNAVAILABLE",
    message: defaultMessages.DEPENDENCY_UNAVAILABLE,
    correlationId
  };
}

function isDemoApiError(error: unknown): error is DemoApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    isDemoErrorCode(error.code) &&
    "message" in error &&
    typeof error.message === "string" &&
    "correlationId" in error &&
    typeof error.correlationId === "string"
  );
}

function isKnownCodeError(error: unknown): error is { code: DemoErrorCode; message?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    isDemoErrorCode(error.code) &&
    (!("message" in error) || typeof error.message === "string")
  );
}

function isBodyParserParseError(error: unknown): error is { status?: number; statusCode?: number; type?: string } {
  const candidate = error as { status?: number; statusCode?: number; type?: string } | null;
  return (
    typeof error === "object" &&
    error !== null &&
    candidate?.type === "entity.parse.failed" &&
    (candidate.status === 400 || candidate.statusCode === 400)
  );
}

function isDemoErrorCode(code: string): code is DemoErrorCode {
  return code in statusByCode;
}
