/**
 * RSS-SOURCE-02C — Admin RSS discovery panel and its wiring in Media Resources.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { NewsFeedDiscoveryCandidate, NewsFeedDiscoveryResult } from "@hu/types";

import {
  AdminNewsFeedDiscoveryPanel,
  describeDiscoveryCandidate,
  needsSectionMismatchWarning,
  orderDiscoveryCandidates,
  replacesWorkingFeed,
  type NewsFeedDiscoveryState,
} from "./components/AdminNewsFeedDiscoveryPanel.js";

(globalThis as { React?: typeof React }).React = React;

const dir = path.dirname(fileURLToPath(import.meta.url));

function candidate(overrides: Partial<NewsFeedDiscoveryCandidate>): NewsFeedDiscoveryCandidate {
  return {
    feedUrl: "https://news.example.org/feed/",
    feedHost: "news.example.org",
    title: "Example News",
    format: "rss",
    valid: true,
    reason: null,
    message: null,
    httpStatus: 200,
    sampleArticleCount: 12,
    sampleArticleUrls: [],
    latestPublishedAt: "2026-11-06T10:15:00.000Z",
    recommended: false,
    sectionMatch: null,
    sectionEvidence: [],
    ...overrides,
  };
}

function result(overrides: Partial<NewsFeedDiscoveryResult>): NewsFeedDiscoveryResult {
  return {
    status: "found",
    websiteUrl: "https://news.example.org",
    newsSectionUrl: null,
    discoveryPageUrl: "https://news.example.org",
    message: "Official feed found. Review it and confirm to use it.",
    candidates: [],
    recommendedFeedUrl: null,
    current: null,
    checkedAt: "2026-11-06T11:00:00.000Z",
    ...overrides,
  };
}

const render = (state: NewsFeedDiscoveryState) =>
  renderToStaticMarkup(
    createElement(AdminNewsFeedDiscoveryPanel, {
      heading: "RSS discovery for Example News",
      state,
      confirming: false,
      onConfirm: () => undefined,
      onCancel: () => undefined,
    }),
  );

describe("RSS-SOURCE-02C — discovery panel", () => {
  const recommended = candidate({ recommended: true });
  const broken = candidate({
    feedUrl: "https://news.example.org/old.xml",
    valid: false,
    reason: "http_error",
    message: "The feed responded with HTTP 404.",
    httpStatus: 404,
    sampleArticleCount: 0,
    latestPublishedAt: null,
    title: null,
  });

  it("1. found: recommended feed first with publisher, article count, latest date and actions", () => {
    const found = result({
      candidates: [broken, recommended],
      recommendedFeedUrl: recommended.feedUrl,
    });
    assert.deepEqual(
      orderDiscoveryCandidates(found).map((entry) => entry.feedUrl),
      [recommended.feedUrl, broken.feedUrl],
    );
    const html = render({ status: "done", result: found });
    assert.match(html, /Official feed found/);
    assert.match(html, /https:\/\/news\.example\.org\/feed\//);
    assert.match(html, /Example News/);
    assert.match(html, /Valid · 12 articles · latest 2026-11-06 10:15 UTC/);
    assert.match(html, /Recommended/);
    assert.match(html, />Use this RSS</);
    assert.match(html, />Cancel</);
    assert.match(html, /The feed responded with HTTP 404\. \(HTTP 404\)/);
    assert.equal((html.match(/Use this RSS/g) ?? []).length, 1, "invalid feeds cannot be used");
  });

  it("2. a working saved feed is never replaced silently", () => {
    const working = candidate({
      feedUrl: "https://news.example.org/current.xml",
      recommended: false,
    });
    const found = result({
      candidates: [recommended],
      recommendedFeedUrl: recommended.feedUrl,
      current: working,
    });
    assert.equal(replacesWorkingFeed(found, recommended), true);
    const html = render({ status: "done", result: found });
    assert.match(
      html,
      /Saved RSS URL: <code>https:\/\/news\.example\.org\/current\.xml<\/code> — working/,
    );
    assert.match(html, /The current RSS feed is working\. Using this feed replaces it\./);
    assert.match(html, />Replace working RSS</);
    assert.doesNotMatch(html, />Use this RSS</);

    const brokenCurrent = result({ candidates: [recommended], current: broken });
    assert.equal(replacesWorkingFeed(brokenCurrent, recommended), false);
    assert.match(
      render({ status: "done", result: brokenCurrent }),
      /not working: The feed responded with HTTP 404/,
    );
  });

  it("3. unsuccessful discovery shows the reason; loading and errors keep Cancel available", () => {
    const none = render({
      status: "done",
      result: result({
        status: "no_feed_advertised",
        message: "The website does not advertise an RSS or Atom feed.",
      }),
    });
    assert.match(none, /does not advertise an RSS or Atom feed/);
    assert.doesNotMatch(none, /Use this RSS/);
    assert.match(render({ status: "loading" }), /Looking for the RSS or Atom feed/);
    const error = render({ status: "error", message: "RSS discovery limit reached." });
    assert.match(error, /role="alert"/);
    assert.match(error, />Cancel</);
    assert.equal(
      describeDiscoveryCandidate(candidate({ valid: false, message: null, httpStatus: null })),
      "Not usable.",
    );
  });
});

describe("RSS-SOURCE-02C.1 — news section discovery panel", () => {
  const section = "https://news.example.org/world";
  const match = candidate({
    feedUrl: "https://news.example.org/world/rss",
    title: "World news",
    recommended: true,
    sectionMatch: "section_match",
    sectionEvidence: [
      "Feed URL path matches the section (“world”).",
      "Feed title mentions the section (“world”).",
      "9 of 10 sample articles are within the section.",
    ],
  });
  const general = candidate({
    feedUrl: "https://news.example.org/feed/",
    title: "Example News",
    sectionMatch: "general_feed",
    sectionEvidence: ["Feed URL path does not mention the section."],
  });
  const uncertain = candidate({
    feedUrl: "https://news.example.org/rss/world-latest.xml",
    sectionMatch: "uncertain",
  });
  const sectionResult = result({
    newsSectionUrl: section,
    discoveryPageUrl: section,
    message: "Section feed found. Review it and confirm to use it.",
    candidates: [match, uncertain, general],
    recommendedFeedUrl: match.feedUrl,
  });

  it("6. classification and evidence are shown; only section matches skip the warning", () => {
    assert.equal(needsSectionMismatchWarning(sectionResult, match), false);
    assert.equal(needsSectionMismatchWarning(sectionResult, uncertain), true);
    assert.equal(needsSectionMismatchWarning(sectionResult, general), true);
    assert.equal(
      needsSectionMismatchWarning(result({ candidates: [general] }), general),
      false,
      "website discovery",
    );
    const html = render({ status: "done", result: sectionResult });
    assert.match(
      html,
      /Checked news section page: <code>https:\/\/news\.example\.org\/world<\/code>/,
    );
    assert.match(html, />Section match</);
    assert.match(html, />Uncertain section match</);
    assert.match(html, />General feed</);
    assert.match(html, /9 of 10 sample articles are within the section\./);
    assert.equal(
      (
        html.match(
          /not confirmed as specific to the news section\. Unrelated news may appear\./g,
        ) ?? []
      ).length,
      2,
    );
  });

  it("7. no section feed: explained, nothing offered, Cancel available", () => {
    const html = render({
      status: "done",
      result: result({
        status: "no_feed_advertised",
        newsSectionUrl: section,
        discoveryPageUrl: section,
        message:
          "The news section page does not advertise an RSS or Atom feed. No section-specific feed was found; the main website was not checked.",
      }),
    });
    assert.match(html, /No section-specific feed was found; the main website was not checked\./);
    assert.doesNotMatch(html, /Use this RSS/);
    assert.match(html, />Cancel</);
  });
});

describe("RSS-SOURCE-02C — Media Resources wiring", () => {
  const section = readFileSync(path.join(dir, "components/AdminMediaResourcesSection.tsx"), "utf8");
  const api = readFileSync(path.join(dir, "admin-media-resources-api.ts"), "utf8");

  it("4. Discover RSS on the form and on NEWS_SOURCE rows; automatic discovery on website entry", () => {
    assert.equal((section.match(/>\s*Discover RSS\s*</g) ?? []).length, 2);
    assert.match(section, /onBlur=\{maybeAutoDiscover\}/);
    assert.match(section, /form\.rssUrl\?\.trim\(\)/, "auto discovery only when no RSS URL is set");
    assert.match(section, /resource\.resourceType === "NEWS_SOURCE" \? \(\s*<Button/);
  });

  it("5. confirmation: form fills the field only; rows confirm with the expected current URL", () => {
    assert.match(section, /setForm\(\(current\) => \(\{ \.\.\.current, rssUrl: feedUrl \}\)\)/);
    assert.match(section, /Save the form to apply it/);
    assert.match(section, /expectedCurrentRssUrl: resource\.rssUrl \?\? null/);
    assert.match(section, /window\.confirm\("The current RSS feed is working/);
    assert.match(section, /onCancel=\{\(\) => setDiscovery\(null\)\}/);
    assert.match(api, /\/news-sources\/discover-feed/);
    assert.match(api, /\/rss-feed\/confirm/);
  });

  it("8. News Section URL field: between Website and RSS, explained, drives discovery", () => {
    const website = section.indexOf("Website URL");
    const sectionField = section.indexOf("News Section URL (optional)");
    const rss = section.indexOf("RSS URL\n");
    assert.ok(website > 0 && sectionField > website && rss > sectionField);
    assert.match(
      section.replace(/\s+/g, " "),
      /Enter a specific news section URL \(e\.g\. World, Country or Politics\)\. Leave empty to use the main website\./,
    );
    assert.match(
      section,
      /return form\.newsSectionUrl\?\.trim\(\) \|\| form\.websiteUrl\.trim\(\);/,
    );
    assert.match(section, /newsSectionUrl: form\.newsSectionUrl\?\.trim\(\) \?\? ""/);
    assert.equal((section.match(/onBlur=\{maybeAutoDiscover\}/g) ?? []).length, 2);
  });

  it("9. changing the website or section invalidates form results; rows confirm with the section", () => {
    assert.match(section, /updateDiscoveryInput\("websiteUrl"/);
    assert.match(section, /updateDiscoveryInput\("newsSectionUrl"/);
    assert.match(
      section,
      /setDiscovery\(\(current\) => \(current\?\.target\.kind === "form" \? null : current\)\);\n {2}\}/,
    );
    assert.match(section, /expectedNewsSectionUrl: resource\.newsSectionUrl \?\? null/);
    assert.match(
      section,
      /acceptSectionMismatch &&\s*!window\.confirm\(`\$\{SECTION_MISMATCH_WARNING\} Use this feed anyway\?`\)/,
    );
  });
});
