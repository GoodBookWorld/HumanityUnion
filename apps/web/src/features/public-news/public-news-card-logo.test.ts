/**
 * MEDIA-NEWS-01B — news card publisher logos (API logo → registry → initials) and the
 * explicit /media carousel request.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, before, describe, it, mock } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import type { PublicNewsArticleItem } from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { fetchPublicNewsArticles } from "./api.js";
import { PublicNewsCard } from "./components/PublicNewsCard.js";
import { resolveProviderPresentation } from "./public-news-discovery.utils.js";

(globalThis as { React?: typeof React }).React = React;

const dir = path.dirname(fileURLToPath(import.meta.url));

function article(
  id: string,
  sourceName: string,
  logo: Pick<PublicNewsArticleItem, "sourceLogoUrl" | "sourceLogoLabel"> = {},
): PublicNewsArticleItem {
  return {
    id,
    sourceName,
    title: `Article ${id}`,
    summary: `Summary ${id}.`,
    articleUrl: `https://example.org/${id}`,
    imageUrl: `https://images.example.org/${id}.jpg`,
    publishedAt: "2026-11-06T10:00:00.000Z",
    language: "en",
    category: "democracy",
    verificationStatus: "external-source",
    ...logo,
  };
}

describe("MEDIA-NEWS-01B — provider presentation", () => {
  it("1. API logo first, then the registry by name, then initials", () => {
    assert.deepEqual(
      resolveProviderPresentation("Global News", {
        logoUrl: "/images/media/canada/global-news.webp",
        logoLabel: "GN",
      }),
      {
        logoUrl: "/images/media/canada/global-news.webp",
        logoLabel: "GN",
        country: "International",
      },
    );
    assert.equal(
      resolveProviderPresentation("The Guardian", {
        logoUrl: "https://media.huws.org/media-resources/guardian.webp",
      }).logoUrl,
      "https://media.huws.org/media-resources/guardian.webp",
    );
    assert.equal(
      resolveProviderPresentation("The Guardian").logoUrl,
      "/images/media/guardian.webp",
    );
    assert.deepEqual(resolveProviderPresentation("Цензор.НЕТ", { logoLabel: "ЦН" }), {
      logoUrl: undefined,
      logoLabel: "ЦН",
      country: "International",
    });
    assert.equal(resolveProviderPresentation("La Presse").logoLabel, "LA");
  });

  it("2. unsafe API logo URLs are ignored", () => {
    for (const unsafe of [
      "javascript:alert(1)",
      "data:image/png;base64,AA",
      "//evil.example/x.png",
      "/images/../x.png",
      "http://media.huws.org/x.png",
      "/other/x.png",
    ]) {
      assert.equal(
        resolveProviderPresentation("The Guardian", { logoUrl: unsafe }).logoUrl,
        "/images/media/guardian.webp",
        unsafe,
      );
    }
  });
});

describe("MEDIA-NEWS-01B — PublicNewsCard logos", () => {
  let messages: Record<string, unknown> = {};

  before(async () => {
    messages = (await loadUiMessagesForLocale("en")).messages as Record<string, unknown>;
  });

  it("3. each card shows its publisher logo or initials; article images are unchanged", () => {
    const articles = [
      article("a1", "Global News", {
        sourceLogoUrl: "/images/media/canada/global-news.webp",
        sourceLogoLabel: "GN",
      }),
      article("a2", "The Guardian"),
      article("a3", "Цензор.НЕТ", { sourceLogoLabel: "ЦН" }),
    ];
    const markup = renderToStaticMarkup(
      createElement(
        NextIntlClientProvider,
        { locale: "en", messages, timeZone: "UTC" } as React.ComponentProps<
          typeof NextIntlClientProvider
        >,
        ...articles.map((entry) =>
          createElement(PublicNewsCard, { key: entry.id, article: entry }),
        ),
      ),
    );
    const logos = markup.match(/<img[^>]*class="public-news-card__logo"[^>]*>/g) ?? [];
    assert.deepEqual(
      logos.map((tag) => /src="([^"]+)"/.exec(tag)?.[1]),
      ["/images/media/canada/global-news.webp", "/images/media/guardian.webp"],
    );
    assert.match(
      markup,
      /<span class="public-news-card__logo-fallback" aria-hidden="true">ЦН<\/span>/,
    );
    const images = markup.match(/<img[^>]*class="public-news-card__image"[^>]*>/g) ?? [];
    assert.equal(images.length, 3);
    assert.ok(images.every((tag, n) => tag.includes(`https://images.example.org/a${n + 1}.jpg`)));
  });

  it("4. logos keep their aspect ratio inside the fixed logo box", () => {
    const css = readFileSync(path.join(dir, "public-news-discovery.css"), "utf8");
    const rule =
      /\.public-news-card__logo,\s*\.public-news-card__logo-fallback\s*\{([^}]*)\}/.exec(
        css,
      )?.[1] ?? "";
    assert.match(rule, /object-fit:\s*contain/);
  });
});

describe("MEDIA-NEWS-01B — /media carousel request", () => {
  afterEach(() => mock.restoreAll());

  it("5. the API client sends carousel=media only when asked; /media asks for it", async () => {
    const urls: string[] = [];
    mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(
        JSON.stringify({
          success: true,
          data: { items: [], generatedAt: "", retentionDays: 7, activeProviders: [] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    await fetchPublicNewsArticles({ limit: 12, language: "en", carousel: "media" });
    await fetchPublicNewsArticles({ limit: 24, language: "en" });
    assert.match(urls[0]!, /\/api\/v1\/public\/news\?limit=12&language=en&carousel=media$/);
    assert.doesNotMatch(urls[1]!, /carousel/);

    const page = readFileSync(path.join(dir, "../../app/media/page.tsx"), "utf8");
    assert.match(page, /limit: MEDIA_PLP_NEWS_BATCH_LIMIT,\s*language: "en",\s*carousel: "media",/);
  });
});
