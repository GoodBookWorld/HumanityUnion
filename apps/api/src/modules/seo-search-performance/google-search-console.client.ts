/**
 * SEO-12B.1 — Google Search Console read-only client (service account, OAuth 2.0
 * JWT bearer grant, `webmasters.readonly` scope). Access tokens stay in memory.
 */
import jwt from "jsonwebtoken";

import type { GoogleSearchConsoleConfig } from "./search-performance.config.js";
import { isDayKey } from "./search-performance.dates.js";
import {
  classifyHttpFailure,
  requestBoundedJson,
  SearchProviderError,
  toFiniteNonNegative,
  withSearchProviderRetry,
  type FetchLike,
  type RetryOptions,
} from "./search-performance.http.js";
import type { GoogleSitemapStatus } from "./search-performance.types.js";

export const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const GOOGLE_SEARCH_CONSOLE_API_BASE = "https://www.googleapis.com/webmasters/v3";

const TOKEN_LIFETIME_SECONDS = 3600;
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const MAX_SITEMAPS = 50;
const LABEL = "Google Search Console";

export type GoogleSearchDimension = "date" | "query" | "page";

export interface GoogleSearchAnalyticsRequest {
  readonly startDate: string;
  readonly endDate: string;
  readonly dimensions: readonly GoogleSearchDimension[];
  readonly rowLimit: number;
  readonly dataState: "final" | "all";
}

export interface GoogleSearchAnalyticsRow {
  readonly keys: readonly string[];
  readonly clicks: number;
  readonly impressions: number;
  readonly ctr: number | null;
  readonly position: number | null;
}

export interface GoogleSearchAnalyticsResult {
  readonly rows: readonly GoogleSearchAnalyticsRow[];
  /** First day whose data is still being collected (only with dataState "all"). */
  readonly firstIncompleteDate: string | null;
}

export interface GoogleSearchConsoleClient {
  querySearchAnalytics(request: GoogleSearchAnalyticsRequest): Promise<GoogleSearchAnalyticsResult>;
  listSitemaps(): Promise<GoogleSitemapStatus[]>;
}

