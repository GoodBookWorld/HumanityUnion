/**
 * Pack 1.3 — staging warm CLI / operator hydrate scope (no Mongo / no dotenv).
 *
 * Kept free of persistence imports so `--help` and unknown-kind validation can
 * run before loadApiEnvironment / bootstrap.
 */

import type { ContentTranslationSourceKind } from "@hu/types";

/**
 * Recovery source kinds for staging warm/repair operators.
 * Must stay aligned with discovery in content-translation-staging-warm-backfill.ts.
 */
export const CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS = [
  "initiative",
  "discussion_comment",
  "collaborative_analysis",
  "petition",
  "improvement_proposal",
  "initiative_revision",
  "decision_session",
  "collective_decision",
  "implementation_commitment",
  "implementation_tracking",
  "official_response",
  "public_impact",
  "civic_archive",
  "blog_post",
  "civic_media",
  "public_news",
] as const satisfies readonly ContentTranslationSourceKind[];

export const STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS =
  CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS;

export type StagingWarmSourceKind =
  (typeof CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS)[number];

const RECOVERY_KIND_SET = new Set<string>(CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS);

/** Kinds discovered by walking public initiatives (need Initiative store hydrate). */
export const STAGING_WARM_INITIATIVE_SCOPED_KINDS = [
  "initiative",
  "discussion_comment",
  "collaborative_analysis",
  "petition",
  // improvement_proposal uses paged Part D collection discovery — not initiative walk.
  "initiative_revision",
  "decision_session",
  "collective_decision",
  "implementation_commitment",
  "implementation_tracking",
  "official_response",
  "public_impact",
  "civic_archive",
] as const satisfies readonly StagingWarmSourceKind[];

export type ContentTranslationOperatorHydrateScopes = {
  readonly initiative: boolean;
  readonly collaborativeAnalysis: boolean;
  readonly collectiveDecision: boolean;
};

export function isStagingWarmHelpRequested(
  argv: readonly string[] = process.argv,
): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

export function formatStagingWarmHelp(): string {
  const kinds = CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS.join(", ");
  return [
    "STAGING-ONLY ContentTranslationWarm operator",
    "",
    "Usage (from apps/api):",
    "  pnpm warm:staging-content-translations [-- flags]",
    "",
    "Flags:",
    "  --help | -h                 Print this help and exit (no Mongo).",
    "  (default)                   Dry-run discovery report (no outbox writes).",
    "  --execute                   Enqueue warm requests (staging guards required).",
    "  --repair                    MISSING/STALE audit; with --execute enqueue those only.",
    "  --wait-for-materialization  After execute, poll until CURRENT or timeout.",
    "  --timeout-ms=N              Wait timeout ms (default 300000).",
    "  --kinds=a,b,c               Bound discovery + operator hydrate to these kinds.",
    "  --allow-empty-discovery     Allow empty SOURCE_RECORDS_DISCOVERED on staging.",
    "  --source-record-id=<id>     Exact-record mode (bypasses corpus discovery).",
    "  --locales=a,b               Explicit locales for exact-record mode (required with --force-current).",
    "  --force-current             Rebuild usable machine CURRENT for exact record+locales.",
    "",
    "Exact-record force rematerialization requires ALL of:",
    "  --source-record-id=<id>",
    "  exactly one --kinds= value",
    "  --locales=a,b (max 10; Registry-validated; no automatic expansion)",
    "  --force-current",
    "",
    "Execute requires ALL of:",
    "  ALLOW_STAGING_CONTENT_TRANSLATION_WARM=true",
    "  Mongo database === humanity_union_staging",
    "  PLATFORM_MODE is not production",
    "",
    `Recovery kinds: ${kinds}`,
    "",
    "Examples:",
    "  pnpm warm:staging-content-translations -- --kinds=initiative",
    "  ALLOW_STAGING_CONTENT_TRANSLATION_WARM=true pnpm warm:staging-content-translations -- --kinds=initiative --execute",
    "  ALLOW_STAGING_CONTENT_TRANSLATION_WARM=true pnpm warm:staging-content-translations -- --repair --execute --kinds=initiative",
    "  pnpm warm:staging-content-translations -- --kinds=collaborative_analysis --source-record-id=initiative-analysis-ID --locales=ar,zh-Hant --force-current",
  ].join("\n");
}

export class StagingWarmCliValidationError extends Error {
  readonly code = "STAGING_WARM_CLI_VALIDATION" as const;

  constructor(message: string) {
    super(message);
    this.name = "StagingWarmCliValidationError";
  }
}

/**
 * Parse `--kinds=` from argv. Undefined means full corpus (all recovery kinds).
 * Throws StagingWarmCliValidationError on unknown/empty kind tokens.
 */
export function parseStagingWarmKindsFromArgv(
  argv: readonly string[] = process.argv,
): StagingWarmSourceKind[] | undefined {
  const match = argv.find((entry) => entry.startsWith("--kinds="));
  if (!match) {
    return undefined;
  }
  const raw = match.slice("--kinds=".length);
  const tokens = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    throw new StagingWarmCliValidationError(
      "Invalid --kinds=: provide at least one recovery kind (see --help).",
    );
  }
  const unknown = tokens.filter((token) => !RECOVERY_KIND_SET.has(token));
  if (unknown.length > 0) {
    throw new StagingWarmCliValidationError(
      `Unknown --kinds value(s): ${unknown.join(", ")}. Supported: ${CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS.join(", ")}.`,
    );
  }
  return tokens as StagingWarmSourceKind[];
}

/**
 * Minimum Mongo snapshot hydrates for the requested recovery kinds.
 * `kinds === undefined` → full operator hydrate (legacy default).
 */
export function resolveContentTranslationOperatorHydrateScopes(
  kinds: readonly StagingWarmSourceKind[] | undefined,
): ContentTranslationOperatorHydrateScopes {
  if (!kinds || kinds.length === 0) {
    return {
      initiative: true,
      collaborativeAnalysis: true,
      collectiveDecision: true,
    };
  }

  const allowed = new Set<string>(kinds);
  const needsInitiative = STAGING_WARM_INITIATIVE_SCOPED_KINDS.some((kind) =>
    allowed.has(kind),
  );

  return {
    initiative: needsInitiative,
    collaborativeAnalysis: allowed.has("collaborative_analysis"),
    collectiveDecision: allowed.has("collective_decision"),
  };
}

export function isWarmRecoveryKind(value: string): value is StagingWarmSourceKind {
  return RECOVERY_KIND_SET.has(value);
}
