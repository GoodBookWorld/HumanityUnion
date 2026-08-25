import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type { Initiative, InitiativeImplementationCommitment } from "@hu/types";

import {
  acceptInitiativeImplementationCommitment,
  declineInitiativeImplementationCommitment,
} from "../../../src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-lifecycle.service.js";
import {
  createCommitment,
  deleteCommitmentsByParticipantIdForTests,
  getCommitmentById,
} from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { createInitiative, getInitiativeById } from "../../../src/modules/initiatives/initiative.store.js";
import { resolveNotificationRecipientMemberIds } from "../../../src/modules/notifications/notification.recipients.js";
import { hasAcceptedImplementationResponsibility } from "@hu/types";

const STEWARD = "pack19a4-steward";
const PROPOSED = "pack19a4-proposed";
const OTHER = "pack19a4-other";
const INITIATIVE_ID = "initiative-pack19a4-notification";

function ensureInitiative(): void {
  if (getInitiativeById(INITIATIVE_ID)) {
    return;
  }

  const now = new Date().toISOString();
  const initiative: Initiative = {
    initiativeId: INITIATIVE_ID,
    stewardId: STEWARD,
    createdAt: now,
    updatedAt: now,
    title: "Notification Proposal Initiative",
    description: "Fixture.",
    status: "poll",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "environment",
      tags: [],
      region: "Global",
      language: "en",
      communitySlug: "test-community",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };

  createInitiative(initiative);
}

function proposedCommitment(
  overrides: Partial<InitiativeImplementationCommitment> = {},
): InitiativeImplementationCommitment {
  const now = new Date().toISOString();

  return {
    commitmentId: `implementation-commitment-pack19a4-${Math.random().toString(36).slice(2, 10)}`,
    initiativeId: INITIATIVE_ID,
    decisionId: "decision-pack19a4",
    participantId: PROPOSED,
    commitmentTitle: "Organize riverside cleanup",
    commitmentSummary: "Coordinate volunteers.",
    commitmentScope: "action",
    status: "published",
    publishedAt: now,
    packageId: "package-pack19a4",
    approvedAction: "Organize riverside cleanup",
    actionIndex: 0,
    proposalStatus: "proposed",
    proposedByParticipantId: STEWARD,
    acceptedAt: null,
    declinedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Pack 19A.4 — actionable responsibility notifications", () => {
  after(() => {
    deleteCommitmentsByParticipantIdForTests(PROPOSED);
    deleteCommitmentsByParticipantIdForTests(OTHER);
    deleteCommitmentsByParticipantIdForTests(STEWARD);
  });

  it("proposal notification recipients resolve from Commitment.participantId (canonical id)", () => {
    ensureInitiative();
    const commitment = createCommitment(proposedCommitment());

    const recipients = resolveNotificationRecipientMemberIds({
      eventType: "implementation_commitment_proposed",
      entityType: "implementation_commitment",
      entityId: commitment.commitmentId,
      initiativeId: INITIATIVE_ID,
      actorMemberId: STEWARD,
    });

    assert.deepEqual(recipients, [PROPOSED]);
    assert.ok(!recipients.includes(OTHER));
    assert.ok(!recipients.includes(STEWARD));
  });

  it("Accept from notification surface produces canonical accepted state with server acceptedAt", async () => {
    ensureInitiative();
    const commitment = createCommitment(proposedCommitment());
    const before = Date.now();

    // Same API the notification UI invokes — no parallel engine.
    const accepted = await acceptInitiativeImplementationCommitment(
      { participantId: PROPOSED },
      commitment.commitmentId,
    );

    assert.equal(accepted.proposalStatus, "accepted");
    assert.equal(accepted.participantId, PROPOSED);
    assert.ok(accepted.acceptedAt);
    assert.ok(Date.parse(accepted.acceptedAt!) >= before - 1000);
    assert.equal(hasAcceptedImplementationResponsibility(accepted, PROPOSED), true);
  });

  it("unrelated Participant cannot Accept/Decline through crafted identity", async () => {
    ensureInitiative();
    const commitment = createCommitment(proposedCommitment());

    await assert.rejects(
      () =>
        acceptInitiativeImplementationCommitment(
          { participantId: OTHER },
          commitment.commitmentId,
        ),
      /do not have access/i,
    );

    await assert.rejects(
      () =>
        declineInitiativeImplementationCommitment(
          { participantId: OTHER },
          commitment.commitmentId,
        ),
      /do not have access/i,
    );

    assert.equal(getCommitmentById(commitment.commitmentId)?.proposalStatus, "proposed");
  });

  it("Decline from notification surface produces canonical declined state", async () => {
    ensureInitiative();
    const commitment = createCommitment(proposedCommitment());

    const declined = await declineInitiativeImplementationCommitment(
      { participantId: PROPOSED },
      commitment.commitmentId,
    );

    assert.equal(declined.proposalStatus, "declined");
    assert.ok(declined.declinedAt);
    assert.equal(hasAcceptedImplementationResponsibility(declined, PROPOSED), false);
  });

  it("stale Accept after already-accepted is rejected without overwrite", async () => {
    ensureInitiative();
    const commitment = createCommitment(proposedCommitment());
    const first = await acceptInitiativeImplementationCommitment(
      { participantId: PROPOSED },
      commitment.commitmentId,
    );

    await assert.rejects(
      () =>
        acceptInitiativeImplementationCommitment(
          { participantId: PROPOSED },
          commitment.commitmentId,
        ),
      /already been accepted/i,
    );

    const current = getCommitmentById(commitment.commitmentId);
    assert.equal(current?.acceptedAt, first.acceptedAt);
    assert.equal(current?.participantId, PROPOSED);
  });
});
