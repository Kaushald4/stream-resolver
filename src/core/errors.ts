export type ExtractionErrorCode =
  | "SITE_UNAVAILABLE"
  | "CLOUDFLARE"
  | "PAGE_CHANGED"
  | "API_CHANGED"
  | "PLAYER_CHANGED"
  | "DECRYPT_FAILED"
  | "NO_STREAM"
  | "TIMEOUT"
  | "UNSUPPORTED"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "UNKNOWN";

export class ExtractionError extends Error {
  readonly code: ExtractionErrorCode;
  readonly extractorId?: string;
  readonly layer?: "discovery" | "extraction" | "normalization" | "validation";
  readonly cause?: unknown;

  constructor(
    code: ExtractionErrorCode,
    message: string,
    options?: {
      extractorId?: string;
      layer?: ExtractionError["layer"];
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "ExtractionError";
    this.code = code;
    this.extractorId = options?.extractorId;
    this.layer = options?.layer;
    this.cause = options?.cause;
  }

  toFailure() {
    return {
      extractorId: this.extractorId ?? "unknown",
      code: this.code,
      message: this.message,
      layer: this.layer,
    };
  }
}

export function isExtractionError(err: unknown): err is ExtractionError {
  return err instanceof ExtractionError;
}

export function toExtractionError(
  err: unknown,
  fallback: ExtractionErrorCode = "UNKNOWN",
  extractorId?: string,
): ExtractionError {
  if (isExtractionError(err)) {
    return err;
  }
  if (err instanceof Error) {
    const code =
      err.name === "TimeoutError" || err.message.toLowerCase().includes("timeout")
        ? "TIMEOUT"
        : fallback;
    return new ExtractionError(code, err.message, { extractorId, cause: err });
  }
  return new ExtractionError(fallback, String(err), { extractorId });
}
