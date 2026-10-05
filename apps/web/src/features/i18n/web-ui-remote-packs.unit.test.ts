/**
 * Web loader — remote-first + bundled bootstrap WEB_UI pack resolution.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AbstractIntlMessages } from "next-intl";

import {
  loadUiMessagesForLocale,
  loadBundledUiMessagePack,
  defaultUiMessagePackSources,
  bundledUiMessagePackSource,
} from "./load-ui-messages.js";
import { remoteUiMessagePackSource } from "./remote-ui-message-pack-source.js";
import type { UiMessagePackSource } from "./remote-pack-seam.js";

describe("loadUiMessagesForLocale — remote pack support", () => {
  it("bundled locale still loads bundled messages when remote is absent", async () => {
    const loaded = await loadUiMessagesForLocale("uk", [bundledUiMessagePackSource]);
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
      remote,
      bundledUiMessagePackSource,
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
      remote,
      bundledUiMessagePackSource,
    ]);
    assert.equal(loaded.packSource, "english-only");
    assert.equal(loaded.locale, "en");
  });

  it("default sources are remote then bundled without shipped-locale allowlist", async () => {
    assert.equal(defaultUiMessagePackSources.length, 2);
    assert.equal(defaultUiMessagePackSources[0], remoteUiMessagePackSource);
    assert.equal(defaultUiMessagePackSources[1], bundledUiMessagePackSource);
    const bundled = await loadBundledUiMessagePack("en");
    assert.ok(bundled);
    assert.equal(bundled?.source, "bundled");
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
