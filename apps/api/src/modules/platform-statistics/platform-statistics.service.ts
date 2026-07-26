import type { PlatformStatisticsCounts, PlatformStatisticsPayload } from "@hu/types";

import { countActiveAuthUsers, listActiveAuthUserMemberIds } from "../auth/auth-user.repository.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { listCaps } from "../civic-action-package/civic-action-package.store.js";
import { listCivicNominations } from "../civic-nomination/civic-nomination.store.js";
import {
  listAllNominationVoteHistory,
  listAllNominationVotes,
} from "../civic-nomination-vote/civic-nomination-vote.store.js";
import {
  listAllVoteHistory,
  listAllVotes,
} from "../initiative-decision-vote/initiative-decision-vote.store.js";
import { listDecisions as listInitiativeCollectiveDecisions } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { listAnalyses as listInitiativeAnalyses } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listCommitments as listImplementationCommitments } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import {
  listAllTrackingUpdates,
  listTrackings as listImplementationTrackings,
} from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { listProposals as listImprovementProposals } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { listImpacts as listPublicImpacts } from "../initiative-public-impact/initiative-public-impact.store.js";
import { isInitiativeEligibleForPublicProjection } from "../initiatives/initiative-public-projection.access.js";
import { listInitiatives } from "../initiatives/initiative.store.js";
import { listMembers } from "../member/member-access.js";
import { listResponses as listOfficialResponses } from "../official-response/official-response.store.js";
import { listActiveParticipationAreas } from "../participation-area/participation-area.store.js";
import { listPublishedArchiveRecords } from "../public-civic-archive/public-civic-archive.store.js";
import { ACTIVE_MEMBER_WINDOW_DAYS } from "./platform-statistics.types.js";
import {
  readCachedPlatformStatistics,
  writeCachedPlatformStatistics,
} from "./platform-statistics.cache.js";

const PUBLIC_COLLECTIVE_DECISION_STATUSES = new Set(["opened", "closed", "cancelled"]);

function isWithinActiveMemberWindow(isoDate: string | undefined, windowStartMs: number): boolean {
  if (!isoDate) {
    return false;
  }

  const timestamp = Date.parse(isoDate);

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return timestamp >= windowStartMs;
}

async function countUsers(): Promise<number> {
  const authUserCount = await countActiveAuthUsers();

  if (authUserCount > 0 || isMongoConfigured()) {
    return authUserCount;
  }

  return (await listMembers()).length;
}

function countPublicInitiatives(): number {
  return listInitiatives().filter(isInitiativeEligibleForPublicProjection).length;
}

function countPublicCollectiveDecisions(): number {
  return listInitiativeCollectiveDecisions().filter((decision) =>
    PUBLIC_COLLECTIVE_DECISION_STATUSES.has(decision.status),
  ).length;
}

function countIssuedCivicActionPackages(): number {
  return listCaps().filter((capPackage) => capPackage.status === "issued").length;
}

function countPublicOfficialResponses(): number {
  return listOfficialResponses().filter(
    (response) =>
      response.publicationStatus === "published" || response.publicationStatus === "archived",
  ).length;
}

function countPublishedCivicArchiveRecords(): number {
  return listPublishedArchiveRecords().length;
}

function countGeographyFromParticipationAreas(): { countries: number; regions: number } {
  const activeAreas = listActiveParticipationAreas();
  const countries = new Set<string>();
  const regions = new Set<string>();

  for (const area of activeAreas) {
    if (area.countrySlug.trim()) {
      countries.add(area.countrySlug.trim().toLowerCase());
    }

    if (area.countrySlug.trim() && area.regionSlug?.trim()) {
      regions.add(
        `${area.countrySlug.trim().toLowerCase()}::${area.regionSlug.trim().toLowerCase()}`,
      );
    }
  }

  return {
    countries: countries.size,
    regions: regions.size,
  };
}

async function countGeographyFromMembers(): Promise<{ countries: number; regions: number }> {
  const countries = new Set<string>();
  const regions = new Set<string>();

  for (const member of await listMembers()) {
    const country = member.profile.country?.trim();

    if (country) {
      countries.add(country.toLowerCase());
    }

    const region = member.profile.region?.trim();

    if (country && region) {
      regions.add(`${country.toLowerCase()}::${region.toLowerCase()}`);
    }
  }

  return {
    countries: countries.size,
    regions: regions.size,
  };
}

async function countGeography(): Promise<{ countries: number; regions: number }> {
  const fromParticipationAreas = countGeographyFromParticipationAreas();

  if (fromParticipationAreas.countries > 0) {
    return fromParticipationAreas;
  }

  return countGeographyFromMembers();
}

