import dns from "node:dns/promises";
import type { LookupAddress, LookupOptions } from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";

import {
  isApprovedMediaRegistryDomain,
} from "@hu/media-registry";

import { isApprovedNewsFeedUrl } from "./public-news.config.js";
import { isUrlOnApprovedDomains } from "./public-news-source-trust.js";

const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
const FEED_URL_PATTERN = /\/(?:feed|rss|atom)(?:\/|$|[?#])/i;
const MOCK_ARTICLE_PATH_PATTERN = /\/mock[-_/]|mock-/i;

export const MAX_EXTERNAL_REDIRECTS = 5;

export function isPlaceholderArticleUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return MOCK_ARTICLE_PATH_PATTERN.test(`${parsed.pathname}${parsed.search}`);
  } catch {
    return true;
  }
}

/** Non-public address space: loopback, private, link-local, CGNAT, benchmark, documentation, multicast, reserved. */
const BLOCKED_IPV4 = (() => {
  const list = new net.BlockList();
  const ipv4: Array<[string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ];
  for (const [address, prefix] of ipv4) {
    list.addSubnet(address, prefix, "ipv4");
  }
  return list;
})();

/** Separate list: a BlockList also matches IPv4 addresses against IPv6 subnets. */
const BLOCKED_IPV6 = (() => {
  const list = new net.BlockList();
  const ipv6: Array<[string, number]> = [
    ["::", 128],
    ["::1", 128],
    ["::", 96],
    // NAT64 forms could reach any IPv4 address, private ones included.
    ["64:ff9b::", 96],
    ["64:ff9b:1::", 48],
    ["100::", 64],
    ["2001::", 32],
    ["2001:db8::", 32],
    ["2002::", 16],
    ["fc00::", 7],
    ["fe80::", 10],
    ["fec0::", 10],
    ["ff00::", 8],
  ];
  for (const [address, prefix] of ipv6) {
    list.addSubnet(address, prefix, "ipv6");
  }
  return list;
})();

/** True when an IP literal must never be contacted by the ingestion fetcher. */
export function isBlockedIpAddress(address: string): boolean {
  const normalized = address
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  const family = net.isIP(normalized);
  if (family === 4) {
    return BLOCKED_IPV4.check(normalized, "ipv4");
  }
  if (family === 6) {
    let canonical: string;
    try {
      canonical = new URL(`http://[${normalized}]/`).hostname.replace(/^\[|\]$/g, "");
    } catch {
      return true;
    }
    // IPv4-mapped (::ffff:a.b.c.d) addresses are never expected from a public feed host.
    if (canonical.startsWith("::ffff:")) {
      return true;
    }
    return BLOCKED_IPV6.check(canonical, "ipv6");
  }
  return true;
}

/**
 * Fetch policy failure. `code` maps to a health error code; messages are fixed and
 * safe to log (no addresses or URLs).
 */
export class ExternalFetchPolicyError extends Error {
  readonly code:
    | "blocked_host"
    | "too_many_redirects"
    | "unsupported_content_type"
    | "response_too_large"
    | "timeout";

  constructor(code: ExternalFetchPolicyError["code"], message: string) {
    super(message);
    this.name = "ExternalFetchPolicyError";
    this.code = code;
  }
}

/** Non-2xx response; same message as before, plus the status for health telemetry. */
export class ExternalRequestError extends Error {
  readonly status: number;
  /** Retry-After in milliseconds when the response provided one. */
  readonly retryAfterMs: number | null;

