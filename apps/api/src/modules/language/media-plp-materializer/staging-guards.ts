/**
 * Reset 03B — production refusal + staging-only execute gates.
 */

import { resolveMongoConfig } from "../../../infrastructure/mongodb/mongo-config.js";
import { MEDIA_PLP_STAGING_DATABASE } from "./constants.js";

const PRODUCTION_DATABASE_NAMES = new Set([
  "humanity_union",
  "humanity_union_production",
  "production",
]);

export type MediaPlpMaterializerEnvCheck = {
  readonly refused: boolean;
  readonly reason: string | null;
  readonly database: string | null;
  readonly platformMode: string | null;
  readonly nodeEnv: string | null;
};

export function evaluateMediaPlpMaterializerProductionRefusal(input?: {
  readonly platformMode?: string | null;
  readonly nodeEnv?: string | null;
  readonly database?: string | null;
}): MediaPlpMaterializerEnvCheck {
  const platformMode =
    (input?.platformMode ?? process.env.PLATFORM_MODE ?? "").trim().toLowerCase() || null;
  const nodeEnv = (input?.nodeEnv ?? process.env.NODE_ENV ?? "").trim().toLowerCase() || null;
  const database =
    (input?.database ?? resolveMongoConfig().database ?? "").trim().toLowerCase() || null;

  if (platformMode === "production") {
    return {
      refused: true,
      reason: "Refusing materialize:media-plp: PLATFORM_MODE=production is not allowed.",
      database,
      platformMode,
      nodeEnv,
    };
  }
  if (database && PRODUCTION_DATABASE_NAMES.has(database)) {
    return {
      refused: true,
      reason: `Refusing materialize:media-plp: production database "${database}" detected.`,
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

/**
 * --execute requires staging platform + staging database.
 */
export function evaluateMediaPlpMaterializerExecuteGuards(input?: {
  readonly platformMode?: string | null;
  readonly database?: string | null;
}): MediaPlpMaterializerEnvCheck {
  const base = evaluateMediaPlpMaterializerProductionRefusal(input);
  if (base.refused) {
    return base;
  }
  const platformMode =
    (input?.platformMode ?? process.env.PLATFORM_MODE ?? "").trim().toLowerCase() || null;
  const database =
    (input?.database ?? resolveMongoConfig().database ?? "").trim().toLowerCase() || null;

  if (platformMode !== "staging") {
    return {
      refused: true,
      reason: "Refusing --execute: PLATFORM_MODE must be staging.",
      database,
      platformMode,
      nodeEnv: (process.env.NODE_ENV ?? "").trim().toLowerCase() || null,
    };
  }
  if (database !== MEDIA_PLP_STAGING_DATABASE) {
    return {
      refused: true,
      reason: `Refusing --execute: database must be ${MEDIA_PLP_STAGING_DATABASE} (got "${database ?? ""}").`,
      database,
      platformMode,
      nodeEnv: (process.env.NODE_ENV ?? "").trim().toLowerCase() || null,
    };
  }
  return {
    refused: false,
    reason: null,
    database,
    platformMode,
    nodeEnv: (process.env.NODE_ENV ?? "").trim().toLowerCase() || null,
  };
}
