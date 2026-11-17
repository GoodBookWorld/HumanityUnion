/**
 * HU-NOTIF-02A / 02A.1 — unified Notification Preferences + Email Notifications.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(webSrc, "../../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

function readRepo(relativeFromRepo: string): string {
  return readFileSync(path.join(repoRoot, relativeFromRepo), "utf8");
}

describe("HU-NOTIF-02A Email Notifications settings widget", () => {
  it("renders only for authenticated participants after the page header", () => {
    const page = read("features/notifications/components/NotificationCenterPageContent.tsx");
    const headerClose = page.indexOf("</header>");
    const widget = page.indexOf("<EmailNotificationsSettingsWidget");
    const summary = page.indexOf("<CommunicationSummary");
    assert.ok(headerClose >= 0);
    assert.ok(widget > headerClose);
    assert.ok(summary > widget);
    assert.match(page, /\{authenticated \? <EmailNotificationsSettingsWidget \/> : null\}/);
  });

  it("loads AuthUser email via getMe and never invents email from display name", () => {
    const widget = read(
      "features/notifications/components/EmailNotificationsSettingsWidget.tsx",
    );
    assert.match(widget, /getMe\(\)/);
    assert.match(widget, /user\.email/);
    assert.match(widget, /emailVerificationStatus === "verified"/);
    assert.doesNotMatch(widget, /displayName.*email|email.*displayName/);
    assert.match(widget, /accountEmailUnverified/);
    assert.match(widget, /\/confirm-email/);
  });

  it("reuses preferences APIs and the explicit opt-in field defaulting OFF", () => {
    const widget = read(
      "features/notifications/components/EmailNotificationsSettingsWidget.tsx",
    );
    const defaults = readRepo("apps/api/src/modules/preferences/preferences.defaults.ts");
    const types = readRepo("packages/types/src/domain/member-preferences.ts");
    const validators = readRepo("apps/api/src/modules/preferences/preferences.validators.ts");
    assert.match(widget, /getMyPreferences/);
    assert.match(widget, /updateMyPreferences/);
    assert.match(widget, /notificationEmailCopiesOptIn/);
    assert.match(widget, /emailNotificationsEnabled/);
    assert.match(widget, /notificationFrequency/);
    assert.match(types, /notificationEmailCopiesOptIn: boolean/);
    assert.match(defaults, /notificationEmailCopiesOptIn:\s*false/);
    assert.match(validators, /notificationEmailCopiesOptIn/);
    assert.match(widget, /resolveOptIn/);
    assert.match(widget, /=== true/);
  });

  it("keeps PreferencesWorkspace on the same persisted fields with bidirectional sync", () => {
    const prefs = read("features/preferences/components/PreferencesWorkspace.tsx");
    const widget = read(
      "features/notifications/components/EmailNotificationsSettingsWidget.tsx",
    );
    assert.match(prefs, /notificationEmailCopiesOptIn/);
    assert.match(prefs, /notification\.copiesOptIn/);
    assert.match(prefs, /MEMBER_PREFERENCES_CHANGED_EVENT/);
    assert.match(prefs, /communicationPreferences: loaded\.communicationPreferences/);
    assert.match(prefs, /openNotificationCenter/);
    assert.match(prefs, /href="\/notifications"/);
    assert.match(widget, /MEMBER_PREFERENCES_CHANGED_EVENT/);
    assert.match(widget, /PREFERENCES_NOTIFICATION_HREF|\/preferences#notification-preferences/);
    assert.match(widget, /notification\.emailEnabled/);
    assert.match(widget, /notification\.copiesOptIn/);
    assert.match(widget, /communication\.notificationFrequency/);
  });

  it("serializes saves, recovers after failure, and does not claim delivery", () => {
    const widget = read(
      "features/notifications/components/EmailNotificationsSettingsWidget.tsx",
    );
    const en = JSON.parse(read("features/i18n/messages/en.json"));
    assert.match(widget, /saveChainRef/);
    assert.match(widget, /preferencesRef/);
    assert.match(widget, /getMyPreferences\(\)/);
    assert.match(widget, /setSaveState\("error"\)/);
    assert.match(widget, /alternativeEmailUnavailable/);
    assert.match(widget, /preparationNotice/);
    assert.match(en.notifications.emailSettings.preparationNotice, /not sending those copies yet/i);
    assert.match(en.preferences.notification.copiesHelp, /never disables in-app/i);
    assert.doesNotMatch(widget, /sendTransactionalEmail|MailDeliveryService/);
  });

  it("covers loading, saving, success, failure, and preference sync events", () => {
    const widget = read(
      "features/notifications/components/EmailNotificationsSettingsWidget.tsx",
    );
    assert.match(widget, /loading/);
    assert.match(widget, /saving/);
    assert.match(widget, /saved/);
    assert.match(widget, /saveError|loadError/);
    assert.match(widget, /MEMBER_PREFERENCES_CHANGED_EVENT/);
    assert.match(widget, /role="alert"/);
    assert.match(widget, /role="status"/);
  });

  it("uses WEB_UI keys with RTL-safe CSS and verification catalogs", () => {
    const widget = read(
      "features/notifications/components/EmailNotificationsSettingsWidget.tsx",
    );
    const css = read(
      "features/notifications/components/email-notifications-settings-widget.css",
    );
    const en = JSON.parse(read("features/i18n/messages/en.json"));
    assert.match(widget, /useTranslations\("notifications\.emailSettings"\)/);
    assert.match(widget, /useTranslations\("preferences"\)/);
    assert.equal(en.notifications.emailSettings.title, "Email Notifications");
    assert.equal(typeof en.notifications.emailSettings.openWorkspacePreferences, "string");
    assert.equal(typeof en.preferences.notification.copiesOptIn, "string");
    assert.equal(typeof en.preferences.notification.openNotificationCenter, "string");
    for (const locale of ["ar", "uk", "zh-Hant"] as const) {
      const catalog = JSON.parse(read(`features/i18n/messages/${locale}.json`));
      assert.equal(typeof catalog.notifications.emailSettings?.title, "string");
      assert.equal(typeof catalog.notifications.emailSettings?.openWorkspacePreferences, "string");
      assert.equal(typeof catalog.preferences.notification.copiesOptIn, "string");
      assert.equal(typeof catalog.preferences.notification.openNotificationCenter, "string");
    }
    assert.match(css, /\[dir="rtl"\]/);
    assert.match(css, /overflow-x:\s*hidden/);
    assert.match(css, /padding-inline|margin-block|border-block|text-align:\s*start/);
  });

  it("does not alter auth email flows or store private notification payloads", () => {
    const widget = read(
      "features/notifications/components/EmailNotificationsSettingsWidget.tsx",
    );
    assert.doesNotMatch(widget, /requestEmailChange|confirmEmailChange|pendingEmail/);
    assert.doesNotMatch(widget, /localStorage|sessionStorage|analytics|gtag|dataLayer/);
    assert.doesNotMatch(widget, /legalFirstName|dateOfBirth|relevantExperience|motivation/);
  });

  it("does not disable in-app notifications when email copies are opted out", () => {
    const widget = read(
      "features/notifications/components/EmailNotificationsSettingsWidget.tsx",
    );
    const page = read("features/notifications/components/NotificationCenterPageContent.tsx");
    assert.doesNotMatch(widget, /fetchMyNotifications|markNotificationRead|archiveNotification/);
    assert.match(page, /fetchMyNotifications/);
    assert.match(widget, /notificationEmailCopiesOptIn/);
  });
});