  constructor(status: number, retryAfterMs: number | null = null) {
    super(`External request failed with status ${status}.`);
    this.name = "ExternalRequestError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

interface PinnedAddress {
  address: string;
  family: 4 | 6;
}

interface SafeTarget extends PinnedAddress {
  /** Every validated address, for Happy Eyeballs fallback between them. */
  addresses: PinnedAddress[];
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "");
}

/**
 * Resolves a hostname once and validates every returned address. The returned
 * address is the only one the request may connect to (DNS pinning), so a second
 * resolution cannot swap in a private address.
 */
async function resolveSafeTarget(hostname: string, signal?: AbortSignal): Promise<SafeTarget> {
  const normalized = stripIpv6Brackets(hostname.toLowerCase());

  if (BLOCKED_HOSTNAMES.has(normalized) || normalized.endsWith(".localhost")) {
    throw new ExternalFetchPolicyError("blocked_host", "Blocked hostname.");
  }

  const literalFamily = net.isIP(normalized);
  if (literalFamily) {
    if (isBlockedIpAddress(normalized)) {
      throw new ExternalFetchPolicyError("blocked_host", "Blocked IP address.");
    }
    const literal: PinnedAddress = { address: normalized, family: literalFamily as 4 | 6 };
    return { ...literal, addresses: [literal] };
  }

  const resolved = await raceAbort(dns.lookup(normalized, { all: true, verbatim: true }), signal);
  if (resolved.length === 0) {
    throw new Error("getaddrinfo ENOTFOUND");
  }

  for (const entry of resolved) {
    if (isBlockedIpAddress(entry.address)) {
      throw new ExternalFetchPolicyError("blocked_host", "Blocked resolved IP address.");
    }
  }

  const addresses = resolved.map((entry): PinnedAddress => ({
    address: entry.address,
    family: entry.family === 6 ? 6 : 4,
  }));
  const primary = addresses.find((entry) => entry.family === 4) ?? addresses[0]!;
  return { ...primary, addresses };
}

function parseHttpUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ExternalFetchPolicyError("blocked_host", "Only http and https URLs are allowed.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ExternalFetchPolicyError("blocked_host", "Only http and https URLs are allowed.");
  }
  if (parsed.username || parsed.password) {
    throw new ExternalFetchPolicyError("blocked_host", "Blocked URL credentials.");
  }
  return parsed;
}

export interface ExternalHttpRequest {
  url: URL;
  /** Pre-validated primary address (IPv4 preferred). */
  address: string;
  family: 4 | 6;
  /** All pre-validated addresses; the connection may use only these. */
  addresses: readonly PinnedAddress[];
  headers: Record<string, string>;
  signal: AbortSignal;
}

export interface ExternalHttpResponse {
  status: number;
  /** Lowercase header names. */
  headers: Record<string, string | undefined>;
  body: AsyncIterable<Uint8Array>;
  destroy(): void;
}

export type ExternalHttpTransport = (request: ExternalHttpRequest) => Promise<ExternalHttpResponse>;

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** node:http(s) request whose socket connects only to the pre-validated address. */
export const pinnedNodeTransport: ExternalHttpTransport = (request) =>
  new Promise((resolve, reject) => {
    const client = request.url.protocol === "https:" ? https : http;
    const pinnedLookup = (
      _hostname: string,
      options: LookupOptions,
      callback: (
        error: NodeJS.ErrnoException | null,
        address: string | LookupAddress[],
        family?: number,
      ) => void,
    ) => {
      if (options.all) {
        callback(
          null,
          request.addresses.map((entry) => ({ address: entry.address, family: entry.family })),
        );
      } else {
        callback(null, request.address, request.family);
      }
    };
    const outgoing = client.request(
      request.url,
      {
        method: "GET",
        headers: request.headers,
        signal: request.signal,
        // A fresh socket per request; pooled sockets could bypass the pinned lookup.
        agent: false,
        lookup: pinnedLookup as unknown as net.LookupFunction,
      },
      (incoming) => {
        resolve({
          status: incoming.statusCode ?? 0,
          headers: {
            location: firstHeader(incoming.headers.location),
            "content-type": firstHeader(incoming.headers["content-type"]),
            "content-length": firstHeader(incoming.headers["content-length"]),
            "content-encoding": firstHeader(incoming.headers["content-encoding"]),
            "retry-after": firstHeader(incoming.headers["retry-after"]),
          },
          body: incoming,
          destroy: () => incoming.destroy(),
        });
      },
    );
    outgoing.on("error", reject);
    outgoing.end();
  });

