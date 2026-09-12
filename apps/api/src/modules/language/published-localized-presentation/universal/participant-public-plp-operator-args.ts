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
/** Ad-hoc `--limit` / single-page ceiling. */
export const PARTICIPANT_PUBLIC_PLP_MAX_BATCH_LIMIT = 25;
/** Default Mongo page size for `--historical` (Render Starter safe). */
export const PARTICIPANT_PUBLIC_PLP_HISTORICAL_DEFAULT_PAGE_SIZE = 10;
export const PARTICIPANT_PUBLIC_PLP_HISTORICAL_MAX_PAGE_SIZE = 25;

export type ParticipantPublicPlpMaterializeArgs = {
  readonly mongo: true;
  readonly execute: boolean;
  readonly profileId: string | null;
  readonly publicName: string | null;
  readonly limit: number | null;
  /** Paged full-corpus walk (eligible profiles × Registry locales). */
  readonly historical: boolean;
  /** Deterministic resume cursor (exclusive): next page is profileId > this. */
  readonly afterProfileId: string | null;
  readonly pageSize: number;
  /** Optional safety cap on pages per invocation (`--historical` only). */
  readonly maxPages: number | null;
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

function parsePositiveInt(
  raw: string | null,
  opts: { readonly min: number; readonly max: number },
): number | null {
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < opts.min || parsed > opts.max) {
    return null;
  }
  return parsed;
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
      errorMessage:
        "materialize:participant-public-plp refuses --all/--corpus; use --historical for bounded paged traversal",
    };
  }

  const profileId = flagValue(argv, "--profile-id");
  const publicName = flagValue(argv, "--public-name");
  const limitRaw = flagValue(argv, "--limit");
  const historical = argv.includes("--historical");
  const afterProfileId = flagValue(argv, "--after-profile-id");
  const pageSizeRaw = flagValue(argv, "--page-size");
  const maxPagesRaw = flagValue(argv, "--max-pages");
  const locale = flagValue(argv, "--locale");
  const execute = argv.includes("--execute");

  const selectors = [profileId, publicName, limitRaw, historical ? "historical" : null].filter(
    Boolean,
  ).length;
  if (selectors !== 1) {
    return {
      ok: false,
      errorMessage:
        "materialize:participant-public-plp requires exactly one of --profile-id, --public-name, --limit <n>, or --historical",
    };
  }

  if (afterProfileId && !historical && !limitRaw) {
    return {
      ok: false,
      errorMessage:
        "materialize:participant-public-plp --after-profile-id requires --historical or --limit",
    };
  }

  let limit: number | null = null;
  if (limitRaw) {
    const parsed = parsePositiveInt(limitRaw, {
      min: 1,
      max: PARTICIPANT_PUBLIC_PLP_MAX_BATCH_LIMIT,
    });
    if (parsed == null) {
      return {
        ok: false,
        errorMessage: `materialize:participant-public-plp --limit must be 1..${PARTICIPANT_PUBLIC_PLP_MAX_BATCH_LIMIT}`,
      };
    }
    limit = parsed;
  }

  let pageSize = historical
    ? PARTICIPANT_PUBLIC_PLP_HISTORICAL_DEFAULT_PAGE_SIZE
    : limit ?? PARTICIPANT_PUBLIC_PLP_HISTORICAL_DEFAULT_PAGE_SIZE;
  if (pageSizeRaw) {
    const parsed = parsePositiveInt(pageSizeRaw, {
      min: 1,
      max: PARTICIPANT_PUBLIC_PLP_HISTORICAL_MAX_PAGE_SIZE,
    });
    if (parsed == null) {
      return {
        ok: false,
        errorMessage: `materialize:participant-public-plp --page-size must be 1..${PARTICIPANT_PUBLIC_PLP_HISTORICAL_MAX_PAGE_SIZE}`,
      };
    }
    pageSize = parsed;
  } else if (limit != null) {
    pageSize = limit;
  }

  let maxPages: number | null = null;
  if (maxPagesRaw) {
    if (!historical) {
      return {
        ok: false,
        errorMessage: "materialize:participant-public-plp --max-pages requires --historical",
      };
    }
    const parsed = parsePositiveInt(maxPagesRaw, { min: 1, max: 100_000 });
    if (parsed == null) {
      return {
        ok: false,
        errorMessage: "materialize:participant-public-plp --max-pages must be a positive integer",
      };
    }
    maxPages = parsed;
  }

  return {
    ok: true,
    args: {
      mongo: true,
      execute,
      profileId,
      publicName,
      limit,
      historical,
      afterProfileId,
      pageSize,
      maxPages,
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
