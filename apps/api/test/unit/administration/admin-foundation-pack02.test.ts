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
  AdministrationAuditImmutableError,
  AdministrationInsufficientCapabilityError,
  AuditService,
  assertOwnership,
  deleteAdministrationAuditByActorIdsForTests,
  deletePlatformCapabilityGrantsByParticipantIdsForTests,
  grantPlatformCapability,
  hasCapability,
  isOwner,
  listAdministrationAuditsForTarget,
  resolveParticipantCapabilities,
  resetAdministrationAuditMemoryForTests,
  resetPlatformCapabilityGrantsMemoryForTests,
  runWithCapabilityResolutionContext,
} from "../../../src/modules/administration/index.js";
import {
  createBlogDraft,
  grantBlogCapabilitiesForTests,
  publishBlogPost,
} from "../../../src/modules/blog/blog.service.js";
import {
  deleteBlogCapabilityGrantsByParticipantIdsForTests,
  deleteBlogPostsByAuthorPrefixForTests,
} from "../../../src/modules/blog/persistence/blog.repository.js";
import { findMemberProfileByUserId } from "../../../src/modules/member-profile/member-profile.repository.js";
import { deleteMemberProfilesByUserIdPrefix } from "../../../src/modules/member-profile/member-profile.repository.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("admin-f02");
const createdAuthUserIds: string[] = [];
const createdParticipantIds: string[] = [];

async function registerParticipant(label: string) {
  const email = `${TEST_PREFIX}-${label}@admin-foundation.test`;
  await registerAuthUser({ email, password: "Password123!", displayName: `Admin ${label}` });
  const user = (await findAuthUserByEmail(email)) as AuthUserRecord;
  createdAuthUserIds.push(user.userId);
  createdParticipantIds.push(user.memberId);
  const code = getLastIssuedConfirmationCodeForTests(user.userId);
  assert.ok(code);
  await confirmRegistrationEmailCode({ userId: user.userId, code: code! });
  await findMemberProfileByUserId(user.userId);
  return { userId: user.userId, participantId: user.memberId, displayName: user.displayName };
}

describe("Admin Foundation Pack 02", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    await deleteAdministrationAuditByActorIdsForTests(createdParticipantIds);
    await deletePlatformCapabilityGrantsByParticipantIdsForTests(createdParticipantIds);
    await deleteBlogPostsByAuthorPrefixForTests(TEST_PREFIX);
    await deleteBlogCapabilityGrantsByParticipantIdsForTests(createdParticipantIds);
    await deleteMemberProfilesByUserIdPrefix(TEST_PREFIX);
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    await disconnectMongoClient();
  });

  beforeEach(() => {
    resetAdministrationAuditMemoryForTests();
    resetPlatformCapabilityGrantsMemoryForTests();
  });

  it("resolves Blog Trusted Author via compatibility bridge", async () => {
    const author = await registerParticipant("author");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["trusted_author"],
    });

    const caps = await resolveParticipantCapabilities({
      participantId: author.participantId,
    });
    assert.equal(caps.has("blog.author"), true);
    assert.equal(caps.has("blog.trusted_author"), true);
    assert.equal(caps.has("blog.publish"), true);
    assert.equal(caps.has("platform.capability.manage"), false);
  });

  it("JWT admin maps to platform.admin without second identity", async () => {
    const admin = await registerParticipant("jwt-admin");
    const caps = await resolveParticipantCapabilities({
      participantId: admin.participantId,
      role: "admin",
    });
    assert.equal(caps.has("platform.admin"), true);
    assert.equal(caps.has("platform.capability.manage"), true);
    assert.equal(caps.has("blog.review"), true);
    assert.equal(caps.has("beta.invite.manage"), true);
  });

  it("request-scoped cache returns same set within context", async () => {
    const author = await registerParticipant("cache");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });

    await runWithCapabilityResolutionContext(async () => {
      const first = await resolveParticipantCapabilities({
        participantId: author.participantId,
      });
      const second = await resolveParticipantCapabilities({
        participantId: author.participantId,
      });
      assert.equal(first, second);
    });
  });

  it("ownership is separate from capabilities", () => {
    assert.equal(
      isOwner({
        relation: "blog_post_author",
        actorParticipantId: "p1",
        ownerParticipantId: "p1",
      }),
      true,
    );
    assert.throws(
      () =>
        assertOwnership({
          relation: "initiative_steward",
          actorParticipantId: "p1",
          ownerParticipantId: "p2",
        }),
      /Ownership required/,
    );
  });

  it("audit append-only; rejects secrets and mutations", async () => {
    const actor = await registerParticipant("auditor");
    const saved = await AuditService.record({
      actorParticipantId: actor.participantId,
      action: "capability.grant",
      targetType: "platform_capability_grant",
      targetId: "grant-1",
      reason: "foundation test grant",
      afterSummary: "blog.author granted",
    });
    assert.ok(saved.auditId.startsWith("admin-audit-"));

    await assert.rejects(
      () =>
        AuditService.record({
          actorParticipantId: actor.participantId,
          action: "capability.grant",
          targetType: "x",
          targetId: "y",
          reason: "password=secret",
        }),
      /secrets|credential/i,
    );

    assert.throws(() => AuditService.update(), AdministrationAuditImmutableError);
    assert.throws(() => AuditService.delete(), AdministrationAuditImmutableError);
  });

  it("platform grant dual-read + audit; Editor cannot grant without manage capability", async () => {
    const editor = await registerParticipant("editor");
    const target = await registerParticipant("target");
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor"],
    });

    await assert.rejects(
      () =>
        grantPlatformCapability({
          actorParticipantId: editor.participantId,
          targetParticipantId: target.participantId,
          capability: "media.review",
        }),
      AdministrationInsufficientCapabilityError,
    );

    const admin = await registerParticipant("plat-admin");
    // JWT admin short-circuit for manage.
    const grant = await grantPlatformCapability({
      actorParticipantId: admin.participantId,
      role: "admin",
      targetParticipantId: target.participantId,
      capability: "media.review",
      reason: "ops media review enablement",
    });
    assert.equal(grant.capability, "media.review");

    assert.equal(
      await hasCapability({
        participantId: target.participantId,
        capability: "media.review",
      }),
      true,
    );

    const audits = await listAdministrationAuditsForTarget({
      targetType: "platform_capability_grant",
      targetId: grant.grantId,
    });
    assert.ok(audits.some((entry) => entry.action === "capability.grant"));
  });

  it("Blog publish after grant still works; authorization path unchanged for Trusted Author", async () => {
    const author = await registerParticipant("pub");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["trusted_author"],
    });
    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Publish Compat`,
        categoryId: "our_life",
        content: "<p>Compatibility publish remains available.</p>",
        excerpt: "Compat",
      },
    });
    const published = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });
    assert.equal(published.status, "published");
  });

  it("no impersonation helpers and no Admin UI routes exported", async () => {
    const mod = await import("../../../src/modules/administration/index.js");
    assert.equal("impersonate" in mod, false);
    assert.equal("adminRouter" in mod, false);
    assert.ok(typeof mod.resolveParticipantCapabilities === "function");
    assert.ok(typeof mod.AuditService.record === "function");
  });
});