let transportOverrideForTests: ExternalHttpTransport | null = null;

/** Tests only: replaces the network transport (DNS validation and policy still run). */
export function setExternalHttpTransportForTests(transport: ExternalHttpTransport | null): void {
  transportOverrideForTests = transport;
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new ExternalFetchPolicyError("timeout", "External request timed out.");
}

/** Rejects as soon as the signal aborts, even if the wrapped promise never settles. */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) {
    return promise;
  }
  if (signal.aborted) {
    promise.catch(() => undefined);
    return Promise.reject(abortReason(signal));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Text-like types a feed may legitimately use; anything else is refused before reading. */
function isAcceptableFeedContentType(value: string | undefined): boolean {
  const mediaType = value?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!mediaType) {
    return true;
  }
  if (mediaType.startsWith("text/")) {
    return true;
  }
  if (/xml|rss|atom|rdf/.test(mediaType)) {
    return true;
  }
  return mediaType === "application/octet-stream";
}

function parseRetryAfterMs(value: string | undefined, now: number): number | null {
  if (!value) {
    return null;
  }
  const seconds = Number(value.trim());
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

function sizeLimitError(): ExternalFetchPolicyError {
  return new ExternalFetchPolicyError(
    "response_too_large",
    "External response exceeded size limit.",
  );
}

async function readBoundedBody(
  response: ExternalHttpResponse,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  const iterator = response.body[Symbol.asyncIterator]();
  try {
    for (;;) {
      const next = await raceAbort(iterator.next(), signal);
      if (next.done) {
        break;
      }
      const chunk = Buffer.from(next.value);
      total += chunk.byteLength;
      if (total > maxBytes) {
        throw sizeLimitError();
      }
      chunks.push(chunk);
    }
  } catch (error) {
    response.destroy();
    void iterator.return?.();
    throw error;
  }
  return Buffer.concat(chunks, total);
}

/** Decompresses with the same output cap as the raw body (compression-bomb safe). */
function decodeContentEncoding(
  raw: Buffer,
  encoding: string | undefined,
  maxBytes: number,
): Buffer {
  const normalized = encoding?.trim().toLowerCase() ?? "";
  try {
    if (!normalized || normalized === "identity") {
      return raw;
    }
    if (normalized === "gzip" || normalized === "x-gzip") {
      return zlib.gunzipSync(raw, { maxOutputLength: maxBytes });
    }
    if (normalized === "deflate") {
      try {
        return zlib.inflateSync(raw, { maxOutputLength: maxBytes });
      } catch (error) {
        if (error instanceof RangeError) {
          throw error;
        }
        return zlib.inflateRawSync(raw, { maxOutputLength: maxBytes });
      }
    }
    if (normalized === "br") {
      return zlib.brotliDecompressSync(raw, { maxOutputLength: maxBytes });
    }
  } catch (error) {
    if (error instanceof RangeError || /maxOutputLength|larger than/i.test(String(error))) {
      throw sizeLimitError();
    }
    throw new ExternalFetchPolicyError(
      "unsupported_content_type",
      "External response could not be decoded.",
    );
  }
  throw new ExternalFetchPolicyError("unsupported_content_type", "Unsupported content encoding.");
}

function declaredCharset(contentType: string | undefined, body: Buffer): string | null {
  const header = /charset\s*=\s*"?([\w.:-]+)"?/i.exec(contentType ?? "")?.[1];
  if (header) {
    return header.toLowerCase();
  }
  const prolog = body.subarray(0, 256).toString("latin1");
  return /<\?xml[^>]*encoding\s*=\s*["']([\w.:-]+)["']/i.exec(prolog)?.[1]?.toLowerCase() ?? null;
}

/**
 * Valid UTF-8 is always read as UTF-8 (unchanged behaviour). Only bodies that are
 * not valid UTF-8 use a declared legacy charset such as windows-1251.
 */
function decodeText(body: Buffer, contentType: string | undefined): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    const charset = declaredCharset(contentType, body);
    if (charset && charset !== "utf-8" && charset !== "utf8") {
      try {
        return new TextDecoder(charset).decode(body);
      } catch {
        // Unsupported label: fall through to lossy UTF-8.
      }
    }
    return body.toString("utf8");
  }
}