async function countActiveMembers(windowStartMs: number): Promise<number> {
  const memberIdToUserId = await listActiveAuthUserMemberIds();
  const activeActorKeys = new Set<string>();

  function registerActor(
    participantId: string | undefined,
    userId: string | undefined,
    timestamp: string | undefined,
  ) {
    if (!isWithinActiveMemberWindow(timestamp, windowStartMs)) {
      return;
    }

    if (userId) {
      activeActorKeys.add(`user:${userId}`);
      return;
    }

    if (!participantId) {
      return;
    }

    const mappedUserId = memberIdToUserId.get(participantId);

    if (mappedUserId) {
      activeActorKeys.add(`user:${mappedUserId}`);
      return;
    }

    activeActorKeys.add(`participant:${participantId}`);
  }

  for (const initiative of listInitiatives()) {
    registerActor(initiative.stewardId, undefined, initiative.createdAt);
    registerActor(initiative.stewardId, undefined, initiative.updatedAt);
  }

  for (const analysis of listInitiativeAnalyses()) {
    registerActor(analysis.authorId, undefined, analysis.createdAt);
    registerActor(analysis.authorId, undefined, analysis.updatedAt);
    registerActor(analysis.authorId, undefined, analysis.publishedAt);
  }

  for (const proposal of listImprovementProposals()) {
    registerActor(proposal.authorId, undefined, proposal.createdAt);
    registerActor(proposal.authorId, undefined, proposal.updatedAt);
    registerActor(proposal.authorId, undefined, proposal.decidedAt);
  }

  for (const vote of listAllVotes()) {
    registerActor(vote.participantId, undefined, vote.castAt);
    registerActor(vote.participantId, undefined, vote.updatedAt);
  }

  for (const historyEntry of listAllVoteHistory()) {
    registerActor(historyEntry.participantId, undefined, historyEntry.changedAt);
  }

  for (const commitment of listImplementationCommitments()) {
    registerActor(commitment.participantId, undefined, commitment.createdAt);
    registerActor(commitment.participantId, undefined, commitment.updatedAt);
    registerActor(commitment.participantId, undefined, commitment.publishedAt);
  }

  for (const tracking of listImplementationTrackings()) {
    registerActor(tracking.participantId, undefined, tracking.createdAt);
    registerActor(tracking.participantId, undefined, tracking.updatedAt);
    registerActor(tracking.participantId, undefined, tracking.activatedAt);
  }

  for (const update of listAllTrackingUpdates()) {
    registerActor(update.authorId, undefined, update.createdAt);
  }

  for (const impact of listPublicImpacts()) {
    registerActor(impact.participantId, undefined, impact.createdAt);
    registerActor(impact.participantId, undefined, impact.updatedAt);
    registerActor(impact.participantId, undefined, impact.publishedAt);
  }

  for (const nomination of listCivicNominations()) {
    registerActor(undefined, nomination.nominatedByUserId, nomination.createdAt);
    registerActor(undefined, nomination.nominatedByUserId, nomination.updatedAt);
    registerActor(undefined, nomination.nominatedByUserId, nomination.publishedAt);
  }

  for (const vote of listAllNominationVotes()) {
    registerActor(vote.participantId, undefined, vote.createdAt);
    registerActor(vote.participantId, undefined, vote.updatedAt);
  }

  for (const historyEntry of listAllNominationVoteHistory()) {
    registerActor(historyEntry.participantId, undefined, historyEntry.changedAt);
  }

  return activeActorKeys.size;
}

async function buildPlatformStatisticsCounts(): Promise<PlatformStatisticsCounts> {
  const windowStartMs = Date.now() - ACTIVE_MEMBER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const geography = await countGeography();

  return {
    users: await countUsers(),
    activeMembers: await countActiveMembers(windowStartMs),
    countries: geography.countries,
    regions: geography.regions,
    initiatives: countPublicInitiatives(),
    collectiveDecisions: countPublicCollectiveDecisions(),
    civicActionPackages: countIssuedCivicActionPackages(),
    officialResponses: countPublicOfficialResponses(),
    civicArchive: countPublishedCivicArchiveRecords(),
  };
}

export async function getPlatformStatisticsPayload(): Promise<PlatformStatisticsPayload> {
  const cached = readCachedPlatformStatistics();

  if (cached) {
    return cached;
  }

  const payload: PlatformStatisticsPayload = {
    data: await buildPlatformStatisticsCounts(),
    meta: {
      activeMemberWindowDays: ACTIVE_MEMBER_WINDOW_DAYS,
      generatedAt: new Date().toISOString(),
    },
  };

  writeCachedPlatformStatistics(payload);

  return payload;
}
