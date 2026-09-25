/**
 * EMAIL DELIVERABILITY 03A.1 — RFC 8058 one-click unsubscribe adapter.
 *
 * Thin same-origin bridge: validate MUA POST, then call the canonical API.
 * Does not mutate Mongo/subscribers in Web.
 */

import { API_BASE_URL } from "../../lib/api-base-url";

export const RFC8058_ONE_CLICK_VALUE = "List-Unsubscribe=One-Click";
export const RFC8058_SUCCESS_BODY = "Unsubscribed.";
export const RFC8058_BAD_REQUEST_BODY = "Unable to process unsubscribe request.";
export const RFC8058_UNAVAILABLE_BODY = "Unsubscribe service temporarily unavailable.";

const CANONICAL_UNSUBSCRIBE_PATH = "/api/v1/public/blog/subscriptions/unsubscribe";

export type Rfc8058UnsubscribeResult = {
  readonly status: number;
  readonly body: string;
  readonly contentType: "text/plain; charset=utf-8";
};

function plainResult(status: number, body: string): Rfc8058UnsubscribeResult {
  return {
    status,
    body,
    contentType: "text/plain; charset=utf-8",
  };
}

/** Accept application/x-www-form-urlencoded with optional charset parameter. */
export function isRfc8058FormContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return mediaType === "application/x-www-form-urlencoded";
}

export function extractUnsubscribeTokenFromSearchParams(
  searchParams: URLSearchParams,
): string | null {
  const token = searchParams.get("token");
  if (typeof token !== "string") {
    return null;
  }
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseRfc8058FormBody(rawBody: string): URLSearchParams | null {
  try {
    return new URLSearchParams(rawBody);
  } catch {
    return null;
  }
}

export function hasValidRfc8058OneClickField(params: URLSearchParams): boolean {
  // URLSearchParams.get returns the first value; require exact One-Click.
  return params.get("List-Unsubscribe") === "One-Click";
}

/**
 * Sanitize strings that might be logged or returned — never echo tokens.
 * Caller must not pass the raw token into messages.
 */
export function assertSafeErrorText(text: string, forbiddenToken?: string): void {
  if (forbiddenToken && forbiddenToken.length >= 8 && text.includes(forbiddenToken)) {
    throw new Error("Refusing to expose unsubscribe token in response or error text.");
  }
}

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    cache?: RequestCache;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/**
 * Validate RFC 8058 POST and forward to canonical API with JSON `{ token }`.
 * Never logs the token.
 */
export async function handleRfc8058BlogUnsubscribe(input: {
  contentType: string | null;
  rawBody: string;
  searchParams: URLSearchParams;
  fetchImpl?: FetchLike;
  apiBaseUrl?: string;
}): Promise<Rfc8058UnsubscribeResult> {
  const token = extractUnsubscribeTokenFromSearchParams(input.searchParams);
  if (!token) {
    return plainResult(400, RFC8058_BAD_REQUEST_BODY);
  }

  if (!isRfc8058FormContentType(input.contentType)) {
    return plainResult(400, RFC8058_BAD_REQUEST_BODY);
  }

  const form = parseRfc8058FormBody(input.rawBody);
  if (!form || !hasValidRfc8058OneClickField(form)) {
    return plainResult(400, RFC8058_BAD_REQUEST_BODY);
  }

  const base = (input.apiBaseUrl ?? API_BASE_URL).replace(/\/$/, "");
  const fetchImpl = input.fetchImpl ?? (globalThis.fetch as FetchLike);

  try {
    const response = await fetchImpl(`${base}${CANONICAL_UNSUBSCRIBE_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      const success = plainResult(200, RFC8058_SUCCESS_BODY);
      assertSafeErrorText(success.body, token);
      return success;
    }

    // Preserve opaque failure model: invalid/missing subscriber → 4xx without existence oracle detail.
    if (response.status >= 400 && response.status < 500) {
      const failure = plainResult(400, RFC8058_BAD_REQUEST_BODY);
      assertSafeErrorText(failure.body, token);
      return failure;
    }

    const unavailable = plainResult(503, RFC8058_UNAVAILABLE_BODY);
    assertSafeErrorText(unavailable.body, token);
    return unavailable;
  } catch {
    const unavailable = plainResult(503, RFC8058_UNAVAILABLE_BODY);
    assertSafeErrorText(unavailable.body, token);
    return unavailable;
  }
}
