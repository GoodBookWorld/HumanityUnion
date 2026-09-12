/**
 * Web loader — bundled + remote WEB_UI pack resolution.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AbstractIntlMessages } from "next-intl";

import {
  loadUiMessagesForLocale,
  loadBundledUiMessagePack,
  defaultUiMessagePackSources,
} from "./load-ui-messages.js";
import type { UiMessagePackSource } from "./remote-pack-seam.js";

describe("loadUiMessagesForLocale — remote pack support", () => {
  it("bundled locale still loads bundled messages", async () => {
    const loaded = await loadUiMessagesForLocale("uk", [defaultUiMessagePackSources[0]!]);
    assert.equal(loaded.packSource, "bundled");
    assert.equal(loaded.locale, "uk");
    const common = (loaded.messages as Record<string, unknown>).common as Record<string, unknown>;
    assert.equal(typeof common.language, "string");
  });

  it("arbitrary locale with complete remote pack loads that pack", async () => {
    const remote: UiMessagePackSource = {
      async load(locale) {
        if (locale !== "ka") return null;
        return {
          locale: "ka",
          source: "remote",
          messages: {
            common: { language: "ენა" },
          } as AbstractIntlMessages,
        };
      },
    };
    const loaded = await loadUiMessagesForLocale("ka", [
      defaultUiMessagePackSources[0]!,
      remote,
    ]);
    assert.equal(loaded.packSource, "remote");
    assert.equal(loaded.locale, "ka");
    const common = (loaded.messages as Record<string, unknown>).common as Record<string, unknown>;
    assert.equal(common.language, "ენა");
  });

  it("arbitrary locale with no remote pack falls back to english-only", async () => {
    const remote: UiMessagePackSource = {
      async load() {
        return null;
      },
    };
    const loaded = await loadUiMessagesForLocale("ka", [
      defaultUiMessagePackSources[0]!,
      remote,
    ]);
    assert.equal(loaded.packSource, "english-only");
    assert.equal(loaded.locale, "en");
  });

  it("default sources include remote without shipped-locale allowlist", async () => {
    assert.equal(defaultUiMessagePackSources.length, 2);
    const bundled = await loadBundledUiMessagePack("en");
    assert.ok(bundled);
    assert.equal(bundled?.source, "bundled");
    // Remote source accepts arbitrary tags — no ka/he/es allowlist in loader.
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    const loader = readFileSync(join(here, "load-ui-messages.ts"), "utf8");
    assert.doesNotMatch(loader, /remoteLocales|REMOTE_UI_LOCALES/);
    assert.match(loader, /remoteUiMessagePackSource/);
  });

  it("no provider calls in remote pack source", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "remote-ui-message-pack-source.ts"), "utf8");
    assert.doesNotMatch(src, /TranslationProvider|GEMINI|generateContent/);
    assert.match(src, /web-ui-message-packs/);
  });
});
