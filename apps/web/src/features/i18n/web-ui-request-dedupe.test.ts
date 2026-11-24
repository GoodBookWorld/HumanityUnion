/**
 * HU-MEM-14C — request-scoped WEB_UI catalog loading.
 * Outside a Next.js request, React.cache calls through, so these tests
 * prove there is no process-wide catalog map. Production render counts
 * are measured separately.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveDocumentHtmlLocale } from "../language/resolve-document-locale";
import {
  deepMergeMessages,
  loadUiMessagesForLocale,
  resolveMergedMessage,
} from "./load-ui-messages";
import type { UiMessagePackSource } from "./remote-pack-seam";

const dir = path.dirname(fileURLToPath(import.meta.url));

type PackBody = {
  readonly locale: string;
  readonly messages: Record<string, unknown>;
};

function installFetch(handler: (locale: string) => PackBody | null) {
  const original = globalThis.fetch;
  let fetches = 0;
  let parses = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (!url.pathname.endsWith("/web-ui-message-packs")) {
      return original(input);
    }
    fetches += 1;
    const locale = url.searchParams.get("locale") ?? "";
    const body = handler(locale);
    return {
      ok: body != null,
      status: body != null ? 200 : 404,
      json: async () => {
        parses += 1;
        return {
          success: body != null,
          data: body,
        };
      },
    } as Response;
  }) as typeof fetch;
  return {
    restore() {
      globalThis.fetch = original;
    },
    get fetches() {
      return fetches;
    },
    get parses() {
      return parses;
    },
  };
}

const catalog = [
  {
    languageId: "lang-en",
    locale: "en",
    textDirection: "ltr" as const,
    aliases: [],
    enabled: true,
    seoIndexingEnabled: true,
  },
  {
    languageId: "lang-uk",
    locale: "uk",
    textDirection: "ltr" as const,
    aliases: [],
    enabled: true,
    seoIndexingEnabled: true,
  },
  {
    languageId: "lang-ar",
    locale: "ar",
    textDirection: "rtl" as const,
    aliases: [],
    enabled: true,
    seoIndexingEnabled: true,
  },
];

describe("HU-MEM-14C request-scoped WEB_UI loading", () => {
  const restorers: Array<() => void> = [];

  afterEach(() => {
    while (restorers.length > 0) {
      restorers.pop()?.();
    }
  });

  it("keeps one shared loader and does not retain a process catalog map", () => {
    const loader = readFileSync(path.join(dir, "load-ui-messages.ts"), "utf8");
    const locale = readFileSync(path.join(dir, "../language/resolve-document-locale.ts"), "utf8");
    const layout = readFileSync(path.join(dir, "../../app/layout.tsx"), "utf8");
    const request = readFileSync(path.join(dir, "../../i18n/request.ts"), "utf8");
    const remote = readFileSync(path.join(dir, "remote-ui-message-pack-source.ts"), "utf8");
    assert.match(loader, /cache\(/);
    assert.match(locale, /resolveDocumentHtmlLocaleFromRequest = cache\(/);
    assert.match(layout, /loadUiMessagesForLocale\(documentLocale\.locale\)/);
    assert.match(layout, /resolveDocumentHtmlLocale\(\)/);
    assert.match(request, /loadUiMessagesForLocale\(documentLocale\.locale\)/);
    assert.match(request, /resolveDocumentHtmlLocale\(\)/);
    assert.match(remote, /cache: "no-store"/);
    assert.doesNotMatch(loader, /new Map/);
    assert.doesNotMatch(loader, /setTimeout|ttl|TTL/);
  });

  it("runs every default load outside a request, including a newly published pack", async () => {
    let generation = 1;
    const gate = installFetch((locale) => ({
      locale,
      messages: { common: { language: `${locale}-${generation}` } },
    }));
    restorers.push(gate.restore);

    const first = await loadUiMessagesForLocale("uk");
    const second = await loadUiMessagesForLocale("uk");
    assert.equal(resolveMergedMessage(first.messages, "common", "language"), "uk-1");
    assert.equal(resolveMergedMessage(second.messages, "common", "language"), "uk-1");
    assert.notEqual(first.messages, second.messages);
    assert.equal(gate.fetches, 2);
    assert.equal(gate.parses, 2);

    generation = 2;
    const fresh = await loadUiMessagesForLocale("uk");
    assert.equal(resolveMergedMessage(fresh.messages, "common", "language"), "uk-2");
    assert.equal(gate.fetches, 3);
    assert.equal(gate.parses, 3);
  });

  it("keeps locales, English, partial overlays, and remote failure distinct", async () => {
    const gate = installFetch((locale) => {
      if (locale === "uk") {
        return { locale, messages: { common: { language: "мова" } } };
      }
      if (locale === "ar") {
        return { locale, messages: { common: { language: "لغة" } } };
      }
      if (locale === "de") {
        return null;
      }
      throw new Error("remote down");
    });
    restorers.push(gate.restore);

    const english = await loadUiMessagesForLocale("en");
    assert.equal(english.packSource, "bundled");
    assert.equal(gate.fetches, 0);

    const uk = await loadUiMessagesForLocale("uk");
    const ar = await loadUiMessagesForLocale("ar");
    assert.equal(resolveMergedMessage(uk.messages, "common", "language"), "мова");
    assert.equal(resolveMergedMessage(ar.messages, "common", "language"), "لغة");
    assert.equal(resolveMergedMessage(uk.messages, "common", "save"), resolveMergedMessage(english.messages, "common", "save"));

    const missing = await loadUiMessagesForLocale("de");
    assert.equal(missing.packSource, "english-only");
    assert.equal(missing.locale, "en");
    assert.equal(
      resolveMergedMessage(missing.messages, "common", "save"),
      resolveMergedMessage(english.messages, "common", "save"),
    );

    const failed = await loadUiMessagesForLocale("fr");
    assert.equal(failed.packSource, "english-only");

    const partial: UiMessagePackSource = {
      async load() {
        return {
          locale: "uk",
          source: "remote",
          messages: { common: { language: "частково" } },
        };
      },
    };
    let partialLoads = 0;
    const counting: UiMessagePackSource = {
      async load(locale) {
        partialLoads += 1;
        return partial.load(locale);
      },
    };
    const merged = await loadUiMessagesForLocale("uk", [counting]);
    const mergedAgain = await loadUiMessagesForLocale("uk", [counting]);
    assert.equal(partialLoads, 2);
    assert.equal(resolveMergedMessage(merged.messages, "common", "language"), "частково");
    assert.notEqual(merged.messages, mergedAgain.messages);
    const mutated = merged.messages as { common: { language: string } };
    mutated.common.language = "changed";
    assert.equal(resolveMergedMessage(mergedAgain.messages, "common", "language"), "частково");
  });

  it("does not collapse caller-specific document locale overrides", async () => {
    const anonymous = await resolveDocumentHtmlLocale({
      catalog,
      pathname: "/membership",
      urlLocaleSegment: null,
      huLangCookie: "uk",
      acceptLanguageHeader: "en",
      authenticated: false,
    });
    const authenticated = await resolveDocumentHtmlLocale({
      catalog,
      pathname: "/membership",
      urlLocaleSegment: null,
      huLangCookie: "uk",
      acceptLanguageHeader: "en",
      authenticated: true,
      participantInterfaceLanguage: "ar",
    });
    const prefixed = await resolveDocumentHtmlLocale({
      catalog,
      pathname: "/uk/membership",
      urlLocaleSegment: "uk",
      huLangCookie: "ar",
      acceptLanguageHeader: "en",
      authenticated: true,
      participantInterfaceLanguage: "ar",
    });
    assert.equal(anonymous.locale, "uk");
    assert.equal(anonymous.textDirection, "ltr");
    assert.equal(authenticated.locale, "ar");
    assert.equal(authenticated.textDirection, "rtl");
    assert.equal(prefixed.locale, "uk");
    assert.equal(prefixed.textDirection, "ltr");
  });

  it("deep-merges one overlay onto English without a second bundled generation", () => {
    const merged = deepMergeMessages(
      { common: { save: "Save", loading: "Loading" } },
      { common: { save: "Зберегти" } },
    );
    assert.equal(resolveMergedMessage(merged, "common", "save"), "Зберегти");
    assert.equal(resolveMergedMessage(merged, "common", "loading"), "Loading");
  });
});
