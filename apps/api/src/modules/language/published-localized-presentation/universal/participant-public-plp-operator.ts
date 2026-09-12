/**
 * Bounded participant_public PLP materialize operator.
 * Dry-run default; --execute is staging-only.
 */

import type { LanguageCode, MemberProfile, PlpBuildRequest } from "@hu/types";
import {
  PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
  plpBuildWorkKey,
} from "@hu/types";

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
  findMemberProfileByProfileId,
  findMemberProfileByPublicName,
} from "../../../member-profile/member-profile.repository.js";
import {
  assertPublishedLocalizationMongoPersistenceActive,
  findCurrentPublishedPresentation,
  getPublishedLocalizationPersistenceMode,
  requirePublishedLocalizationMongoPersistence,
} from "../persistence/repository.js";
import { classifyUsableLocalizedPresentation } from "../usability.js";
import {
  buildParticipantPublicCanonicalPresentation,
  PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
} from "./adapters/participant-public-adapter.js";
import {
  evaluateParticipantPublicPlpExecuteGuards,
  evaluateParticipantPublicPlpProductionRefusal,
  parseParticipantPublicPlpMaterializeArgs,
  type ParticipantPublicPlpMaterializeArgs,
} from "./participant-public-plp-operator-args.js";
import { processPlpBuildRequest } from "./process-plp-build-request.js";
import { resolvePlpAutoBuildLocales } from "./public-source-mutation-bridge.js";
import { ensureAllDefaultPlpAdaptersRegistered } from "./register-defaults.js";

export type { ParticipantPublicPlpMaterializeArgs } from "./participant-public-plp-operator-args.js";
export {
  evaluateParticipantPublicPlpExecuteGuards,
  evaluateParticipantPublicPlpProductionRefusal,
  parseParticipantPublicPlpMaterializeArgs,
} from "./participant-public-plp-operator-args.js";

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

function isEligible(profile: MemberProfile): boolean {
  if (profile.status === "suspended") {
    return false;
  }
  return profile.profileVisibility === "public" || profile.profileVisibility === "members_only";
}

async function listEligibleProfiles(limit: number): Promise<MemberProfile[]> {
  const collection = getMongoCollection(MONGO_COLLECTIONS.memberProfiles);
  const docs = await collection
    .find({
      status: { $ne: "suspended" },
      profileVisibility: { $in: ["public", "members_only"] },
    })
    .project({
      _id: 0,
      profileId: 1,
      publicName: 1,
      displayName: 1,
      biography: 1,
      organization: 1,
      skills: 1,
      profileVisibility: 1,
      status: 1,
    })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
  return docs as unknown as MemberProfile[];
}

async function resolveTargetLocales(localeFilter: string | null): Promise<readonly string[]> {
  if (localeFilter) {
    return [localeFilter];
  }
  return resolvePlpAutoBuildLocales({ excludeSourceLanguage: "en" });
}

async function inspectLocale(input: {
  readonly profile: MemberProfile;
  readonly locale: string;
  readonly canonicalVersion: string;
  readonly presentation: ReturnType<typeof buildParticipantPublicCanonicalPresentation>["presentation"];
  readonly execute: boolean;
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

  const current = await findCurrentPublishedPresentation({
    entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
    entityId: input.profile.profileId,
    locale: input.locale,
  });
  const usability = classifyUsableLocalizedPresentation({
    locale: input.locale,
    liveCanonicalVersion: input.canonicalVersion,
    liveLocalizationSchemaVersion: PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
    canonicalPresentation: input.presentation,
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

  const now = new Date().toISOString();
  const request: PlpBuildRequest = {
    workKey: plpBuildWorkKey({
      entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
      entityId: input.profile.profileId,
      locale: input.locale,
    }),
    entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
    entityId: input.profile.profileId,
    locale: input.locale as LanguageCode,
    canonicalVersion: input.canonicalVersion,
    contentRevision: 1,
    trigger: "ADMIN_REBUILD",
    enqueuedAt: now,
    status: "QUEUED",
  };
  const result = await processPlpBuildRequest(request);
  if (result.status === "COMPLETED") {
    return {
      outcome: {
        locale: input.locale,
        CURRENT_USABLE: true,
        ACTION: "BUILT",
        reason: result.status,
      },
      providerCalls: 1,
    };
  }
  if (result.status === "SKIPPED_USABLE") {
    return {
      outcome: {
        locale: input.locale,
        CURRENT_USABLE: true,
        ACTION: "SKIP_CURRENT",
        reason: result.status,
      },
      providerCalls: 0,
    };
  }
  return {
    outcome: {
      locale: input.locale,
      CURRENT_USABLE: false,
      ACTION: "FAILED",
      reason:
        result.status === "FAILED"
          ? (result.failure?.safeReason ?? result.status)
          : result.status,
    },
    providerCalls: result.status === "FAILED" ? 1 : 0,
  };
}

async function materializeProfile(input: {
  readonly profile: MemberProfile | null;
  readonly locales: readonly string[];
  readonly execute: boolean;
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
      canonicalVersion: canonical.canonicalVersion,
      presentation: canonical.presentation,
      execute: input.execute,
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

  const refusal = evaluateParticipantPublicPlpProductionRefusal();
  if (refusal.refused) {
    return { exitCode: 2, report: null, errorMessage: refusal.reason };
  }
  if (args.execute) {
    const executeGuard = evaluateParticipantPublicPlpExecuteGuards();
    if (executeGuard.refused) {
      return { exitCode: 2, report: null, errorMessage: executeGuard.reason };
    }
  }

  if (!isMongoConfigured()) {
    return {
      exitCode: 2,
      report: null,
      errorMessage: "materialize:participant-public-plp --mongo requires MONGODB_URI",
    };
  }

  ensureAllDefaultPlpAdaptersRegistered();

  try {
    await connectMongoClient();
    requirePublishedLocalizationMongoPersistence(
      "materialize:participant-public-plp --mongo",
    );
    assertPublishedLocalizationMongoPersistenceActive(
      "materialize:participant-public-plp --mongo",
    );

    const locales = await resolveTargetLocales(args.locale);
    const profiles: MemberProfile[] = [];
    if (args.profileId) {
      const profile = await findMemberProfileByProfileId(args.profileId);
      if (profile) {
        profiles.push(profile);
      }
    } else if (args.publicName) {
      const profile = await findMemberProfileByPublicName(args.publicName);
      if (profile) {
        profiles.push(profile);
      }
    } else if (args.limit) {
      profiles.push(...(await listEligibleProfiles(args.limit)));
    }

    const profileReports: ParticipantPublicPlpProfileReport[] = [];
    let providerCalls = 0;
    for (const profile of profiles) {
      const result = await materializeProfile({
        profile,
        locales,
        execute: args.execute,
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
    await disconnectMongoClient();
  }
}

export function printParticipantPublicPlpMaterializeReport(
  report: ParticipantPublicPlpMaterializeReport,
): void {
  console.log(JSON.stringify(report, null, 2));
}
