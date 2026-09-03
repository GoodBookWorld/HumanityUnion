/**
 * Pack 08I.4 — Membership / Support / Contact / Blog chrome catalogs + wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readNested(messages: Record<string, unknown>, dottedPath: string): string {
  const parts = dottedPath.split(".");
  let cursor: unknown = messages;
  for (const part of parts) {
    assert.ok(cursor && typeof cursor === "object" && !Array.isArray(cursor), dottedPath);
    cursor = (cursor as Record<string, unknown>)[part];
  }
  assert.equal(typeof cursor, "string", dottedPath);
  return cursor as string;
}

const PACK08I4_KEYS = [
  "membershipPublic.pageTitle",
  "membershipPublic.hero.title",
  "membershipPublic.signIn.login",
  "membershipPublic.meaning.cards.community.title",
  "membershipPublic.notMeans.items.citizenship",
  "membershipPublic.benefits.items.member-badge.title",
  "membershipPublic.faq.items.voting-power.question",
  "supportPublic.title",
  "supportPublic.donate.cta",
  "supportPublic.volunteer.noteSoon",
  "supportPublic.why.heading",
  "supportPublic.forms.chooseCta",
  "contactPublic.pageTitle",
  "contactPublic.subjects.general.label",
  "contactPublic.subjects.technical.subject",
  "contactPublic.successChrome",
  "contactPublic.errorUnavailable",
  "blogPublic.pageTitle",
  "blogPublic.publicationsHeading",
  "blogPublic.empty",
  "blogPublic.backToBlog",
  "blogPublic.updated",
  "blogPublic.noComments",
  "blogPublic.bodyTranslationNote",
  "legalPublic.privacy.title",
  "legalPublic.terms.counselNote",
  "legalPublic.nav.privacy",
  "legalPublic.expectedFallbackNote",
  "knowledgePublic.article.purpose",
  "knowledgePublic.article.overview",
] as const;

describe("Pack 08I.4 — membership/support/contact/blog chrome catalogs", () => {
  it("catalog parity includes Pack 08I.4 keys across en/uk/zh-Hant/ar", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of PACK08I4_KEYS) {
        assert.equal(typeof readNested(loaded.messages, key), "string", `${locale}:${key}`);
      }
    }

    const en = await loadUiMessagesForLocale("en");
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });

  it("Membership public chrome uses membershipPublic catalogs", () => {
    const page = readWeb("features/membership/components/MembershipPageContent.tsx");
    const hero = readWeb("features/membership/components/MembershipHero.tsx");
    const meaning = readWeb("features/membership/components/MembershipMeaningCards.tsx");
    const benefits = readWeb("features/membership/components/MembershipBenefitsGrid.tsx");
    const faq = readWeb("features/membership/components/MembershipFaqAccordion.tsx");
    const notMeans = readWeb("features/membership/components/MembershipNotMeans.tsx");
    const constants = readWeb("features/membership/membership.constants.ts");

    assert.match(page, /useTranslations\("membershipPublic"\)/);
    assert.match(hero, /useTranslations\("membershipPublic"\)/);
    assert.match(meaning, /MEMBERSHIP_MEANING_CARD_IDS/);
    assert.match(benefits, /MEMBERSHIP_BENEFIT_IDS/);
    assert.match(faq, /MEMBERSHIP_FAQ_IDS/);
    assert.match(notMeans, /MEMBERSHIP_NOT_MEANS_IDS/);
    assert.doesNotMatch(hero, /MEMBERSHIP_HERO\.title/);
    assert.match(constants, /MEMBERSHIP_CONTRIBUTION_AMOUNT = "1 CAD"/);
    assert.match(constants, /price: "CA\$28"/);
  });

  it("Support public chrome uses supportPublic; donation URLs stay in constants", () => {
    const support = readWeb("features/support/components/SupportPageContent.tsx");
    const constants = readWeb("features/support/support.constants.ts");

    assert.match(support, /useTranslations\("supportPublic"\)/);
    assert.match(support, /useLocalizedBrand/);
    assert.match(support, /t\("title",\s*siteName\)/);
    assert.match(support, /t\("donate\.cta"\)/);
    assert.doesNotMatch(support, />Support Humanity Union</);
    assert.match(constants, /SUPPORT_DONATE_URL/);
    assert.match(constants, /buy\.stripe\.com/);
    assert.match(constants, /SUPPORT_REGIONAL_PROGRAM_URL/);
  });

  it("Contact page uses contactPublic catalogs and subject ids", () => {
    const contact = readWeb("app/contact/page.tsx");
    const constants = readWeb("features/public-experience/contact.constants.ts");

    assert.match(contact, /getTranslations\("contactPublic"\)/);
    assert.match(contact, /CONTACT_SUBJECT_IDS/);
    assert.match(contact, /subjects\.\$\{id\}\.label/);
    assert.doesNotMatch(contact, /General Inquiries/);
    assert.match(constants, /CONTACT_SUBJECT_IDS/);
  });

  it("Blog index/article chrome use blogPublic; title/body resolve via shared presentation helper", () => {
    const index = readWeb("features/blog/components/BlogIndexPageContent.tsx");
    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    const card = readWeb("features/blog/components/BlogPostCard.tsx");
    const resolver = readWeb("features/blog/resolve-blog-post-presentation.ts");

    assert.match(index, /useTranslations\("blogPublic"\)/);
    assert.match(index, /t\("pageTitle"\)/);
    assert.match(index, /t\("publicationsHeading"\)/);
    assert.match(article, /useTranslations\("blogPublic"\)/);
    assert.match(article, /resolveBlogPostPresentation/);
    assert.match(article, /BlogArticleBody html=\{bodyHtml\}/);
    assert.match(card, /resolveBlogPostPresentation/);
    assert.match(resolver, /sourceKind:\s*"blog_post"/);
    assert.doesNotMatch(article, /import\s*\{[^}]*TranslatedContentView/);
    assert.doesNotMatch(article, /<TranslatedContentView/);
    assert.match(article, /t\("backToBlog"\)/);
    assert.match(article, /t\("updated"/);
  });
});
