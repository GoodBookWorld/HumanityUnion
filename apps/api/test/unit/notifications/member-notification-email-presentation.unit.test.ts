/**
 * HU-NOTIF-02C.3 — safe localized notification email templates + deep links.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  getMockEmailSendCount,
  resetMockEmailOutboxForTests,
} from "../../../src/modules/email/email-test-helpers.js";
import {
  executeMemberNotificationEmailDeliveryAdapter,
  insertMemberNotificationEmailDelivery,
  MEMBER_NOTIFICATION_EMAIL_INSTALLED_LOCALES,
  resetMemberNotificationEmailDeliveryStoreForTests,
  resolveMemberNotificationDeepLink,
  resolveMemberNotificationEmailCopy,
  resolveMemberNotificationEmailLocale,
  resolveMemberNotificationEmailPresentation,
  resolveMemberNotificationEmailPresentationCategory,
  runMemberNotificationEmailDeliveryWorkerTick,
  setMemberNotificationEmailDeliveryEnabledForTests,
  setMemberNotificationEmailDeliveryForceMemoryForTests,
  setMemberNotificationEmailDeliveryIndexesReadyForTests,
  setMemberNotificationEmailDeliveryModeForTests,
} from "../../../src/modules/notifications/email-delivery/index.js";
import { MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS } from "../../../src/modules/notifications/email-delivery/member-notification-email-delivery.constants.js";
import { buildDefaultMemberPreferences } from "../../../src/modules/preferences/preferences.defaults.js";
import {
  insertPreferences,
  resetPreferencesMemoryStoreForTests,
  setPreferencesForceMemoryForTests,
} from "../../../src/modules/preferences/preferences.repository.js";
import { setFindAuthUserByIdForTests } from "../../../src/modules/auth/auth-user.repository.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.repository.js";
import type { MemberNotificationEmailDeliveryRecord } from "@hu/types";

const USER_ID = "user-present-01";
const MEMBER_ID = "member-present-01";
const ACTIVATION = "2026-01-01T00:00:00.000Z";

function makeUser(): AuthUserRecord {
  const now = new Date().toISOString();
  return {
    userId: USER_ID,
    email: "present@example.com",
    passwordHash: "hash",
    displayName: "Presenter",
    role: "member",
    status: "active",
    memberId: MEMBER_ID,
    emailVerificationStatus: "verified",
    emailVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

describe("HU-NOTIF-02C.3 member notification email presentation", () => {
  beforeEach(async () => {
    process.env.NODE_TEST_ENV = "true";
    process.env.WEB_ORIGIN = "https://hu.example";
    process.env.HU_MEMBER_NOTIFICATION_EMAIL_DELIVERY_ACTIVATION_AT = ACTIVATION;
    setMemberNotificationEmailDeliveryForceMemoryForTests(true);
    setPreferencesForceMemoryForTests(true);
    resetPreferencesMemoryStoreForTests();
    resetMemberNotificationEmailDeliveryStoreForTests();
    setMemberNotificationEmailDeliveryIndexesReadyForTests(true);
    setMemberNotificationEmailDeliveryEnabledForTests(null);
    setMemberNotificationEmailDeliveryModeForTests(null);
    resetMockEmailOutboxForTests();
    setFindAuthUserByIdForTests(async (id) => (id === USER_ID ? makeUser() : null));

    const prefs = buildDefaultMemberPreferences({ memberId: MEMBER_ID, userId: USER_ID });
    prefs.experiencePreferences.readingLanguages = ["en"];
    prefs.communicationPreferences.notificationEmailCopiesOptIn = true;
    prefs.communicationPreferences.notificationFrequency = "immediate";
    await insertPreferences(prefs);
  });

  afterEach(() => {
    setMemberNotificationEmailDeliveryEnabledForTests(null);
    setMemberNotificationEmailDeliveryModeForTests(null);
    resetMemberNotificationEmailDeliveryStoreForTests();
    resetPreferencesMemoryStoreForTests();
    setFindAuthUserByIdForTests(null);
    resetMockEmailOutboxForTests();
    delete process.env.HU_MEMBER_NOTIFICATION_EMAIL_DELIVERY_ACTIVATION_AT;
  });

  it("renders allowlisted events with fixed category copy (no raw title/body)", async () => {
    const result = await resolveMemberNotificationEmailPresentation({
      eventType: "initiative_published",
      relatedUrl: "/initiatives/init-1",
      recipientMemberId: MEMBER_ID,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.category, "civic_initiative_update");
    assert.match(result.subject, /Civic initiative update/i);
    assert.match(result.html, /Civic initiative update/);
    assert.match(result.html, /https:\/\/hu\.example\/initiatives\/init-1/);
    assert.match(result.html, /https:\/\/hu\.example\/preferences/);
    assert.equal(result.html.includes("SECRET TITLE"), false);
    assert.equal(result.text.includes("PRIVATE BODY"), false);
  });

  it("rejects unknown and private events", async () => {
    const unknown = await resolveMemberNotificationEmailPresentation({
      eventType: "totally_unknown_event",
    });
    assert.equal(unknown.ok, false);
    if (!unknown.ok) {
      assert.equal(unknown.errorCode, "unknown_event");
    }

    const privateEvent = await resolveMemberNotificationEmailPresentation({
      eventType: "direct_message_received",
    });
    assert.equal(privateEvent.ok, false);
    if (!privateEvent.ok) {
      assert.equal(privateEvent.errorCode, "private_event");
    }
    assert.equal(
      resolveMemberNotificationEmailPresentationCategory("direct_message_received"),
      null,
    );
  });

  it("supports all installed locales with EN fallback", () => {
    for (const locale of MEMBER_NOTIFICATION_EMAIL_INSTALLED_LOCALES) {
      const resolved = resolveMemberNotificationEmailLocale(locale);
      assert.equal(resolved.locale, locale);
      const copy = resolveMemberNotificationEmailCopy({
        locale,
        category: "contribution_status",
      });
      assert.ok(copy.subject.length > 0);
      assert.ok(copy.body.length > 0);
      assert.ok(copy.openLabel.length > 0);
    }

    const fallback = resolveMemberNotificationEmailLocale("xx-unsupported");
    assert.equal(fallback.locale, "en");
    assert.equal(fallback.usedFallback, true);
  });

  it("sets RTL html lang/dir for Arabic and Hebrew", async () => {
    for (const locale of ["ar", "he"] as const) {
      resetPreferencesMemoryStoreForTests();
      const prefs = buildDefaultMemberPreferences({ memberId: MEMBER_ID, userId: USER_ID });
      prefs.experiencePreferences.readingLanguages = [locale];
      prefs.experiencePreferences.interfaceLanguage = locale;
      await insertPreferences(prefs);

      const result = await resolveMemberNotificationEmailPresentation({
        eventType: "initiative_published",
        relatedUrl: "/notifications",
        recipientMemberId: MEMBER_ID,
      });
      assert.equal(result.ok, true);
      if (!result.ok) {
        continue;
      }
      assert.equal(result.dir, "rtl");
      assert.match(result.html, new RegExp(`lang="${locale}"`));
      assert.match(result.html, /dir="rtl"/);
      assert.match(result.html, /dir="ltr"/); // URLs stay LTR
    }
  });

  it("HTML-escapes localized strings", async () => {
    // EN catalog has no raw HTML; ensure escape path does not inject tags from category text.
    const result = await resolveMemberNotificationEmailPresentation({
      eventType: "analysis_published",
      relatedUrl: "/initiatives/a-1",
      recipientMemberId: MEMBER_ID,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.html.includes("<script"), false);
    assert.match(result.html, /<html lang=/);
  });

  it("rejects unsafe URLs and falls back to /notifications", async () => {
    assert.equal(resolveMemberNotificationDeepLink("https://evil.example/x").ok, false);
    assert.equal(resolveMemberNotificationDeepLink("//evil.example/x").ok, false);
    assert.equal(resolveMemberNotificationDeepLink("javascript:alert(1)").ok, false);
    assert.equal(resolveMemberNotificationDeepLink("/notifications?token=abc").ok, false);
    assert.equal(resolveMemberNotificationDeepLink("/admin/secrets").ok, false);

    const result = await resolveMemberNotificationEmailPresentation({
      eventType: "initiative_published",
      relatedUrl: "https://evil.example/phish",
      recipientMemberId: MEMBER_ID,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.deepLinkFallback, true);
    assert.match(result.html, /https:\/\/hu\.example\/notifications/);
    assert.equal(result.html.includes("evil.example"), false);
  });

  it("blocks encoded and double-encoded deep-link bypasses", () => {
    const rejected = [
      "/%2f%2fevil.example/phish",
      "/%252f%252fevil.example/phish",
      "javascript%3Aalert(1)",
      "data%3Atext/html%2C%3Cscript%3E",
      "/initiatives/%2e%2e/%2e%2e/admin",
      "/initiatives/foo/../../../admin",
      "/notifications?%74oken=abc",
      "/notifications?%72edirect=https%3A%2F%2Fevil.example",
      "/notifications?next=https://evil.example",
      "/notifications?url=//evil.example",
      "/notifications?continue=https%3A%2F%2Fevil.example",
      "https://user:pass@hu.example/notifications",
      "https://hu.example/notifications?redirect=/evil",
      "/notifications\\@evil.example",
      "data:text/html,hi",
    ];
    for (const candidate of rejected) {
      const resolved = resolveMemberNotificationDeepLink(candidate);
      assert.equal(resolved.ok, false, `expected reject: ${candidate}`);
    }

    const sameOriginSafe = resolveMemberNotificationDeepLink(
      "https://hu.example/initiatives/init-safe",
    );
    assert.equal(sameOriginSafe.ok, true);
    if (sameOriginSafe.ok) {
      assert.equal(sameOriginSafe.absoluteUrl, "https://hu.example/initiatives/init-safe");
    }
  });

  it("accepts safe internal paths", () => {
    const ok = resolveMemberNotificationDeepLink("/initiatives/init-9");
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.absoluteUrl, "https://hu.example/initiatives/init-9");
      assert.equal(ok.usedFallback, false);
    }
  });

  it("provides non-empty copy for every category in every installed locale", () => {
    const categories = [
      "civic_initiative_update",
      "decision_petition_update",
      "contribution_status",
      "author_publication_status",
      "collaboration_invitation",
      "civic_accountability_update",
      "nomination_update",
    ] as const;
    for (const locale of MEMBER_NOTIFICATION_EMAIL_INSTALLED_LOCALES) {
      for (const category of categories) {
        const copy = resolveMemberNotificationEmailCopy({ locale, category });
        for (const [key, value] of Object.entries(copy)) {
          assert.equal(typeof value, "string", `${locale}/${category}.${key}`);
          assert.ok(value.trim().length > 0, `empty ${locale}/${category}.${key}`);
          assert.equal(value.includes("undefined"), false);
        }
      }
    }
  });

  it("dry-run adapter validates template without SMTP or sent marking", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");

    const adapter = await executeMemberNotificationEmailDeliveryAdapter({
      deliveryId: "d1",
      notificationId: "n1",
      eventType: "initiative_published",
      destinationHash: "abc",
      mode: "dry_run",
      recipientMemberId: MEMBER_ID,
      relatedUrl: "/initiatives/init-1",
    });
    assert.equal(adapter.outcome, "dry_run_validated");
    if (adapter.outcome === "dry_run_validated") {
      assert.equal(adapter.providerEmailId, null);
      assert.equal(adapter.diagnostics.templateId, "member_notification_copy");
      assert.equal(adapter.diagnostics.category, "civic_initiative_update");
      assert.equal("html" in adapter.diagnostics, false);
    }
    assert.equal(getMockEmailSendCount(), 0);

    const privateAdapter = await executeMemberNotificationEmailDeliveryAdapter({
      deliveryId: "d2",
      notificationId: "n2",
      eventType: "direct_message_received",
      destinationHash: "abc",
      mode: "dry_run",
      recipientMemberId: MEMBER_ID,
      relatedUrl: "/messages/1",
    });
    assert.equal(privateAdapter.outcome, "template_failed");
  });

  it("integrates dry-run worker without SMTP", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");

    const row: MemberNotificationEmailDeliveryRecord = {
      deliveryId: "present-del-1",
      notificationId: "present-notif-1",
      recipientUserId: USER_ID,
      recipientMemberId: MEMBER_ID,
      eventType: "initiative_published",
      channel: "immediate",
      status: "pending",
      attemptCount: 0,
      maxAttempts: MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS,
      nextAttemptAt: new Date().toISOString(),
      leaseOwner: null,
      leaseExpiresAt: null,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: new Date().toISOString(),
    };
    await insertMemberNotificationEmailDelivery(row);

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.dryRunOk, 1);
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("does not leak PII into presentation diagnostics", async () => {
    const result = await resolveMemberNotificationEmailPresentation({
      eventType: "member_badge_shipped",
      relatedUrl: "/workspace/badge",
      recipientMemberId: MEMBER_ID,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes("present@example.com"), false);
    assert.equal(serialized.includes("Presenter"), false);
  });
});
