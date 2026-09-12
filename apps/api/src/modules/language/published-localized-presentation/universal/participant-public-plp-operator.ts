/**
 * Bounded participant_public PLP materialize operator (Render Starter safe).
 *
 * Dry-run default; --execute is staging-only.
 * Thin path: runUniversalPlpBuild + dynamic provider import only.
 * Does not pull the durable queue, Registry service barrel, or all-adapter
 * registration graph (those inflate RSS past Render Starter 512 MB).
 *
 * Historical backfill (`--historical`): Mongo pages ordered by profileId,
 * process one page, release, next page. Never materializes the full corpus
 * array. Resume with `--after-profile-id`. Provider concurrency = 1.
 */

import type { LanguageCode, MemberProfile, PlpLocalizableEntityContract } from "@hu/types";
import { PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../../infrastructure/mongodb/mongo-collections.js";
import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../../../../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../../infrastructure/mongodb/mongo-database.js";
import {
  assertPublishedLocalizationMongoPersistenceActive,
  findCurrentPublishedPresentation,
  getPublishedLocalizationPersistenceMode,
  requirePublishedLocalizationMongoPersistence,
} from "../persistence/repository.js";
import { collectAutoPaths } from "../presentation-paths.js";
import { classifyUsableLocalizedPresentation } from "../usability.js";
import {
  buildParticipantPublicCanonicalPresentation,
  PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
  participantPublicPlpDomainAdapter,
} from "./adapters/participant-public-adapter.js";
import { runUniversalPlpBuild } from "./build-pipeline.js";
import {
  getPlpDomainAdapter,
  registerPlpDomainAdapter,
} from "./domain-adapter-registry.js";
import { isCollectedPathMachineEligible } from "./field-authority.js";
import {
  evaluateParticipantPublicPlpExecuteGuards,
  evaluateParticipantPublicPlpProductionRefusal,
  parseParticipantPublicPlpMaterializeArgs,
  type ParticipantPublicPlpMaterializeArgs,
} from "./participant-public-plp-operator-args.js";

export type { ParticipantPublicPlpMaterializeArgs } from "./participant-public-plp-operator-args.js";
export {
  evaluateParticipantPublicPlpExecuteGuards,
  evaluateParticipantPublicPlpProductionRefusal,
  parseParticipantPublicPlpMaterializeArgs,
} from "./participant-public-plp-operator-args.js";

const PROFILE_PROJECTION = {
  _id: 0,
  profileId: 1,
  publicName: 1,
  displayName: 1,
  biography: 1,
  organization: 1,
  skills: 1,
  profileVisibility: 1,
  status: 1,
} as const;

export type ParticipantPublicPlpLocaleOutcome = {
  readonly locale: string;
  readonly CURRENT_USABLE: boolean;
  readonly ACTION:
    | "SKIP_CURRENT"
    | "WOULD_BUILD"
    | "BUILT"
    | "FAILED"
    | "SKIP_SOURCE"
    | "SKIP_NO_TRANSLATABLE";
  readonly reason: string | null;
};

export type ParticipantPublicPlpProfileReport = {
  readonly profileId: string;
  readonly publicName: string | null;
  readonly SOURCE_FOUND: boolean;
  readonly ELIGIBLE: boolean;
  readonly CANONICAL_VERSION: string | null;
  readonly locales: readonly ParticipantPublicPlpLocaleOutcome[];
  /** False when operator budget stopped before all target locales were attempted. */
  readonly COMPLETE: boolean;
};

export type ParticipantPublicPlpActionTotals = {
  readonly SKIP_CURRENT: number;
  readonly WOULD_BUILD: number;
  readonly BUILT: number;
  readonly FAILED: number;
  readonly SKIP_SOURCE: number;
  readonly SKIP_NO_TRANSLATABLE: number;
  readonly ineligible: number;
};

export type ParticipantPublicPlpMaterializeReport = {
  readonly pack: "PARTICIPANT_PUBLIC_PLP";
  readonly operation: "materialize_participant_public_plp";
  readonly OPERATOR_MODE: "DRY_RUN" | "EXECUTE";
  readonly TRAVERSAL: "identity" | "page" | "historical";
  readonly ENTITY_TYPE: typeof PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE;
  readonly PLP_PERSISTENCE_MODE: string;
  readonly database: string | null;
  readonly targetLocales: readonly string[];
  readonly pageSize: number | null;
  readonly pagesProcessed: number;
  readonly profilesProcessed: number;
  /**
   * Exclusive resume cursor for `--after-profile-id`.
   * When abortReason is PROVIDER_CALL_BUDGET_REACHED mid-profile, this is the
   * last *fully completed* profileId (or the page start cursor), so resume
   * re-enters the unfinished profile; SKIP_CURRENT covers already-built locales.
   */
  readonly resumeAfterProfileId: string | null;
  readonly hasMore: boolean;
  readonly maxProviderCalls: number;
  readonly totals: ParticipantPublicPlpActionTotals;
  /** Identity/limit: all rows. Historical: last page only (memory bound). */
  readonly profiles: readonly ParticipantPublicPlpProfileReport[];
  readonly PROVIDER_CALLS: number;
  readonly PROVIDER_CONCURRENCY: 1;
  readonly abortReason: string | null;
};

export type ParticipantPublicPlpEligiblePageInput = {
  readonly pageSize: number;
  readonly afterProfileId: string | null;
};

export type ParticipantPublicPlpMaterializeDeps = {
  readonly loadProfileById?: (profileId: string) => Promise<MemberProfile | null>;
  readonly loadProfileByPublicName?: (
    publicName: string,
  ) => Promise<MemberProfile | null>;
  /** @deprecated Prefer listEligibleProfilesPage (deterministic profileId cursor). */
  readonly listEligibleProfiles?: (limit: number) => Promise<MemberProfile[]>;
  readonly listEligibleProfilesPage?: (
    input: ParticipantPublicPlpEligiblePageInput,
  ) => Promise<MemberProfile[]>;
  readonly resolveLocales?: (
    localeFilter: string | null,
  ) => Promise<readonly string[]>;
  readonly runProvider?: (input: {
    readonly locale: LanguageCode;
    readonly autoValues: Readonly<Record<string, string>>;
    readonly sourceRecordId: string;
    readonly sourceVersion: string;
  }) => Promise<
    | { readonly ok: true; readonly values: Readonly<Record<string, string>> }
    | { readonly ok: false; readonly reason: string; readonly message: string }
  >;
  readonly publishBuild?: typeof runUniversalPlpBuild;
  readonly skipPersistenceRequire?: boolean;
  readonly skipProductionRefusal?: boolean;
  readonly skipExecuteGuards?: boolean;
  readonly connect?: () => Promise<void>;
  readonly disconnect?: () => Promise<void>;
  readonly isMongoConfigured?: () => boolean;
};

function isEligible(profile: MemberProfile): boolean {
  if (profile.status === "suspended") {
    return false;
  }
  return profile.profileVisibility === "public" || profile.profileVisibility === "members_only";
}

function asProfile(doc: Record<string, unknown> | null): MemberProfile | null {
  if (!doc || typeof doc.profileId !== "string") {
    return null;
  }
  return {
    ...(doc as unknown as MemberProfile),
    skills: Array.isArray(doc.skills) ? (doc.skills as string[]) : [],
  };
}

export async function loadParticipantPublicPlpProfileById(
  profileId: string,
): Promise<MemberProfile | null> {
  const collection = getMongoCollection(MONGO_COLLECTIONS.memberProfiles);
  const doc = await collection.findOne(
    { profileId },
    { projection: PROFILE_PROJECTION },
  );
  return asProfile(doc as Record<string, unknown> | null);
}

export async function loadParticipantPublicPlpProfileByPublicName(
  publicName: string,
): Promise<MemberProfile | null> {
  const collection = getMongoCollection(MONGO_COLLECTIONS.memberProfiles);
  const doc = await collection.findOne(
    { publicName },
    { projection: PROFILE_PROJECTION },
  );
  return asProfile(doc as Record<string, unknown> | null);
}

/**
 * One Mongo page of eligible profiles. Deterministic `profileId` ascending
 * cursor — never loads the full corpus. `afterProfileId` is exclusive.
 */
export async function listParticipantPublicPlpEligibleProfilesPage(
  input: ParticipantPublicPlpEligiblePageInput,
): Promise<MemberProfile[]> {
  const pageSize = Math.max(1, Math.min(input.pageSize, 25));
  const collection = getMongoCollection(MONGO_COLLECTIONS.memberProfiles);
  const filter: Record<string, unknown> = {
    status: { $ne: "suspended" },
    profileVisibility: { $in: ["public", "members_only"] },
  };
  const after = input.afterProfileId?.trim() || null;
  if (after) {
    filter.profileId = { $gt: after };
  }
  const docs = await collection
    .find(filter)
    .project(PROFILE_PROJECTION)
    .sort({ profileId: 1 })
    .limit(pageSize)
    .toArray();
  return docs
    .map((doc) => asProfile(doc as Record<string, unknown>))
    .filter((row): row is MemberProfile => row != null);
}

/** Single-page helper (ad-hoc `--limit`). */
export async function listParticipantPublicPlpEligibleProfiles(
  limit: number,
): Promise<MemberProfile[]> {
  return listParticipantPublicPlpEligibleProfilesPage({
    pageSize: limit,
    afterProfileId: null,
  });
}

function emptyActionTotals(): ParticipantPublicPlpActionTotals {
  return {
    SKIP_CURRENT: 0,
    WOULD_BUILD: 0,
    BUILT: 0,
    FAILED: 0,
    SKIP_SOURCE: 0,
    SKIP_NO_TRANSLATABLE: 0,
    ineligible: 0,
  };
}

function accumulateProfileTotals(
  totals: ParticipantPublicPlpActionTotals,
  report: ParticipantPublicPlpProfileReport,
): ParticipantPublicPlpActionTotals {
  if (!report.ELIGIBLE) {
    return { ...totals, ineligible: totals.ineligible + 1 };
  }
  let next = { ...totals };
  for (const locale of report.locales) {
    switch (locale.ACTION) {
      case "SKIP_CURRENT":
        next = { ...next, SKIP_CURRENT: next.SKIP_CURRENT + 1 };
        break;
      case "WOULD_BUILD":
        next = { ...next, WOULD_BUILD: next.WOULD_BUILD + 1 };
        break;
      case "BUILT":
        next = { ...next, BUILT: next.BUILT + 1 };
        break;
      case "FAILED":
        next = { ...next, FAILED: next.FAILED + 1 };
        break;
      case "SKIP_SOURCE":
        next = { ...next, SKIP_SOURCE: next.SKIP_SOURCE + 1 };
        break;
      case "SKIP_NO_TRANSLATABLE":
        next = { ...next, SKIP_NO_TRANSLATABLE: next.SKIP_NO_TRANSLATABLE + 1 };
        break;
      default:
        break;
    }
  }
  return next;
}

/** Thin Registry read — never import language-registry barrel / service. */
export async function listParticipantPublicPlpRegistryLocales(input?: {
  readonly excludeSourceLanguage?: string | null;
}): Promise<readonly string[]> {
  const exclude = (input?.excludeSourceLanguage ?? "en")?.toLowerCase() ?? null;
  const collection = getMongoCollection<{
    locale: string;
    enabled?: boolean;
    contentTranslationEnabled?: boolean;
  }>(MONGO_COLLECTIONS.languageRegistry);
  const docs = await collection
    .find(
      {
        enabled: true,
        contentTranslationEnabled: true,
      },
      { projection: { _id: 0, locale: 1 } },
    )
    .toArray();
  const locales: string[] = [];
  for (const doc of docs) {
    const locale = typeof doc.locale === "string" ? doc.locale.trim() : "";
    if (!locale) {
      continue;
    }
    if (exclude && locale.toLowerCase() === exclude) {
      continue;
    }
    locales.push(locale);
  }
  return locales;
}

export async function resolveParticipantPublicPlpTargetLocales(
  localeFilter: string | null,
): Promise<readonly string[]> {
  if (localeFilter) {
    return [localeFilter];
  }
  return listParticipantPublicPlpRegistryLocales({ excludeSourceLanguage: "en" });
}

function ensureParticipantPublicAdapterOnly(): void {
  if (!getPlpDomainAdapter(PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE)) {
    try {
      registerPlpDomainAdapter(participantPublicPlpDomainAdapter);
    } catch {
      // already registered
    }
  }
}

function buildContract(
  profile: MemberProfile,
  locale: string,
): {
  readonly contract: PlpLocalizableEntityContract;
  readonly autoValues: Record<string, string>;
} {
  const canonical = buildParticipantPublicCanonicalPresentation({
    profileId: profile.profileId,
    displayName: profile.displayName,
    biography: profile.biography,
    organization: profile.organization,
    skills: profile.skills,
  });
  const fieldPolicy = participantPublicPlpDomainAdapter.fieldPolicyFor(
    PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
  );
  const autoValues: Record<string, string> = {};
  for (const node of collectAutoPaths(canonical.presentation)) {
    if (isCollectedPathMachineEligible(node.path, fieldPolicy)) {
      autoValues[node.path] = node.value;
    }
  }
  return {
    contract: {
      entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
      entityId: profile.profileId,
      canonicalVersion: canonical.canonicalVersion,
      localizationSchemaVersion: PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
      canonicalPresentation: canonical.presentation,
      fieldPolicy,
      targetLocale: locale as LanguageCode,
      contentRevision: 1,
    },
    autoValues,
  };
}

async function defaultRunProvider(input: {
  readonly locale: LanguageCode;
  readonly autoValues: Readonly<Record<string, string>>;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
}): Promise<
  | { readonly ok: true; readonly values: Readonly<Record<string, string>> }
  | { readonly ok: false; readonly reason: string; readonly message: string }
> {
  const {
    importMediaPlpMaterializerProvider,
    callMediaPlpMaterializerProviderOnce,
  } = await import("../../media-plp-materializer/provider-boundary.js");
  // RESET 05C pattern: per-build budget. Without this, process-global
  // PROVIDER_CALL_COUNT leaks across locales and trips PROVIDER_CALL_CAP
  // (batchCount*2, often 2) after the first couple of builds.
  const { resetMediaPlpMaterializerProviderCallBudget } = await import(
    "../../media-plp-materializer/counters.js"
  );
  resetMediaPlpMaterializerProviderCallBudget();

  const imported = await importMediaPlpMaterializerProvider();
  const result = await callMediaPlpMaterializerProviderOnce({
    provider: imported.provider,
    locale: input.locale,
    autoValues: input.autoValues,
    sourceRecordId: input.sourceRecordId,
    sourceVersion: input.sourceVersion,
    PROVIDER_TRANSPORT: imported.PROVIDER_TRANSPORT,
  });
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      message: result.message,
    };
  }
  return { ok: true, values: result.values };
}

