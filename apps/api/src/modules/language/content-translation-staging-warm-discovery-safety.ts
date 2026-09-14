/**
 * Pack 08I.16.1 — staging warm/repair discovery safety.
 *
 * A silent 0/0/0 repair report after hydrate failure looks like "all done" but
 * means discovery never saw canonical sources. Staging operators that target
 * humanity_union_staging expect a non-empty civic corpus unless explicitly
 * opted out with --allow-empty-discovery.
 */

import type { StagingWarmDiscoveryKindCounts } from "./content-translation-staging-warm-backfill.js";

export const STAGING_CONTENT_TRANSLATION_DATABASE = "humanity_union_staging";

export type StagingWarmDiscoveryExpectation = {
  readonly expectPersistedSources: boolean;
  readonly reason: string;
};

export type StagingWarmDiscoveryTotals = {
  readonly SOURCE_RECORDS_DISCOVERED: number;
  readonly PUBLIC_RECORDS: number;
  readonly ELIGIBLE_SOURCE_RECORDS: number;
  readonly LOCALE_TARGETS_AUDITED: number;
};

export class StagingContentTranslationDiscoveryFailure extends Error {
  readonly code = "DISCOVERY_FAILURE" as const;

  constructor(
    message: string,
    readonly diagnostics: StagingWarmDiscoveryTotals & {
      readonly byKind: readonly StagingWarmDiscoveryKindCounts[];
      readonly discoveryHint: string | null;
    },
  ) {
    super(message);
    this.name = "StagingContentTranslationDiscoveryFailure";
  }
}

export function resolveStagingWarmDiscoveryExpectation(input: {
  readonly databaseName: string | null | undefined;
  readonly allowEmptyDiscovery?: boolean;
  readonly argv?: readonly string[];
}): StagingWarmDiscoveryExpectation {
  const argv = input.argv ?? process.argv;
  const allowEmpty =
    input.allowEmptyDiscovery === true || argv.includes("--allow-empty-discovery");

  if (allowEmpty) {
    return {
      expectPersistedSources: false,
      reason: "allow_empty_discovery",
    };
  }

  if (input.databaseName === STAGING_CONTENT_TRANSLATION_DATABASE) {
    return {
      expectPersistedSources: true,
      reason: "staging_database_expects_persisted_civic_sources",
    };
  }

  return {
    expectPersistedSources: false,
    reason: "non_staging_database",
  };
}

export function summarizeStagingWarmDiscovery(input: {
  readonly discoveryByKind: readonly StagingWarmDiscoveryKindCounts[];
  readonly localeTargetsAudited?: number;
}): StagingWarmDiscoveryTotals & {
  readonly byKind: readonly {
    readonly sourceKind: string;
    readonly SOURCE_RECORDS_DISCOVERED: number;
    readonly PUBLIC_RECORDS: number;
    readonly ELIGIBLE_SOURCE_RECORDS: number;
  }[];
} {
  const byKind = input.discoveryByKind.map((row) => ({
    sourceKind: row.sourceKind,
    SOURCE_RECORDS_DISCOVERED: row.sourceRecordsDiscovered,
    PUBLIC_RECORDS: row.publicRecords,
    ELIGIBLE_SOURCE_RECORDS: row.eligibleSourceRecords,
  }));

  const totals = byKind.reduce(
    (acc, row) => ({
      SOURCE_RECORDS_DISCOVERED:
        acc.SOURCE_RECORDS_DISCOVERED + row.SOURCE_RECORDS_DISCOVERED,
      PUBLIC_RECORDS: acc.PUBLIC_RECORDS + row.PUBLIC_RECORDS,
      ELIGIBLE_SOURCE_RECORDS:
        acc.ELIGIBLE_SOURCE_RECORDS + row.ELIGIBLE_SOURCE_RECORDS,
    }),
    {
      SOURCE_RECORDS_DISCOVERED: 0,
      PUBLIC_RECORDS: 0,
      ELIGIBLE_SOURCE_RECORDS: 0,
    },
  );

  return {
    ...totals,
    LOCALE_TARGETS_AUDITED: Math.max(0, input.localeTargetsAudited ?? 0),
    byKind,
  };
}

/**
 * Throws DISCOVERY_FAILURE when staging expects persisted sources but
 * SOURCE_RECORDS_DISCOVERED total is zero.
 */
export function assertStagingWarmDiscoveryNotSilentlyEmpty(input: {
  readonly expectation: StagingWarmDiscoveryExpectation;
  readonly discoveryByKind: readonly StagingWarmDiscoveryKindCounts[];
  readonly discoveryHint?: string | null;
  readonly localeTargetsAudited?: number;
}): StagingWarmDiscoveryTotals & {
  readonly byKind: ReturnType<typeof summarizeStagingWarmDiscovery>["byKind"];
} {
  const summary = summarizeStagingWarmDiscovery({
    discoveryByKind: input.discoveryByKind,
    localeTargetsAudited: input.localeTargetsAudited,
  });

  if (
    input.expectation.expectPersistedSources &&
    summary.SOURCE_RECORDS_DISCOVERED === 0
  ) {
    throw new StagingContentTranslationDiscoveryFailure(
      "DISCOVERY_FAILURE: expected persisted CIVIC_CONTENT sources on staging, but SOURCE_RECORDS_DISCOVERED=0. This is not translation completion (CURRENT_SKIPPED would be non-zero if discovery worked). Check lightweight bootstrap hydrate+sync. Pass --allow-empty-discovery only for intentionally empty databases.",
      {
        ...summary,
        byKind: [...input.discoveryByKind],
        discoveryHint: input.discoveryHint ?? null,
      },
    );
  }

  return summary;
}
