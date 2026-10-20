import { createHash } from "node:crypto";

import { detectImageSignature, looksLikeMarkupOrScript } from "../media-upload/image-signature.js";
import { resolveIntegrityMediaLinkConfig } from "./external-author-link.config.js";
import { INTEGRITY_MEDIA_SERVER_ORIGIN_ENV } from "./external-author-link.constants.js";
import { readIntegrityMediaDeploymentTarget } from "./external-author-link.environment-target.js";
import { signIntegrityMediaLinkRedeem } from "./external-author-link.hmac.js";
import { buildProvisionPhotoPayload } from "./external-author-link.provision-photo.hmac.js";
import { SNAPSHOT_PHOTO_MAX_BYTES } from "./external-author-link.provision-snapshot.schema.js";

const PHOTO_PATH = "/api/integrations/humanity-union/provision-photo";
const DEFAULT_TIMEOUT_MS = 5_000;
const TRANSPORT_ATTEMPTS = 2;

export type ProvisionPhotoFailureCode =
  | "timeout"
  | "missing"
  | "conflict"
  | "expired"
  | "invalid_response"
  | "unavailable";

export type ProvisionPhotoFetchResult =
  | { ok: true; bytes: Buffer }
  | { ok: false; code: ProvisionPhotoFailureCode };

type PhotoFetch = typeof fetch;

let photoFetch: PhotoFetch | null = null;
let photoTimeoutMs = DEFAULT_TIMEOUT_MS;

/** Unit tests only. */
export function setProvisionPhotoFetchForTests(fetchImpl: PhotoFetch | null): void {
  if (fetchImpl && process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Provision photo test fetch is unavailable.");
  }

  photoFetch = fetchImpl;
}

/** Unit tests only. */
export function setProvisionPhotoTimeoutForTests(timeoutMs: number | null): void {
  if (timeoutMs !== null && process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Provision photo test timeout is unavailable.");
  }

  photoTimeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

export function resolveIntegrityMediaServerOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const configured = env[INTEGRITY_MEDIA_SERVER_ORIGIN_ENV]?.trim() ?? "";
  if (!configured || !isTrustedServerOrigin(configured, env.NODE_ENV ?? "development")) {
    return null;
  }

  return new URL(configured).origin;
}

export async function fetchProvisionPhoto(input: {
  attemptId: string;
  digest: string;
  byteLength: number;
  now?: Date;
}): Promise<ProvisionPhotoFetchResult> {
  const origin = resolveIntegrityMediaServerOrigin();
  const secret = resolveIntegrityMediaLinkConfig().hmacSecret;
  const target = readIntegrityMediaDeploymentTarget();
  if (!origin || !secret || !target || !isPhotoRequest(input)) {
    return { ok: false, code: "unavailable" };
  }

  const baseSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  let last: ProvisionPhotoFetchResult = { ok: false, code: "unavailable" };

  for (let attempt = 0; attempt < TRANSPORT_ATTEMPTS; attempt += 1) {
    last = await fetchOnce({
      origin,
      secret,
      target,
      attemptId: input.attemptId,
      digest: input.digest,
      byteLength: input.byteLength,
      timestamp: String(baseSeconds + attempt),
    });

    if (
      last.ok ||
      last.code === "missing" ||
      last.code === "conflict" ||
      last.code === "expired" ||
      last.code === "unavailable"
    ) {
      return last;
    }
  }

  return last;
}

async function fetchOnce(input: {
  origin: string;
  secret: string;
  target: "staging" | "production";
  attemptId: string;
  digest: string;
  byteLength: number;
  timestamp: string;
}): Promise<ProvisionPhotoFetchResult> {
  const payload = buildProvisionPhotoPayload({
    timestamp: input.timestamp,
    attemptId: input.attemptId,
    target: input.target,
    digest: input.digest,
    byteLength: input.byteLength,
  });
  const signature = signIntegrityMediaLinkRedeem(input.secret, payload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), photoTimeoutMs);

  try {
    const response = await (photoFetch ?? fetch)(new URL(PHOTO_PATH, input.origin), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-HU-Integrity-Media-Timestamp": input.timestamp,
        "X-HU-Integrity-Media-Signature": signature,
      },
      body: JSON.stringify({
        attemptId: input.attemptId,
        target: input.target,
        digest: input.digest,
        byteLength: input.byteLength,
      }),
      signal: controller.signal,
    });

    if (response.status === 404) {
      return { ok: false, code: "missing" };
    }

    if (response.status === 409) {
      return { ok: false, code: "conflict" };
    }

    if (response.status === 410) {
      return { ok: false, code: "expired" };
    }

    if (response.status === 503) {
      return { ok: false, code: "unavailable" };
    }

    if (!response.ok) {
      return { ok: false, code: "invalid_response" };
    }

    const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (mediaType !== "image/webp") {
      return { ok: false, code: "invalid_response" };
    }

    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null && Number(declaredLength) !== input.byteLength) {
      return { ok: false, code: "invalid_response" };
    }

    const bytes = await readBounded(response, SNAPSHOT_PHOTO_MAX_BYTES);
    if (
      bytes.length !== input.byteLength ||
      bytes.length > SNAPSHOT_PHOTO_MAX_BYTES ||
      detectImageSignature(bytes) !== "image/webp" ||
      looksLikeMarkupOrScript(bytes) ||
      createHash("sha256").update(bytes).digest("hex") !== input.digest
    ) {
      return { ok: false, code: "invalid_response" };
    }

    return { ok: true, bytes };
  } catch (error) {
    if (isAbortError(error)) {
      return { ok: false, code: "timeout" };
    }

    return { ok: false, code: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

async function readBounded(response: Response, maxBytes: number): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    return Buffer.alloc(0);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return Buffer.alloc(maxBytes + 1);
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

function isPhotoRequest(input: { digest: string; byteLength: number }): boolean {
  return (
    /^[0-9a-f]{64}$/.test(input.digest) &&
    Number.isInteger(input.byteLength) &&
    input.byteLength >= 1 &&
    input.byteLength <= SNAPSHOT_PHOTO_MAX_BYTES
  );
}

function isTrustedServerOrigin(origin: string, nodeEnv: string): boolean {
  let url: URL;

  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.username || url.password || url.search || url.hash) {
    return false;
  }

  if (url.pathname !== "/" && url.pathname !== "") {
    return false;
  }

  if (url.protocol === "https:") {
    return true;
  }

  return url.protocol === "http:" && nodeEnv !== "production";
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "AbortError"
  );
}
