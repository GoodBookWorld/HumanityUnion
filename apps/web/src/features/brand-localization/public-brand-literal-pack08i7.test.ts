/**
 * Pack 08I.7 — PUBLIC_BRAND_LITERAL_BYPASS=0 for mounted public catalogs.
 *
 * Brand presentation uses Brand Localization `{siteName}` ICU interpolation.
 * Terminology Glossary remains vocabulary-only (no runtime string substitution).
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

const PUBLIC_BRAND_NAMESPACES = [
  "publicGeo",
  "membershipPublic",
  "knowledgePublic",
  "blogPublic",
  "civicMediaPublic",
  "supportPublic",
  "contactPublic",
  "publicHome",
  "institutionsPublic",
  "worldInitiativesPublic",
  "publicNews",
] as const;

/** Allow-listed substrings that may still mention the English brand literally. */
const LITERAL_ALLOWLIST: RegExp[] = [
  /TEST/i,
  /legal/i,
  /canonical/i,
];

function collectHumanityUnionLiterals(
  messages: Record<string, unknown>,
  namespace: string,
): string[] {
  const hits: string[] = [];

  function walk(value: unknown, dotted: string): void {
    if (typeof value === "string") {
      if (value.includes("Humanity Union")) {
        const allowed = LITERAL_ALLOWLIST.some((re) => re.test(dotted) || re.test(value));
        if (!allowed) {
          hits.push(`${dotted}: ${value}`);
        }
      }
      return;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        walk(child, `${dotted}.${key}`);
      }
    }
  }

  const root = messages[namespace];
  if (root) {
    walk(root, namespace);
  }
  return hits;
}

