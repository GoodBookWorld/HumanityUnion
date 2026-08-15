import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.repository.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { confirmRegistrationEmailCode } from "../../../src/modules/auth/auth-email-confirmation.service.js";
import { registerAuthUser } from "../../../src/modules/auth/auth.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findAuthUserByEmail,
} from "../../../src/modules/auth/auth-user.repository.js";
import { getLastIssuedConfirmationCodeForTests } from "../../../src/modules/email/email-confirmation-code.repository.js";
import {
  BlogAccessDeniedError,
  BlogConflictError,
  BlogValidationError,
} from "../../../src/modules/blog/blog.errors.js";
import {
  applyForBlogAuthorCapability,
  decideBlogAuthorApplication,
  getBlogAuthoringAccessState,
  grantBlogCapabilitiesForTests,
} from "../../../src/modules/blog/blog.service.js";
import { resolveBlogCapabilities } from "../../../src/modules/blog/blog-permissions.js";
import { deleteBlogCapabilityGrantsByParticipantIdsForTests } from "../../../src/modules/blog/persistence/blog.repository.js";
import { resolveAssistantSpecialization } from "../../../src/modules/lifecycle-ai/assistant-specialization.js";
import { PLATFORM_KNOWLEDGE_MODULES } from "../../../src/modules/lifecycle-ai/platform-knowledge/catalog.js";
import { retrievePlatformKnowledge } from "../../../src/modules/lifecycle-ai/platform-knowledge/retrieve-platform-knowledge.js";
import {
  resetSafetyProviderForTests,
  setSafetyProviderForTests,
  type SafetyProvider,
} from "../../../src/modules/lifecycle-safety/safety-provider.js";
import { findMemberProfileByUserId } from "../../../src/modules/member-profile/member-profile.repository.js";
import { deleteMemberProfilesByUserIdPrefix } from "../../../src/modules/member-profile/member-profile.repository.js";
import {
  clearMemoryNotificationRecipientsForTests,
  registerMemoryNotificationRecipient,
} from "../../../src/modules/notifications/notification.recipients.js";
import { listMyNotifications } from "../../../src/modules/notifications/notification.service.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("blog-auth04");
const createdAuthUserIds: string[] = [];
const createdParticipantIds: string[] = [];

interface TestParticipant {
  userId: string;
  participantId: string;
  displayName: string;
}

async function registerParticipant(label: string): Promise<TestParticipant> {
  const email = `${TEST_PREFIX}-${label}@blog-auth.test`;
  await registerAuthUser({ email, password: "Password123!", displayName: `Blog Auth ${label}` });

  const user = (await findAuthUserByEmail(email)) as AuthUserRecord;
  assert.ok(user);
  createdAuthUserIds.push(user.userId);
  createdParticipantIds.push(user.memberId);

  const code = getLastIssuedConfirmationCodeForTests(user.userId);
  assert.ok(code);
  await confirmRegistrationEmailCode({ userId: user.userId, code: code! });

  const profile = await findMemberProfileByUserId(user.userId);
  assert.ok(profile);

  registerMemoryNotificationRecipient({
    memberId: user.memberId,
    userId: user.userId,
    profileId: profile!.profileId,
  });

  return {
    userId: user.userId,
    participantId: user.memberId,
    displayName: user.displayName,
  };
}

const permissiveSafety: SafetyProvider = {
  providerId: "test-permissive",
  async evaluate() {
    return {
      signal: "safe",
      categories: [],
      providerId: "test-permissive",
    };
  },
};

const validApplicationBody = {
  motivation: "I want to share constructive civic reflections with the community.",
  topics: "Human security, education, and community resilience.",
  previousWritingUrl: "https://example.com/writing",
  preferredCategoryIds: ["conscious_existence", "human_security"],
  agreedToStandards: true as const,
};

