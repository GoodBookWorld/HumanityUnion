import {
  DEFAULT_INTEGRITY_MEDIA_RETURN_PATH,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV,
  INTEGRITY_MEDIA_LINK_RETURN_PATH_ENV,
} from "./external-author-link.constants.js";

export interface IntegrityMediaLinkConfig {
  hmacSecret: string | null;
  returnOrigin: string | null;
  returnPath: string;
}

/**
 * Read at call time. Missing values leave the feature dormant.
 * Startup does not require Integrity Media to be reachable or configured.
 */
export function resolveIntegrityMediaLinkConfig(
  env: NodeJS.ProcessEnv = process.env,
): IntegrityMediaLinkConfig {
  const configuredPath = env[INTEGRITY_MEDIA_LINK_RETURN_PATH_ENV]?.trim();

  return {
    hmacSecret: env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV]?.trim() || null,
    returnOrigin: env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV]?.trim() || null,
    returnPath: configuredPath || DEFAULT_INTEGRITY_MEDIA_RETURN_PATH,
  };
}

export function buildIntegrityMediaReturnUrl(input: {
  status: "confirmed" | "cancelled";
  attemptState: string;
  resultCode?: string;
  config?: IntegrityMediaLinkConfig;
  nodeEnv?: string;
}): string | null {
  const config = input.config ?? resolveIntegrityMediaLinkConfig();
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const origin = config.returnOrigin;

  if (!origin || !isAllowedReturnOrigin(origin, nodeEnv)) {
    return null;
  }

  if (!isAllowedReturnPath(config.returnPath)) {
    return null;
  }

  const configured = new URL(origin);
  const target = new URL(config.returnPath, configured.origin);

  if (target.origin !== configured.origin || target.pathname !== config.returnPath) {
    return null;
  }

  target.searchParams.set("state", input.attemptState);
  target.searchParams.set("status", input.status);

  if (input.status === "confirmed" && input.resultCode) {
    target.searchParams.set("code", input.resultCode);
  }

  return target.toString();
}

function isAllowedReturnOrigin(origin: string, nodeEnv: string): boolean {
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

function isAllowedReturnPath(path: string): boolean {
  if (!isSingleSafePath(path)) {
    return false;
  }

  let decoded = path;

  try {
    decoded = decodeURIComponent(path);
  } catch {
    return false;
  }

  if (decoded !== path && !isSingleSafePath(decoded)) {
    return false;
  }

  return true;
}

function isSingleSafePath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return false;
  }

  if (/[\s?#\\@]/.test(path)) {
    return false;
  }

  return path.split("/").every((segment) => segment !== "." && segment !== "..");
}
