/**
 * UX Evolution Pack 02.3 Part 12 — focused tests for the pure Discussion
 * comment-card presentation logic (discussion-comment-presentation.ts).
 *
 * `apps/web` has no React component test harness (no vitest/jest/RTL
 * configured anywhere in this monorepo). Rather than introduce a new
 * frontend test framework for this one feature, the actual decision logic
 * behind every rendering bug this pack fixes — which control is visible,
 * which is disabled/"completed", which label and status indicators show,
 * and how the discussion filters behave — was extracted into a pure,
 * framework-free module so it can be exercised directly with Node's
 * built-in test runner, exactly like the rest of this repository's tests
 * (see apps/api/test). Run with:
 *
 *   npx tsx --test src/features/public-initiative-experience/components/discussion-comment-presentation.test.ts
 *
 * from apps/web.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  PublicCommentAuthor,
  PublicCommentCollaborationState,
  PublicInitiativeDiscussionComment,
} from "@hu/types";

import {
  DISCUSSION_ACTION_DEFINITIONS,
  matchesDiscussionFilter,
  resolveAuthorBadges,
  resolveAuthorLinkPresentation,
  resolveCollaborationReviewActionState,
  resolveCollaborationStatusLabel,
  resolveFilterHeading,
  resolveInviteToAlliesActionState,
  resolveProposalActionState,
  resolveReadyToCollaborateActionState,
  resolveStatusIndicators,
} from "./discussion-comment-presentation.js";

function buildCollaboration(
  overrides: Partial<PublicCommentCollaborationState> = {},
): PublicCommentCollaborationState {
  return {
    proposalCandidateStatus: "none",
    authorAllyStatus: "none",
    viewerAllyStatus: "none",
    isAuthorInitiativeSteward: false,
    isViewerAuthor: false,
    isViewerInitiativeSteward: false,
    canMarkProposal: false,
    canReadyToCollaborate: false,
    canInviteToAllies: false,
    authorParticipantId: null,
    ...overrides,
  };
}

function buildComment(
  overrides: Partial<PublicInitiativeDiscussionComment> = {},
): PublicInitiativeDiscussionComment {
  return {
    commentId: "comment-1",
    author: { displayName: "Fixture Participant" },
    authorDisplayName: "Fixture Participant",
    body: "A fixture comment.",
    createdAt: new Date().toISOString(),
    replyCount: 0,
    likes: 0,
    dislikes: 0,
    currentUserReaction: "none",
    ...overrides,
  };
}

describe("Author profile link (Part 2)", () => {
  it("renders a link when the author has a profileUrl", () => {
    const author: PublicCommentAuthor = {
      displayName: "Ada Lovelace",
      profileUrl: "/member/ada-lovelace",
    };

    const presentation = resolveAuthorLinkPresentation(author);

    assert.equal(presentation.isLink, true);
    assert.equal(presentation.href, "/member/ada-lovelace");
  });

  it("never invents a route: falls back to plain text when profileUrl is absent", () => {
    const author: PublicCommentAuthor = { displayName: "Anonymous Participant" };

    const presentation = resolveAuthorLinkPresentation(author);

    assert.equal(presentation.isLink, false);
    assert.equal(presentation.href, undefined);
  });
});

describe("Initiative Author / You badges (Part 5)", () => {
  it("shows the Initiative Author badge only when the author is the steward", () => {
    const badges = resolveAuthorBadges(buildCollaboration({ isAuthorInitiativeSteward: true }));
    assert.equal(badges.isInitiativeAuthor, true);
    assert.equal(badges.isYou, false);
  });

  it("shows the You badge only when the viewer is the author", () => {
    const badges = resolveAuthorBadges(buildCollaboration({ isViewerAuthor: true }));
    assert.equal(badges.isYou, true);
    assert.equal(badges.isInitiativeAuthor, false);
  });

  it("shows no badges when collaboration state is absent (e.g. a stale response shape)", () => {
    const badges = resolveAuthorBadges(undefined);
    assert.equal(badges.isInitiativeAuthor, false);
    assert.equal(badges.isYou, false);
  });
});

describe("Proposal action state (Parts 1, 6, 7)", () => {
  it("is hidden when collaboration state is missing (root-cause regression guard)", () => {
    const state = resolveProposalActionState(undefined, false);
    assert.equal(state.visible, false);
  });

  it("is visible and enabled when the viewer may mark a Proposal", () => {
    const state = resolveProposalActionState(buildCollaboration({ canMarkProposal: true }), false);
    assert.equal(state.visible, true);
    assert.equal(state.disabled, false);
    assert.equal(state.label, "Proposal");
  });

  it("shows a busy label while the action is in flight", () => {
    const state = resolveProposalActionState(buildCollaboration({ canMarkProposal: true }), true);
    assert.equal(state.disabled, true);
    assert.equal(state.label, "Marking…");
  });

  it("stays visible but muted/disabled once already a candidate, using the 'Proposal Added' user-facing wording (never hidden, never the internal 'Proposal Candidate' label)", () => {
    const state = resolveProposalActionState(
      buildCollaboration({ proposalCandidateStatus: "candidate", canMarkProposal: false }),
      false,
    );
    assert.equal(state.visible, true);
    assert.equal(state.disabled, true);
    assert.equal(state.label, "✓ Proposal Added");
  });

  it("is hidden when the viewer is not permitted to mark a Proposal at all", () => {
    const state = resolveProposalActionState(buildCollaboration({ canMarkProposal: false }), false);
    assert.equal(state.visible, false);
  });
});

describe("Ready to Collaborate action state (Parts 1, 6, 7)", () => {
  it("is hidden when collaboration state is missing (root-cause regression guard)", () => {
    const state = resolveReadyToCollaborateActionState(undefined, false);
    assert.equal(state.visible, false);
  });

  it("is visible and enabled when the viewer has not yet expressed interest", () => {
    const state = resolveReadyToCollaborateActionState(
      buildCollaboration({ canReadyToCollaborate: true, viewerAllyStatus: "none" }),
      false,
    );
    assert.equal(state.visible, true);
    assert.equal(state.disabled, false);
    assert.equal(state.label, "Ready to Collaborate");
  });

  it("shows a disabled 'Ready to Collaborate' label once interest was already expressed", () => {
    const state = resolveReadyToCollaborateActionState(
      buildCollaboration({ viewerAllyStatus: "interest_pending" }),
      false,
    );
    assert.equal(state.visible, true);
    assert.equal(state.disabled, true);
    assert.equal(state.label, "Ready to Collaborate");
  });

  it("shows a disabled 'Invitation Pending' label once invited", () => {
    const state = resolveReadyToCollaborateActionState(
      buildCollaboration({ viewerAllyStatus: "invitation_pending" }),
      false,
    );
    assert.equal(state.disabled, true);
    assert.equal(state.label, "Invitation Pending");
  });

  it("shows a disabled 'Ally' label once the viewer is an Ally", () => {
    const state = resolveReadyToCollaborateActionState(
      buildCollaboration({ viewerAllyStatus: "active" }),
      false,
    );
    assert.equal(state.disabled, true);
    assert.equal(state.label, "Ally");
  });

  it("is hidden for an unauthenticated / not-permitted viewer", () => {
    const state = resolveReadyToCollaborateActionState(
      buildCollaboration({ canReadyToCollaborate: false, viewerAllyStatus: "none" }),
      false,
    );
    assert.equal(state.visible, false);
  });
});

describe("Invite to Allies action state (Parts 1, 6, 7, 10 — steward only)", () => {
  it("is hidden when collaboration state is missing (root-cause regression guard)", () => {
    const state = resolveInviteToAlliesActionState(undefined, false);
    assert.equal(state.visible, false);
  });

  it("is hidden for a non-steward viewer even if authorAllyStatus is interest_pending", () => {
    const state = resolveInviteToAlliesActionState(
      buildCollaboration({
        isViewerInitiativeSteward: false,
        authorAllyStatus: "interest_pending",
      }),
      false,
    );
    assert.equal(state.visible, false);
  });

  it("is hidden for self-invite (viewer is the comment author), even for the steward", () => {
    const state = resolveInviteToAlliesActionState(
      buildCollaboration({
        isViewerInitiativeSteward: true,
        isViewerAuthor: true,
        authorAllyStatus: "interest_pending",
      }),
      false,
    );
    assert.equal(state.visible, false);
  });

  it("is hidden before the author has expressed Ready to Collaborate", () => {
    const state = resolveInviteToAlliesActionState(
      buildCollaboration({ isViewerInitiativeSteward: true, authorAllyStatus: "none" }),
      false,
    );
    assert.equal(state.visible, false);
  });

  it("is visible and enabled for the steward once the author expressed interest", () => {
    const state = resolveInviteToAlliesActionState(
      buildCollaboration({ isViewerInitiativeSteward: true, authorAllyStatus: "interest_pending" }),
      false,
    );
    assert.equal(state.visible, true);
    assert.equal(state.disabled, false);
    assert.equal(state.label, "Invite to Allies");
  });

  it("shows a disabled 'Invitation Sent' label once invited (never hidden — duplicates impossible)", () => {
    const state = resolveInviteToAlliesActionState(
      buildCollaboration({ isViewerInitiativeSteward: true, authorAllyStatus: "invitation_pending" }),
      false,
    );
    assert.equal(state.visible, true);
    assert.equal(state.disabled, true);
    assert.equal(state.label, "Invitation Sent");
  });

  it("shows a disabled 'Ally' label once the author is an Ally", () => {
    const state = resolveInviteToAlliesActionState(
      buildCollaboration({ isViewerInitiativeSteward: true, authorAllyStatus: "active" }),
      false,
    );
    assert.equal(state.visible, true);
    assert.equal(state.disabled, true);
    assert.equal(state.label, "Ally");
  });
});

describe("Status indicators (Part 9 — persisted statuses only, human-readable)", () => {
  it("returns no indicators for a plain comment", () => {
    assert.deepEqual(resolveStatusIndicators(buildCollaboration()), []);
  });

  it("returns no indicators when collaboration state is absent", () => {
    assert.deepEqual(resolveStatusIndicators(undefined), []);
  });

  it("shows the user-facing 'Proposal Added' wording (never the internal 'candidate' status value or 'Proposal Candidate' label)", () => {
    const indicators = resolveStatusIndicators(
      buildCollaboration({ proposalCandidateStatus: "candidate" }),
    );
    assert.ok(indicators.includes("Proposal Added"));
    assert.ok(!indicators.includes("Proposal Candidate"));
  });

  it("shows human-readable labels for every author Ally status", () => {
    assert.deepEqual(
      resolveStatusIndicators(buildCollaboration({ authorAllyStatus: "interest_pending" })),
      ["Ready to Collaborate"],
    );
    assert.deepEqual(
      resolveStatusIndicators(buildCollaboration({ authorAllyStatus: "invitation_pending" })),
      ["Invitation Sent"],
    );
    assert.deepEqual(resolveStatusIndicators(buildCollaboration({ authorAllyStatus: "active" })), [
      "Ally",
    ]);
    assert.deepEqual(
      resolveStatusIndicators(buildCollaboration({ authorAllyStatus: "declined" })),
      ["Invitation Declined"],
    );
  });

  it("combines Proposal Added with an Ally-status indicator", () => {
    const indicators = resolveStatusIndicators(
      buildCollaboration({ proposalCandidateStatus: "candidate", authorAllyStatus: "active" }),
    );
    assert.deepEqual(indicators, ["Proposal Added", "Ally"]);
  });
});

describe("Discussion filters (Part 8 — working lists, not duplicate discussions)", () => {
  it("'all' shows every comment regardless of collaboration state", () => {
    assert.equal(matchesDiscussionFilter(buildComment(), "all"), true);
    assert.equal(
      matchesDiscussionFilter(
        buildComment({ collaboration: buildCollaboration({ authorAllyStatus: "declined" }) }),
        "all",
      ),
      true,
    );
  });

  it("'proposals' shows only Proposal Candidates", () => {
    const candidate = buildComment({
      collaboration: buildCollaboration({ proposalCandidateStatus: "candidate" }),
    });
    const plain = buildComment({ collaboration: buildCollaboration() });

    assert.equal(matchesDiscussionFilter(candidate, "proposals"), true);
    assert.equal(matchesDiscussionFilter(plain, "proposals"), false);
  });

  it("'collaboration' includes interest_pending, invitation_pending, and active", () => {
    for (const status of ["interest_pending", "invitation_pending", "active"] as const) {
      const comment = buildComment({ collaboration: buildCollaboration({ authorAllyStatus: status }) });
      assert.equal(matchesDiscussionFilter(comment, "collaboration"), true, `expected ${status} to match`);
    }
  });

  it("'collaboration' excludes none and declined", () => {
    for (const status of ["none", "declined"] as const) {
      const comment = buildComment({ collaboration: buildCollaboration({ authorAllyStatus: status }) });
      assert.equal(
        matchesDiscussionFilter(comment, "collaboration"),
        false,
        `expected ${status} to be excluded`,
      );
    }
  });

  it("'collaboration' excludes comments with no collaboration state at all", () => {
    assert.equal(matchesDiscussionFilter(buildComment(), "collaboration"), false);
  });

  it("resolves the required per-filter headings", () => {
    assert.equal(resolveFilterHeading("all"), null);
    assert.equal(resolveFilterHeading("proposals"), "Improvement ideas selected from the discussion.");
    assert.equal(
      resolveFilterHeading("collaboration"),
      "Participants interested in helping this Initiative.",
    );
  });
});

describe("Collaboration status label (Profile UX Pack 01 Part 7 — never a raw internal status)", () => {
  it("maps every persisted Ally status to its user-facing label", () => {
    assert.equal(resolveCollaborationStatusLabel("interest_pending"), "Ready to Collaborate");
    assert.equal(resolveCollaborationStatusLabel("invitation_pending"), "Invitation Sent");
    assert.equal(resolveCollaborationStatusLabel("active"), "Ally");
    assert.equal(resolveCollaborationStatusLabel("declined"), "Request closed");
  });
});

describe("Collaboration review action state (Profile UX Pack 01 Parts 2/5/6/7/12)", () => {
  it("is visible and enabled for the steward reviewing a still-pending request", () => {
    const state = resolveCollaborationReviewActionState("interest_pending", true, false);
    assert.equal(state.visible, true);
    assert.equal(state.disabled, false);
  });

  it("is visible but disabled while an Accept/Decline action is in flight", () => {
    const state = resolveCollaborationReviewActionState("interest_pending", true, true);
    assert.equal(state.visible, true);
    assert.equal(state.disabled, true);
  });

  it("is hidden for a non-steward viewer, even on a pending request (Part 12 — no frontend-only authorization)", () => {
    const state = resolveCollaborationReviewActionState("interest_pending", false, false);
    assert.equal(state.visible, false);
  });

  it("is hidden once the request is already resolved (active or declined)", () => {
    assert.equal(resolveCollaborationReviewActionState("active", true, false).visible, false);
    assert.equal(resolveCollaborationReviewActionState("declined", true, false).visible, false);
  });

  it("is hidden for the reverse-direction invitation_pending state (reviewed by the invited Participant, not the steward)", () => {
    const state = resolveCollaborationReviewActionState("invitation_pending", true, false);
    assert.equal(state.visible, false);
  });
});

describe("Action row order and icons (Part 6)", () => {
  it("renders exactly the required five actions in the required order", () => {
    assert.deepEqual(
      DISCUSSION_ACTION_DEFINITIONS.map((definition) => definition.id),
      ["helpful", "not-helpful", "proposal", "ready-to-collaborate", "invite-to-allies"],
    );
  });

  it("uses the required icon path for every action (no new icon library)", () => {
    const iconById = new Map(
      DISCUSSION_ACTION_DEFINITIONS.map((definition) => [definition.id, definition.icon]),
    );

    assert.equal(iconById.get("helpful"), "/icons/workspace/like.svg");
    assert.equal(iconById.get("not-helpful"), "/icons/workspace/dislike.svg");
    assert.equal(iconById.get("proposal"), "/icons/workspace/initiatives.svg");
    assert.equal(iconById.get("ready-to-collaborate"), "/icons/workspace/collective-decisions.svg");
    assert.equal(iconById.get("invite-to-allies"), "/icons/workspace/participation.svg");
  });

  it("every action has both an icon and a label (no icon-only buttons)", () => {
    for (const definition of DISCUSSION_ACTION_DEFINITIONS) {
      assert.ok(definition.icon.length > 0);
      assert.ok(definition.label.length > 0);
    }
  });
});
