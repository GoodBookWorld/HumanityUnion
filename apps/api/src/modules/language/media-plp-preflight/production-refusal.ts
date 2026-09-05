/**
 * Reset 03A — mandatory production refusal for Media PLP preflight.
 * Staging (PLATFORM_MODE=staging + humanity_union_staging) is allowed.
 */

import { resolveMongoConfig } from "../../../infrastructure/mongodb/mongo-config.js";

const PRODUCTION_DATABASE_NAMES = new Set([
  "humanity_union",
  "humanity_union_production",
  "production",
]);

export type MediaPlpPreflightProductionCheck = {
  readonly refused: boolean;
  readonly reason: string | null;
  readonly database: string | null;
  readonly platformMode: string | null;
  readonly nodeEnv: string | null;
};

export function evaluateMediaPlpPreflightProductionRefusal(input?: {
  readonly platformMode?: string | null;
  readonly nodeEnv?: string | null;
  readonly database?: string | null;
}): MediaPlpPreflightProductionCheck {
  const platformMode =
    (input?.platformMode ?? process.env.PLATFORM_MODE ?? "").trim().toLowerCase() || null;
  const nodeEnv = (input?.nodeEnv ?? process.env.NODE_ENV ?? "").trim().toLowerCase() || null;
  const database =
    (input?.database ?? resolveMongoConfig().database ?? "").trim().toLowerCase() || null;

  if (platformMode === "production") {
    return {
      refused: true,
      reason: "Refusing Media PLP preflight: PLATFORM_MODE=production is not allowed.",
      database,
      platformMode,
      nodeEnv,
    };
  }

  if (database && PRODUCTION_DATABASE_NAMES.has(database)) {
    return {
      refused: true,
      reason: `Refusing Media PLP preflight: production database "${database}" detected.`,
      database,
      platformMode,
      nodeEnv,
    };
  }

  if (nodeEnv === "production" && platformMode !== "staging") {
    return {
      refused: true,
      reason:
        "Refusing Media PLP preflight: NODE_ENV=production without PLATFORM_MODE=staging.",
      database,
      platformMode,
      nodeEnv,
    };
  }

  return {
    refused: false,
    reason: null,
    database,
    platformMode,
    nodeEnv,
  };
}
