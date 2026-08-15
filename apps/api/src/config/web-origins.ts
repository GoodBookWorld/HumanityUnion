import { resolveCorsOrigin } from "./validate-production-environment.js";

/**
 * Launch Blocker Recovery Pack 01 — credentialed browser origins.
 *
 * CORS + Origin guard share one allowlist. Production remains an explicit
 * configured list (never `*`). Development also accepts loopback http(s)
 * origins so alternate local Web ports (3000/3010/3011) can authenticate
 * without disabling the guard.
 *
 * Reads NODE_ENV directly to avoid a circular import with `environment.ts`.
 */

function resolveNodeEnv(): string {
  return process.env.NODE_ENV ?? "development";
}

function parseOriginList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function resolveConfiguredWebOrigins(): string[] {
  const fromEnv = parseOriginList(resolveCorsOrigin());

  if (fromEnv.length > 0) {
    return [...new Set(fromEnv)];
  }

  return ["http://localhost:3000"];
}

function isLoopbackHttpOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * True when `origin` may receive credentialed API responses.
 * Production: configured list only.
 * Development/test: configured list + loopback http(s) hosts.
 */
export function isAllowedWebOrigin(origin: string | undefined | null): boolean {
  if (typeof origin !== "string") {
    return false;
  }

  const trimmed = origin.trim();

  if (!trimmed) {
    return false;
  }

  const configured = resolveConfiguredWebOrigins();

  if (configured.includes(trimmed)) {
    return true;
  }

  if (resolveNodeEnv() === "production") {
    return false;
  }

  return isLoopbackHttpOrigin(trimmed);
}

/**
 * `cors` package origin callback — reflects the request Origin when allowed.
 * Never returns `*`.
 */
export function resolveCorsOriginOption(
  requestOrigin: string | undefined,
  callback: (err: Error | null, origin?: boolean | string) => void,
): void {
  if (!requestOrigin) {
    // Non-browser clients (curl, API tests) omit Origin.
    callback(null, true);
    return;
  }

  if (isAllowedWebOrigin(requestOrigin)) {
    callback(null, requestOrigin);
    return;
  }

  callback(null, false);
}
