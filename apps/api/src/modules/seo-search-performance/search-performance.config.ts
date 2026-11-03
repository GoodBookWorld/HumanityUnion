/**
 * SEO-12B.1 — search performance provider configuration (API service only).
 *
 * Values are read from the environment and never returned to callers; the
 * public description lists variable names only.
 */
import type { SearchProvider } from "./search-performance.types.js";

export const SEO_SEARCH_SYNC_ENABLED_ENV = "SEO_SEARCH_SYNC_ENABLED";
export const SEO_GSC_SITE_URL_ENV = "SEO_GSC_SITE_URL";
export const SEO_GSC_SERVICE_ACCOUNT_EMAIL_ENV = "SEO_GSC_SERVICE_ACCOUNT_EMAIL";
export const SEO_GSC_SERVICE_ACCOUNT_PRIVATE_KEY_ENV = "SEO_GSC_SERVICE_ACCOUNT_PRIVATE_KEY";
export const SEO_BING_SITE_URL_ENV = "SEO_BING_SITE_URL";
export const SEO_BING_CLIENT_ID_ENV = "SEO_BING_CLIENT_ID";
export const SEO_BING_CLIENT_SECRET_ENV = "SEO_BING_CLIENT_SECRET";
export const SEO_BING_REFRESH_TOKEN_ENV = "SEO_BING_REFRESH_TOKEN";

export const SEARCH_PERFORMANCE_REQUEST_TIMEOUT_MS = 15_000;
export const SEARCH_PERFORMANCE_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
export const SEARCH_PERFORMANCE_TOP_ROWS = 50;

export interface GoogleSearchConsoleConfig {
  readonly siteUrl: string;
  readonly clientEmail: string;
  readonly privateKey: string;
}

export interface BingWebmasterConfig {
  readonly siteUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
}

export type ProviderConfigResolution<T> =
  | { readonly configured: true; readonly config: T; readonly issues: readonly [] }
  | { readonly configured: false; readonly config: null; readonly issues: readonly string[] };

export interface SearchPerformanceConfig {
  readonly syncEnabled: boolean;
  readonly google: ProviderConfigResolution<GoogleSearchConsoleConfig>;
  readonly bing: ProviderConfigResolution<BingWebmasterConfig>;
}

type Env = Readonly<Record<string, string | undefined>>;

function read(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isGoogleSiteUrl(value: string): boolean {
  if (value.startsWith("sc-domain:")) {
    return /^sc-domain:[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);
  }
  return isHttpsUrl(value) && value.endsWith("/");
}

function normalizePrivateKey(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

function resolveGoogle(env: Env): ProviderConfigResolution<GoogleSearchConsoleConfig> {
  const siteUrl = read(env, SEO_GSC_SITE_URL_ENV);
  const clientEmail = read(env, SEO_GSC_SERVICE_ACCOUNT_EMAIL_ENV);
  const rawKey = read(env, SEO_GSC_SERVICE_ACCOUNT_PRIVATE_KEY_ENV);
  const issues: string[] = [];

  if (!siteUrl) {
    issues.push(`${SEO_GSC_SITE_URL_ENV} is missing`);
  } else if (!isGoogleSiteUrl(siteUrl)) {
    issues.push(`${SEO_GSC_SITE_URL_ENV} must be sc-domain:<domain> or an https URL ending in /`);
  }
  if (!clientEmail) {
    issues.push(`${SEO_GSC_SERVICE_ACCOUNT_EMAIL_ENV} is missing`);
  } else if (!/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/i.test(clientEmail)) {
    issues.push(`${SEO_GSC_SERVICE_ACCOUNT_EMAIL_ENV} is not a service account address`);
  }
  const privateKey = rawKey ? normalizePrivateKey(rawKey) : undefined;
  if (!privateKey) {
    issues.push(`${SEO_GSC_SERVICE_ACCOUNT_PRIVATE_KEY_ENV} is missing`);
  } else if (!/-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----/.test(privateKey)) {
    issues.push(`${SEO_GSC_SERVICE_ACCOUNT_PRIVATE_KEY_ENV} is not a PEM private key`);
  }

  if (issues.length > 0 || !siteUrl || !clientEmail || !privateKey) {
    return { configured: false, config: null, issues };
  }
  return { configured: true, config: { siteUrl, clientEmail, privateKey }, issues: [] };
}

function resolveBing(env: Env): ProviderConfigResolution<BingWebmasterConfig> {
  const siteUrl = read(env, SEO_BING_SITE_URL_ENV);
  const clientId = read(env, SEO_BING_CLIENT_ID_ENV);
  const clientSecret = read(env, SEO_BING_CLIENT_SECRET_ENV);
  const refreshToken = read(env, SEO_BING_REFRESH_TOKEN_ENV);
  const issues: string[] = [];

  if (!siteUrl) {
    issues.push(`${SEO_BING_SITE_URL_ENV} is missing`);
  } else if (!isHttpsUrl(siteUrl)) {
    issues.push(`${SEO_BING_SITE_URL_ENV} must be an https URL`);
  }
  if (!clientId) {
    issues.push(`${SEO_BING_CLIENT_ID_ENV} is missing`);
  }
  if (!clientSecret) {
    issues.push(`${SEO_BING_CLIENT_SECRET_ENV} is missing`);
  }
  if (!refreshToken) {
    issues.push(`${SEO_BING_REFRESH_TOKEN_ENV} is missing`);
  }

  if (issues.length > 0 || !siteUrl || !clientId || !clientSecret || !refreshToken) {
    return { configured: false, config: null, issues };
  }
  return {
    configured: true,
    config: { siteUrl, clientId, clientSecret, refreshToken },
    issues: [],
  };
}

export function resolveSearchPerformanceConfig(env: Env = process.env): SearchPerformanceConfig {
  return {
    syncEnabled: read(env, SEO_SEARCH_SYNC_ENABLED_ENV) === "true",
    google: resolveGoogle(env),
    bing: resolveBing(env),
  };
}

export function providerSiteUrl(
  config: SearchPerformanceConfig,
  provider: SearchProvider,
): string | null {
  return config[provider].configured ? config[provider].config.siteUrl : null;
}

/** Secret values that must never appear in logs, stored errors, or responses. */
export function collectSearchPerformanceSecrets(config: SearchPerformanceConfig): string[] {
  const secrets: string[] = [];
  if (config.google.configured) {
    secrets.push(config.google.config.privateKey);
  }
  if (config.bing.configured) {
    secrets.push(config.bing.config.clientSecret, config.bing.config.refreshToken);
  }
  return secrets;
}
