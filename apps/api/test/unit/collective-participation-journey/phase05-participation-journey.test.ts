import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  CollectiveParticipationAvailableAction,
  CollectiveParticipationPastAction,
} from "@hu/types";

import { buildInitiativeShellDeepLink } from "../../../src/modules/collective-participation-journey/initiative-shell-deep-link.js";
import { resolveNextMeaningfulParticipationAction } from "../../../src/modules/collective-participation-journey/resolve-next-meaningful-participation-action.js";
import { buildParticipantActionId } from "../../../src/modules/participant-action/domain/participant-action.types.js";

function available(
  partial: Partial<CollectiveParticipationAvailableAction> &
    Pick<CollectiveParticipationAvailableAction, "actionType" | "stageId" | "label">,
): CollectiveParticipationAvailableAction {
  return {
    eligibility: "eligible",
    deepLink: buildInitiativeShellDeepLink("initiative-1", partial.stageId),
    ...partial,
  };
}

describe("Lifecycle Finalization Phase 05 — Collective Participation Journey", () => {
  it("deep links stay inside the canonical Initiative shell", () => {
    assert.equal(
      buildInitiativeShellDeepLink("initiative-1", "petition"),
      "/initiatives/public/initiative-1#petition",
    );
    assert.equal(
      buildInitiativeShellDeepLink("initiative-1", "discussion"),
      "/initiatives/public/initiative-1#discussion",
    );
    assert.equal(
      buildInitiativeShellDeepLink("initiative-1", "collective_decision"),
      "/initiatives/public/initiative-1#collective-decision",
    );
  });

  it("STANDARD: unsigned Petition → Sign Petition", () => {
    const next = resolveNextMeaningfulParticipationAction({
      lifecycleProfile: "STANDARD",
      currentStageId: "petition",
      pastActions: [],
      availableActions: [
        available({
          actionType: "petition_signature",
          stageId: "petition",
          label: "Sign the Petition",
          labelCode: "sign_petition",
        }),
      ],
      activeAlly: false,
    });
    assert.equal(next?.actionType, "petition_signature");
    assert.equal(next?.labelCode, "sign_petition");
    assert.equal(next?.reasonCode, "petition_open_unsigned");
  });

  it("STANDARD: already signed Petition does not re-prompt Sign", () => {
    const past: CollectiveParticipationPastAction[] = [
      {
        actionType: "petition_signature",
        stageId: "petition",
        occurredAt: "2026-08-01T00:00:00.000Z",
        statusLabel: "Signed",
        deepLink: "/initiatives/public/initiative-1#petition",
        source: "participant_action_ledger",
      },
    ];
    const next = resolveNextMeaningfulParticipationAction({
      lifecycleProfile: "STANDARD",
      currentStageId: "petition",
      pastActions: past,
      availableActions: [
        available({
          actionType: "petition_signature",
          stageId: "petition",
          label: "Sign the Petition",
          eligibility: "already_completed",
        }),
        available({
          actionType: "decision_vote",
          stageId: "collective_decision",
          label: "Cast your vote",
        }),
      ],
      activeAlly: false,
    });
    assert.equal(next?.actionType, "decision_vote");
  });

  it("vote change is updateable — does not present as first cast", () => {
    const next = resolveNextMeaningfulParticipationAction({
      lifecycleProfile: "STANDARD",
      currentStageId: "collective_decision",
      pastActions: [
        {
          actionType: "decision_vote",
          stageId: "collective_decision",
          occurredAt: "2026-08-01T00:00:00.000Z",
          statusLabel: "Voted (support)",
          statusCode: "voted",
          statusParams: { choice: "support" },
          deepLink: "/initiatives/public/initiative-1#collective-decision",
          source: "participant_action_ledger",
          updateable: true,
        },
      ],
      availableActions: [
        available({
          actionType: "decision_vote",
          stageId: "collective_decision",
          label: "Review or update your vote",
          labelCode: "review_or_update_vote",
        }),
      ],
      activeAlly: false,
    });
    assert.equal(next?.actionType, "decision_vote");
    assert.equal(next?.labelCode, "review_or_update_vote");
    assert.equal(next?.reasonCode, "vote_open_may_update");
    assert.match(next?.reason ?? "", /update|review/i);
  });

  it("PUBLIC_CHOICE never suggests Petition", () => {
    const next = resolveNextMeaningfulParticipationAction({
      lifecycleProfile: "PUBLIC_CHOICE",
      currentStageId: "discussion",
      pastActions: [],
      availableActions: [
        available({
          actionType: "discussion_comment",
          stageId: "discussion",
          label: "Join the Discussion",
        }),
        available({
          actionType: "petition_signature",
          stageId: "petition",
          label: "Sign the Petition",
        }),
      ],
      activeAlly: false,
    });
    assert.equal(next?.actionType, "discussion_comment");
    assert.notEqual(next?.stageId, "petition");
  });

  it("PUBLIC_CHOICE Collective Decision prefers vote", () => {
    const next = resolveNextMeaningfulParticipationAction({
      lifecycleProfile: "PUBLIC_CHOICE",
      currentStageId: "collective_decision",
      pastActions: [],
      availableActions: [
        available({
          actionType: "decision_vote",
          stageId: "collective_decision",
          label: "Cast your vote",
        }),
        available({
          actionType: "petition_signature",
          stageId: "petition",
          label: "Sign the Petition",
        }),
      ],
      activeAlly: false,
    });
    assert.equal(next?.actionType, "decision_vote");
  });

  it("ledger action identity remains deterministic for retries", () => {
    const eventId = "petition-signed:signature-1";
    assert.equal(buildParticipantActionId(eventId), buildParticipantActionId(eventId));
    assert.equal(buildParticipantActionId(eventId), "participant-action:petition-signed:signature-1");
  });

  it("no next action when nothing eligible", () => {
    const next = resolveNextMeaningfulParticipationAction({
      lifecycleProfile: "STANDARD",
      currentStageId: "archive",
      pastActions: [],
      availableActions: [
        available({
          actionType: "petition_signature",
          stageId: "petition",
          label: "Sign",
          eligibility: "stage_not_open",
        }),
      ],
      activeAlly: false,
    });
    assert.equal(next, null);
  });

  it("emits reasonCode for discussion soft fallback", () => {
    const next = resolveNextMeaningfulParticipationAction({
      lifecycleProfile: "STANDARD",
      currentStageId: "archive",
      pastActions: [],
      availableActions: [
        available({
          actionType: "discussion_comment",
          stageId: "discussion",
          label: "Join the Discussion",
          labelCode: "join_discussion",
        }),
      ],
      activeAlly: false,
    });
    assert.equal(next?.actionType, "discussion_comment");
    assert.equal(next?.labelCode, "join_discussion");
    assert.equal(next?.reasonCode, "still_contribute_discussion");
  });
});