function requestHeaders(url: URL): Record<string, string> {
  return {
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    "Accept-Encoding": "gzip, deflate, br",
    // Some publishers (e.g. Politico) reject bare bot UAs with HTTP 403.
    "User-Agent": "Mozilla/5.0 (compatible; HumanityUnionPublicNewsBot/1.0; +https://huws.org)",
    ...(url.hostname.toLowerCase().includes("politico.com")
      ? { Referer: "https://www.politico.com/" }
      : {}),
  };
}

export interface FetchExternalDocumentOptions {
  /** Deadline for the whole fetch: DNS, every redirect hop and the body. */
  timeoutMs: number;
  maxBytes: number;
  requireApprovedRssFeed?: boolean;
  /** Receives the HTTP status of the final response (health telemetry). */
  onStatus?: (status: number) => void;
}

export async function fetchExternalDocument(
  url: string,
  options: FetchExternalDocumentOptions,
): Promise<string> {
  let current = parseHttpUrl(url);

  if (options.requireApprovedRssFeed && !isApprovedNewsFeedUrl(url)) {
    throw new Error("RSS feed URL is not in the approved media registry.");
  }

  const transport = transportOverrideForTests ?? pinnedNodeTransport;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new ExternalFetchPolicyError("timeout", "External request timed out.")),
    options.timeoutMs,
  );
  const signal = controller.signal;

  try {
    for (let hop = 0; ; hop += 1) {
      const target = await resolveSafeTarget(current.hostname, signal);
      const response = await raceAbort(
        transport({
          url: current,
          address: target.address,
          family: target.family,
          addresses: target.addresses,
          headers: requestHeaders(current),
          signal,
        }),
        signal,
      );

      if (REDIRECT_STATUSES.has(response.status) && response.headers.location) {
        response.destroy();
        if (hop >= MAX_EXTERNAL_REDIRECTS) {
          throw new ExternalFetchPolicyError("too_many_redirects", "Too many redirects.");
        }
        let next: string;
        try {
          next = new URL(response.headers.location, current).toString();
        } catch {
          throw new ExternalFetchPolicyError("blocked_host", "Blocked redirect target.");
        }
        current = parseHttpUrl(next);
        continue;
      }

      options.onStatus?.(response.status);

      if (response.status < 200 || response.status >= 300) {
        response.destroy();
        throw new ExternalRequestError(
          response.status,
          parseRetryAfterMs(response.headers["retry-after"], Date.now()),
        );
      }

      const contentType = response.headers["content-type"];
      if (!isAcceptableFeedContentType(contentType)) {
        response.destroy();
        throw new ExternalFetchPolicyError("unsupported_content_type", "Unsupported content type.");
      }

      const declaredLength = Number(response.headers["content-length"]);
      if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes) {
        response.destroy();
        throw sizeLimitError();
      }

      const raw = await readBoundedBody(response, options.maxBytes, signal);
      const decoded = decodeContentEncoding(
        raw,
        response.headers["content-encoding"],
        options.maxBytes,
      );
      return decodeText(decoded, contentType);
    }
  } catch (error) {
    if (signal.aborted && !(error instanceof ExternalRequestError)) {
      throw new ExternalFetchPolicyError("timeout", "External request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export interface ExternalFetchRetryPolicy {
  /** Total attempts including the first. */
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_FEED_RETRY_POLICY: ExternalFetchRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 10_000,
};

/** Transient failures only: timeouts, connection errors, HTTP 408/425/429 and 5xx. */
export function isRetryableFetchError(error: unknown): boolean {
  if (error instanceof ExternalRequestError) {
    return (
      error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500
    );
  }
  if (error instanceof ExternalFetchPolicyError) {
    return error.code === "timeout";
  }
  if (error instanceof Error && /approved media registry/i.test(error.message)) {
    return false;
  }
  return error instanceof Error;
}

let retrySleepForTests: ((ms: number) => Promise<void>) | null = null;

/** Tests only: replaces the backoff sleep (receives the computed delay). */
export function setExternalFetchRetrySleepForTests(
  sleep: ((ms: number) => Promise<void>) | null,
): void {
  retrySleepForTests = sleep;
}

export function computeRetryDelayMs(
  attempt: number,
  policy: ExternalFetchRetryPolicy,
  error: unknown,
  random: () => number = Math.random,
): number {
  const exponential = policy.baseDelayMs * 2 ** (attempt - 1);
  const jittered = exponential * (0.5 + random() / 2);
  const retryAfter = error instanceof ExternalRequestError ? error.retryAfterMs : null;
  return Math.min(policy.maxDelayMs, Math.max(jittered, retryAfter ?? 0));
}

/** fetchExternalDocument with bounded exponential backoff for transient failures. */
export async function fetchExternalDocumentWithRetry(
  url: string,
  options: FetchExternalDocumentOptions & {
    retry?: ExternalFetchRetryPolicy;
    onRetry?: (attempt: number, error: unknown) => void;
  },
): Promise<string> {
  const policy = options.retry ?? DEFAULT_FEED_RETRY_POLICY;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetchExternalDocument(url, options);
    } catch (error) {
      if (attempt >= policy.maxAttempts || !isRetryableFetchError(error)) {
        throw error;
      }
      options.onRetry?.(attempt, error);
      const delay = computeRetryDelayMs(attempt, policy, error);
      await (retrySleepForTests
        ? retrySleepForTests(delay)
        : new Promise<void>((resolve) => setTimeout(resolve, delay)));
    }
  }
}

