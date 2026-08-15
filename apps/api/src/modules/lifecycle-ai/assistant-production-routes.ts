/**
 * Assistant Production Hardening Pack 02 — production route inventory.
 * Only these Assistant HTTP paths are mounted in apps/api/src/app.ts.
 */

export const CANONICAL_ASSISTANT_HTTP_BASE = "/api/v1/assistant" as const;

export const CANONICAL_ASSISTANT_HTTP_PATHS = [
  "/api/v1/assistant/session-context",
  "/api/v1/assistant/assist",
] as const;

/** Intentionally unmounted. Source retained under QUARANTINE.md markers. */
export const QUARANTINED_ASSISTANT_HTTP_BASES = [
  "/api/v1/workspace-assistant",
  "/api/v1/lifecycle-ai",
] as const;
