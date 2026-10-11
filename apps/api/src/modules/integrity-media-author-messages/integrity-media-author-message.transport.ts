import { resolveIntegrityMediaLinkConfig } from "../external-author-link/external-author-link.config.js";
import {
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_PATH,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_SIGNATURE_HEADER,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_TIMESTAMP_HEADER,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_TIMEOUT_MS,
} from "./integrity-media-author-message.constants.js";

export interface IntegrityMediaAuthorMessageEndpoint {
  url: string;
  secret: string;
}

export interface IntegrityMediaAuthorMessageHttpRequest {
  url: string;
  body: string;
  timestamp: string;
  signature: string;
  timeoutMs: number;
}

export type IntegrityMediaAuthorMessageHttpResult =
  | { kind: "response"; status: number; body: string }
  | { kind: "timeout" }
  | { kind: "network" };

export type IntegrityMediaAuthorMessageTransport = (
  request: IntegrityMediaAuthorMessageHttpRequest,
) => Promise<IntegrityMediaAuthorMessageHttpResult>;

/**
 * Server configuration only. The browser cannot choose the Integrity Media origin.
 * Reuses the origin and shared secret already configured for the identity link.
 */
export function resolveIntegrityMediaAuthorMessageEndpoint(
  env: NodeJS.ProcessEnv = process.env,
): IntegrityMediaAuthorMessageEndpoint | null {
  const config = resolveIntegrityMediaLinkConfig(env);

  if (!config.hmacSecret || !config.returnOrigin) {
    return null;
  }

  let origin: URL;

  try {
    origin = new URL(config.returnOrigin);
  } catch {
    return null;
  }

  if (origin.username || origin.password || origin.search || origin.hash) {
    return null;
  }

  if (origin.pathname !== "/" && origin.pathname !== "") {
    return null;
  }

  const nodeEnv = env.NODE_ENV ?? "development";

  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && nodeEnv !== "production")) {
    return null;
  }

  return {
    url: new URL(INTEGRITY_MEDIA_AUTHOR_MESSAGE_PATH, origin.origin).toString(),
    secret: config.hmacSecret,
  };
}

let fetchOverrideForTests: typeof fetch | null = null;

/** Test-only. Production uses the global fetch implementation. */
export function setIntegrityMediaAuthorMessageFetchForTests(
  fetchImpl: typeof fetch | null,
): void {
  fetchOverrideForTests = fetchImpl;
}

export async function postIntegrityMediaAuthorMessage(
  request: IntegrityMediaAuthorMessageHttpRequest,
): Promise<IntegrityMediaAuthorMessageHttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs);
  const doFetch = fetchOverrideForTests ?? fetch;

  try {
    const response = await doFetch(request.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [INTEGRITY_MEDIA_AUTHOR_MESSAGE_TIMESTAMP_HEADER]: request.timestamp,
        [INTEGRITY_MEDIA_AUTHOR_MESSAGE_SIGNATURE_HEADER]: request.signature,
      },
      body: request.body,
      signal: controller.signal,
    });
    const body = await response.text();
    return { kind: "response", status: response.status, body };
  } catch (error) {
    if (isAbortError(error)) {
      return { kind: "timeout" };
    }

    return { kind: "network" };
  } finally {
    clearTimeout(timer);
  }
}

let transportOverride: IntegrityMediaAuthorMessageTransport | null = null;

export function setIntegrityMediaAuthorMessageTransportForTests(
  transport: IntegrityMediaAuthorMessageTransport | null,
): void {
  transportOverride = transport;
}

export function getIntegrityMediaAuthorMessageTransport(): IntegrityMediaAuthorMessageTransport {
  return transportOverride ?? postIntegrityMediaAuthorMessage;
}

export function integrityMediaAuthorMessageTimeoutMs(): number {
  return INTEGRITY_MEDIA_AUTHOR_MESSAGE_TIMEOUT_MS;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}
