/**
 * RSS-SOURCE-02B.2 — Country News / public news card images: each card renders its
 * own article image, missing, insecure or broken images use the fallback, and the
 * media frame keeps a fixed aspect ratio without cropping.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import type { PublicNewsArticleItem } from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { PUBLIC_NEWS_FALLBACK_IMAGE } from "./components/NewsArticleImage.js";
import { PublicNewsCard } from "./components/PublicNewsCard.js";
import {
  PublicNewsCardImage,
  resolvePublicNewsCardImageSrc,
} from "./components/PublicNewsCardImage.js";

(globalThis as { React?: typeof React }).React = React;

const dir = path.dirname(fileURLToPath(import.meta.url));

function article(id: string, imageUrl?: string): PublicNewsArticleItem {
  return {
    id,
    sourceName: "Українська правда",
    title: `Country news article ${id}`,
    summary: `Summary for ${id}.`,
    articleUrl: `https://www.pravda.com.ua/eng/news/2026/11/06/${id}/`,
    ...(imageUrl ? { imageUrl } : {}),
    publishedAt: "2026-11-06T10:00:00.000Z",
    language: "en",
    category: "democracy",
    verificationStatus: "external-source",
  } as PublicNewsArticleItem;
}

function imgTags(markup: string): string[] {
  return markup.match(/<img\b[^>]*class="public-news-card__image"[^>]*>/g) ?? [];
}

const srcOf = (tag: string) => /\bsrc="([^"]*)"/.exec(tag)?.[1]?.replace(/&amp;/g, "&");

describe("RSS-SOURCE-02B.2 — card image source rules", () => {
  it("1. only absolute HTTPS images; a URL that failed is not retried, a new URL is", () => {
    const image = "https://uimg.pravda.com.ua/images/one.jpeg";
    assert.equal(resolvePublicNewsCardImageSrc(image, null), image);
    assert.equal(resolvePublicNewsCardImageSrc(image, image), null, "broken image falls back");
    assert.equal(
      resolvePublicNewsCardImageSrc("https://uimg.pravda.com.ua/images/two.jpeg", image),
      "https://uimg.pravda.com.ua/images/two.jpeg",
      "a different image for the same card is tried",
    );
    for (const unsafe of [
      undefined,
      null,
      "",
      "http://cdn.example.org/a.jpg",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "/relative.jpg",
      "not a url",
    ]) {
      assert.equal(resolvePublicNewsCardImageSrc(unsafe, null), null, String(unsafe));
    }
  });

  it("2. rendered markup: article image with alt text, or the decorative fallback", () => {
    const withImage = renderToStaticMarkup(
      createElement(PublicNewsCardImage, {
        title: "Headline",
        imageUrl: "https://uimg.pravda.com.ua/images/one.jpeg?w=720&h=480",
      }),
    );
    assert.equal(srcOf(withImage), "https://uimg.pravda.com.ua/images/one.jpeg?w=720&h=480");
    assert.match(withImage, /alt="Headline"/);
    assert.doesNotMatch(withImage, /aria-hidden/);
    assert.match(withImage, /width="640" height="360"/);

    for (const imageUrl of [undefined, "http://cdn.example.org/a.jpg", "javascript:alert(1)"]) {
      const markup = renderToStaticMarkup(
        createElement(PublicNewsCardImage, { title: "Headline", imageUrl }),
      );
      assert.equal(srcOf(markup), PUBLIC_NEWS_FALLBACK_IMAGE, String(imageUrl));
      assert.match(markup, /alt=""/);
      assert.match(markup, /aria-hidden="true"/);
    }
  });
});

describe("RSS-SOURCE-02B.2 — full news cards", () => {
  let messages: Record<string, unknown> = {};

  before(async () => {
    messages = (await loadUiMessagesForLocale("en")).messages as Record<string, unknown>;
  });

  it("3. each card shows its own article image; a card without an image shows the fallback", () => {
    const articles = [
      article("7512001", "https://uimg.pravda.com.ua/images/one.jpeg"),
      article("7512002"),
      article("7512003", "https://uimg.pravda.com.ua/images/three.jpeg"),
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
    assert.deepEqual(imgTags(markup).map(srcOf), [
      "https://uimg.pravda.com.ua/images/one.jpeg",
      PUBLIC_NEWS_FALLBACK_IMAGE,
      "https://uimg.pravda.com.ua/images/three.jpeg",
    ]);
    assert.equal((markup.match(/class="public-news-card__media"/g) ?? []).length, 3);
  });
});

describe("RSS-SOURCE-02B.2 — card image layout", () => {
  const css = readFileSync(path.join(dir, "public-news-discovery.css"), "utf8");

  it("4. fixed-ratio media frame; images fill it without cropping or overflow", () => {
    const frame = /\.public-news-card__media\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    assert.match(frame, /aspect-ratio:\s*21 \/ 9/);
    assert.match(frame, /overflow:\s*hidden/);
    assert.match(frame, /width:\s*100%/);
    const image = /\.public-news-card__image,[^{]*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    assert.match(image, /width:\s*100%/);
    assert.match(image, /height:\s*100%/);
    assert.match(image, /object-fit:\s*contain/);
  });
});
