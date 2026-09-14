/**
 * Reset 03E — Media PLP semantic coverage (no live ops).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { CivicMediaCenterPublic, TrustedMediaResource } from "@hu/types";
import { MEDIA_PLP_ENTITY_TYPE, PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import { applyMediaPlpPresentationsToEditorial } from "./apply-media-plp-editorial.js";
import {
  isMediaPlpWebEnabled,
  setMediaPlpWebEnabledForTests,
} from "./feature-flag.js";
import {
  assertMediaSemanticCoverageComplete,
  formatMediaSemanticCoverageReport,
  MEDIA_SEMANTIC_INVENTORY,
  summarizeMediaSemanticCoverage,
} from "./media-semantic-inventory.js";
import { MEDIA_PLP_LOCALE_SWITCH_POST_FIX_TOPOLOGY } from "./media-plp-locale-switch-perf.js";

const webSrc = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const repoRoot = join(webSrc, "../../..");

afterEach(() => {
  setMediaPlpWebEnabledForTests(null);
});

const reuters: TrustedMediaResource = {
  id: "reuters",
  name: "Reuters",
  logoLabel: "R",
  country: "International",
  categoryId: "international-wire-service",
  explanation: "Independent international news agency with global editorial standards.",
  websiteUrl: "https://www.reuters.com/",
  sortOrder: 1,
};

function sampleMedia(): CivicMediaCenterPublic {
  return {
    overview: {
      title: "Overview title",
      summary: "Overview summary",
      points: [{ id: "p1", heading: "H1", body: "B1" }],
    },
    selectionPrinciples: [
      {
        id: "editorial-transparency",
        title: "Independence",
        description: "Desc",
        sortOrder: 1,
      },
    ],
    trustedMediaCategories: [
      {
        id: "international-wire-service",
        title: "Wire",
        description: "Wire services",
        sortOrder: 1,
      },
    ],
    trustedMedia: [reuters],
    factChecking: [],
    propagandaAnalysis: [],
    faq: [{ id: "faq-1", question: "Q1?", answer: "A1", sortOrder: 1 }],
    initiativeFlow: {
      title: "Flow",
      summary: "Summary",
      diagramSvg: "",
      stages: ["One", "Two"],
    },
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("Reset 03E — Media semantic coverage", () => {
  it("coverage detector: UNOWNED_FIELDS=0 (inventory only — not render authority; see 03E.1)", () => {
    const report = assertMediaSemanticCoverageComplete();
    assert.equal(report.UNOWNED_FIELDS, 0);
    assert.ok(report.MEDIA_SEMANTIC_FIELDS_TOTAL >= 30);
    // 03E.1: inventory completeness ≠ localized render. Render gates live in reset03e1.
    assert.ok(report.PLP_FIELDS >= 1);
    assert.ok(report.UI_DICTIONARY_FIELDS >= 1);
    const formatted = formatMediaSemanticCoverageReport(report);
    assert.match(formatted, /UNOWNED_FIELDS=0/);
    assert.equal(summarizeMediaSemanticCoverage().unownedIds.length, 0);
  });

  it("inventory classifies every major Media section", () => {
    const sections = new Set(MEDIA_SEMANTIC_INVENTORY.map((f) => f.section));
    for (const required of [
      "overview",
      "initiative-flow",
      "news",
      "selection-principles",
      "trusted-media",
      "fact-checking",
      "propaganda-analysis",
      "faq",
      "knowledge",
      "controls",
      "states",
    ]) {
      assert.ok(sections.has(required as never), `missing section ${required}`);
    }
  });

  it("editorial PLP applies overview + FAQ without mixing entities", () => {
    const media = sampleMedia();
    const editorial = applyMediaPlpPresentationsToEditorial({
      media,
      trustedById: {
        reuters: {
          mode: "PUBLISHED_LOCALIZED",
          presentation: { explanation: "UK explanation" },
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
          entityId: "reuters",
          locale: "uk",
          canonicalVersion: "v1",
        },
      },
      principlesById: {
        "editorial-transparency": {
          mode: "CANONICAL_FALLBACK",
          presentation: {
            title: "Independence",
            description: "Desc",
          },
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
          entityId: "editorial-transparency",
          locale: "uk",
          canonicalVersion: "canonical",
        },
      },
      editorialPresentation: {
        mode: "PUBLISHED_LOCALIZED",
        presentation: {
          overviewTitle: "UK Overview",
          overviewSummary: "UK Summary",
          overviewPoints: [{ id: "p1", heading: "UK H1", body: "UK B1" }],
          faq: [{ id: "faq-1", question: "UK Q1?", answer: "UK A1" }],
        },
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId: "civic-media-center",
        locale: "uk",
        canonicalVersion: "v1",
      },
      requestedLocale: "uk",
    });
    assert.equal(editorial.overview.title, "UK Overview");
    assert.equal(editorial.faq[0]?.question, "UK Q1?");
    assert.equal(editorial.trustedExplanationsById.reuters, "UK explanation");
    // Principle stayed canonical (no mix with editorial fields).
    assert.equal(editorial.selectionPrinciples[0]?.title, "Independence");
  });

  it("schema version bumped to PLP.2; reuters/uk may be schema-stale until rematerialized", () => {
    assert.equal(PUBLISHED_LOCALIZATION_SCHEMA_VERSION, "PLP.2");
    const types = readFileSync(
      join(repoRoot, "packages/types/src/domain/media-plp-identities.ts"),
      "utf8",
    );
    assert.match(types, /CIVIC_MEDIA_EDITORIAL/);
    const ledger = readFileSync(
      join(
        repoRoot,
        "project/architecture/core/PUBLISHED_LOCALIZATION_LEGACY_REMOVAL_LEDGER_v1.0.md",
      ),
      "utf8",
    );
    assert.match(ledger, /schema-stale|PLP\.2|03E/i);
  });

  it("combined page resolve includes editorial; still one HTTP batch topology", () => {
    const page = readFileSync(join(webSrc, "app/media/page.tsx"), "utf8");
    assert.match(page, /composeMediaPageLocalization/);
    assert.match(page, /plpEditorialPresentation/);
    assert.equal(MEDIA_PLP_LOCALE_SWITCH_POST_FIX_TOPOLOGY.mediaPlpResolveHttpPosts, 1);
    const compose = readFileSync(
      join(webSrc, "features/language/media-plp/compose-media-page-localization.ts"),
      "utf8",
    );
    assert.match(compose, /loadMediaPlpPagePresentations/);
    const loader = readFileSync(
      join(webSrc, "features/language/media-plp/load-media-plp-ssr.ts"),
      "utf8",
    );
    assert.match(loader, /CIVIC_MEDIA_EDITORIAL/);
    assert.match(loader, /resolveMediaPlpBatch/);
  });

  it("UI chrome uses dictionary; no hardcoded rail English", () => {
    const controls = readFileSync(
      join(webSrc, "features/civic-media-center/media-rail/MediaRailControls.tsx"),
      "utf8",
    );
    assert.match(controls, /civicMediaPublic\.rail/);
    assert.doesNotMatch(controls, /Previous \$\{/);
    const viewport = readFileSync(
      join(webSrc, "features/civic-media-center/media-rail/MediaRailViewport.tsx"),
      "utf8",
    );
    assert.match(viewport, /t\("showing"/);
    assert.doesNotMatch(viewport, /Showing \{/);
    const stage = readFileSync(
      join(webSrc, "features/horizontal-experience/HuxWorkflowStage.tsx"),
      "utf8",
    );
    assert.match(stage, /stageOf/);
    assert.doesNotMatch(stage, /Stage \{index/);
  });

  it("Media PLP path disables news generate-on-read", () => {
    const pageContent = readFileSync(
      join(webSrc, "features/civic-media-center/components/CivicMediaCenterPageContent.tsx"),
      "utf8",
    );
    assert.match(pageContent, /disableOnDemandTranslation=\{plpMode/);
    const hook = readFileSync(
      join(webSrc, "features/public-news/use-localized-public-news-card.ts"),
      "utf8",
    );
    assert.match(hook, /skipClientTranslation/);
  });

  it("default Web flag remains ON (Reset 01)", () => {
    setMediaPlpWebEnabledForTests(null);
    assert.equal(isMediaPlpWebEnabled(), true);
  });

  it("uk/zh-Hant/ar UI dictionary owns Media chrome keys; no orphan English labels", () => {
    const requiredPaths = [
      ["civicMediaPublic", "metaTitle"],
      ["civicMediaPublic", "metaDescription"],
      ["civicMediaPublic", "logoAlt"],
      ["civicMediaPublic", "trustedCategoriesTablist"],
      ["civicMediaPublic", "rail", "previous"],
      ["civicMediaPublic", "rail", "next"],
      ["civicMediaPublic", "rail", "showing"],
      ["civicMediaPublic", "pipeline", "stageOf"],
    ] as const;

    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const messages = JSON.parse(
        readFileSync(join(webSrc, `features/i18n/messages/${locale}.json`), "utf8"),
      ) as Record<string, unknown>;
      const en = JSON.parse(
        readFileSync(join(webSrc, "features/i18n/messages/en.json"), "utf8"),
      ) as Record<string, unknown>;
      for (const path of requiredPaths) {
        let cursor: unknown = messages;
        let enCursor: unknown = en;
        for (const part of path) {
          assert.ok(
            cursor && typeof cursor === "object" && part in (cursor as object),
            `${locale} missing ${path.join(".")}`,
          );
          cursor = (cursor as Record<string, unknown>)[part];
          enCursor = (enCursor as Record<string, unknown>)[part];
        }
        assert.equal(typeof cursor, "string");
        assert.notEqual(
          cursor,
          enCursor,
          `${locale} ${path.join(".")} must not remain English`,
        );
      }
    }
  });

  it("PLP-owned fields use whole-entity presentation or complete canonical fallback (no mix)", () => {
    const media = sampleMedia();
    const mixedForbidden = applyMediaPlpPresentationsToEditorial({
      media,
      trustedById: {},
      principlesById: {},
      editorialPresentation: {
        mode: "CANONICAL_FALLBACK",
        presentation: {
          overviewTitle: "Partial only — must not apply",
        },
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId: "civic-media-center",
        locale: "uk",
        canonicalVersion: "canonical",
      },
      requestedLocale: "uk",
    });
    // Fail-closed: CANONICAL_FALLBACK keeps whole canonical overview (no partial mix).
    assert.equal(mixedForbidden.overview.title, media.overview.title);
    assert.equal(mixedForbidden.faq[0]?.question, media.faq[0]?.question);
  });

  it("read path stays free of provider/materializer", () => {
    for (const rel of [
      "features/language/media-plp/apply-media-plp-editorial.ts",
      "features/language/media-plp/load-media-plp-ssr.ts",
      "features/language/media-plp/media-semantic-inventory.ts",
      "app/media/page.tsx",
    ]) {
      const text = readFileSync(join(webSrc, rel), "utf8");
      assert.doesNotMatch(
        text,
        /gemini|thin-gemini|media-plp-materializer|GEMINI_API_KEY|generateContentTranslation/,
      );
    }
  });
});