async function inspectLocale(input: {
  readonly profile: MemberProfile;
  readonly locale: string;
  readonly execute: boolean;
  readonly remainingProviderBudget: number;
  readonly runProvider: NonNullable<ParticipantPublicPlpMaterializeDeps["runProvider"]>;
  readonly publishBuild: typeof runUniversalPlpBuild;
}): Promise<{
  readonly outcome: ParticipantPublicPlpLocaleOutcome | null;
  readonly providerCalls: number;
  readonly stoppedForBudget: boolean;
}> {
  if (input.locale.toLowerCase() === "en") {
    return {
      outcome: {
        locale: input.locale,
        CURRENT_USABLE: false,
        ACTION: "SKIP_SOURCE",
        reason: "SOURCE_LOCALE",
      },
      providerCalls: 0,
      stoppedForBudget: false,
    };
  }

  const { contract, autoValues } = buildContract(input.profile, input.locale);
  const current = await findCurrentPublishedPresentation({
    entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
    entityId: input.profile.profileId,
    locale: input.locale,
  });
  const usability = classifyUsableLocalizedPresentation({
    locale: input.locale,
    liveCanonicalVersion: contract.canonicalVersion,
    liveLocalizationSchemaVersion: contract.localizationSchemaVersion,
    canonicalPresentation: contract.canonicalPresentation,
    snapshot: current,
  });

  if (usability.allowPublishedLocalized) {
    return {
      outcome: {
        locale: input.locale,
        CURRENT_USABLE: true,
        ACTION: "SKIP_CURRENT",
        reason: usability.resolveReasonCode ?? "CURRENT_USABLE",
      },
      providerCalls: 0,
      stoppedForBudget: false,
    };
  }

  if (!input.execute) {
    return {
      outcome: {
        locale: input.locale,
        CURRENT_USABLE: false,
        ACTION: "WOULD_BUILD",
        reason: usability.resolveReasonCode ?? "NO_PUBLISHED_SNAPSHOT",
      },
      providerCalls: 0,
      stoppedForBudget: false,
    };
  }

  if (Object.keys(autoValues).length === 0) {
    // Nothing MACHINE_CONTENT to send — canonical/protected fields remain on read.
    return {
      outcome: {
        locale: input.locale,
        CURRENT_USABLE: false,
        ACTION: "SKIP_NO_TRANSLATABLE",
        reason: "NO_MACHINE_AUTO_PATHS",
      },
      providerCalls: 0,
      stoppedForBudget: false,
    };
  }

  if (input.remainingProviderBudget <= 0) {
    return { outcome: null, providerCalls: 0, stoppedForBudget: true };
  }

  const providerResult = await input.runProvider({
    locale: input.locale as LanguageCode,
    autoValues,
    sourceRecordId: `${PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE}:${input.profile.profileId}`,
    sourceVersion: contract.canonicalVersion,
  });
  if (!providerResult.ok) {
    return {
      outcome: {
        locale: input.locale,
        CURRENT_USABLE: false,
        ACTION: "FAILED",
        reason: providerResult.reason,
      },
      providerCalls: 1,
      stoppedForBudget: false,
    };
  }

  const built = await input.publishBuild({
    contract,
    liveCanonicalVersion: contract.canonicalVersion,
    layers: [
      {
        source: "MACHINE",
        values: providerResult.values,
        provider: "thin_gemini",
      },
    ],
  });
  if (built.status === "COMPLETED") {
    return {
      outcome: {
        locale: input.locale,
        CURRENT_USABLE: true,
        ACTION: "BUILT",
        reason: built.status,
      },
      providerCalls: 1,
      stoppedForBudget: false,
    };
  }
  return {
    outcome: {
      locale: input.locale,
      CURRENT_USABLE: false,
      ACTION: "FAILED",
      reason: built.reasonCodes.join(",") || built.status,
    },
    providerCalls: 1,
    stoppedForBudget: false,
  };
}

