import type { CivicEntityType, CivicNotificationEventType } from "@hu/types";

import { getAccountabilityById } from "../civic-accountability/civic-accountability.store.js";
import { getCapById } from "../civic-action-package/civic-action-package.store.js";
import { publicUrlForEntity } from "../capability02-integration/capability02-integration.service.js";
import { getSessionById } from "../decision-session/decision-session.store.js";
import { getAnalysisById } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { getCommitmentById } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { getTrackingById } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { getProposalById } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { getImpactById } from "../initiative-public-impact/initiative-public-impact.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getResponseById } from "../official-response/official-response.store.js";
import { getArchiveRecordById } from "../public-civic-archive/public-civic-archive.store.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";

export interface CivicNotificationEventInput {
  eventType: CivicNotificationEventType;
  entityType: CivicEntityType;
  entityId: string;
  initiativeId?: string;
  actorMemberId?: string;
}

function uniqueMemberIds(memberIds: Array<string | undefined | null>): string[] {
  return [...new Set(memberIds.filter((memberId): memberId is string => Boolean(memberId)))];
}

function initiativeStewardId(initiativeId: string): string | null {
  return getInitiativeById(initiativeId)?.stewardId ?? null;
}

export function resolveNotificationRecipientMemberIds(
  input: CivicNotificationEventInput,
): string[] {
  const initiativeId =
    input.initiativeId ?? resolveInitiativeIdFromEntity(input.entityType, input.entityId);

  switch (input.eventType) {
    case "initiative_published":
      return uniqueMemberIds([initiativeStewardId(input.entityId)]);

    case "analysis_published":
      return uniqueMemberIds([initiativeId ? initiativeStewardId(initiativeId) : null]);

    case "proposal_submitted":
      return uniqueMemberIds([initiativeId ? initiativeStewardId(initiativeId) : null]);

    case "proposal_decided": {
      const proposal = getProposalById(input.entityId);
      return uniqueMemberIds([proposal?.authorId]);
    }

    case "revision_published":
      return uniqueMemberIds([initiativeId ? initiativeStewardId(initiativeId) : null]);

    case "decision_opened":
    case "decision_closed":
      return uniqueMemberIds([
        getDecisionById(input.entityId)?.stewardId,
        initiativeId ? initiativeStewardId(initiativeId) : null,
      ]);

    case "civic_action_package_issued": {
      return uniqueMemberIds([initiativeId ? initiativeStewardId(initiativeId) : null]);
    }

    case "official_response_received":
    case "official_response_verified": {
      const response = getResponseById(input.entityId);
      return uniqueMemberIds([
        response?.recordedByParticipantId,
        initiativeId ? initiativeStewardId(initiativeId) : null,
      ]);
    }

    case "civic_accountability_event_added":
    case "civic_accountability_closed": {
      const accountability = getAccountabilityById(input.entityId);
      return uniqueMemberIds([
        accountability?.createdByParticipantId,
        initiativeId ? initiativeStewardId(initiativeId) : null,
      ]);
    }

    case "commitment_published": {
      const commitment = getCommitmentById(input.entityId);
      return uniqueMemberIds([
        commitment?.participantId,
        initiativeId ? initiativeStewardId(initiativeId) : null,
      ]);
    }

    case "tracking_updated": {
      const tracking = getTrackingById(input.entityId);
      return uniqueMemberIds([
        tracking?.participantId,
        initiativeId ? initiativeStewardId(initiativeId) : null,
      ]);
    }

    case "impact_verified": {
      const impact = getImpactById(input.entityId);
      return uniqueMemberIds([impact?.participantId]);
    }

    case "archive_published": {
      const archive = getArchiveRecordById(input.entityId);
      return uniqueMemberIds([
        archive?.authorId,
        initiativeId ? initiativeStewardId(initiativeId) : null,
      ]);
    }

    case "civic_nomination_submitted":
    case "civic_nomination_published":
    case "civic_nomination_withdrawn":
    case "civic_nomination_voting_opened":
    case "civic_nomination_voting_closed":
      return uniqueMemberIds([input.actorMemberId]);

    case "civic_nomination_vote_cast":
      return uniqueMemberIds([input.actorMemberId]);

    case "initiative_interest_match":
      return [];

    case "initiative_comment_posted":
      return uniqueMemberIds([initiativeId ? initiativeStewardId(initiativeId) : null]);

    case "initiative_comment_reply":
      return [];

    default:
      return [];
  }
}

function resolveInitiativeIdFromEntity(
  entityType: CivicEntityType,
  entityId: string,
): string | null {
  switch (entityType) {
    case "initiative":
      return entityId;
    case "analysis":
      return getAnalysisById(entityId)?.initiativeId ?? null;
    case "improvement_proposal":
      return getProposalById(entityId)?.initiativeId ?? null;
    case "decision_session":
      return getSessionById(entityId)?.initiativeId ?? null;
    case "collective_decision":
      return getDecisionById(entityId)?.initiativeId ?? null;
    case "civic_action_package":
      return getCapById(entityId)?.initiativeId ?? null;
    case "official_response":
      return getResponseById(entityId)?.initiativeId ?? null;
    case "civic_accountability":
      return getAccountabilityById(entityId)?.initiativeId ?? null;
    case "implementation_commitment":
      return getCommitmentById(entityId)?.initiativeId ?? null;
    case "implementation_tracking":
      return getTrackingById(entityId)?.initiativeId ?? null;
    case "public_impact":
      return getImpactById(entityId)?.initiativeId ?? null;
    case "civic_archive":
      return getArchiveRecordById(entityId)?.initiativeId ?? null;
    case "civic_nomination":
    case "knowledge_article":
    case "knowledge_media":
      return null;
    case "initiative_revision":
      return entityId.split("::")[0] ?? null;
    default:
      return null;
  }
}

export function resolveNotificationRelatedUrl(
  entityType: CivicEntityType,
  entityId: string,
): string {
  if (entityType === "initiative_revision") {
    const [initiativeId, versionPart] = entityId.split("::");
    const version = Number.parseInt(versionPart ?? "1", 10);

    return publicUrlForEntity(entityType, entityId, {
      initiativeId,
      version: Number.isNaN(version) ? 1 : version,
    });
  }

  return publicUrlForEntity(entityType, entityId);
}

const memoryRecipientDirectory = new Map<string, { userId: string; profileId: string }>();

export function registerMemoryNotificationRecipient(input: {
  memberId: string;
  userId: string;
  profileId: string;
}): void {
  memoryRecipientDirectory.set(input.memberId, {
    userId: input.userId,
    profileId: input.profileId,
  });
}

export function clearMemoryNotificationRecipientsForTests(): void {
  memoryRecipientDirectory.clear();
}

export async function resolveRecipientIdentity(memberId: string): Promise<{
  userId: string;
  profileId: string;
} | null> {
  const cached = memoryRecipientDirectory.get(memberId);

  if (cached) {
    return cached;
  }

  const shouldResolveFromMongo =
    isMongoConfigured() && process.env.NOTIFICATION_PERSISTENCE === "mongodb";

  if (shouldResolveFromMongo) {
    try {
      const authUser = await findAuthUserByMemberId(memberId);

      if (authUser) {
        const profile = await findMemberProfileByUserId(authUser.userId);

        if (profile) {
          return {
            userId: authUser.userId,
            profileId: profile.profileId,
          };
        }

        return {
          userId: authUser.userId,
          profileId: authUser.userId,
        };
      }
    } catch {
      // Mongo may be unavailable in memory-only civic tests.
    }
  }

  return {
    userId: memberId,
    profileId: memberId,
  };
}
