import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type { Initiative, InitiativeImplementationCommitment } from "@hu/types";
import { hasAcceptedImplementationResponsibility } from "@hu/types";

import {
  acceptInitiativeImplementationCommitment,
  declineInitiativeImplementationCommitment,
  initiateImplementationCommitmentTransfer,
  reproposeInitiativeImplementationCommitment,
  takeInitiativeImplementationCommitment,
} from "../../../src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-lifecycle.service.js";
import {
  createCommitment,
  deleteCommitmentsByParticipantIdForTests,
  getCommitmentById,
} from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { resolveNotificationRecipientMemberIds } from "../../../src/modules/notifications/notification.recipients.js";
import { createInitiative, getInitiativeById } from "../../../src/modules/initiatives/initiative.store.js";
import { assessInitiativeImplementationTrackingEligibility } from "../../../src/modules/initiative-implementation-tracking/initiative-implementation-tracking-eligibility.js";

const STEWARD = "pack19a5-steward";
const FIRST = "pack19a5-first";
const SECOND = "pack19a5-second";
const OTHER = "pack19a5-other";
const INITIATIVE_ID = "initiative-pack19a5-repropose-transfer";

const alwaysExists = async () => true;

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
    title: "Pack 19A.5 Initiative",
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
    commitmentId: `implementation-commitment-pack19a5-${Math.random().toString(36).slice(2, 10)}`,
    initiativeId: INITIATIVE_ID,
    decisionId: "decision-pack19a5",
    participantId: FIRST,
    commitmentTitle: "Restore wetland buffer",
    commitmentSummary: "Coordinate restoration.",
    commitmentScope: "action",
    status: "published",
    publishedAt: now,
    packageId: "package-pack19a5",
    approvedAction: "Restore wetland buffer",
    actionIndex: 0,
    proposalStatus: "proposed",
    proposedByParticipantId: STEWARD,
    proposedAt: now,
    acceptedAt: null,
    declinedAt: null,
    pendingProposedParticipantId: null,
    proposalHistory: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Pack 19A.5 — re-propose after Decline + responsibility transfer", () => {
  after(() => {
    deleteCommitmentsByParticipantIdForTests(FIRST);
    deleteCommitmentsByParticipantIdForTests(SECOND);
    deleteCommitmentsByParticipantIdForTests(OTHER);
    deleteCommitmentsByParticipantIdForTests(STEWARD);
  });

  it("re-propose: declined → new Participant proposed; old cannot Accept; new can Accept", async () => {
    ensureInitiative();
    const created = createCommitment(proposedCommitment());

    await declineInitiativeImplementationCommitment({ participantId: FIRST }, created.commitmentId);

    const declined = getCommitmentById(created.commitmentId)!;
    assert.equal(declined.proposalStatus, "declined");
    assert.ok((declined.proposalHistory ?? []).some((entry) => entry.outcome === "declined"));

    const reproposed = await reproposeInitiativeImplementationCommitment(
      { participantId: STEWARD },
      created.commitmentId,
      SECOND,
      { resolveProposedParticipantExists: alwaysExists },
    );

    assert.equal(reproposed.proposalStatus, "proposed");
    assert.equal(reproposed.participantId, SECOND);
    assert.equal(reproposed.declinedAt, null);
    assert.ok((reproposed.proposalHistory ?? []).some((entry) => entry.outcome === "declined"));
    assert.ok(
      (reproposed.proposalHistory ?? []).some((entry) => entry.outcome === "superseded_by_reproposal"),
    );

    await assert.rejects(
      () =>
        acceptInitiativeImplementationCommitment(
          { participantId: FIRST },
          created.commitmentId,
        ),
      /do not have access/i,
    );

    const accepted = await acceptInitiativeImplementationCommitment(
      { participantId: SECOND },
      created.commitmentId,
    );

    assert.equal(accepted.proposalStatus, "accepted");
    assert.equal(accepted.participantId, SECOND);
    assert.ok(accepted.acceptedAt);
    assert.equal(hasAcceptedImplementationResponsibility(accepted, SECOND), true);
    assert.equal(hasAcceptedImplementationResponsibility(accepted, FIRST), false);
  });

  it("re-propose: new Participant can Decline; unrelated rejected; non-steward cannot re-propose", async () => {
    ensureInitiative();
    const created = createCommitment(proposedCommitment());

    await declineInitiativeImplementationCommitment({ participantId: FIRST }, created.commitmentId);

    await assert.rejects(
      () =>
        reproposeInitiativeImplementationCommitment(
          { participantId: OTHER },
          created.commitmentId,
          SECOND,
          { resolveProposedParticipantExists: alwaysExists },
        ),
      /do not have access/i,
    );

    await reproposeInitiativeImplementationCommitment(
      { participantId: STEWARD },
      created.commitmentId,
      SECOND,
      { resolveProposedParticipantExists: alwaysExists },
    );

    await assert.rejects(
      () =>
        declineInitiativeImplementationCommitment(
          { participantId: OTHER },
          created.commitmentId,
        ),
      /do not have access/i,
    );

    const declined = await declineInitiativeImplementationCommitment(
      { participantId: SECOND },
      created.commitmentId,
    );

    assert.equal(declined.proposalStatus, "declined");
    assert.equal(declined.participantId, SECOND);
  });

  it("transfer: keeps one owner until Accept; history preserved; tracking resolves to current", async () => {
    ensureInitiative();
    const created = createCommitment(proposedCommitment());
    const accepted = await acceptInitiativeImplementationCommitment(
      { participantId: FIRST },
      created.commitmentId,
    );
    const priorAcceptedAt = accepted.acceptedAt;

    await assert.rejects(
      () =>
        initiateImplementationCommitmentTransfer(
          { participantId: OTHER },
          created.commitmentId,
          SECOND,
          { resolveProposedParticipantExists: alwaysExists },
        ),
      /do not have access/i,
    );

    const pending = await initiateImplementationCommitmentTransfer(
      { participantId: STEWARD },
      created.commitmentId,
      SECOND,
      { resolveProposedParticipantExists: alwaysExists },
    );

    assert.equal(pending.proposalStatus, "accepted");
    assert.equal(pending.participantId, FIRST);
    assert.equal(pending.pendingProposedParticipantId, SECOND);
    assert.equal(hasAcceptedImplementationResponsibility(pending, FIRST), true);
    assert.equal(hasAcceptedImplementationResponsibility(pending, SECOND), false);

    const recipients = resolveNotificationRecipientMemberIds({
      eventType: "implementation_commitment_proposed",
      entityType: "implementation_commitment",
      entityId: created.commitmentId,
      initiativeId: INITIATIVE_ID,
      actorMemberId: STEWARD,
    });
    assert.deepEqual(recipients, [SECOND]);

    await assert.rejects(
      () =>
        acceptInitiativeImplementationCommitment(
          { participantId: FIRST },
          created.commitmentId,
        ),
      /already been accepted|do not have access/i,
    );

    await assert.rejects(
      () =>
        acceptInitiativeImplementationCommitment(
          { participantId: OTHER },
          created.commitmentId,
        ),
      /do not have access/i,
    );

    const transferred = await acceptInitiativeImplementationCommitment(
      { participantId: SECOND },
      created.commitmentId,
    );

    assert.equal(transferred.proposalStatus, "accepted");
    assert.equal(transferred.participantId, SECOND);
    assert.equal(transferred.pendingProposedParticipantId, null);
    assert.ok(transferred.acceptedAt);
    assert.notEqual(transferred.acceptedAt, priorAcceptedAt);
    assert.equal(hasAcceptedImplementationResponsibility(transferred, SECOND), true);
    assert.equal(hasAcceptedImplementationResponsibility(transferred, FIRST), false);

    const history = transferred.proposalHistory ?? [];
    assert.ok(
      history.some(
        (entry) =>
          entry.outcome === "transferred_away" &&
          entry.participantId === FIRST &&
          entry.acceptedAt === priorAcceptedAt,
      ),
    );

    const eligibilitySecond = assessInitiativeImplementationTrackingEligibility(
      created.commitmentId,
      SECOND,
    );
    const eligibilityFirst = assessInitiativeImplementationTrackingEligibility(
      created.commitmentId,
      FIRST,
    );
    assert.equal(eligibilitySecond.eligible, true);
    assert.equal(eligibilityFirst.eligible, false);
  });

  it("transfer Decline keeps original owner; stale second transfer rejected", async () => {
    ensureInitiative();
    const created = createCommitment(proposedCommitment());
    await acceptInitiativeImplementationCommitment({ participantId: FIRST }, created.commitmentId);

    await initiateImplementationCommitmentTransfer(
      { participantId: STEWARD },
      created.commitmentId,
      SECOND,
      { resolveProposedParticipantExists: alwaysExists },
    );

    await assert.rejects(
      () =>
        initiateImplementationCommitmentTransfer(
          { participantId: STEWARD },
          created.commitmentId,
          OTHER,
          { resolveProposedParticipantExists: alwaysExists },
        ),
      /already pending/i,
    );

    const afterDecline = await declineInitiativeImplementationCommitment(
      { participantId: SECOND },
      created.commitmentId,
    );

    assert.equal(afterDecline.proposalStatus, "accepted");
    assert.equal(afterDecline.participantId, FIRST);
    assert.equal(afterDecline.pendingProposedParticipantId, null);
    assert.equal(hasAcceptedImplementationResponsibility(afterDecline, FIRST), true);
    assert.ok(
      (afterDecline.proposalHistory ?? []).some((entry) => entry.outcome === "transfer_declined"),
    );

    await assert.rejects(
      () =>
        acceptInitiativeImplementationCommitment(
          { participantId: SECOND },
          created.commitmentId,
        ),
      /do not have access|already been accepted/i,
    );
  });

  it("regression: original proposal Accept/Decline, Take, notification recipients", async () => {
    ensureInitiative();
    const proposed = createCommitment(proposedCommitment({ participantId: SECOND }));
    const accepted = await acceptInitiativeImplementationCommitment(
      { participantId: SECOND },
      proposed.commitmentId,
    );
    assert.equal(accepted.proposalStatus, "accepted");

    const toDecline = createCommitment(proposedCommitment({ participantId: FIRST }));
    const declined = await declineInitiativeImplementationCommitment(
      { participantId: FIRST },
      toDecline.commitmentId,
    );
    assert.equal(declined.proposalStatus, "declined");

    const unassigned = createCommitment(
      proposedCommitment({
        participantId: null,
        proposalStatus: "unassigned",
        proposedAt: null,
      }),
    );
    const taken = await takeInitiativeImplementationCommitment(
      { participantId: OTHER },
      unassigned.commitmentId,
    );
    assert.equal(taken.proposalStatus, "accepted");
    assert.equal(taken.participantId, OTHER);

    const recipients = resolveNotificationRecipientMemberIds({
      eventType: "implementation_commitment_proposed",
      entityType: "implementation_commitment",
      entityId: proposed.commitmentId,
      initiativeId: INITIATIVE_ID,
      actorMemberId: STEWARD,
    });
    assert.deepEqual(recipients, [SECOND]);
  });
});
