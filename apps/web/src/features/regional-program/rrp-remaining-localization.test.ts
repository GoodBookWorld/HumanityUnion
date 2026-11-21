/**
 * HU-RRP-07G.5 — remaining RRP catalog keys and participant country names.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { getLocalizedCountryDisplayName } from "@hu/geography";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const repoRoot = path.resolve(webRoot, "../..");
const webDir = path.join(webRoot, "src/features/i18n/messages");
const packagedDir = path.join(repoRoot, "apps/api/assets/packaged-web-ui-catalogs");

const LOCALES = ["en", "uk", "zh-Hant", "ar", "de", "es", "fr", "he", "ka", "pt"] as const;

const GAP_KEYS = [
  "regionalProgramPublic.cta.joinDisclaimer",
  "workspace.messagesPage.conversation.viewRrpApplication",
  "adminNotifications.types.rrp_application_submitted",
  "rrpApplication.workspaceWidget.messagesUnavailable.pending",
  "rrpApplication.workspaceWidget.messagesUnavailable.failed",
  "rrpApplication.workspaceWidget.messagesUnavailable.none",
  "rrpApplication.workspaceWidget.messagesUnavailable.unavailable",
] as const;

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function leaves(node: unknown, prefix = "", out: Map<string, string> = new Map()): Map<string, string> {
  if (typeof node === "string") {
    if (prefix) out.set(prefix, node);
    return out;
  }
  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      leaves(value, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

function tokens(value: string): string {
  return [...value.matchAll(/\{[A-Za-z_][A-Za-z0-9_]*\}/g)].map((match) => match[0]).join("|");
}

describe("HU-RRP-07G.5 remaining localization gaps", () => {
  const english = leaves(readJson(path.join(webDir, "en.json")));

  it("completes the remaining keys with packaged parity and English fallback source", () => {
    const loader = readFileSync(path.join(webRoot, "src/features/i18n/load-ui-messages.ts"), "utf8");
    assert.match(loader, /UI_I18N_ENGLISH_FALLBACK_LOCALE = "en"/);

    for (const locale of LOCALES) {
      const web = leaves(readJson(path.join(webDir, `${locale}.json`)));
      const packaged = leaves(readJson(path.join(packagedDir, `${locale}.json`)));
      for (const key of GAP_KEYS) {
        const source = english.get(key);
        const value = web.get(key);
        assert.ok(source && value && value.trim().length > 0, `${locale} ${key}`);
        assert.equal(packaged.get(key), value, `${locale} ${key}`);
        assert.equal(tokens(value), tokens(source), `${locale} ${key}`);
        if (locale !== "en") assert.notEqual(value, source, `${locale} ${key}`);
      }
    }

    assert.match(english.get("regionalProgramPublic.cta.joinDisclaimer") ?? "", /legal authority/i);
    assert.match(english.get("regionalProgramPublic.cta.joinDisclaimer") ?? "", /internal designation only/i);
    assert.equal(
      english.get("workspace.messagesPage.conversation.viewRrpApplication"),
      "View Regional Application",
    );
    assert.equal(
      english.get("adminNotifications.types.rrp_application_submitted"),
      "Regional Representative application submitted",
    );
  });

  it("shows localized country names in participant RRP UI and keeps unknown codes unchanged", () => {
    const modal = readFileSync(
      path.join(webRoot, "src/features/regional-program/components/RrpApplicationModal.tsx"),
      "utf8",
    );
    const widget = readFileSync(
      path.join(webRoot, "src/features/regional-program/components/RrpApplicationWorkspaceWidget.tsx"),
      "utf8",
    );
    assert.match(modal, /useCountryDisplayName/);
    assert.match(widget, /useCountryDisplayName/);
    assert.doesNotMatch(modal, /country:\s*(item|active)\.representCountryCode/);
    assert.match(modal, /representCountryCode:\s*newRepresentCountry/);
    assert.match(modal, /value=\{form\.representCountryCode\}/);
    assert.match(widget, /resolveCountryName\(item\.representCountryCode, item\.representCountryCode\)/);

    assert.equal(getLocalizedCountryDisplayName("CA", "en"), "Canada");
    assert.notEqual(getLocalizedCountryDisplayName("CA", "en"), "CA");
    assert.notEqual(getLocalizedCountryDisplayName("CA", "uk").toUpperCase(), "CA");
    assert.notEqual(getLocalizedCountryDisplayName("CA", "ar"), "CA");
    assert.notEqual(getLocalizedCountryDisplayName("CA", "he"), "CA");

    const unknown = getLocalizedCountryDisplayName("ZZ", "fr", "ZZ");
    assert.equal(unknown, "ZZ");
    assert.notEqual(unknown, getLocalizedCountryDisplayName("CA", "fr"));
  });

  it("keeps Arabic and Hebrew catalog text free of directional overrides", () => {
    const css = readFileSync(
      path.join(webRoot, "src/features/direct-messaging/components/direct-messaging.css"),
      "utf8",
    );
    assert.match(css, /\[dir="rtl"\] \.direct-messaging__rrp-link/);
    for (const locale of ["ar", "he"] as const) {
      const catalog = leaves(readJson(path.join(webDir, `${locale}.json`)));
      for (const key of GAP_KEYS) {
        const value = catalog.get(key) ?? "";
        assert.equal(value.includes("\u200e") || value.includes("\u200f"), false, `${locale} ${key}`);
        assert.doesNotMatch(value, /\bleft\b|\bright\b/i);
      }
    }
  });
});
