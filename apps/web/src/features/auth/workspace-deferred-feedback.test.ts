/**
 * HU-UX-01E.3 — deferred Workspace actions and untitled feedback headings.
 * Source contract. No live votes, signatures, or payments.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("HU-UX-01E.3 deferred contextual feedback", () => {
  const authFeedback = read("features/auth/components/AuthFeedbackMessage.tsx");
  const huFeedback = read("design-system/components/HuFeedbackMessage.tsx");
  const login = read("features/auth/components/LoginForm.tsx");
  const sessions = read(
    "features/initiative-collaboration-sessions/components/InitiativeCollaborationSessionsPanel.tsx",
  );
  const groupForm = read(
    "features/initiative-group-chat/components/InitiativeGroupSessionQuickForm.tsx",
  );
  const channel = read(
    "features/initiative-collaboration-channel/components/InitiativeCollaborationChannel.tsx",
  );
  const signature = read(
    "features/initiative-petition-lifecycle/components/InitiativePetitionSignatureWidget.tsx",
  );
  const ballot = read(
    "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionBallotWidget.tsx",
  );
  const revisionReaction = read(
    "features/initiative-version-revision/components/InitiativeRevisionReactionWidget.tsx",
  );
  const proposalReaction = read(
    "features/initiative-improvement-proposals-stage/components/InitiativeProposalReactionWidget.tsx",
  );
  const comments = read("features/blog/components/BlogCommentsSection.tsx");
  const blogReaction = read("features/blog/components/BlogReactionControls.tsx");
  const badge = read("features/membership/components/MemberBadgePageContent.tsx");
  const badgeModal = read("features/membership/components/MemberBadgeApplicationModal.tsx");
  const publicChoice = read(
    "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
  );

  it("omits an English heading when a feedback title is not supplied", () => {
    assert.doesNotMatch(authFeedback, /VARIANT_LABELS/);
    assert.doesNotMatch(authFeedback, /"Information"|"Notice"|"Error"|"Success"/);
    assert.match(authFeedback, /heading \? <p className="auth-feedback__label">\{heading\}<\/p> : null/);
    assert.match(authFeedback, /variant === "error" \? "alert" : "status"/);
    assert.doesNotMatch(huFeedback, /VARIANT_LABELS/);
    assert.match(huFeedback, /heading \? <p className="hu-feedback__label">\{heading\}<\/p> : null/);
    assert.match(login, /title=\{t\("signInFailed"\)\}/);
  });

  it("moves misplaced action results under their controls and leaves compliant widgets in place", () => {
    const schedule = sessions.indexOf("collaboration.sessions.scheduleSession");
    const editorError = sessions.indexOf('ref={errorRef}');
    assert.ok(editorError > schedule);
    const attendance = sessions.indexOf("collaboration.sessions.yourAttendanceAria");
    const attendanceError = sessions.indexOf('actionErrorPlace === "attendance"');
    const authorError = sessions.indexOf('actionErrorPlace === "author"');
    assert.ok(attendanceError > attendance);
    assert.ok(authorError > sessions.indexOf("collaboration.sessions.cancelSession"));

    const groupButton = groupForm.indexOf("scheduleSession");
    assert.ok(groupForm.indexOf("ref={errorRef}") > groupButton);

    const sendButton = channel.indexOf("collaboration.channel.send");
    assert.ok(channel.indexOf("ref={sendErrorRef}") > sendButton);
    assert.match(channel, /loadState === "error"/);

    const signButton = signature.indexOf("petitionSignature.sign");
    assert.ok(signature.indexOf("{errorNote}") > signButton);
    assert.match(signature, /withdrawPetitionSignature\(petitionId\)/);

    const choiceButton = ballot.indexOf("void handleCast(choice)");
    assert.ok(ballot.indexOf("icd-ballot__error") > choiceButton);
    assert.match(ballot, /collaboration.vote.submitting/);

    const reactionButton = revisionReaction.indexOf('void handleReact("support")');
    assert.ok(revisionReaction.indexOf('role="alert"') > reactionButton);
    assert.match(revisionReaction, /collaboration.reaction.noteLegal/);
    assert.ok(proposalReaction.indexOf('role="alert"') > proposalReaction.indexOf('void handleReact("support")'));

    const postButton = comments.indexOf('{t("postComment")}');
    assert.ok(comments.indexOf("composerError") > postButton);
    assert.match(comments, /loadError/);
    assert.match(comments, /deleteError\?\.commentId === comment\.commentId/);
    assert.match(comments, /createPublicBlogComment/);

    const helpful = blogReaction.indexOf('void react("helpful")');
    assert.ok(blogReaction.indexOf('role="alert"') > helpful);

    const checkout = badge.indexOf("onRequest={() => void handleRequest()}");
    assert.ok(badge.indexOf("ref={checkoutErrorRef}") > checkout);
    assert.match(badge, /startMemberBadgeContribution/);

    const pay = badgeModal.indexOf("badgeApplication.continueToPayment");
    assert.ok(badgeModal.indexOf("ref={errorRef}") > pay);
    assert.match(badgeModal, /handleContinueToPayment/);

    const select = publicChoice.indexOf("publicChoice.candidateIntake.select");
    assert.ok(publicChoice.indexOf("VoteActionNotice") > select);
    assert.match(publicChoice, /castOrUpdateInitiativeDecisionVote/);
    assert.match(publicChoice, /recallInitiativeDecisionVote/);
  });
});
