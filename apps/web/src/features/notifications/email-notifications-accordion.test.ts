/**
 * HU-NOTIF-02C.10 — compact Email Notifications accordion on Notification Center.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  bundledUiMessagePackSource,
  deepMergeMessages,
  loadUiMessagesForLocale,
} from "../i18n/load-ui-messages.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

function readMessages(locale: string): Record<string, unknown> {
  return JSON.parse(read(`i18n/messages/${locale}.json`)) as Record<string, unknown>;
}

describe("HU-NOTIF-02C.10 Email Notifications accordion", () => {
  const widget = () => read("notifications/components/EmailNotificationsSettingsWidget.tsx");
  const css = () => read("notifications/components/email-notifications-settings-widget.css");
  const page = () => read("notifications/components/NotificationCenterPageContent.tsx");

  it("defaults collapsed and uses a semantic accordion button", () => {
    const source = widget();
    assert.match(source, /useState\(false\)/);
    assert.match(source, /aria-expanded=\{expanded\}/);
    assert.match(source, /aria-controls=\{panelId\}/);
    assert.match(source, /hidden=\{!expanded\}/);
    assert.match(source, /<h2 className="email-notifications-settings__heading">/);
    assert.match(source, /type="button"/);
    assert.match(source, /toggleExpanded/);
    assert.match(source, /MailIcon|mail-icon/);
    assert.match(source, /collapsedSummary/);
    assert.match(source, /email-notifications-settings__chevron/);
  });

  it("does not write preferences or call APIs when toggling the accordion", () => {
    const source = widget();
    const toggleBlock = source.slice(
      source.indexOf("function toggleExpanded"),
      source.indexOf("if (loadState === \"unauthenticated\")"),
    );
    assert.match(toggleBlock, /setExpanded/);
    assert.doesNotMatch(toggleBlock, /updateMyPreferences|persistCommunicationPatch|getMe|load\(/);
    assert.match(source, /UI-only: never persist preferences or call APIs on accordion toggle/);
  });

  it("preserves unsaved local inputs across expand/collapse (state not cleared on toggle)", () => {
    const source = widget();
    assert.match(source, /setAltEmailInput/);
    assert.match(source, /setCodeInput/);
    const toggleBlock = source.slice(
      source.indexOf("function toggleExpanded"),
      source.indexOf("if (loadState === \"unauthenticated\")"),
    );
    assert.doesNotMatch(toggleBlock, /setAltEmailInput|setCodeInput|setPreferences|setDestination/);
  });

  it("keeps both email toggles with distinct short help and both preference fields", () => {
    const source = widget();
    const en = readMessages("en");
    const emailSettings = (en.notifications as { emailSettings: Record<string, string> })
      .emailSettings;
    assert.match(source, /emailNotificationsEnabled/);
    assert.match(source, /notificationEmailCopiesOptIn/);
    assert.match(source, /emailEnabledHelpShort/);
    assert.match(source, /copiesHelpShort/);
    assert.match(String(emailSettings.emailEnabledHelpShort), /Activity alerts/i);
    assert.match(String(emailSettings.copiesHelpShort), /Notification Center items/i);
    assert.notEqual(emailSettings.emailEnabledHelpShort, emailSettings.copiesHelpShort);
  });

  it("avoids duplicated account email presentation when destination is already account", () => {
    const source = widget();
    assert.match(source, /currentDestination/);
    assert.match(source, /destinationAccount/);
    assert.match(source, /loginEmailHint/);
    assert.match(source, /mode === "alternative"/);
    // Separate always-visible accountEmail field removed from ready body.
    assert.doesNotMatch(
      source,
      /loadState === "ready"[\s\S]*t\("accountEmail"\)[\s\S]*destinationUnavailable/,
    );
  });

  it("keeps alternative email verification flow and frequency controls", () => {
    const source = widget();
    assert.match(source, /requestAlternativeNotificationEmail/);
    assert.match(source, /confirmAlternativeNotificationEmail/);
    assert.match(source, /useAccountNotificationEmail/);
    assert.match(source, /removeAlternativeNotificationEmail/);
    assert.match(source, /notificationFrequency/);
    assert.match(source, /one-time-code/);
  });

  it("keeps Notification Center list structure after the email widget", () => {
    const source = page();
    const widgetIdx = source.indexOf("<EmailNotificationsSettingsWidget");
    const summaryIdx = source.indexOf("<CommunicationSummary");
    assert.ok(widgetIdx > 0);
    assert.ok(summaryIdx > widgetIdx);
    assert.match(source, /\{authenticated \? <EmailNotificationsSettingsWidget \/> : null\}/);
  });

  it("supports keyboard activation via native button and visible focus styles", () => {
    const source = widget();
    const styles = css();
    assert.match(source, /type="button"/);
    assert.match(styles, /\.email-notifications-settings__trigger:focus-visible/);
    assert.match(styles, /\[dir="rtl"\]/);
    assert.match(styles, /@media \(max-width: 768px\)/);
    assert.match(styles, /overflow-x:\s*hidden/);
  });

  it("scopes stronger control borders and primary/secondary button hierarchy to Email Notifications", () => {
    const source = widget();
    const styles = css();
    assert.match(styles, /\.email-notifications-settings\s*\{/);
    assert.match(styles, /--ens-border-strong/);
    assert.match(styles, /\.email-notifications-settings__select:focus-visible/);
    assert.match(styles, /\.email-notifications-settings__select:disabled/);
    assert.match(styles, /\.email-notifications-settings__button--primary/);
    assert.match(styles, /\.email-notifications-settings__button--secondary/);
    assert.match(styles, /\.email-notifications-settings__button:disabled/);
    assert.match(source, /email-notifications-settings__button--primary/);
    assert.match(source, /email-notifications-settings__button--secondary/);
    assert.match(styles, /\[dir="rtl"\] \.email-notifications-settings/);
    assert.match(styles, /@media \(max-width: 768px\)/);
  });

  it("resolves new accordion strings for installed locales via EN fallback", async () => {
    const en = readMessages("en");
    for (const locale of ["en", "ar", "de", "he", "uk", "zh-Hant"] as const) {
      const merged =
        locale === "en"
          ? en
          : (deepMergeMessages(en as never, readMessages(locale) as never) as Record<
              string,
              unknown
            >);
      const settings = (merged.notifications as { emailSettings: Record<string, string> })
        .emailSettings;
      assert.ok(settings.collapsedSummary?.trim());
      assert.ok(settings.emailEnabledHelpShort?.trim());
      assert.ok(settings.copiesHelpShort?.trim());
      assert.ok(settings.loginEmailHint?.includes("{email}"));
    }

    const de = await loadUiMessagesForLocale("de", [bundledUiMessagePackSource]);
    const deSettings = (
      de.messages as { notifications: { emailSettings: Record<string, string> } }
    ).notifications.emailSettings;
    assert.match(String(deSettings.collapsedSummary), /Optional email copies/i);
  });
});