export interface GoogleClientDeps {
  readonly fetchImpl: FetchLike;
  readonly now?: () => Date;
  readonly timeoutMs: number;
  readonly maxBytes: number;
  readonly retry?: RetryOptions;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRow(raw: unknown, dimensionCount: number): GoogleSearchAnalyticsRow | null {
  if (!isRecord(raw)) {
    return null;
  }
  const keys = Array.isArray(raw.keys) ? raw.keys : dimensionCount === 0 ? [] : null;
  if (
    !keys ||
    keys.length !== dimensionCount ||
    !keys.every((key) => typeof key === "string" && key.length <= 2048)
  ) {
    return null;
  }
  const clicks = toFiniteNonNegative(raw.clicks);
  const impressions = toFiniteNonNegative(raw.impressions);
  if (clicks === null || impressions === null) {
    return null;
  }
  const ctr = toFiniteNonNegative(raw.ctr);
  const position = toFiniteNonNegative(raw.position);
  return {
    keys: keys as string[],
    clicks,
    impressions,
    ctr: ctr !== null && ctr <= 1 ? ctr : null,
    position: position !== null && position > 0 ? position : null,
  };
}

function parseSitemap(raw: unknown): GoogleSitemapStatus | null {
  if (!isRecord(raw) || typeof raw.path !== "string" || raw.path.length > 2048) {
    return null;
  }
  let submittedUrls: number | null = null;
  if (Array.isArray(raw.contents)) {
    for (const content of raw.contents) {
      const submitted = isRecord(content) ? toFiniteNonNegative(content.submitted) : null;
      if (submitted !== null) {
        submittedUrls = (submittedUrls ?? 0) + submitted;
      }
    }
  }
  const dateOrNull = (value: unknown) =>
    typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
  return {
    path: raw.path,
    type: typeof raw.type === "string" ? raw.type : null,
    isSitemapsIndex: raw.isSitemapsIndex === true,
    isPending: raw.isPending === true,
    lastSubmitted: dateOrNull(raw.lastSubmitted),
    lastDownloaded: dateOrNull(raw.lastDownloaded),
    errors: toFiniteNonNegative(raw.errors),
    warnings: toFiniteNonNegative(raw.warnings),
    submittedUrls,
  };
}

export function createGoogleSearchConsoleClient(
  config: GoogleSearchConsoleConfig,
  deps: GoogleClientDeps,
): GoogleSearchConsoleClient {
  const now = deps.now ?? (() => new Date());
  let cachedToken: { value: string; expiresAtMs: number } | null = null;

  async function fetchAccessToken(): Promise<string> {
    const current = now().getTime();
    if (cachedToken && cachedToken.expiresAtMs - TOKEN_REFRESH_MARGIN_MS > current) {
      return cachedToken.value;
    }
    const issuedAt = Math.floor(current / 1000);
    let assertion: string;
    try {
      assertion = jwt.sign(
        {
          iss: config.clientEmail,
          scope: GOOGLE_SEARCH_CONSOLE_SCOPE,
          aud: GOOGLE_OAUTH_TOKEN_URL,
          iat: issuedAt,
          exp: issuedAt + TOKEN_LIFETIME_SECONDS,
        },
        config.privateKey,
        { algorithm: "RS256" },
      );
    } catch {
      throw new SearchProviderError(
        "auth_failed",
        `${LABEL} service account key could not sign the token request.`,
      );
    }

    const response = await requestBoundedJson({
      fetchImpl: deps.fetchImpl,
      url: GOOGLE_OAUTH_TOKEN_URL,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }).toString(),
      },
      label: `${LABEL} token exchange`,
      timeoutMs: deps.timeoutMs,
      maxBytes: 64 * 1024,
    });
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        throw new SearchProviderError(
          "auth_failed",
          `${LABEL} token exchange was rejected (HTTP ${response.status}).`,
          { httpStatus: response.status },
        );
      }
      throw classifyHttpFailure(`${LABEL} token exchange`, response.status, response.retryAfter);
    }
    const body = response.body;
    const token = isRecord(body) && typeof body.access_token === "string" ? body.access_token : "";
    const expiresIn = isRecord(body) ? toFiniteNonNegative(body.expires_in) : null;
    if (!token) {
      throw new SearchProviderError(
        "invalid_response",
        `${LABEL} token exchange returned no token.`,
      );
    }
    cachedToken = { value: token, expiresAtMs: current + (expiresIn ?? 3600) * 1000 };
    return token;
  }

  async function authorizedJson(path: string, init: RequestInit): Promise<unknown> {
    return withSearchProviderRetry(async () => {
      const token = await fetchAccessToken();
      const response = await requestBoundedJson({
        fetchImpl: deps.fetchImpl,
        url: `${GOOGLE_SEARCH_CONSOLE_API_BASE}${path}`,
        init: {
          ...init,
          headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
        },
        label: LABEL,
        timeoutMs: deps.timeoutMs,
        maxBytes: deps.maxBytes,
      });
      if (!response.ok) {
        if (response.status === 401) {
          cachedToken = null;
        }
        throw classifyHttpFailure(LABEL, response.status, response.retryAfter);
      }
      return response.body;
    }, deps.retry);
  }

  const sitePath = `/sites/${encodeURIComponent(config.siteUrl)}`;

  return {
    async querySearchAnalytics(request) {
      if (!isDayKey(request.startDate) || !isDayKey(request.endDate)) {
        throw new SearchProviderError("request_rejected", `${LABEL} request dates are invalid.`);
      }
      const rowLimit = Math.max(1, Math.min(25_000, Math.floor(request.rowLimit)));
      const body = await authorizedJson(`${sitePath}/searchAnalytics/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: request.startDate,
          endDate: request.endDate,
          dimensions: request.dimensions,
          type: "web",
          rowLimit,
          dataState: request.dataState,
        }),
      });
      if (!isRecord(body)) {
        throw new SearchProviderError(
          "invalid_response",
          `${LABEL} returned an unexpected response.`,
        );
      }
      const rawRows = body.rows === undefined ? [] : body.rows;
      if (!Array.isArray(rawRows)) {
        throw new SearchProviderError(
          "invalid_response",
          `${LABEL} returned an unexpected response.`,
        );
      }
      const rows = rawRows
        .slice(0, rowLimit)
        .map((row) => parseRow(row, request.dimensions.length))
        .filter((row): row is GoogleSearchAnalyticsRow => row !== null);
      const metadata = isRecord(body.metadata) ? body.metadata : null;
      const firstIncomplete = metadata?.first_incomplete_date;
      return {
        rows,
        firstIncompleteDate: isDayKey(firstIncomplete) ? firstIncomplete : null,
      };
    },

    async listSitemaps() {
      const body = await authorizedJson(`${sitePath}/sitemaps`, { method: "GET" });
      if (!isRecord(body)) {
        throw new SearchProviderError(
          "invalid_response",
          `${LABEL} returned an unexpected response.`,
        );
      }
      const raw = body.sitemap === undefined ? [] : body.sitemap;
      if (!Array.isArray(raw)) {
        throw new SearchProviderError(
          "invalid_response",
          `${LABEL} returned an unexpected response.`,
        );
      }
      return raw
        .slice(0, MAX_SITEMAPS)
        .map(parseSitemap)
        .filter((row): row is GoogleSitemapStatus => row !== null);
    },
  };
}