function isFeedLikeArticleUrl(url: URL): boolean {
  const path = url.pathname.toLowerCase();

  if (path.endsWith(".xml") || path.endsWith(".rss") || path.endsWith(".atom")) {
    return true;
  }

  if (MOCK_ARTICLE_PATH_PATTERN.test(`${url.pathname}${url.search}`)) {
    return true;
  }

  return FEED_URL_PATTERN.test(`${url.pathname}${url.search}`);
}

function isApprovedPublisherArticleUrl(url: URL): boolean {
  return isApprovedMediaRegistryDomain(url.hostname.toLowerCase());
}

export async function validatePublicArticleUrl(
  url: string,
  options: {
    timeoutMs: number;
    /**
     * Admin source trust: the article host must be one of these domains (or a
     * subdomain). When omitted, the static registry domain list applies.
     */
    allowedDomains?: readonly string[];
  },
): Promise<boolean> {
  let parsed: URL;

  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  if (isFeedLikeArticleUrl(parsed)) {
    return false;
  }

  const approved = options.allowedDomains
    ? isUrlOnApprovedDomains(parsed.toString(), options.allowedDomains)
    : isApprovedPublisherArticleUrl(parsed);
  if (!approved) {
    return false;
  }

  try {
    await resolveSafeTarget(parsed.hostname);
  } catch {
    return false;
  }

  // Approved article URLs are trusted after SSRF hostname checks.
  // Do not require a live HTML GET: publishers often paywall, bot-gate (403),
  // or reset HTTP/2 streams, and Humanity Union only links out — it never
  // ingests full article bodies.
  void options.timeoutMs;
  return true;
}
