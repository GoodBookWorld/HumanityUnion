/**
 * HU-NOTIF-02B / HU-NOTIF-02B.1 — alternative notification email verification.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.repository.js";
import {
  findAuthUserById,
  setFindAuthUserByIdForTests,
} from "../../../src/modules/auth/auth-user.repository.js";
import {
  clearEmailConfirmationCodesForTests,
  getLastIssuedConfirmationCodeForTests,
  setConfirmationCodeNowMsForTests,
} from "../../../src/modules/email/email-confirmation-code.repository.js";
import { resetMockEmailOutboxForTests } from "../../../src/modules/email/email-test-helpers.js";
import { clearEmailVerificationTokensForTests } from "../../../src/modules/email/email.tokens.js";
import {
  confirmAlternativeNotificationEmail,
  NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
  removeAlternativeNotificationEmail,
  requestAlternativeNotificationEmail,
  resolveNotificationEmailDestination,
  useAccountNotificationEmail,
} from "../../../src/modules/preferences/notification-alternative-email.service.js";
import { buildDefaultMemberPreferences } from "../../../src/modules/preferences/preferences.defaults.js";
import {
  applyPreferencesPatchAtomically,
  findPreferencesByMemberId,
  insertPreferences,
  resetPreferencesMemoryStoreForTests,
  setPreferencesForceMemoryForTests,
} from "../../../src/modules/preferences/preferences.repository.js";
import { validatePreferencesPatch } from "../../../src/modules/preferences/preferences.validators.js";

const USER_ID = "user-notif-alt-01";
const MEMBER_ID = "member-notif-alt-01";

function makeUser(email = "owner@example.com"): AuthUserRecord {
  const now = new Date().toISOString();
  return {
    userId: USER_ID,
    email,
    passwordHash: "hash",
    displayName: "Owner",
    role: "member",
    status: "active",
    memberId: MEMBER_ID,
    emailVerificationStatus: "verified",
    emailVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

describe("HU-NOTIF-02B alternative notification email", () => {
  let previousCooldown: string | undefined;

  beforeEach(async () => {
    process.env.NODE_TEST_ENV = "true";
    previousCooldown = process.env.EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS;
    // Default tests allow back-to-back requests; dedicated cooldown test restores a positive value.
    process.env.EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS = "0";
    setPreferencesForceMemoryForTests(true);
    resetPreferencesMemoryStoreForTests();
    clearEmailConfirmationCodesForTests();
    clearEmailVerificationTokensForTests();
    resetMockEmailOutboxForTests();
    setConfirmationCodeNowMsForTests(null);
    const user = makeUser();
    setFindAuthUserByIdForTests(async (userId) => (userId === USER_ID ? user : null));
    await insertPreferences(
      buildDefaultMemberPreferences({ memberId: MEMBER_ID, userId: USER_ID }),
    );
  });

  afterEach(() => {
    setFindAuthUserByIdForTests(null);
    resetPreferencesMemoryStoreForTests();
    clearEmailConfirmationCodesForTests();
    resetMockEmailOutboxForTests();
    setConfirmationCodeNowMsForTests(null);
    if (previousCooldown === undefined) {
      delete process.env.EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS;
    } else {
      process.env.EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS = previousCooldown;
    }
  });

  it("happy path: request, confirm, destination switches without changing auth email", async () => {
    const authBefore = await findAuthUserById(USER_ID);
    assert.ok(authBefore);

    const requested = await requestAlternativeNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
      email: "alt@example.com",
      ipKey: "127.0.0.1",
    });
    assert.equal(
      requested.preferences.communicationPreferences.notificationAlternativeEmailPending,
      "alt@example.com",
    );
    assert.equal(
      requested.preferences.communicationPreferences.notificationEmailDestinationMode,
      "account",
    );

    const code = getLastIssuedConfirmationCodeForTests(
      USER_ID,
      NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
    );
    assert.ok(code);

    const confirmed = await confirmAlternativeNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
      code,
    });
    assert.equal(
      confirmed.preferences.communicationPreferences.notificationAlternativeEmail,
      "alt@example.com",
    );
    assert.equal(
      confirmed.preferences.communicationPreferences.notificationEmailDestinationMode,
      "alternative",
    );
    assert.equal(
      confirmed.preferences.communicationPreferences.notificationAlternativeEmailPending,
      null,
    );
    assert.equal(
      confirmed.preferences.communicationPreferences.notificationEmailCopiesOptIn,
      false,
    );

    const destination = resolveNotificationEmailDestination({
      preferences: confirmed.preferences,
      accountEmail: "owner@example.com",
      accountEmailVerified: true,
    });
    assert.equal(destination, "alt@example.com");

    const authAfter = await findAuthUserById(USER_ID);
    assert.equal(authAfter?.email, authBefore.email);
  });

  it("rejects wrong and expired codes", async () => {
    await requestAlternativeNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
      email: "alt2@example.com",
      ipKey: "10.0.0.1",
    });

    await assert.rejects(
      () =>
        confirmAlternativeNotificationEmail({
          userId: USER_ID,
          memberId: MEMBER_ID,
          code: "000000",
        }),
      /incorrect/i,
    );

    const code = getLastIssuedConfirmationCodeForTests(
      USER_ID,
      NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
    );
    assert.ok(code);

    setConfirmationCodeNowMsForTests(Date.now() + 60 * 60 * 1000);
    await assert.rejects(
      () =>
        confirmAlternativeNotificationEmail({
          userId: USER_ID,
          memberId: MEMBER_ID,
          code,
        }),
      /expired|incorrect/i,
    );
  });

  it("enforces resend cooldown between requests", async () => {
    process.env.EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS = "60";

    await requestAlternativeNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
      email: "cool@example.com",
      ipKey: "10.0.0.9",
    });

    await assert.rejects(
      () =>
        requestAlternativeNotificationEmail({
          userId: USER_ID,
          memberId: MEMBER_ID,
          email: "cool2@example.com",
          ipKey: "10.0.0.9",
        }),
      /wait before requesting another code/i,
    );
  });

  it("changing pending email invalidates previous challenge", async () => {
    await requestAlternativeNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
      email: "first@example.com",
      ipKey: "10.0.0.2",
    });
    const firstCode = getLastIssuedConfirmationCodeForTests(
      USER_ID,
      NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
    );
    assert.ok(firstCode);

    const second = await requestAlternativeNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
      email: "second@example.com",
      ipKey: "10.0.0.2",
    });
    assert.equal(
      second.preferences.communicationPreferences.notificationAlternativeEmailPending,
      "second@example.com",
    );

    await assert.rejects(
      () =>
        confirmAlternativeNotificationEmail({
          userId: USER_ID,
          memberId: MEMBER_ID,
          code: firstCode,
        }),
      /incorrect|expired/i,
    );
  });

  it("rejects confirmation when pending was replaced without matching code email", async () => {
    await requestAlternativeNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
      email: "bound@example.com",
      ipKey: "10.0.0.8",
    });
    const code = getLastIssuedConfirmationCodeForTests(
      USER_ID,
      NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
    );
    assert.ok(code);

    // Simulate a concurrent pending replacement after code issue (CAS / re-read guard).
    await applyPreferencesPatchAtomically(MEMBER_ID, {
      communicationPreferences: {
        notificationAlternativeEmailPending: "newer@example.com",
      },
    });

    await assert.rejects(
      () =>
        confirmAlternativeNotificationEmail({
          userId: USER_ID,
          memberId: MEMBER_ID,
          code,
        }),
      /incorrect/i,
    );

    const prefs = await findPreferencesByMemberId(MEMBER_ID);
    assert.equal(
      prefs?.communicationPreferences.notificationAlternativeEmailPending,
      "newer@example.com",
    );
    assert.equal(prefs?.communicationPreferences.notificationAlternativeEmail, null);
    assert.equal(prefs?.communicationPreferences.notificationEmailDestinationMode, "account");
  });

  it("allows only one concurrent confirmation to consume a code", async () => {
    await requestAlternativeNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
      email: "race@example.com",
      ipKey: "10.0.0.7",
    });
    const code = getLastIssuedConfirmationCodeForTests(
      USER_ID,
      NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
    );
    assert.ok(code);

    const results = await Promise.allSettled([
      confirmAlternativeNotificationEmail({
        userId: USER_ID,
        memberId: MEMBER_ID,
        code,
      }),
      confirmAlternativeNotificationEmail({
        userId: USER_ID,
        memberId: MEMBER_ID,
        code,
      }),
    ]);

    const fulfilled = results.filter((entry) => entry.status === "fulfilled");
    const rejected = results.filter((entry) => entry.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);

    const winner = fulfilled[0] as PromiseFulfilledResult<
      Awaited<ReturnType<typeof confirmAlternativeNotificationEmail>>
    >;
    assert.equal(
      winner.value.preferences.communicationPreferences.notificationAlternativeEmail,
      "race@example.com",
    );
  });

  it("revokes pending verification when alternative email is removed", async () => {
    await requestAlternativeNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
      email: "pending-remove@example.com",
      ipKey: "10.0.0.6",
    });
    const code = getLastIssuedConfirmationCodeForTests(
      USER_ID,
      NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
    );
    assert.ok(code);

    await removeAlternativeNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
    });

    await assert.rejects(
      () =>
        confirmAlternativeNotificationEmail({
          userId: USER_ID,
          memberId: MEMBER_ID,
          code,
        }),
      /pending|incorrect|expired/i,
    );
  });

  it("use-account and remove revert destination safely", async () => {
    await requestAlternativeNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
      email: "keep@example.com",
      ipKey: "10.0.0.3",
    });
    const code = getLastIssuedConfirmationCodeForTests(
      USER_ID,
      NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
    );
    await confirmAlternativeNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
      code: code!,
    });

    const account = await useAccountNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
    });
    assert.equal(
      account.preferences.communicationPreferences.notificationEmailDestinationMode,
      "account",
    );
    assert.equal(
      account.preferences.communicationPreferences.notificationAlternativeEmail,
      "keep@example.com",
    );

    const removed = await removeAlternativeNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
    });
    assert.equal(
      removed.preferences.communicationPreferences.notificationAlternativeEmail,
      null,
    );
    assert.equal(
      removed.preferences.communicationPreferences.notificationEmailDestinationMode,
      "account",
    );
  });

  it("blocks protected fields on general preferences PATCH", () => {
    for (const protectedField of [
      "notificationEmailDestinationMode",
      "notificationAlternativeEmail",
      "notificationAlternativeEmailVerifiedAt",
      "notificationAlternativeEmailPending",
    ] as const) {
      assert.throws(
        () =>
          validatePreferencesPatch({
            communicationPreferences: {
              [protectedField]:
                protectedField === "notificationEmailDestinationMode" ? "alternative" : "evil@example.com",
            },
          }),
        /notification email verification endpoints/i,
      );
    }
  });

  it("clears resendAvailableAt after successful alternative confirmation", async () => {
    process.env.EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS = "60";

    const requested = await requestAlternativeNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
      email: "confirm-clear@example.com",
      ipKey: "127.0.0.1",
    });
    assert.ok(requested.destination.pendingAlternativeEmail);
    assert.ok(requested.destination.resendAvailableAt);

    const code = getLastIssuedConfirmationCodeForTests(
      USER_ID,
      NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
    );
    assert.ok(code);

    const confirmed = await confirmAlternativeNotificationEmail({
      userId: USER_ID,
      memberId: MEMBER_ID,
      code,
    });
    assert.equal(confirmed.destination.pendingAlternativeEmail, null);
    assert.equal(confirmed.destination.resendAvailableAt, null);
    assert.equal(confirmed.destination.attemptsRemaining, null);
    assert.equal(confirmed.destination.alternativeEmail, "confirm-clear@example.com");

    const auth = await findAuthUserById(USER_ID);
    assert.equal(auth?.email, "owner@example.com");
  });

  it("keeps notificationEmailCopiesOptIn default OFF", () => {
    const defaults = buildDefaultMemberPreferences({ memberId: MEMBER_ID });
    assert.equal(defaults.communicationPreferences.notificationEmailCopiesOptIn, false);
    assert.equal(defaults.communicationPreferences.notificationEmailDestinationMode, "account");
  });

  it("never resolves pending email as the notification destination", () => {
    const preferences = buildDefaultMemberPreferences({ memberId: MEMBER_ID, userId: USER_ID });
    preferences.communicationPreferences.notificationAlternativeEmailPending = "pending@example.com";
    preferences.communicationPreferences.notificationEmailDestinationMode = "account";

    const destination = resolveNotificationEmailDestination({
      preferences,
      accountEmail: "owner@example.com",
      accountEmailVerified: true,
    });
    assert.equal(destination, "owner@example.com");
  });
});