async function materializeProfile(input: {
  readonly profile: MemberProfile | null;
  readonly locales: readonly string[];
  readonly execute: boolean;
  readonly remainingProviderBudget: number;
  readonly runProvider: NonNullable<ParticipantPublicPlpMaterializeDeps["runProvider"]>;
  readonly publishBuild: typeof runUniversalPlpBuild;
}): Promise<{
  readonly report: ParticipantPublicPlpProfileReport;
  readonly providerCalls: number;
  readonly stoppedForBudget: boolean;
  readonly profileFullyCompleted: boolean;
}> {
  if (!input.profile) {
    return {
      report: {
        profileId: "",
        publicName: null,
        SOURCE_FOUND: false,
        ELIGIBLE: false,
        CANONICAL_VERSION: null,
        locales: [],
        COMPLETE: true,
      },
      providerCalls: 0,
      stoppedForBudget: false,
      profileFullyCompleted: true,
    };
  }
  if (!isEligible(input.profile)) {
    return {
      report: {
        profileId: input.profile.profileId,
        publicName: input.profile.publicName ?? null,
        SOURCE_FOUND: true,
        ELIGIBLE: false,
        CANONICAL_VERSION: null,
        locales: [],
        COMPLETE: true,
      },
      providerCalls: 0,
      stoppedForBudget: false,
      profileFullyCompleted: true,
    };
  }

  const canonical = buildParticipantPublicCanonicalPresentation({
    profileId: input.profile.profileId,
    displayName: input.profile.displayName,
    biography: input.profile.biography,
    organization: input.profile.organization,
    skills: input.profile.skills,
  });

  const locales: ParticipantPublicPlpLocaleOutcome[] = [];
  let providerCalls = 0;
  let remaining = input.remainingProviderBudget;
  let stoppedForBudget = false;

  for (const locale of input.locales) {
    const result = await inspectLocale({
      profile: input.profile,
      locale,
      execute: input.execute,
      remainingProviderBudget: remaining,
      runProvider: input.runProvider,
      publishBuild: input.publishBuild,
    });
    if (result.stoppedForBudget) {
      stoppedForBudget = true;
      break;
    }
    if (result.outcome) {
      locales.push(result.outcome);
    }
    providerCalls += result.providerCalls;
    remaining -= result.providerCalls;
  }

  const profileFullyCompleted = !stoppedForBudget;
  return {
    report: {
      profileId: input.profile.profileId,
      publicName: input.profile.publicName ?? null,
      SOURCE_FOUND: true,
      ELIGIBLE: true,
      CANONICAL_VERSION: canonical.canonicalVersion,
      locales,
      COMPLETE: profileFullyCompleted,
    },
    providerCalls,
    stoppedForBudget,
    profileFullyCompleted,
  };
}