describe("Blog Author Access Pack 04", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    await deleteBlogCapabilityGrantsByParticipantIdsForTests(createdParticipantIds);
    for (const userId of createdAuthUserIds) {
      await deleteMemberProfilesByUserIdPrefix(userId);
    }
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    clearMemoryNotificationRecipientsForTests();
    resetSafetyProviderForTests();
    await disconnectMongoClient();
  });

  beforeEach(() => {
    setSafetyProviderForTests(permissiveSafety);
  });

  it("1 — Participant sees Become an Author / eligible_to_apply state", async () => {
    const participant = await registerParticipant("eligible");
    const state = await getBlogAuthoringAccessState({
      actorParticipantId: participant.participantId,
    });

    assert.equal(state.presentation, "eligible_to_apply");
    assert.equal(state.canApply, true);
    assert.equal(state.navLabel, "Become an Author");
    assert.equal(state.application, null);
    assert.equal(state.publishingWorkspaceHref, null);
    assert.equal(state.editorialReviewHref, null);
  });

  it("2/9/10 — Application submission succeeds and persists", async () => {
    const participant = await registerParticipant("submit");
    const application = await applyForBlogAuthorCapability({
      actorParticipantId: participant.participantId,
      body: { ...validApplicationBody },
    });

    assert.equal(application.status, "submitted");
    assert.equal(application.participantId, participant.participantId);
    assert.equal(application.motivation.includes("constructive"), true);
    assert.deepEqual(application.preferredCategoryIds, [
      "conscious_existence",
      "human_security",
    ]);
    assert.equal(application.agreedToStandards, true);

    const state = await getBlogAuthoringAccessState({
      actorParticipantId: participant.participantId,
    });
    assert.equal(state.presentation, "application_submitted");
    assert.equal(state.application?.applicationId, application.applicationId);
    assert.equal(state.canApply, false);
  });

  it("3 — Duplicate active application blocked", async () => {
    const participant = await registerParticipant("dup");
    await applyForBlogAuthorCapability({
      actorParticipantId: participant.participantId,
      body: { ...validApplicationBody },
    });

    await assert.rejects(
      () =>
        applyForBlogAuthorCapability({
          actorParticipantId: participant.participantId,
          body: { ...validApplicationBody, motivation: "Second attempt with enough characters." },
        }),
      BlogConflictError,
    );
  });

  it("4/5 — Participant identity is server-side; forged participantId ignored by service contract", async () => {
    const participant = await registerParticipant("identity");
    const forged = await registerParticipant("forged");

    const application = await applyForBlogAuthorCapability({
      actorParticipantId: participant.participantId,
      body: {
        ...validApplicationBody,
        participantId: forged.participantId,
        applicantParticipantId: forged.participantId,
      },
    });

    assert.equal(application.participantId, participant.participantId);
    assert.notEqual(application.participantId, forged.participantId);
  });

  it("6/7 — Application categories validated; multiple interests allowed", async () => {
    const participant = await registerParticipant("cats");

    await assert.rejects(
      () =>
        applyForBlogAuthorCapability({
          actorParticipantId: participant.participantId,
          body: {
            ...validApplicationBody,
            preferredCategoryIds: ["not_a_category"],
          },
        }),
      BlogValidationError,
    );

    const application = await applyForBlogAuthorCapability({
      actorParticipantId: participant.participantId,
      body: {
        ...validApplicationBody,
        preferredCategoryIds: ["conscious_existence", "our_life", "human_security"],
      },
    });

    assert.equal(application.preferredCategoryIds.length, 3);
  });

  it("8 — Sensitive personal data not required", async () => {
    const participant = await registerParticipant("minimal");
    const application = await applyForBlogAuthorCapability({
      actorParticipantId: participant.participantId,
      body: {
        motivation: "I hope to contribute careful analysis of civic issues.",
        topics: "Community life and constructive public dialogue.",
        preferredCategoryIds: ["our_life"],
        agreedToStandards: true,
      },
    });

    assert.equal(application.previousWritingUrl, undefined);
    assert.equal("religion" in application, false);
    assert.equal("ethnicity" in application, false);
    assert.equal("politicalAffiliation" in application, false);
  });

  it("11/12 — Approved application grants Author and Publishing-ready state", async () => {
    const applicant = await registerParticipant("approve-a");
    const editor = await registerParticipant("approve-e");
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor", "author"],
    });

    const application = await applyForBlogAuthorCapability({
      actorParticipantId: applicant.participantId,
      body: { ...validApplicationBody },
    });

    const decided = await decideBlogAuthorApplication({
      actorParticipantId: editor.participantId,
      applicationId: application.applicationId,
      decision: "approve",
    });

    assert.equal(decided.status, "approved");

    const caps = await resolveBlogCapabilities({ participantId: applicant.participantId });
    assert.equal(caps.has("author"), true);
    assert.equal(caps.has("author_applicant"), false);

    const state = await getBlogAuthoringAccessState({
      actorParticipantId: applicant.participantId,
    });
    assert.equal(state.presentation, "author");
    assert.equal(state.navLabel, "Publishing");
    assert.equal(state.publishingWorkspaceHref, "/workspace/publishing");
    assert.equal(state.editorialReviewHref, null);
    assert.equal(state.canApply, false);
  });

  it("13 — Trusted Author state resolves correctly", async () => {
    const participant = await registerParticipant("trusted");
    await grantBlogCapabilitiesForTests({
      participantId: participant.participantId,
      capabilities: ["trusted_author"],
    });

    const state = await getBlogAuthoringAccessState({
      actorParticipantId: participant.participantId,
    });
    assert.equal(state.presentation, "trusted_author");
    assert.equal(state.navLabel, "Publishing");
    assert.equal(state.editorialReviewHref, null);
  });

  it("14 — Editor/Admin state resolves correctly", async () => {
    const editor = await registerParticipant("editor");
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor"],
    });
    const editorState = await getBlogAuthoringAccessState({
      actorParticipantId: editor.participantId,
    });
    assert.equal(editorState.presentation, "editor");
    assert.equal(editorState.editorialReviewHref, "/workspace/editorial");

    const admin = await registerParticipant("admin");
    const adminState = await getBlogAuthoringAccessState({
      actorParticipantId: admin.participantId,
      role: "admin",
    });
    assert.equal(adminState.presentation, "administrator");
    assert.equal(adminState.editorialReviewHref, "/workspace/editorial");
  });

  it("15 — Declined application does not grant Author capability", async () => {
    const applicant = await registerParticipant("decline-a");
    const editor = await registerParticipant("decline-e");
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor", "author"],
    });

    const application = await applyForBlogAuthorCapability({
      actorParticipantId: applicant.participantId,
      body: { ...validApplicationBody },
    });

    await decideBlogAuthorApplication({
      actorParticipantId: editor.participantId,
      applicationId: application.applicationId,
      decision: "decline",
      reviewNote: "Please gain more public writing experience and reapply later.",
    });

    const caps = await resolveBlogCapabilities({ participantId: applicant.participantId });
    assert.equal(caps.has("author"), false);

    const state = await getBlogAuthoringAccessState({
      actorParticipantId: applicant.participantId,
    });
    assert.equal(state.presentation, "application_declined");
    assert.equal(state.canApply, true);
  });

  it("16 — Changes-requested state renders safely and allows resubmit", async () => {
    const applicant = await registerParticipant("changes-a");
    const editor = await registerParticipant("changes-e");
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor", "author"],
    });

    const application = await applyForBlogAuthorCapability({
      actorParticipantId: applicant.participantId,
      body: { ...validApplicationBody },
    });

    await decideBlogAuthorApplication({
      actorParticipantId: editor.participantId,
      applicationId: application.applicationId,
      decision: "request_changes",
      reviewNote: "Please clarify the topics you plan to cover.",
    });

    const state = await getBlogAuthoringAccessState({
      actorParticipantId: applicant.participantId,
    });
    assert.equal(state.presentation, "application_changes_requested");
    assert.equal(state.canResubmit, true);
    assert.equal(state.application?.reviewNote?.includes("clarify"), true);

    const resubmitted = await applyForBlogAuthorCapability({
      actorParticipantId: applicant.participantId,
      body: {
        ...validApplicationBody,
        topics: "Clarified topics about human security and community care.",
      },
    });
    assert.equal(resubmitted.status, "submitted");
  });

  it("17 — Relevant status notifications emitted", async () => {
    const applicant = await registerParticipant("notify-a");
    const editor = await registerParticipant("notify-e");
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor", "author"],
    });

    const application = await applyForBlogAuthorCapability({
      actorParticipantId: applicant.participantId,
      body: { ...validApplicationBody },
    });

    const afterSubmit = await listMyNotifications({ userId: applicant.userId, limit: 20 });
    assert.ok(
      afterSubmit.notifications.some((n) => n.eventType === "blog_author_application_submitted"),
    );

    await decideBlogAuthorApplication({
      actorParticipantId: editor.participantId,
      applicationId: application.applicationId,
      decision: "approve",
    });

    const afterApprove = await listMyNotifications({ userId: applicant.userId, limit: 20 });
    assert.ok(
      afterApprove.notifications.some((n) => n.eventType === "blog_author_application_approved"),
    );
    assert.ok(
      afterApprove.notifications.some((n) => n.relatedUrl === "/workspace/authoring"),
    );
  });

  it("18/19 — Assistant knows Author workflow and cannot grant capability", () => {
    const specialization = resolveAssistantSpecialization("blog");
    assert.match(specialization.instructionBlock, /NEVER/i);
    assert.match(specialization.instructionBlock, /approve/i);
    assert.match(specialization.instructionBlock, /grant/i);
    assert.equal(specialization.canApplySuggestionsToDraft, false);
    assert.ok(specialization.suggestedQuestions.some((q) => /become a Blog Author/i.test(q)));

    const knowledge = retrievePlatformKnowledge({
      surfaceId: "blog",
      instructions: "How can I become a Blog Author?",
    });
    assert.ok(knowledge.moduleIds.includes("blog_author_access"));
    assert.ok(knowledge.moduleIds.includes("blog_publishing"));
    assert.match(knowledge.promptBlock, /never approve an application/i);

    assert.ok(PLATFORM_KNOWLEDGE_MODULES.some((m) => m.moduleId === "blog_author_access"));
  });

  it("24 — No second Participant model: application.participantId is Auth memberId", async () => {
    const participant = await registerParticipant("no-second-id");
    const application = await applyForBlogAuthorCapability({
      actorParticipantId: participant.participantId,
      body: { ...validApplicationBody },
    });
    assert.equal(application.participantId, participant.participantId);
  });

  it("Non-editor cannot decide applications", async () => {
    const applicant = await registerParticipant("gate-a");
    const stranger = await registerParticipant("gate-s");
    const application = await applyForBlogAuthorCapability({
      actorParticipantId: applicant.participantId,
      body: { ...validApplicationBody },
    });

    await assert.rejects(
      () =>
        decideBlogAuthorApplication({
          actorParticipantId: stranger.participantId,
          applicationId: application.applicationId,
          decision: "approve",
        }),
      BlogAccessDeniedError,
    );
  });
});
