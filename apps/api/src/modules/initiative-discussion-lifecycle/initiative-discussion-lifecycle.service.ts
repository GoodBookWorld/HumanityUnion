import { randomUUID } from "node:crypto";

import type { Initiative } from "@hu/types";

import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { publishInitiativeLifecycleStage } from "../../shared/initiative-lifecycle-stage/index.js";
import {
  getDiscussionCompletionByInitiativeId,
  upsertDiscussionCompletion,
} from "./initiative-discussion-completion.store.js";
import type { InitiativeDiscussionCompletion } from "./persistence/initiative-discussion-completion-persistence.types.js";

function getOwnedInitiative(initiativeId: string, identity: RequestIdentity): Initiative {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);
  return initiative;
}

/**
 * Discussion completion for lifecycle progression.
 *
 * Discussion remains the Initiative Center `#discussion` surface — this module
 * only stores an explicit Author completion marker + emits the canonical
 * InitiativeLifecycleStagePublished event. Visiting the Discussion tab never
 * completes the stage.
 */
export function getInitiativeDiscussionCompletion(
  initiativeId: string,
): InitiativeDiscussionCompletion | null {
  return getDiscussionCompletionByInitiativeId(initiativeId);
}

export async function completeInitiativeDiscussionStage(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeDiscussionCompletion> {
  const initiative = getOwnedInitiative(initiativeId, identity);

  if (initiative.lifecyclePhase === "draft") {
    throw new Error("Publish the Initiative before completing Discussion.");
  }

  const existing = getDiscussionCompletionByInitiativeId(initiativeId);
  if (existing) {
    return existing;
  }

  const completion = upsertDiscussionCompletion({
    completionId: `initiative-discussion-completion-${randomUUID()}`,
    initiativeId,
    completedByParticipantId: identity.participantId,
    completedAt: new Date().toISOString(),
  });

  try {
    await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      lifecycleProfile: initiative.lifecycleProfile,
      stageId: "discussion",
      stageLabel: "Discussion",
      stageArtifactId: completion.completionId,
      stageVersion: 1,
      actorParticipantId: identity.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#discussion`,
    });
  } catch (error) {
    console.warn(
      `[initiative-discussion-lifecycle] Lifecycle stage notification skipped: ${String(error)}`,
    );
  }

  return completion;
}
