import { createHash } from "node:crypto";

import type {
  CommunityInitiativeRelationshipProjection,
  Initiative,
} from "@hu/types";

import { publicUrlForEntity } from "../capability02-integration/capability02-integration.service.js";
import { listAllPreferencesRecords } from "../preferences/preferences.repository.js";
import { resolveRecipientIdentity } from "../notifications/notification.recipients.js";
import {
  createReminderIfEligibleWithCooldown,
} from "../reminders/reminder.service.js";
import { getInitiativeById, listInitiatives } from "../initiatives/initiative.store.js";
import { isInitiativeEligibleForPublicProjection } from "../initiatives/initiative-public-projection.access.js";

import {
  COMMUNITY_INTELLIGENCE_COLLAB_REMINDER_MIN_SCORE,
  COMMUNITY_INTELLIGENCE_REMINDER_COOLDOWN_DAYS,
  COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
} from "./community-intelligence.constants.js";
import { findRelatedInitiativesForInitiative } from "./community-intelligence.service.js";
import { scorePriorityMatches } from "./community-intelligence-matching.js";

function buildGenerationKey(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

function relationshipGenerationKey(
  sourceInitiativeId: string,
  item: CommunityInitiativeRelationshipProjection,
): string {
  return buildGenerationKey([
    COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
    sourceInitiativeId,
    item.initiativeId,
    item.relationshipType,
    ...item.reasons.map((reason) => reason.code).slice(0, 4),
    ...item.sharedTopics.slice(0, 4),
  ]);
}

function isHighConfidenceCollaborationOpportunity(
  item: CommunityInitiativeRelationshipProjection,
): boolean {
  if (item.score < COMMUNITY_INTELLIGENCE_COLLAB_REMINDER_MIN_SCORE) {
    return false;
  }

  if (item.relationshipType === "possible_duplicate") {
    return true;
  }

  if (item.relationshipType === "complementary" && item.sharedParticipationAreas.length > 0) {
    return item.sharedTopics.length >= 1 || item.reasons.length >= 2;
  }

  if (item.relationshipType === "related") {
    return (
      item.sharedParticipationAreas.length > 0 &&
      item.sharedTopics.length >= 2 &&
      item.score >= COMMUNITY_INTELLIGENCE_COLLAB_REMINDER_MIN_SCORE
    );
  }

  return false;
}

/**
 * Pack 01/02 — strong priority matches only (≥2 signals). Cooldown prevents
 * immediate regeneration after archive.
 */
export async function createPriorityMatchReminderCandidatesForPublishedInitiative(
  initiative: Initiative,
  stewardMemberId: string,
): Promise<number> {
  const preferencesRecords = await listAllPreferencesRecords();
  let created = 0;

  for (const preferences of preferencesRecords) {
    if (preferences.memberId === stewardMemberId) {
      continue;
    }

    if (!preferences.communicationPreferences.interestMatchNotificationsEnabled) {
      continue;
    }

    const matches = scorePriorityMatches(preferences, [initiative]);
    const strong = matches.find((match) => match.reminderEligible);

    if (!strong) {
      continue;
    }

    const recipient = await resolveRecipientIdentity(preferences.memberId);
    if (!recipient) {
      continue;
    }

    const priorityLabel = strong.matchedPriorities[0] ?? "your selected priorities";
    const generationKey = buildGenerationKey([
      COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
      "priority",
      initiative.initiativeId,
      ...strong.matchedPriorities,
    ]);

    const result = await createReminderIfEligibleWithCooldown({
      recipientUserId: recipient.userId,
      recipientProfileId: recipient.profileId,
      category: "initiative",
      title: "Initiative matches your priorities",
      message: `A new Initiative closely matches one of your selected priorities (“${priorityLabel}”).`,
      relatedEntityType: "initiative",
      relatedEntityId: initiative.initiativeId,
      relatedUrl: publicUrlForEntity("initiative", initiative.initiativeId),
      generationKey,
      cooldownDays: COMMUNITY_INTELLIGENCE_REMINDER_COOLDOWN_DAYS,
    });

    if (result.reminder && !result.skippedReason) {
      created += 1;
    }
  }

  return created;
}

/**
 * Pack 02 — conservative collaboration-opportunity Reminders.
 * Notifies stewards of related Initiatives when a high-confidence relationship
 * exists with the newly published Initiative. Never uses weak keyword matches.
 */
export async function createCollaborationOpportunityReminderCandidatesForPublishedInitiative(
  initiative: Initiative,
  stewardMemberId: string,
): Promise<number> {
  if (!isInitiativeEligibleForPublicProjection(initiative)) {
    return 0;
  }

  const related = await findRelatedInitiativesForInitiative(initiative.initiativeId, {
    bypassCache: true,
  });
  const highConfidence = related.items.filter(isHighConfidenceCollaborationOpportunity);

  if (highConfidence.length === 0) {
    return 0;
  }

  let created = 0;

  for (const item of highConfidence.slice(0, 3)) {
    const peer = getInitiativeById(item.initiativeId);
    if (!peer || peer.stewardId === stewardMemberId) {
      continue;
    }

    const recipient = await resolveRecipientIdentity(peer.stewardId);
    if (!recipient) {
      continue;
    }

    const generationKey = relationshipGenerationKey(initiative.initiativeId, item);
    const result = await createReminderIfEligibleWithCooldown({
      recipientUserId: recipient.userId,
      recipientProfileId: recipient.profileId,
      category: "collaboration",
      title: "Collaboration opportunity",
      message: `An Initiative related to your work may benefit from collaboration (“${initiative.title}”).`,
      relatedEntityType: "initiative",
      relatedEntityId: initiative.initiativeId,
      relatedUrl: publicUrlForEntity("initiative", initiative.initiativeId),
      generationKey,
      cooldownDays: COMMUNITY_INTELLIGENCE_REMINDER_COOLDOWN_DAYS,
    });

    if (result.reminder && !result.skippedReason) {
      created += 1;
    }
  }

  return created;
}

/** Combined publish hook — priority + collaboration candidates. */
export async function createCommunityIntelligenceReminderCandidatesForPublishedInitiative(
  initiative: Initiative,
  stewardMemberId: string,
): Promise<{ priorityCreated: number; collaborationCreated: number }> {
  const priorityCreated = await createPriorityMatchReminderCandidatesForPublishedInitiative(
    initiative,
    stewardMemberId,
  );
  const collaborationCreated =
    await createCollaborationOpportunityReminderCandidatesForPublishedInitiative(
      initiative,
      stewardMemberId,
    );

  return { priorityCreated, collaborationCreated };
}

/** Test helper — expose eligibility without persistence. */
export function isEligibleCollaborationReminderForTests(
  item: CommunityInitiativeRelationshipProjection,
): boolean {
  return isHighConfidenceCollaborationOpportunity(item);
}

/** Test helper — unused export kept for diagnostics of steward discovery. */
export function listPublishedInitiativesForReminderScan(): Initiative[] {
  return listInitiatives().filter(isInitiativeEligibleForPublicProjection);
}
