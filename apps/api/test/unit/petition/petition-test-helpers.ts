import type { CollectiveDecision, Petition } from "@hu/types";

import { createDecision } from "../../../src/modules/collective-decision/collective-decision.store.js";
import { bootstrapCollectiveDecision } from "../../../src/modules/collective-decision/bootstrap-collective-decision.js";
import {
  createPetition,
  openPetition,
  preparePetition,
  publishPetition,
} from "../../../src/modules/petition/petition.store.js";
import { defaultPetitionPolicy } from "../../../src/modules/petition/petition.defaults.js";
import { bootstrapInitiativeId } from "../../../src/modules/petition/petition.defaults.js";

export const FIXTURE_INITIATIVE_ID = bootstrapInitiativeId;

export function buildFixturePetition(overrides: {
  petitionId: string;
  decisionId: string;
  initiativeId: string;
}): Petition {
  return {
    petitionId: overrides.petitionId,
    collectiveDecisionId: overrides.decisionId,
    status: "Draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subject: {
      decisionId: overrides.decisionId,
      initiativeId: overrides.initiativeId,
      title: "Task 24 persistence migration test petition",
      summary: "Exercises Mongo-backed Petition/Signature persistence.",
    },
    policy: structuredClone(defaultPetitionPolicy),
    shareLink: null,
    signatures: [],
    supportMetrics: {
      totalSignatures: 0,
      participantSignatures: 0,
      dailyActivity: [],
      supportThresholdStatus: {
        thresholdDefined: false,
        thresholdReached: false,
        currentCount: 0,
        thresholdCount: null,
      },
    },
    outcome: null,
  };
}

/** Seeds an Approved Collective Decision fixture (in-memory, per Task 24 scope). */
export async function seedApprovedDecision(
  decisionId: string,
  initiativeId: string,
): Promise<CollectiveDecision> {
  const decisionFixture: CollectiveDecision = {
    ...structuredClone(bootstrapCollectiveDecision),
    decisionId,
    decisionSubjectId: initiativeId,
  };

  return createDecision(decisionFixture);
}

/** Creates, prepares, publishes and opens a Petition, returning the Open Petition. */
export async function seedOpenPetition(
  petitionId: string,
  decisionId: string,
  initiativeId: string = FIXTURE_INITIATIVE_ID,
): Promise<Petition> {
  await seedApprovedDecision(decisionId, initiativeId);
  await createPetition(buildFixturePetition({ petitionId, decisionId, initiativeId }));
  await preparePetition(petitionId);
  await publishPetition(petitionId);
  const opened = await openPetition(petitionId);

  if (!opened) {
    throw new Error(`Failed to seed Open Petition "${petitionId}" for test.`);
  }

  return opened;
}
