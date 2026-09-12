/**
 * Bounded participant_public PLP materialize operator (Render Starter safe).
 *
 * Dry-run default; --execute is staging-only.
 * Thin path: runUniversalPlpBuild + dynamic provider import only.
 * Does not pull the durable queue, Registry service barrel, or all-adapter
 * registration graph (those inflate RSS past Render Starter 512 MB).
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
  readonly ACTION: "SKIP_CURRENT" | "WOULD_BUILD" | "BUILT" | "FAILED" | "SKIP_SOURCE";
  readonly reason: string | null;
};

export type ParticipantPublicPlpProfileReport = {
  readonly profileId: string;
  readonly publicName: string | null;
  readonly SOURCE_FOUND: boolean;
  readonly ELIGIBLE: boolean;
  readonly CANONICAL_VERSION: string | null;
  readonly locales: readonly ParticipantPublicPlpLocaleOutcome[];
};

export type ParticipantPublicPlpMaterializeReport = {
  readonly pack: "PARTICIPANT_PUBLIC_PLP";
  readonly operation: "materialize_participant_public_plp";
  readonly OPERATOR_MODE: "DRY_RUN" | "EXECUTE";
  readonly ENTITY_TYPE: typeof PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE;
  readonly PLP_PERSISTENCE_MODE: string;
  readonly database: string | null;
  readonly profiles: readonly ParticipantPublicPlpProfileReport[];
  readonly PROVIDER_CALLS: number;
  readonly abortReason: string | null;
};

export type ParticipantPublicPlpMaterializeDeps = {
  readonly loadProfileById?: (profileId: string) => Promise<MemberProfile | null>;
  readonly loadProfileByPublicName?: (
    publicName: string,
  ) => Promise<MemberProfile | null>;
  readonly listEligibleProfiles?: (limit: number) => Promise<MemberProfile[]>;
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

export async function listParticipantPublicPlpEligibleProfiles(
  limit: number,
): Promise<MemberProfile[]> {
  const collection = getMongoCollection(MONGO_COLLECTIONS.memberProfiles);
  const docs = await collection
    .find({
      status: { $ne: "suspended" },
      profileVisibility: { $in: ["public", "members_only"] },
    })
    .project(PROFILE_PROJECTION)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
  return docs
    .map((doc) => asProfile(doc as Record<string, unknown>))
    .filter((row): row is MemberProfile => row != null);
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
  readonly runProvider: NonNullable<ParticipantPublicPlpMaterializeDeps["runProvider"]>;
  readonly publishBuild: typeof runUniversalPlpBuild;
}): Promise<{
  readonly outcome: ParticipantPublicPlpLocaleOutcome;
  readonly providerCalls: number;
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
    };
  }

  if (Object.keys(autoValues).length === 0) {
    return {
      outcome: {
        locale: input.locale,
        CURRENT_USABLE: false,
        ACTION: "FAILED",
        reason: "NO_MACHINE_AUTO_PATHS",
      },
      providerCalls: 0,
    };
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
  };
}

async function materializeProfile(input: {
  readonly profile: MemberProfile | null;
  readonly locales: readonly string[];
  readonly execute: boolean;
  readonly runProvider: NonNullable<ParticipantPublicPlpMaterializeDeps["runProvider"]>;
  readonly publishBuild: typeof runUniversalPlpBuild;
}): Promise<{
  readonly report: ParticipantPublicPlpProfileReport;
  readonly providerCalls: number;
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
      },
      providerCalls: 0,
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
      },
      providerCalls: 0,
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
  for (const locale of input.locales) {
    const { outcome, providerCalls: calls } = await inspectLocale({
      profile: input.profile,
      locale,
      execute: input.execute,
      runProvider: input.runProvider,
      publishBuild: input.publishBuild,
    });
    locales.push(outcome);
    providerCalls += calls;
  }

  return {
    report: {
      profileId: input.profile.profileId,
      publicName: input.profile.publicName ?? null,
      SOURCE_FOUND: true,
      ELIGIBLE: true,
      CANONICAL_VERSION: canonical.canonicalVersion,
      locales,
    },
    providerCalls,
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
    const listEligible =
      deps.listEligibleProfiles ?? listParticipantPublicPlpEligibleProfiles;

    const profiles: MemberProfile[] = [];
    if (args.profileId) {
      const profile = await loadById(args.profileId);
      if (profile) {
        profiles.push(profile);
      }
    } else if (args.publicName) {
      const profile = await loadByName(args.publicName);
      if (profile) {
        profiles.push(profile);
      }
    } else if (args.limit) {
      profiles.push(...(await listEligible(args.limit)));
    }

    const runProvider = deps.runProvider ?? defaultRunProvider;
    const publishBuild = deps.publishBuild ?? runUniversalPlpBuild;

    const profileReports: ParticipantPublicPlpProfileReport[] = [];
    let providerCalls = 0;
    for (const profile of profiles) {
      const result = await materializeProfile({
        profile,
        locales,
        execute: args.execute,
        runProvider,
        publishBuild,
      });
      profileReports.push(result.report);
      providerCalls += result.providerCalls;
    }

    if (profiles.length === 0) {
      profileReports.push({
        profileId: args.profileId ?? "",
        publicName: args.publicName,
        SOURCE_FOUND: false,
        ELIGIBLE: false,
        CANONICAL_VERSION: null,
        locales: [],
      });
    }

    const report: ParticipantPublicPlpMaterializeReport = {
      pack: "PARTICIPANT_PUBLIC_PLP",
      operation: "materialize_participant_public_plp",
      OPERATOR_MODE: args.execute ? "EXECUTE" : "DRY_RUN",
      ENTITY_TYPE: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
      PLP_PERSISTENCE_MODE:
        getPublishedLocalizationPersistenceMode() === "mongo"
          ? "MONGO"
          : getPublishedLocalizationPersistenceMode() === "memory"
            ? "MEMORY"
            : "UNSET",
      database: resolveMongoConfig().database,
      profiles: profileReports,
      PROVIDER_CALLS: providerCalls,
      abortReason: profiles.length === 0 ? "SOURCE_NOT_FOUND" : null,
    };

    return {
      exitCode: profiles.length === 0 ? 1 : 0,
      report,
      errorMessage: profiles.length === 0 ? "SOURCE_NOT_FOUND" : null,
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
