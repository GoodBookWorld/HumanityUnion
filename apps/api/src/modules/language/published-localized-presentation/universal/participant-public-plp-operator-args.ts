/**
 * Args + staging guards for materialize:participant-public-plp.
 * Kept free of PLP pipeline imports so unit tests exit cleanly.
 */

import { resolveMongoConfig } from "../../../../infrastructure/mongodb/mongo-config.js";

const PRODUCTION_DATABASE_NAMES = new Set([
  "humanity_union",
  "humanity_union_production",
  "production",
]);
export const PARTICIPANT_PUBLIC_PLP_STAGING_DATABASE = "humanity_union_staging";
export const PARTICIPANT_PUBLIC_PLP_MAX_BATCH_LIMIT = 25;

export type ParticipantPublicPlpMaterializeArgs = {
  readonly mongo: true;
  readonly execute: boolean;
  readonly profileId: string | null;
  readonly publicName: string | null;
  readonly limit: number | null;
  readonly locale: string | null;
};

function flagValue(argv: readonly string[], flag: string): string | null {
  const idx = argv.indexOf(flag);
  if (idx < 0) {
    return null;
  }
  const value = argv[idx + 1];
  if (!value || value.startsWith("--")) {
    return null;
  }
  return value.trim();
}

export function parseParticipantPublicPlpMaterializeArgs(
  argv: readonly string[],
):
  | { readonly ok: true; readonly args: ParticipantPublicPlpMaterializeArgs }
  | { readonly ok: false; readonly errorMessage: string } {
  if (!argv.includes("--mongo")) {
    return { ok: false, errorMessage: "materialize:participant-public-plp requires --mongo" };
  }
  if (argv.includes("--all") || argv.includes("--corpus")) {
    return {
      ok: false,
      errorMessage: "materialize:participant-public-plp refuses --all/--corpus",
    };
  }

  const profileId = flagValue(argv, "--profile-id");
  const publicName = flagValue(argv, "--public-name");
  const limitRaw = flagValue(argv, "--limit");
  const locale = flagValue(argv, "--locale");
  const execute = argv.includes("--execute");

  const selectors = [profileId, publicName, limitRaw].filter(Boolean).length;
  if (selectors !== 1) {
    return {
      ok: false,
      errorMessage:
        "materialize:participant-public-plp requires exactly one of --profile-id, --public-name, or --limit <n>",
    };
  }

  let limit: number | null = null;
  if (limitRaw) {
    const parsed = Number(limitRaw);
    if (
      !Number.isInteger(parsed) ||
      parsed < 1 ||
      parsed > PARTICIPANT_PUBLIC_PLP_MAX_BATCH_LIMIT
    ) {
      return {
        ok: false,
        errorMessage: `materialize:participant-public-plp --limit must be 1..${PARTICIPANT_PUBLIC_PLP_MAX_BATCH_LIMIT}`,
      };
    }
    limit = parsed;
  }

  return {
    ok: true,
    args: {
      mongo: true,
      execute,
      profileId,
      publicName,
      limit,
      locale,
    },
  };
}

export function evaluateParticipantPublicPlpProductionRefusal(input?: {
  readonly platformMode?: string | null;
  readonly database?: string | null;
}): { readonly refused: boolean; readonly reason: string | null } {
  const platformMode =
    (input?.platformMode ?? process.env.PLATFORM_MODE ?? "").trim().toLowerCase() || null;
  const database =
    (input?.database ?? resolveMongoConfig().database ?? "").trim().toLowerCase() || null;
  if (platformMode === "production") {
    return {
      refused: true,
      reason: "Refusing materialize:participant-public-plp: PLATFORM_MODE=production is not allowed.",
    };
  }
  if (database && PRODUCTION_DATABASE_NAMES.has(database)) {
    return {
      refused: true,
      reason: `Refusing materialize:participant-public-plp: production database "${database}" detected.`,
    };
  }
  return { refused: false, reason: null };
}

export function evaluateParticipantPublicPlpExecuteGuards(input?: {
  readonly platformMode?: string | null;
  readonly database?: string | null;
}): { readonly refused: boolean; readonly reason: string | null } {
  const base = evaluateParticipantPublicPlpProductionRefusal(input);
  if (base.refused) {
    return base;
  }
  const platformMode =
    (input?.platformMode ?? process.env.PLATFORM_MODE ?? "").trim().toLowerCase() || null;
  const database =
    (input?.database ?? resolveMongoConfig().database ?? "").trim().toLowerCase() || null;
  if (platformMode !== "staging") {
    return { refused: true, reason: "Refusing --execute: PLATFORM_MODE must be staging." };
  }
  if (database !== PARTICIPANT_PUBLIC_PLP_STAGING_DATABASE) {
    return {
      refused: true,
      reason: `Refusing --execute: database must be ${PARTICIPANT_PUBLIC_PLP_STAGING_DATABASE} (got "${database ?? ""}").`,
    };
  }
  return { refused: false, reason: null };
}
