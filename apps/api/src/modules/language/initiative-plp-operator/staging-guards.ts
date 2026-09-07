/**
 * RESET 05B — staging/production refusal gates for Initiative PLP materializer.
 */

import { resolveMongoConfig } from "../../../infrastructure/mongodb/mongo-config.js";
import { INITIATIVE_PLP_STAGING_DATABASE } from "./constants.js";

const PRODUCTION_DATABASE_NAMES = new Set([
  "humanity_union",
  "humanity_union_production",
  "production",
]);

export type InitiativePlpOperatorEnvCheck = {
  readonly refused: boolean;
  readonly reason: string | null;
  readonly database: string | null;
  readonly platformMode: string | null;
  readonly nodeEnv: string | null;
};

export function evaluateInitiativePlpProductionRefusal(input?: {
  readonly platformMode?: string | null;
  readonly nodeEnv?: string | null;
  readonly database?: string | null;
}): InitiativePlpOperatorEnvCheck {
  const platformMode =
    (input?.platformMode ?? process.env.PLATFORM_MODE ?? "").trim().toLowerCase() ||
    null;
  const nodeEnv =
    (input?.nodeEnv ?? process.env.NODE_ENV ?? "").trim().toLowerCase() || null;
  const database =
    (input?.database ?? resolveMongoConfig().database ?? "").trim().toLowerCase() ||
    null;

  if (platformMode === "production") {
    return {
      refused: true,
      reason:
        "Refusing materialize:initiative-plp: PLATFORM_MODE=production is not allowed.",
      database,
      platformMode,
      nodeEnv,
    };
  }
  if (database && PRODUCTION_DATABASE_NAMES.has(database)) {
    return {
      refused: true,
      reason: `Refusing materialize:initiative-plp: production database "${database}" detected.`,
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

export function evaluateInitiativePlpExecuteGuards(input?: {
  readonly platformMode?: string | null;
  readonly database?: string | null;
}): InitiativePlpOperatorEnvCheck {
  const base = evaluateInitiativePlpProductionRefusal(input);
  if (base.refused) {
    return base;
  }
  const platformMode =
    (input?.platformMode ?? process.env.PLATFORM_MODE ?? "").trim().toLowerCase() ||
    null;
  const database =
    (input?.database ?? resolveMongoConfig().database ?? "").trim().toLowerCase() ||
    null;

  if (platformMode !== "staging") {
    return {
      refused: true,
      reason: "Refusing --execute: PLATFORM_MODE must be staging.",
      database,
      platformMode,
      nodeEnv: (process.env.NODE_ENV ?? "").trim().toLowerCase() || null,
    };
  }
  if (database !== INITIATIVE_PLP_STAGING_DATABASE) {
    return {
      refused: true,
      reason: `Refusing --execute: database must be ${INITIATIVE_PLP_STAGING_DATABASE} (got "${database ?? ""}").`,
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
