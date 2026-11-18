/**
 * HU-NOTIF-02C.7 — accurate Notification Center / preferences email UX copy + i18n fallback.
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

function readMessages(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(webSrc, `i18n/messages/${locale}.json`), "utf8"),
  ) as Record<string, unknown>;
}

const INSTALLED = [
  "en",
  "ar",
  "de",
  "es",
  "fr",
  "he",
  "ka",
  "pt",
  "uk",
  "zh-Hant",
] as const;

const STALE_PATTERNS = [
  /not sending those copies yet/i,
  /not sending yet/i,
  /upcoming email copies/i,
  /future Notification Center email-copy feature/i,
  /Prepare email copies of my notifications/,
];

function getPath(root: Record<string, unknown>, parts: string[]): unknown {
  let current: unknown = root;
  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

describe("HU-NOTIF-02C.7 notification email UX copy", () => {
  it("uses accurate English opt-in and preparation copy without stale deferral claims", () => {
    const en = readMessages("en");
    const preparationNotice = getPath(en, [
      "notifications",
      "emailSettings",
      "preparationNotice",
    ]);
    const copiesOptIn = getPath(en, ["preferences", "notification", "copiesOptIn"]);
    const copiesHelp = getPath(en, ["preferences", "notification", "copiesHelp"]);
    const altHelp = getPath(en, ["notifications", "emailSettings", "alternativeEmailHelp"]);

    assert.equal(typeof preparationNotice, "string");
    assert.equal(typeof copiesOptIn, "string");
    assert.equal(typeof copiesHelp, "string");
    assert.equal(typeof altHelp, "string");

    assert.match(String(preparationNotice), /optional/i);
    assert.match(String(preparationNotice), /explicit opt-in/i);
    assert.match(String(preparationNotice), /verified notification destination/i);
    assert.match(String(preparationNotice), /frequency/i);
    assert.match(String(preparationNotice), /platform availability/i);

    assert.match(String(copiesOptIn), /Send email copies/i);
    assert.match(String(copiesHelp), /Optional/i);
    assert.match(String(copiesHelp), /verified notification destination/i);
    assert.match(String(copiesHelp), /does not change your login email/i);
    assert.match(String(copiesHelp), /does not stop security or account emails/i);
    assert.match(String(copiesHelp), /Saving preferences does not mean an email was sent/i);
    assert.match(String(altHelp), /Notification Center email copies/i);

    for (const pattern of STALE_PATTERNS) {
      assert.doesNotMatch(String(preparationNotice), pattern);
      assert.doesNotMatch(String(copiesHelp), pattern);
      assert.doesNotMatch(String(copiesOptIn), pattern);
      assert.doesNotMatch(String(altHelp), pattern);
    }
  });

  it("keeps bundled overlays free of stale deferral wording", () => {
    for (const locale of ["en", "ar", "uk", "zh-Hant"] as const) {
      const catalog = readMessages(locale);
      const strings = [
        getPath(catalog, ["notifications", "emailSettings", "preparationNotice"]),
        getPath(catalog, ["preferences", "notification", "copiesHelp"]),
        getPath(catalog, ["preferences", "notification", "copiesOptIn"]),
        getPath(catalog, ["notifications", "emailSettings", "alternativeEmailHelp"]),
      ]
        .filter((value): value is string => typeof value === "string")
        .join("\n");
      for (const pattern of STALE_PATTERNS) {
        assert.doesNotMatch(strings, pattern, `${locale} still has stale copy: ${pattern}`);
      }
    }
  });

  it("resolves copy for every installed locale via English deep-merge fallback", async () => {
    const en = readMessages("en");
    for (const locale of INSTALLED) {
      const merged =
        locale === "en"
          ? en
          : (deepMergeMessages(
              en as never,
              readMessages(locale) as never,
            ) as Record<string, unknown>);
      const preparationNotice = getPath(merged, [
        "notifications",
        "emailSettings",
        "preparationNotice",
      ]);
      const copiesHelp = getPath(merged, ["preferences", "notification", "copiesHelp"]);
      assert.equal(typeof preparationNotice, "string", `${locale} preparationNotice`);
      assert.equal(typeof copiesHelp, "string", `${locale} copiesHelp`);
      assert.ok(String(preparationNotice).trim().length > 20, `${locale} preparationNotice empty`);
      assert.ok(String(copiesHelp).trim().length > 20, `${locale} copiesHelp empty`);
      for (const pattern of STALE_PATTERNS) {
        assert.doesNotMatch(String(preparationNotice), pattern, `${locale} stale prep`);
        assert.doesNotMatch(String(copiesHelp), pattern, `${locale} stale help`);
      }
    }
  });

  it("loadUiMessagesForLocale keeps English fallback for missing overlay keys", async () => {
    // de is installed but not a bundled overlay — falls back to English-only merge base.
    const deOnly = await loadUiMessagesForLocale("de", [bundledUiMessagePackSource]);
    assert.equal(deOnly.packSource, "english-only");
    assert.match(
      String(
        getPath(deOnly.messages as Record<string, unknown>, [
          "notifications",
          "emailSettings",
          "preparationNotice",
        ]),
      ),
      /Optional email copies/i,
    );

    // ar is a bundled overlay — missing keys still deep-merge from English.
    const ar = await loadUiMessagesForLocale("ar", [bundledUiMessagePackSource]);
    assert.equal(ar.packSource, "bundled");
    const copiesHelp = getPath(ar.messages as Record<string, unknown>, [
      "preferences",
      "notification",
      "copiesHelp",
    ]);
    assert.equal(typeof copiesHelp, "string");
    assert.ok(String(copiesHelp).length > 20);
    assert.doesNotMatch(String(copiesHelp), /not sending those copies yet/i);
  });

  it("keeps RTL CSS hooks for the Notification Center email widget", () => {
    const css = readFileSync(
      path.join(webSrc, "notifications/components/email-notifications-settings-widget.css"),
      "utf8",
    );
    assert.match(css, /\[dir="rtl"\]/);
    assert.match(css, /\.email-notifications-settings/);
  });

  it("does not expose internal delivery env flags in UI components", () => {
    const widget = readFileSync(
      path.join(webSrc, "notifications/components/EmailNotificationsSettingsWidget.tsx"),
      "utf8",
    );
    const prefs = readFileSync(
      path.join(webSrc, "preferences/components/PreferencesWorkspace.tsx"),
      "utf8",
    );
    for (const source of [widget, prefs]) {
      assert.doesNotMatch(source, /HU_MEMBER_NOTIFICATION_EMAIL_/);
      assert.doesNotMatch(source, /LIVE_APPROVED|DELIVERY_MODE|LIVE_RECIPIENT/);
    }
  });
});
