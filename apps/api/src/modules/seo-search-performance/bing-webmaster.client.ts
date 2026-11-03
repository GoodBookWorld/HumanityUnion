/**
 * SEO-12B.1 — Bing Webmaster read-only client (OAuth 2.0 refresh token,
 * `webmaster.read` scope). Only the read methods below can be called.
 */
import type { BingWebmasterConfig } from "./search-performance.config.js";
import { parseBingDateToDay } from "./search-performance.dates.js";
import {
  classifyHttpFailure,
  requestBoundedJson,
  SearchProviderError,
  toFiniteNonNegative,
  withSearchProviderRetry,
  type FetchLike,
  type RetryOptions,
} from "./search-performance.http.js";
import type { BingCrawlDay } from "./search-performance.types.js";

export const BING_OAUTH_TOKEN_URL = "https://www.bing.com/webmasters/oauth/token";
export const BING_WEBMASTER_API_BASE = "https://www.bing.com/webmaster/api.svc/json";

export const BING_READ_METHODS = [
  "GetRankAndTrafficStats",
  "GetQueryStats",
  "GetPageStats",
  "GetCrawlStats",
] as const;
export type BingReadMethod = (typeof BING_READ_METHODS)[number];

const TOKEN_REFRESH_MARGIN_MS = 60_000;
const MAX_ROWS = 5_000;
const LABEL = "Bing Webmaster";

export interface BingTrafficDay {
  readonly day: string;
  readonly clicks: number;
  readonly impressions: number;
}

export interface BingKeyedStatsRow {
  /** Query text (GetQueryStats) or page URL (GetPageStats). */
  readonly key: string;
  readonly day: string;
  readonly clicks: number;
  readonly impressions: number;
  readonly avgImpressionPosition: number | null;
  readonly avgClickPosition: number | null;
}

export interface BingWebmasterClient {
  getRankAndTrafficStats(): Promise<BingTrafficDay[]>;
  getQueryStats(): Promise<BingKeyedStatsRow[]>;
  getPageStats(): Promise<BingKeyedStatsRow[]>;
  getCrawlStats(): Promise<BingCrawlDay[]>;
}

