/**
 * Pack 08I.12 — Live localization regression recovery (route/runtime integrity).
 *
 * Proves production-like wiring for Media availability, compact Initiative cards,
 * generation-after-SSR-seed lifecycle, Blog author-name invariant, and footer UI.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolvePublicContentReadingFromProbe } from "../language/public-content-reading-probe.js";
import {
  shouldAttemptOnDemandContentTranslation,
  classifyResolvedTranslationPhase,
} from "../language/public-translation-presentation-lifecycle.js";
import { resolveInitiativeCardPresentation } from "../public-initiative-mini-card/resolve-initiative-card-presentation.js";
import { resolveBlogPostPresentation } from "../blog/resolve-blog-post-presentation.js";
import { resolveInitiativeDetailPresentation } from "../public-initiative-experience/resolve-initiative-detail-presentation.js";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, rel), "utf8");
}

describe("Pack 08I.12 — Media availability (P0)", () => {
  it("SSR seed failure must not null media or skip client recovery", () => {
    const page = readWeb("app/media/page.tsx");
    const content = readWeb(
      "features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
    );

    assert.match(page, /initialMedia = undefined/);
    assert.doesNotMatch(page, /initialMedia = null/);
    assert.match(page, /if \(initialMedia\)/);
    assert.match(page, /loadCivicMediaEditorialSeed/);

    assert.match(content, /hasServerPayload/);
    assert.match(content, /fetchCivicMediaCenter/);
    assert.doesNotMatch(content, /seeded && initialMedia === null/);
    assert.doesNotMatch(content, /initialMedia\?:\s*CivicMediaCenterPublic\s*\|\s*null/);
  });

  it("editorial seed failure returns canonical and does not gate page", () => {
    const seed = readWeb("features/civic-media-center/load-civic-media-editorial-seed.ts");
    assert.match(seed, /return canonical/);
    assert.match(seed, /catch \{/);
    assert.doesNotMatch(seed, /throw /);
  });
});

describe("Pack 08I.12 — Compact Initiative cards (no description)", () => {
  it("mounted compact cards do not render summary/description body", () => {
    const mini = readWeb("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    const world = readWeb("features/initiatives/components/WorldInitiativesPageContent.tsx");
    const country = readWeb(
      "features/country-experience/components/CountryInitiativeRailCard.tsx",
    );
    const latest = readWeb("features/public-experience/components/LatestInitiativeCard.tsx");

    for (const src of [mini, world, country, latest]) {
      assert.match(src, /resolveInitiativeCardPresentation/);
      assert.doesNotMatch(src, /className="[^"]*__summary"/);
    }

    assert.match(mini, /public-initiative-mini-card__title/);
    assert.match(mini, /public-initiative-mini-card__badge-row/);
    assert.match(mini, /public-initiative-mini-card__meta/);
    assert.match(mini, /public-initiative-mini-card__cta/);
  });
});

describe("Pack 08I.12 — Reading context + generation lifecycle", () => {
  it("unauthenticated prefs unavailable → preferred + interface locale (no deadlock)", () => {
    const resolved = resolvePublicContentReadingFromProbe({
      authStatus: "unauthenticated",
      outcome: { kind: "unavailable" },
      interfaceLocale: "uk",
    });
    assert.equal(resolved.translationPreference, "preferred");
    assert.equal(resolved.readingLanguage, "uk");
  });

  it("canonical SSR seed does not block on-demand generate", () => {
    assert.equal(
      shouldAttemptOnDemandContentTranslation({
        ready: true,
        translationPreference: "preferred",
        readingLanguage: "uk",
        resolvePresentationMode: "original",
        originalLanguage: "en",
        isStale: false,
      }),
      true,
    );
    assert.equal(
      shouldAttemptOnDemandContentTranslation({
        ready: true,
        translationPreference: "none",
        readingLanguage: "uk",
        resolvePresentationMode: "original",
        originalLanguage: "en",
      }),
      false,
    );
  });

  it("EXISTING UK initiative translation → card + detail presentation values", async () => {
    const ukTitle = "Українська назва ініціативи";
    const ukDescription = "Український опис";

    const card = await resolveInitiativeCardPresentation(
      {
        initiativeId: "init-08i12",
        canonical: { title: "English Title", summary: "English Summary" },
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () => ({
          presentationMode: "preferred_translation",
          content: { title: ukTitle, description: ukDescription },
          activeLanguage: "uk",
          originalLanguage: "en",
          originalContent: { title: "English Title", description: "English Summary" },
          isMachineTranslated: true,
          isStale: false,
          canViewOriginal: true,
          canViewTranslation: true,
          translation: null,
        }),
        generateContentTranslation: async () => {
          throw new Error("must not generate when warm exists");
        },
      },
    );
    assert.equal(card.title, ukTitle);
    assert.equal(card.presentationMode, "translated");

    const detail = await resolveInitiativeDetailPresentation(
      {
        initiativeId: "init-08i12",
        canonical: { title: "English Title", description: "English Summary" },
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () => ({
          presentationMode: "preferred_translation",
          content: { title: ukTitle, description: ukDescription },
          activeLanguage: "uk",
          originalLanguage: "en",
          originalContent: { title: "English Title", description: "English Summary" },
          isMachineTranslated: true,
          isStale: false,
          canViewOriginal: true,
          canViewTranslation: true,
          translation: null,
        }),
        generateContentTranslation: async () => {
          throw new Error("must not generate when warm exists");
        },
      },
    );
    assert.equal(detail.title, ukTitle);
    assert.equal(detail.description, ukDescription);

    assert.equal(
      classifyResolvedTranslationPhase({
        requested: true,
        presentationMode: "preferred_translation",
        displayedTranslated: true,
      }),
      "TRANSLATION_DISPLAYED",
    );
  });

  it("cache miss after preferred → generation attempted (deadlock=0)", async () => {
    let generated = false;
    const presented = await resolveBlogPostPresentation(
      {
        postId: "post-08i12",
        canonical: {
          title: "EN title",
          excerpt: "EN excerpt",
          contentHtml: "<p>EN</p>",
        },
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () => ({
          presentationMode: "original",
          content: {},
          activeLanguage: "en",
          originalLanguage: "en",
          originalContent: {},
          isMachineTranslated: false,
          isStale: false,
          canViewOriginal: false,
          canViewTranslation: false,
          translation: null,
        }),
        generateContentTranslation: async () => {
          generated = true;
          return {
            generated: true,
            display: {
              presentationMode: "preferred_translation",
              content: {
                title: "UK title",
                excerpt: "UK excerpt",
                content: "<p>UK</p>",
              },
              activeLanguage: "uk",
              originalLanguage: "en",
              originalContent: {
                title: "EN title",
                excerpt: "EN excerpt",
                content: "<p>EN</p>",
              },
              isMachineTranslated: true,
              isStale: false,
              canViewOriginal: true,
              canViewTranslation: true,
              translation: null,
            },
          };
        },
      },
    );
    assert.equal(generated, true);
    assert.equal(presented.title, "UK title");
    assert.equal(presented.contentHtml, "<p>UK</p>");
  });
});

describe("Pack 08I.12 — Blog author identity + surfaces", () => {
  it("author proper names are not machine-translated; titles use shared presentation", () => {
    const authors = readWeb("features/blog/components/BlogAuthorsSidebar.tsx");
    const card = readWeb("features/blog/components/BlogPostCard.tsx");
    const latest = readWeb("features/blog/components/BlogLatestMiniCards.tsx");
    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");

    assert.match(authors, /displayName/);
    assert.match(authors, /resolveBlogPostPresentation/);
    assert.match(card, /resolveBlogPostPresentation/);
    assert.match(latest, /resolveBlogPostPresentation/);
    assert.match(article, /resolveBlogPostPresentation/);
    assert.match(article, /initialPresentation/);
  });
});

describe("Pack 08I.12 / 08I.13 — Discussion comments ownership", () => {
  it("discussion comments use content_translations body presentation (public-eligible)", () => {
    const panel = readWeb(
      "features/public-initiative-experience/components/PublicDiscussionPanel.tsx",
    );
    assert.match(panel, /resolveDiscussionCommentPresentation/);
    assert.match(panel, /originalLanguageNote/);

    const eligibility = readFileSync(
      path.resolve(webRoot, "../../api/src/modules/language/content-translation-eligibility.ts"),
      "utf8",
    );
    assert.match(eligibility, /discussion_comment:\s*\[\s*"body"\s*\]/);
    assert.doesNotMatch(
      eligibility,
      /CONTENT_TRANSLATION_PRIVACY_EXCLUSIONS[\s\S]*"discussion_comment"/,
    );
  });
});

describe("Pack 08I.12 — Footer UI residual", () => {
  it("footer copyright uses localized navigation.footerCopyright ICU", () => {
    const footer = readWeb(
      "features/public-experience/components/PublicExperienceFooter.tsx",
    );
    assert.match(footer, /footerCopyright/);
    assert.doesNotMatch(footer, /All rights reserved\./);

    const en = JSON.parse(readWeb("features/i18n/messages/en.json")) as {
      navigation: { footerCopyright: string };
    };
    assert.match(en.navigation.footerCopyright, /All rights reserved/);
  });
});