describe("Pack 08I.7 — public brand literal + Knowledge presentation", () => {
  it("public catalog namespaces do not hardcode Humanity Union without {siteName}", async () => {
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const ns of PUBLIC_BRAND_NAMESPACES) {
        const hits = collectHumanityUnionLiterals(loaded.messages, ns);
        assert.equal(
          hits.length,
          0,
          `${locale}:${ns} still hardcodes Humanity Union:\n${hits.slice(0, 8).join("\n")}`,
        );
      }
    }
  });

  it("Join / Support style keys interpolate {siteName}", async () => {
    const en = await loadUiMessagesForLocale("en");
    const join = (en.messages as { publicGeo: { shared: { registration: { title: string } } } })
      .publicGeo.shared.registration.title;
    const support = (en.messages as { supportPublic: { title: string } }).supportPublic.title;
    const learn = (
      en.messages as { publicGeo: { shared: { registration: { learnAbout: string } } } }
    ).publicGeo.shared.registration.learnAbout;

    assert.match(join, /\{siteName\}/);
    assert.match(support, /\{siteName\}/);
    assert.match(learn, /\{siteName\}/);
    assert.doesNotMatch(join, /Humanity Union/);
    assert.doesNotMatch(support, /Humanity Union/);
  });

  it("published Ukrainian siteName interpolates into catalog sentences (Союз Людяності)", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const titleTemplate = (uk.messages as { supportPublic: { title: string } }).supportPublic
      .title;
    assert.match(titleTemplate, /\{siteName\}/);

    const publishedUkSiteName = "Союз Людяності";
    const displayed = titleTemplate.replaceAll("{siteName}", publishedUkSiteName);
    assert.match(displayed, /Союз Людяності/);
    assert.doesNotMatch(displayed, /Humanity Union/);
    assert.doesNotMatch(displayed, /\{siteName\}/);

    // Terminology Glossary is not applied as a global string rewriter on this path.
    assert.notEqual(publishedUkSiteName, "Humanity Union");
  });

  it("Join/Support mounted components pass siteName from useLocalizedBrand", () => {
    const support = readWeb("features/support/components/SupportPageContent.tsx");
    const regEvidence = readWeb(
      "features/public-experience/components/RegistrationGatewayEvidence.tsx",
    );
    const regSection = readWeb(
      "features/public-experience/components/RegistrationGatewaySection.tsx",
    );
    const membershipHero = readWeb("features/membership/components/MembershipHero.tsx");

    assert.match(support, /useLocalizedBrand/);
    assert.match(support, /t\("title",\s*siteName\)/);
    assert.match(regEvidence, /useLocalizedBrand/);
    assert.match(regEvidence, /learnAbout.*siteName|siteName.*learnAbout/);
    assert.match(regSection, /t\("title",\s*siteName\)/);
    assert.match(membershipHero, /useLocalizedBrand/);
    assert.match(membershipHero, /hero\.title.*siteName|siteName.*hero\.title/);
  });

  it("Knowledge helpers + mounted pages resolve taxonomy from catalogs", () => {
    const helper = readWeb("features/knowledge-center/resolve-knowledge-presentation.ts");
    const index = readWeb("features/knowledge-center/components/KnowledgeCenterPageContent.tsx");
    const sidebar = readWeb("features/knowledge-center/components/KnowledgeSidebar.tsx");
    const search = readWeb("features/knowledge-center/components/KnowledgeSearchPanel.tsx");
    const article = readWeb("features/knowledge-center/components/KnowledgeArticlePageContent.tsx");

    assert.match(helper, /resolveKnowledgeCategoryPresentation/);
    assert.match(helper, /resolveKnowledgeArticleTitle/);
    assert.match(helper, /EXPECTED_TRANSLATION_FALLBACK/);
    assert.match(index, /resolveKnowledgeCategoryPresentation/);
    assert.match(index, /resolveKnowledgeArticleTitle/);
    assert.match(index, /useLocalizedBrand/);
    assert.match(sidebar, /resolveKnowledgeCategoryPresentation/);
    assert.match(sidebar, /resolveKnowledgeArticleTitle/);
    assert.match(search, /resolveKnowledgeArticleTitle|EXPECTED_TRANSLATION_FALLBACK/);
    assert.match(article, /resolveKnowledgeArticleField/);
    assert.match(article, /resolveKnowledgeExplanationSection/);
  });

  it("knowledgePublic catalogs cover categories + article titles", async () => {
    const categoryIds = [
      "getting-started",
      "explanations",
      "institutions-experience",
      "guides",
      "constitution",
      "glossary",
      "faq",
    ] as const;

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      const knowledge = (loaded.messages as { knowledgePublic: Record<string, unknown> })
        .knowledgePublic;
      const categories = knowledge.categories as Record<string, { title: string; description: string }>;
      const articles = knowledge.articles as Record<string, { title: string }>;

      for (const id of categoryIds) {
        assert.equal(typeof categories[id]?.title, "string", `${locale}:categories.${id}.title`);
        assert.equal(
          typeof categories[id]?.description,
          "string",
          `${locale}:categories.${id}.description`,
        );
      }

      assert.ok(Object.keys(articles).length >= 50, `${locale}: expected article title catalog`);
      const whatIsTitle = articles["what-is-humanity-union"]?.title;
      assert.equal(typeof whatIsTitle, "string");
      assert.match(whatIsTitle as string, /\{siteName\}/);
    }
  });

  it("public layout does not scan Terminology Glossary for runtime substitution", () => {
    const layout = readWeb("app/layout.tsx");
    const publicFooter = readWeb("features/public-experience/components/PublicExperienceFooter.tsx");
    const header = readWeb("design-system/components/HumanityHeader.tsx");

    assert.doesNotMatch(layout, /terminology-glossary|TerminologyGlossary|scanGlossary|applyGlossary/i);
    assert.doesNotMatch(
      publicFooter,
      /terminology-glossary|TerminologyGlossary|scanGlossary|applyGlossary/i,
    );
    assert.doesNotMatch(header, /terminology-glossary|TerminologyGlossary|scanGlossary|applyGlossary/i);
    assert.match(header, /useLocalizedBrand/);
  });

  it("catalog parity remains intact across en/uk/zh-Hant/ar", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    const en = await loadUiMessagesForLocale("en");
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });
});
