/**
 * HU-UX-01B — public Author Publications widget and 30px heading icons.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  authorPublicationScrollMaxPx,
  mergeAuthorPublicationCards,
  shouldLoadMoreAuthorPublications,
} from "./author-publications-list.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const repoRoot = path.resolve(webSrc, "../../..");
const locales = ["en", "uk", "de", "fr", "es", "pt", "ar", "he", "ka", "zh-Hant"] as const;
const keys = [
  ["sections", "authorPublications"],
  ["authorPublications", "loading"],
  ["authorPublications", "loadError"],
  ["authorPublications", "loadMore"],
] as const;

function read(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("HU-UX-01B author publications widget", () => {
  it("places a closed disclosure under initiatives and hides it without public posts", () => {
    const surface = read("features/member-profile/components/ParticipantProfileSurface.tsx");
    const initiativesAt = surface.indexOf("<RecentPublicInitiativesDisclosure");
    const authorAt = surface.indexOf("<AuthorPublicationsDisclosure");
    assert.ok(initiativesAt > 0 && authorAt > initiativesAt);
    assert.match(surface, /profile\.hasPublicAuthorPublications \?/);
    assert.match(surface, /key=\{`\$\{profile\.publicName\}:\$\{locale\}`\}/);
    assert.match(surface, /width=\{30\}/);
    assert.match(surface, /height=\{30\}/);

    const widget = read("features/member-profile/components/AuthorPublicationsDisclosure.tsx");
    assert.match(widget, /useState\(false\)/);
    assert.match(widget, /aria-expanded=\{open\}/);
    assert.match(widget, /aria-controls=\{panelId\}/);
    assert.match(widget, /type="button"/);
    assert.match(widget, /\/icons\/workspace\/author\.svg/);
    assert.match(widget, /buildPublicBlogPostHref\(post\.slug\)/);
    assert.match(widget, /<Link/);
    assert.doesNotMatch(widget, /archiveBlogPost|discardUnpublishedBlogDraft|Edit \/ Correct|View Public|Preview/);
    assert.match(widget, /fetchPublicAuthorPublications/);
    assert.match(widget, /if \(!open\)/);
    assert.match(widget, /loadedSubjectRef\.current === subjectKey/);
    assert.match(widget, /pendingRef\.current/);
    assert.match(widget, /onScroll=\{onScroll\}/);
    assert.doesNotMatch(widget, /window\.addEventListener\("scroll"/);
    assert.doesNotMatch(widget, /scrollTop\s*=/);
    assert.match(widget, /authorPublications\.loadError/);
    assert.match(widget, /tCommon\("retry"\)/);
    assert.match(widget, /phase === "empty"/);
    assert.match(widget, /formatBlogPublishedDate\(post\.publishedAt, locale\)/);
    assert.match(widget, /useHuPersistedOrdinaryFields/);
    assert.match(widget, /fieldOrder: \["title"\]/);
  });

  it("sizes heading icons at 30px and scrolls about two and a half cards", () => {
    const css = read("features/member-profile/components/participant-profile-surface.css");
    const iconRule = css.slice(
      css.indexOf(".public-member-page__heading-icon {"),
      css.indexOf("}", css.indexOf(".public-member-page__heading-icon {")) + 1,
    );
    assert.match(iconRule, /width:\s*30px/);
    assert.match(iconRule, /height:\s*30px/);
    assert.match(iconRule, /flex-shrink:\s*0/);
    assert.match(iconRule, /object-fit:\s*contain/);
    assert.match(css, /overscroll-behavior:\s*contain/);
    assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.public-author-publication-card/);
    assert.match(css, /margin-block-start:\s*0\.75rem/);
    const initiatives = read("features/member-profile/components/RecentPublicInitiativesDisclosure.tsx");
    assert.match(initiatives, /width=\{30\}/);
    assert.match(initiatives, /height=\{30\}/);

    assert.equal(authorPublicationScrollMaxPx([100, 80], 2), null);
    assert.equal(authorPublicationScrollMaxPx([100, 120], 3), 300);
    assert.equal(
      shouldLoadMoreAuthorPublications({
        scrollTop: 200,
        clientHeight: 100,
        scrollHeight: 280,
        hasMore: true,
        pending: false,
      }),
      true,
    );
    assert.equal(
      shouldLoadMoreAuthorPublications({
        scrollTop: 0,
        clientHeight: 100,
        scrollHeight: 400,
        hasMore: true,
        pending: false,
      }),
      false,
    );
    assert.equal(
      shouldLoadMoreAuthorPublications({
        scrollTop: 300,
        clientHeight: 100,
        scrollHeight: 300,
        hasMore: true,
        pending: true,
      }),
      false,
    );
    assert.equal(
      shouldLoadMoreAuthorPublications({
        scrollTop: 300,
        clientHeight: 100,
        scrollHeight: 300,
        hasMore: false,
        pending: false,
      }),
      false,
    );
    const merged = mergeAuthorPublicationCards(
      [{ postId: "a" }, { postId: "b" }],
      [{ postId: "b" }, { postId: "c" }],
    );
    assert.deepEqual(merged.map((item) => item.postId), ["a", "b", "c"]);
  });

  it("keeps new keys in WEB and API catalogs and preserves draft deletion keys", () => {
    for (const locale of locales) {
      const web = JSON.parse(
        readFileSync(path.join(webSrc, "features/i18n/messages", `${locale}.json`), "utf8"),
      ) as {
        participantPublic: {
          sections: { authorPublications?: string };
          authorPublications?: { loading?: string; loadError?: string; loadMore?: string };
        };
        workspace: { publishingPage: Record<string, string> };
      };
      const api = JSON.parse(
        readFileSync(
          path.join(repoRoot, "apps/api/assets/packaged-web-ui-catalogs", `${locale}.json`),
          "utf8",
        ),
      ) as typeof web;
      for (const [group, key] of keys) {
        const webValue =
          group === "sections"
            ? web.participantPublic.sections.authorPublications
            : web.participantPublic.authorPublications?.[key as "loading"];
        const apiValue =
          group === "sections"
            ? api.participantPublic.sections.authorPublications
            : api.participantPublic.authorPublications?.[key as "loading"];
        assert.equal(typeof webValue, "string");
        assert.equal(webValue, apiValue);
        assert.equal(String(webValue).includes("{"), false);
      }
      for (const key of [
        "draftDeleteTitle",
        "draftDeleteBody",
        "draftDeleteConfirm",
        "draftDeletedTitle",
        "draftDeleted",
        "deleteBody",
      ]) {
        assert.equal(web.workspace.publishingPage[key], api.workspace.publishingPage[key]);
      }
    }
    const english = JSON.parse(read("features/i18n/messages/en.json")) as {
      participantPublic: { sections: { authorPublications: string } };
      workspace: { publishingPage: { deleteBody: string } };
      common: { retry: string };
    };
    assert.match(english.workspace.publishingPage.deleteBody, /archived/);
    assert.equal(english.participantPublic.sections.authorPublications, "Author Publications");
    assert.equal(english.common.retry, "Try again");
  });
});
