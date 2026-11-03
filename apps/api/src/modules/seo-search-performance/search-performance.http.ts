/**
 * SEO-12B.1 — bounded provider HTTP calls and retry policy.
 *
 * Errors carry our own short messages only; provider response bodies are never
 * copied into them.
 */
import type { SearchProviderErrorCode } from "./search-performance.types.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const RETRYABLE_CODES: ReadonlySet<SearchProviderErrorCode> = new Set([
  "rate_limited",
  "provider_unavailable",
  "timeout",
  "network_error",
]);

export const MAX_RETRY_AFTER_MS = 60_000;

export class SearchProviderError extends Error {
  readonly code: SearchProviderErrorCode;
  readonly httpStatus: number | null;
  readonly retryAfterMs: number | null;

  constructor(
    code: SearchProviderErrorCode,
    message: string,
    options: { httpStatus?: number | null; retryAfterMs?: number | null } = {},
  ) {
    super(message);
    this.name = "SearchProviderError";
    this.code = code;
    this.httpStatus = options.httpStatus ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
  }

  get retryable(): boolean {
    return RETRYABLE_CODES.has(this.code);
  }
}

export function parseRetryAfterMs(value: string | null, now: Date = new Date()): number | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) {
    return null;
  }
  return Math.max(0, at - now.getTime());
}

export function classifyHttpFailure(
  label: string,
  status: number,
  retryAfterHeader: string | null,
): SearchProviderError {
  const options = { httpStatus: status, retryAfterMs: parseRetryAfterMs(retryAfterHeader) };
  if (status === 401) {
    return new SearchProviderError(
      "auth_failed",
      `${label} rejected the credentials (HTTP 401).`,
      options,
    );
  }
  if (status === 403) {
    return new SearchProviderError(
      "permission_denied",
      `${label} denied access (HTTP 403).`,
      options,
    );
  }
  if (status === 429) {
    return new SearchProviderError(
      "rate_limited",
      `${label} rate limit reached (HTTP 429).`,
      options,
    );
  }
  if (status >= 500) {
    return new SearchProviderError(
      "provider_unavailable",
      `${label} is unavailable (HTTP ${status}).`,
      options,
    );
  }
  return new SearchProviderError(
    "request_rejected",
    `${label} rejected the request (HTTP ${status}).`,
    options,
  );
}

async function readBoundedText(
  response: Response,
  label: string,
  maxBytes: number,
): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new SearchProviderError(
      "response_too_large",
      `${label} response exceeded the size limit.`,
    );
  }
  if (!response.body) {
    return "";
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new SearchProviderError(
        "response_too_large",
        `${label} response exceeded the size limit.`,
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export interface BoundedJsonResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly retryAfter: string | null;
  readonly body: unknown;
}

/** Performs one request with a timeout and response-size cap; parses JSON when present. */
export async function requestBoundedJson(input: {
  readonly fetchImpl: FetchLike;
  readonly url: string;
  readonly init: RequestInit;
  readonly label: string;
  readonly timeoutMs: number;
  readonly maxBytes: number;
}): Promise<BoundedJsonResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    let response: Response;
    try {
      response = await input.fetchImpl(input.url, {
        ...input.init,
        redirect: "error",
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw new SearchProviderError("timeout", `${input.label} timed out.`);
      }
      throw new SearchProviderError("network_error", `${input.label} could not be reached.`);
    }

    let text: string;
    try {
      text = await readBoundedText(response, input.label, input.maxBytes);
    } catch (error) {
      if (error instanceof SearchProviderError) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw new SearchProviderError("timeout", `${input.label} timed out.`);
      }
      throw new SearchProviderError("network_error", `${input.label} response could not be read.`);
    }

    let body: unknown = null;
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        if (response.ok) {
          throw new SearchProviderError(
            "invalid_response",
            `${input.label} returned invalid JSON.`,
          );
        }
      }
    }
    return {
      status: response.status,
      ok: response.ok,
      retryAfter: response.headers.get("retry-after"),
      body,
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface RetryOptions {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly random?: () => number;
  /** Called before each retry (for example to drop a cached access token). */
  readonly onRetry?: (error: SearchProviderError, attempt: number) => void;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms).unref?.();
  });

/**
 * Retries only rate limits, provider outages, timeouts and network errors, with
 * exponential backoff and jitter. A Retry-After above one minute is not waited out.
 */
export async function withSearchProviderRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 2_000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!(error instanceof SearchProviderError) || !error.retryable || attempt >= maxAttempts) {
        throw error;
      }
      if (error.retryAfterMs !== null && error.retryAfterMs > MAX_RETRY_AFTER_MS) {
        throw error;
      }
      const backoff = Math.min(maxDelayMs, baseDelayMs * 4 ** (attempt - 1));
      const jittered = Math.round(backoff * (0.5 + random() / 2));
      const delay = error.retryAfterMs !== null ? Math.max(error.retryAfterMs, jittered) : jittered;
      options.onRetry?.(error, attempt);
      await sleep(Math.min(delay, MAX_RETRY_AFTER_MS));
    }
  }
}

export function toFiniteNonNegative(value: unknown): number | null {
  const numeric = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}
