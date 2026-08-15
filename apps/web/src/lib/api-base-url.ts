/**
 * Canonical Web → API origin.
 * Must be an origin only (https://api.huws.org), never .../api or .../api/v1.
 */
export function normalizeApiBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

export function assertApiBaseUrlShape(raw: string): void {
  const value = normalizeApiBaseUrl(raw);
  if (!value) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is empty.");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`NEXT_PUBLIC_API_BASE_URL is not a valid URL: ${raw}`);
  }

  if (parsed.pathname && parsed.pathname !== "/") {
    throw new Error(
      `NEXT_PUBLIC_API_BASE_URL must be an origin without a path (got pathname "${parsed.pathname}"). ` +
        "Client paths already include /api/v1/....",
    );
  }
}

const configured = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

if (process.env.NODE_ENV === "production") {
  assertApiBaseUrlShape(configured);
}

export const API_BASE_URL = normalizeApiBaseUrl(configured);
