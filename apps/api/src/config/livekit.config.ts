import { LiveKitConfigurationError } from "../modules/direct-conversation-calls/direct-conversation-call.errors.js";

/**
 * VC-04B.1 — server-side LiveKit contract.
 *
 * Credentials stay on the API and the future media VM. The browser receives
 * only a short-lived access token and LIVEKIT_URL after call authorization.
 * Humanity Union JWT secrets are not used.
 *
 * Final LiveKit DNS names are not in the repository. This module does not
 * invent them. It rejects the documented public R2 host and known web/API
 * hosts that belong to the other deployment. A dedicated calls hostname
 * allowlist waits for the VM/DNS step.
 */

export const LIVEKIT_TOKEN_TTL = "10m";

/** Documented staging public R2 bucket host. Never a LiveKit endpoint. */
export const LIVEKIT_FORBIDDEN_PUBLIC_MEDIA_HOST = "media-staging.huws.org";

const PRODUCTION_PLATFORM_HOSTS = new Set(["huws.org", "www.huws.org", "api.huws.org"]);

const STAGING_PLATFORM_HOSTS = new Set(["staging.huws.org", "api-staging.huws.org"]);

export interface LiveKitServerConfig {
  apiKey: string;
  apiSecret: string;
  /** Browser WebSocket endpoint, always wss. */
  url: string;
  /** Room service HTTP origin derived from the wss URL. */
  httpHost: string;
}

function readRawPlatformMode(): string {
  return process.env.PLATFORM_MODE?.trim().toLowerCase() ?? "";
}

function readR2PublicHost(): string | null {
  const raw = process.env.R2_PUBLIC_BASE_URL?.trim();

  if (!raw) {
    return null;
  }

  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function assertLiveKitDeploymentBoundary(url: URL): void {
  if (url.protocol !== "wss:") {
    throw new LiveKitConfigurationError("LIVEKIT_URL must be a wss:// endpoint.");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new LiveKitConfigurationError("LIVEKIT_URL must not carry credentials or a query.");
  }

  const host = url.hostname.toLowerCase();
  const r2Host = readR2PublicHost();
  const mode = readRawPlatformMode();

  if (host === LIVEKIT_FORBIDDEN_PUBLIC_MEDIA_HOST || (r2Host !== null && host === r2Host)) {
    throw new LiveKitConfigurationError(
      "LIVEKIT_URL must not use the public media bucket hostname.",
    );
  }

  if (mode === "staging" && PRODUCTION_PLATFORM_HOSTS.has(host)) {
    throw new LiveKitConfigurationError(
      "Staging cannot mint LiveKit credentials for a production host.",
    );
  }

  if (mode === "production" && (STAGING_PLATFORM_HOSTS.has(host) || host.split(".").includes("staging") || host.includes("-staging"))) {
    throw new LiveKitConfigurationError(
      "Production cannot mint LiveKit credentials for a staging host.",
    );
  }
}

export function resolveLiveKitConfig(): LiveKitServerConfig {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim() ?? "";
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim() ?? "";
  const urlRaw = process.env.LIVEKIT_URL?.trim() ?? "";

  if (!apiKey || !apiSecret || !urlRaw) {
    throw new LiveKitConfigurationError();
  }

  let parsed: URL;

  try {
    parsed = new URL(urlRaw);
  } catch {
    throw new LiveKitConfigurationError("LIVEKIT_URL must be a wss:// endpoint.");
  }

  assertLiveKitDeploymentBoundary(parsed);

  const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");

  return {
    apiKey,
    apiSecret,
    url: `wss://${parsed.host}${path}`,
    httpHost: `https://${parsed.host}`,
  };
}