export async function runParticipantPublicPlpMaterialize(
  argv: readonly string[],
  deps: ParticipantPublicPlpMaterializeDeps = {},
): Promise<{
  readonly exitCode: number;
  readonly report: ParticipantPublicPlpMaterializeReport | null;
  readonly errorMessage: string | null;
}> {
  const parsed = parseParticipantPublicPlpMaterializeArgs(argv);
  if (!parsed.ok) {
    return { exitCode: 2, report: null, errorMessage: parsed.errorMessage };
  }
  const args: ParticipantPublicPlpMaterializeArgs = parsed.args;

  const refusal = deps.skipProductionRefusal
    ? { refused: false as const, reason: null }
    : evaluateParticipantPublicPlpProductionRefusal();
  if (refusal.refused) {
    return { exitCode: 2, report: null, errorMessage: refusal.reason };
  }
  if (args.execute && !deps.skipExecuteGuards) {
    const executeGuard = evaluateParticipantPublicPlpExecuteGuards();
    if (executeGuard.refused) {
      return { exitCode: 2, report: null, errorMessage: executeGuard.reason };
    }
  }

  const isConfigured = deps.isMongoConfigured ?? isMongoConfigured;
  if (!isConfigured() && !deps.skipPersistenceRequire) {
    return {
      exitCode: 2,
      report: null,
      errorMessage: "materialize:participant-public-plp --mongo requires MONGODB_URI",
    };
  }

  ensureParticipantPublicAdapterOnly();

  const connect = deps.connect ?? connectMongoClient;
  const disconnect = deps.disconnect ?? disconnectMongoClient;

  try {
    if (!deps.skipPersistenceRequire) {
      await connect();
      requirePublishedLocalizationMongoPersistence(
        "materialize:participant-public-plp --mongo",
      );
      assertPublishedLocalizationMongoPersistenceActive(
        "materialize:participant-public-plp --mongo",
      );
    }

    const resolveLocales =
      deps.resolveLocales ?? resolveParticipantPublicPlpTargetLocales;
    const locales = await resolveLocales(args.locale);

    const loadById = deps.loadProfileById ?? loadParticipantPublicPlpProfileById;
    const loadByName =
      deps.loadProfileByPublicName ?? loadParticipantPublicPlpProfileByPublicName;
    const listPage =
      deps.listEligibleProfilesPage ??
      (deps.listEligibleProfiles
        ? async (input: ParticipantPublicPlpEligiblePageInput) => {
            // Legacy test dep: ignore cursor; one page only.
            if (input.afterProfileId) {
              return [];
            }
            return deps.listEligibleProfiles!(input.pageSize);
          }
        : listParticipantPublicPlpEligibleProfilesPage);

    const runProvider = deps.runProvider ?? defaultRunProvider;
    const publishBuild = deps.publishBuild ?? runUniversalPlpBuild;

    let traversal: ParticipantPublicPlpMaterializeReport["TRAVERSAL"] = "identity";
    let pagesProcessed = 0;
    let profilesProcessed = 0;
    let providerCalls = 0;
    let totals = emptyActionTotals();
    /** Exclusive cursor: last profile whose *all* locales finished. */
    let lastFullyCompletedProfileId: string | null = args.afterProfileId;
    let resumeAfterProfileId: string | null = args.afterProfileId;
    let hasMore = false;
    let lastPageReports: ParticipantPublicPlpProfileReport[] = [];
    let sourceNotFound = false;
    let abortReason: string | null = null;
    const providerBudget = args.execute ? args.maxProviderCalls : Number.POSITIVE_INFINITY;

    if (args.profileId || args.publicName) {
      traversal = "identity";
      const profile = args.profileId
        ? await loadById(args.profileId)
        : await loadByName(args.publicName!);
      if (!profile) {
        sourceNotFound = true;
        lastPageReports = [
          {
            profileId: args.profileId ?? "",
            publicName: args.publicName,
            SOURCE_FOUND: false,
            ELIGIBLE: false,
            CANONICAL_VERSION: null,
            locales: [],
            COMPLETE: true,
          },
        ];
      } else {
        const result = await materializeProfile({
          profile,
          locales,
          execute: args.execute,
          remainingProviderBudget: Math.max(0, providerBudget - providerCalls),
          runProvider,
          publishBuild,
        });
        lastPageReports = [result.report];
        profilesProcessed = 1;
        pagesProcessed = 1;
        providerCalls += result.providerCalls;
        totals = accumulateProfileTotals(totals, result.report);
        if (result.stoppedForBudget) {
          abortReason = "PROVIDER_CALL_BUDGET_REACHED";
          hasMore = true;
          // Do not advance past this profile — resume re-enters it.
          resumeAfterProfileId = lastFullyCompletedProfileId;
        } else {
          resumeAfterProfileId = profile.profileId;
          lastFullyCompletedProfileId = profile.profileId;
        }
      }
    } else {
      traversal = args.historical ? "historical" : "page";
      let afterProfileId = args.afterProfileId;
      const maxPages = args.historical ? args.maxPages : 1;

      pageLoop: for (;;) {
        if (maxPages != null && pagesProcessed >= maxPages) {
          hasMore = true;
          break;
        }

        const page = await listPage({
          pageSize: args.pageSize,
          afterProfileId,
        });
        if (page.length === 0) {
          hasMore = false;
          if (pagesProcessed === 0 && !args.afterProfileId) {
            sourceNotFound = true;
            lastPageReports = [
              {
                profileId: "",
                publicName: null,
                SOURCE_FOUND: false,
                ELIGIBLE: false,
                CANONICAL_VERSION: null,
                locales: [],
                COMPLETE: true,
              },
            ];
          }
          break;
        }

        pagesProcessed += 1;
        const pageReports: ParticipantPublicPlpProfileReport[] = [];
        for (const profile of page) {
          const result = await materializeProfile({
            profile,
            locales,
            execute: args.execute,
            remainingProviderBudget: Math.max(0, providerBudget - providerCalls),
            runProvider,
            publishBuild,
          });
          pageReports.push(result.report);
          providerCalls += result.providerCalls;
          totals = accumulateProfileTotals(totals, result.report);
          profilesProcessed += 1;

          if (result.stoppedForBudget) {
            abortReason = "PROVIDER_CALL_BUDGET_REACHED";
            hasMore = true;
            resumeAfterProfileId = lastFullyCompletedProfileId;
            lastPageReports = pageReports;
            break pageLoop;
          }

          if (result.profileFullyCompleted) {
            lastFullyCompletedProfileId = profile.profileId;
            afterProfileId = profile.profileId;
            resumeAfterProfileId = profile.profileId;
          }
        }
        lastPageReports = pageReports;

        // Release page before next Mongo read (do not retain prior pages).
        if (page.length < args.pageSize) {
          hasMore = false;
          break;
        }
        if (!args.historical) {
          const probe = await listPage({
            pageSize: 1,
            afterProfileId,
          });
          hasMore = probe.length > 0;
          break;
        }
        hasMore = true;
      }
    }

    if (sourceNotFound) {
      abortReason = "SOURCE_NOT_FOUND";
    }

    const report: ParticipantPublicPlpMaterializeReport = {
      pack: "PARTICIPANT_PUBLIC_PLP",
      operation: "materialize_participant_public_plp",
      OPERATOR_MODE: args.execute ? "EXECUTE" : "DRY_RUN",
      TRAVERSAL: traversal,
      ENTITY_TYPE: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
      PLP_PERSISTENCE_MODE:
        getPublishedLocalizationPersistenceMode() === "mongo"
          ? "MONGO"
          : getPublishedLocalizationPersistenceMode() === "memory"
            ? "MEMORY"
            : "UNSET",
      database: resolveMongoConfig().database,
      targetLocales: locales,
      pageSize: traversal === "identity" ? null : args.pageSize,
      pagesProcessed,
      profilesProcessed,
      resumeAfterProfileId,
      hasMore,
      maxProviderCalls: args.maxProviderCalls,
      totals,
      profiles: lastPageReports,
      PROVIDER_CALLS: providerCalls,
      PROVIDER_CONCURRENCY: 1,
      abortReason,
    };

    return {
      exitCode: sourceNotFound ? 1 : 0,
      report,
      errorMessage: sourceNotFound ? "SOURCE_NOT_FOUND" : null,
    };
  } finally {
    await disconnect();
  }
}

export function printParticipantPublicPlpMaterializeReport(
  report: ParticipantPublicPlpMaterializeReport,
): void {
  console.log(JSON.stringify(report, null, 2));
}
