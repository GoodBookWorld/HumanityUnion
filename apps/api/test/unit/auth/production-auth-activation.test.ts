import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { InvalidCredentialsError, UserDisabledError } from "../../../src/modules/auth/auth.errors.js";
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from "../../../src/modules/auth/auth-email.service.js";
import { loginAuthUser } from "../../../src/modules/auth/auth.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findAuthUserByEmail,
  findAuthUserById,
  insertAuthUser,
} from "../../../src/modules/auth/auth-user.repository.js";
import { clearEmailConfirmationCodesForTests } from "../../../src/modules/email/email-confirmation-code.repository.js";
import {
  clearEmailVerificationTokensForTests,
  createEmailVerificationToken,
  findValidEmailVerificationToken,
} from "../../../src/modules/email/email.tokens.js";
import { MockEmailProvider } from "../../../src/modules/email/providers/mock.provider.js";
import { confirmMemberRegistration } from "../../../src/modules/member/application/confirm-member-registration.service.js";
import {
  deleteMembersByMemberIdPrefix,
  insertMember,
} from "../../../src/modules/member/infrastructure/member.repository.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import { resetSmtpTransportForTests } from "../../../src/modules/email/smtp-transport.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import { resetEventInfrastructureForTests } from "../../helpers/test-events.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("auth-activation");

function createTestEmail(suffix: string): string {
  return `${TEST_PREFIX}-${suffix}@activation.test`;
}

async function createBootstrapShell(input: {
  suffix: string;
  displayName: string;
  role?: "admin" | "member";
  passwordSecret?: string;
}) {
  const email = createTestEmail(input.suffix);
  const memberId = `${TEST_PREFIX}-m-${input.suffix}`;
  const discardedSecret =
    input.passwordSecret ?? `migration-reset-required-${randomUUID()}`;

  const user = await insertAuthUser(
    {
      email,
      password: discardedSecret,
      displayName: input.displayName,
      role: input.role ?? "member",
    },
    memberId,
  );

  await insertMember({
    memberId,
    identityId: user.userId,
    displayName: input.displayName,
    uniqueName: `${TEST_PREFIX}-${input.suffix}`,
  });

  return { email, user, memberId, discardedSecret };
}

