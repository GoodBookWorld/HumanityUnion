/**
 * Step 15D.14.D.2 — WEB_UI single authority (Web runtime precedence).
 *
 * Published Mongo (remote) wins over bundled localized overlay.
 * Missing keys in the selected Mongo overlay fall back to English, not bundled.
 * No locale-specific branches.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { AbstractIntlMessages } from "next-intl";

import {
  bundledUiMessagePackSource,
  defaultUiMessagePackSources,
  loadBundledUiMessagePack,
  loadUiMessagesForLocale,
  resolveMergedMessage,
} from "./load-ui-messages.js";
import { remoteUiMessagePackSource } from "./remote-ui-message-pack-source.js";
import type { UiMessagePackSource } from "./remote-pack-seam.js";

function fixtureSource(
  kind: "remote" | "bundled",
  byLocale: Readonly<Record<string, AbstractIntlMessages | null>>,
): UiMessagePackSource {
  return {
    async load(locale) {
      const messages = byLocale[locale];
      if (messages == null) {
        return null;
      }
      return { locale, source: kind, messages };
    },
  };
}

describe("Step 15D.14.D.2 — WEB_UI single authority (Web)", () => {
  it("default sources are remote then bundled (no locale allowlist)", () => {
    assert.equal(defaultUiMessagePackSources.length, 2);
    assert.equal(defaultUiMessagePackSources[0], remoteUiMessagePackSource);
    assert.equal(defaultUiMessagePackSources[1], bundledUiMessagePackSource);
    const here = path.dirname(fileURLToPath(import.meta.url));
    const loader = readFileSync(path.join(here, "load-ui-messages.ts"), "utf8");
    assert.doesNotMatch(loader, /locale === ["']uk["']|locale === ["']ka["']|locale === ["']he["']/);
    assert.doesNotMatch(loader, /remoteLocales|REMOTE_UI_LOCALES/);
  });

  it("A. published remote wins over bundled localized pack", async () => {
    const remote = fixtureSource("remote", {
      xx: { common: { language: "FROM_MONGO" } } as AbstractIntlMessages,
    });
    const bundled = fixtureSource("bundled", {
      xx: { common: { language: "FROM_BUNDLED" } } as AbstractIntlMessages,
    });
    const loaded = await loadUiMessagesForLocale("xx", [remote, bundled]);
    assert.equal(loaded.packSource, "remote");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "language"), "FROM_MONGO");
  });

  it("B. bundled localized pack used when published remote is absent", async () => {
    const remote = fixtureSource("remote", { xx: null });
    const bundled = fixtureSource("bundled", {
      xx: { common: { language: "FROM_BUNDLED" } } as AbstractIntlMessages,
    });
    const loaded = await loadUiMessagesForLocale("xx", [remote, bundled]);
    assert.equal(loaded.packSource, "bundled");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "language"), "FROM_BUNDLED");
  });

  it("C. draft-equivalent null remote does not override bundled", async () => {
    // Public API returns null for draft; simulate the same seam outcome.
    const remote = fixtureSource("remote", { xx: null });
    const bundled = fixtureSource("bundled", {
      xx: { common: { language: "BOOTSTRAP" } } as AbstractIntlMessages,
    });
    const loaded = await loadUiMessagesForLocale("xx", [remote, bundled]);
    assert.equal(loaded.packSource, "bundled");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "language"), "BOOTSTRAP");
  });

  it("E. Mongo-authoritative missing key falls back to English, not bundled", async () => {
    const remote = fixtureSource("remote", {
      xx: {
        // Only localize language — omit `save` so English merge must supply it.
        common: { language: "FROM_MONGO" },
      } as AbstractIntlMessages,
    });
    const bundled = fixtureSource("bundled", {
      xx: {
        common: { language: "FROM_BUNDLED", save: "BUNDLED_SAVE_MUST_NOT_WIN" },
      } as AbstractIntlMessages,
    });
    const loaded = await loadUiMessagesForLocale("xx", [remote, bundled]);
    assert.equal(loaded.packSource, "remote");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "language"), "FROM_MONGO");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "save"), "Save");
    assert.notEqual(
      resolveMergedMessage(loaded.messages, "common", "save"),
      "BUNDLED_SAVE_MUST_NOT_WIN",
    );
  });

  it("F. Mongo-only clean-room locale works", async () => {
    const remote = fixtureSource("remote", {
      zz: { common: { language: "CLEANROOM" } } as AbstractIntlMessages,
    });
    const bundled = fixtureSource("bundled", { zz: null });
    const loaded = await loadUiMessagesForLocale("zz", [remote, bundled]);
    assert.equal(loaded.packSource, "remote");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "language"), "CLEANROOM");
  });

  it("G. neither localized source → English", async () => {
    const remote = fixtureSource("remote", { qq: null });
    const bundled = fixtureSource("bundled", { qq: null });
    const loaded = await loadUiMessagesForLocale("qq", [remote, bundled]);
    assert.equal(loaded.packSource, "english-only");
    assert.equal(loaded.locale, "en");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "language"), "Language");
  });

  it("real bundled bootstrap still available when remote source returns null", async () => {
    const nullRemote: UiMessagePackSource = {
      async load() {
        return null;
      },
    };
    const loaded = await loadUiMessagesForLocale("uk", [
      nullRemote,
      bundledUiMessagePackSource,
    ]);
    assert.equal(loaded.packSource, "bundled");
    assert.equal(loaded.locale, "uk");
    const pack = await loadBundledUiMessagePack("uk");
    assert.ok(pack);
  });
});