export interface BingClientDeps {
  readonly fetchImpl: FetchLike;
  readonly now?: () => Date;
  readonly timeoutMs: number;
  readonly maxBytes: number;
  readonly retry?: RetryOptions;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positionOrNull(value: unknown): number | null {
  const numeric = toFiniteNonNegative(value);
  return numeric !== null && numeric > 0 ? numeric : null;
}

function parseTrafficDay(raw: unknown): BingTrafficDay | null {
  if (!isRecord(raw)) {
    return null;
  }
  const day = parseBingDateToDay(raw.Date);
  const clicks = toFiniteNonNegative(raw.Clicks);
  const impressions = toFiniteNonNegative(raw.Impressions);
  return day && clicks !== null && impressions !== null ? { day, clicks, impressions } : null;
}

function parseKeyedRow(raw: unknown): BingKeyedStatsRow | null {
  if (!isRecord(raw) || typeof raw.Query !== "string" || !raw.Query || raw.Query.length > 2048) {
    return null;
  }
  const day = parseBingDateToDay(raw.Date);
  const clicks = toFiniteNonNegative(raw.Clicks);
  const impressions = toFiniteNonNegative(raw.Impressions);
  if (!day || clicks === null || impressions === null) {
    return null;
  }
  return {
    key: raw.Query,
    day,
    clicks,
    impressions,
    avgImpressionPosition: positionOrNull(raw.AvgImpressionPosition),
    avgClickPosition: positionOrNull(raw.AvgClickPosition),
  };
}

function parseCrawlDay(raw: unknown): BingCrawlDay | null {
  if (!isRecord(raw)) {
    return null;
  }
  const day = parseBingDateToDay(raw.Date);
  if (!day) {
    return null;
  }
  return {
    day,
    inIndex: toFiniteNonNegative(raw.InIndex),
    crawledPages: toFiniteNonNegative(raw.CrawledPages),
    crawlErrors: toFiniteNonNegative(raw.CrawlErrors),
    blockedByRobotsTxt: toFiniteNonNegative(raw.BlockedByRobotsTxt),
    code4xx: toFiniteNonNegative(raw.Code4xx),
    code5xx: toFiniteNonNegative(raw.Code5xx),
  };
}

export function createBingWebmasterClient(
  config: BingWebmasterConfig,
  deps: BingClientDeps,
): BingWebmasterClient {
  const now = deps.now ?? (() => new Date());
  let cachedToken: { value: string; expiresAtMs: number } | null = null;

  async function fetchAccessToken(): Promise<string> {
    const current = now().getTime();
    if (cachedToken && cachedToken.expiresAtMs - TOKEN_REFRESH_MARGIN_MS > current) {
      return cachedToken.value;
    }
    const response = await requestBoundedJson({
      fetchImpl: deps.fetchImpl,
      url: BING_OAUTH_TOKEN_URL,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: config.refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      },
      label: `${LABEL} token refresh`,
      timeoutMs: deps.timeoutMs,
      maxBytes: 64 * 1024,
    });
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        throw new SearchProviderError(
          "auth_failed",
          `${LABEL} token refresh was rejected (HTTP ${response.status}).`,
          { httpStatus: response.status },
        );
      }
      throw classifyHttpFailure(`${LABEL} token refresh`, response.status, response.retryAfter);
    }
    const body = response.body;
    const token = isRecord(body) && typeof body.access_token === "string" ? body.access_token : "";
    const expiresIn = isRecord(body) ? toFiniteNonNegative(body.expires_in) : null;
    if (!token) {
      throw new SearchProviderError(
        "invalid_response",
        `${LABEL} token refresh returned no token.`,
      );
    }
    cachedToken = { value: token, expiresAtMs: current + (expiresIn ?? 3600) * 1000 };
    return token;
  }

  async function callReadMethod(method: BingReadMethod): Promise<unknown[]> {
    if (!(BING_READ_METHODS as readonly string[]).includes(method)) {
      throw new SearchProviderError("request_rejected", `${LABEL} method is not allowed.`);
    }
    return withSearchProviderRetry(async () => {
      const token = await fetchAccessToken();
      const url = `${BING_WEBMASTER_API_BASE}/${method}?${new URLSearchParams({
        siteUrl: config.siteUrl,
      }).toString()}`;
      const response = await requestBoundedJson({
        fetchImpl: deps.fetchImpl,
        url,
        init: {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
        label: `${LABEL} ${method}`,
        timeoutMs: deps.timeoutMs,
        maxBytes: deps.maxBytes,
      });
      if (!response.ok) {
        if (response.status === 401) {
          cachedToken = null;
        }
        if (response.status === 400 && isRecord(response.body)) {
          const errorCode = toFiniteNonNegative(response.body.ErrorCode);
          const message = typeof response.body.Message === "string" ? response.body.Message : "";
          if (/auth|token|permission|InvalidApiKey/i.test(message)) {
            cachedToken = null;
            throw new SearchProviderError(
              "auth_failed",
              `${LABEL} ${method} rejected the credentials (ErrorCode ${errorCode ?? "unknown"}).`,
              { httpStatus: 400 },
            );
          }
          throw new SearchProviderError(
            "request_rejected",
            `${LABEL} ${method} rejected the request (ErrorCode ${errorCode ?? "unknown"}).`,
            { httpStatus: 400 },
          );
        }
        throw classifyHttpFailure(`${LABEL} ${method}`, response.status, response.retryAfter);
      }
      const body = response.body;
      if (!isRecord(body) || !Array.isArray(body.d)) {
        throw new SearchProviderError(
          "invalid_response",
          `${LABEL} ${method} returned an unexpected response.`,
        );
      }
      return body.d.slice(0, MAX_ROWS);
    }, deps.retry);
  }

  return {
    async getRankAndTrafficStats() {
      return (await callReadMethod("GetRankAndTrafficStats"))
        .map(parseTrafficDay)
        .filter((row): row is BingTrafficDay => row !== null);
    },
    async getQueryStats() {
      return (await callReadMethod("GetQueryStats"))
        .map(parseKeyedRow)
        .filter((row): row is BingKeyedStatsRow => row !== null);
    },
    async getPageStats() {
      return (await callReadMethod("GetPageStats"))
        .map(parseKeyedRow)
        .filter((row): row is BingKeyedStatsRow => row !== null);
    },
    async getCrawlStats() {
      return (await callReadMethod("GetCrawlStats"))
        .map(parseCrawlDay)
        .filter((row): row is BingCrawlDay => row !== null);
    },
  };
}