describe("Production auth activation — bootstrap shells", () => {
  before(async () => {
    resetEventInfrastructureForTests();
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  beforeEach(() => {
    resetEventInfrastructureForTests();
    MockEmailProvider.clearForTests();
    clearEmailVerificationTokensForTests();
    clearEmailConfirmationCodesForTests();
  });

  after(async () => {
    resetEventInfrastructureForTests();
    await deleteMembersByMemberIdPrefix(TEST_PREFIX);
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    MockEmailProvider.clearForTests();
    clearEmailVerificationTokensForTests();
    resetSmtpTransportForTests();
    await disconnectMongoClient();
  });

  it("bootstrap unusable password cannot authenticate directly", async () => {
    const shell = await createBootstrapShell({
      suffix: "unusable",
      displayName: "Unusable Shell",
    });

    await assert.rejects(
      () => loginAuthUser({ email: shell.email, password: "GuessablePassword1!" }),
      (error: unknown) =>
        error instanceof InvalidCredentialsError &&
        error.message === "Invalid email or password.",
    );

    // Discarded bootstrap secret is not a legitimate credential path for operators.
    await assert.rejects(
      () => loginAuthUser({ email: shell.email, password: "wrong-password" }),
      InvalidCredentialsError,
    );

    const stored = await findAuthUserByEmail(shell.email);
    assert.equal(stored?.emailVerificationStatus, "pending");
    assert.equal(stored?.role, "member");
  });

  it("password reset establishes new password; email confirm works with pre-created member; admin role survives", async () => {
    const shell = await createBootstrapShell({
      suffix: "admin-flow",
      displayName: "Admin Shell",
      role: "admin",
    });

    const issued = await createEmailVerificationToken({
      userId: shell.user.userId,
      purpose: "password_reset",
    });
    const publicUser = await resetPasswordWithToken(issued.token, "NewProductionPass1!");
    assert.equal(publicUser.role, "admin");
    assert.equal(publicUser.emailVerificationStatus, "pending");

    // Old/unusable path remains invalid.
    await assert.rejects(
      () => loginAuthUser({ email: shell.email, password: shell.discardedSecret }),
      InvalidCredentialsError,
    );

    const loginPending = await loginAuthUser({
      email: shell.email,
      password: "NewProductionPass1!",
    });
    assert.equal(loginPending.kind, "email_confirmation_required");

    // Canonical confirmation path for bootstrap shells with pre-created members.
    const pendingUser = await findAuthUserById(shell.user.userId);
    assert.ok(pendingUser);
    const registration = await confirmMemberRegistration(pendingUser);
    assert.equal(registration.outcome, "idempotent_replay");

    const verified = await findAuthUserById(shell.user.userId);
    assert.equal(verified?.emailVerificationStatus, "verified");
    assert.equal(verified?.role, "admin");

    const loginOk = await loginAuthUser({
      email: shell.email,
      password: "NewProductionPass1!",
    });
    assert.equal(loginOk.kind, "session");
    if (loginOk.kind === "session") {
      assert.equal(loginOk.user.role, "admin");
      assert.equal(loginOk.user.emailVerificationStatus, "verified");
    }

    // Reset token is one-time.
    await assert.rejects(
      () => resetPasswordWithToken(issued.token, "AnotherPass123!"),
      (error: unknown) =>
        error instanceof InvalidCredentialsError &&
        /Invalid or expired reset token/i.test(error.message),
    );
  });

  it("confirmMemberRegistration verifies pending auth when member already exists (idempotent)", async () => {
    const shell = await createBootstrapShell({
      suffix: "idempotent-verify",
      displayName: "Idempotent Shell",
    });

    const first = await confirmMemberRegistration(shell.user);
    assert.equal(first.outcome, "idempotent_replay");

    const verified = await findAuthUserById(shell.user.userId);
    assert.equal(verified?.emailVerificationStatus, "verified");
    assert.equal(verified?.role, "member");

    const second = await confirmMemberRegistration(verified!);
    assert.equal(second.outcome, "idempotent_replay");
    assert.equal(second.member.memberId, shell.memberId);
  });

  it("disabled account remains blocked after password reset", async () => {
    const shell = await createBootstrapShell({
      suffix: "disabled",
      displayName: "Disabled Shell",
    });

    await getMongoCollection(MONGO_COLLECTIONS.authUsers).updateOne(
      { userId: shell.user.userId },
      { $set: { status: "disabled" } },
    );

    const issued = await createEmailVerificationToken({
      userId: shell.user.userId,
      purpose: "password_reset",
    });
    await resetPasswordWithToken(issued.token, "NewProductionPass1!");

    await assert.rejects(
      () => loginAuthUser({ email: shell.email, password: "NewProductionPass1!" }),
      UserDisabledError,
    );
  });

  it("public password-reset request does not require verified email", async () => {
    const shell = await createBootstrapShell({
      suffix: "public-reset",
      displayName: "Public Reset Shell",
    });

    const result = await requestPasswordReset(shell.email);
    assert.equal(result.requested, true);
    assert.match(result.message, /reset email has been sent/i);
    // Report path must stay generic (no email echo).
    assert.equal(result.message.includes(shell.email), false);
  });

  it("no privilege escalation: member shell cannot become admin via activation", async () => {
    const shell = await createBootstrapShell({
      suffix: "no-escalation",
      displayName: "Member Shell",
      role: "member",
    });

    const issued = await createEmailVerificationToken({
      userId: shell.user.userId,
      purpose: "password_reset",
    });
    await resetPasswordWithToken(issued.token, "NewProductionPass1!");
    await confirmMemberRegistration(await findAuthUserById(shell.user.userId).then((u) => u!));

    const user = await findAuthUserById(shell.user.userId);
    assert.equal(user?.role, "member");
    assert.equal(user?.role === "admin", false);
  });

  it("expired reset token is rejected", async () => {
    const shell = await createBootstrapShell({
      suffix: "expired-token",
      displayName: "Expired Token Shell",
    });

    const issued = await createEmailVerificationToken({
      userId: shell.user.userId,
      purpose: "password_reset",
    });

    await getMongoCollection(MONGO_COLLECTIONS.emailVerificationTokens).updateOne(
      { tokenId: issued.record.tokenId },
      { $set: { expiresAt: new Date(Date.now() - 60_000).toISOString() } },
    );

    assert.equal(
      await findValidEmailVerificationToken({
        token: issued.token,
        purpose: "password_reset",
      }),
      null,
    );

    await assert.rejects(
      () => resetPasswordWithToken(issued.token, "NewProductionPass1!"),
      InvalidCredentialsError,
    );
  });
});
