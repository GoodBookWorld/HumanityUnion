/**
 * Reset 03C.1 — Media structural parity + PLP consumer regression (no live ops).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { CivicMediaCenterPublic, TrustedMediaResource } from "@hu/types";
import { MEDIA_PLP_ENTITY_TYPE } from "@hu/types";

import { applyMediaPlpPresentationsToEditorial } from "./apply-media-plp-editorial.js";
import {
  isMediaPlpWebEnabled,
  setMediaPlpWebEnabledForTests,
} from "./feature-flag.js";
import { MEDIA_PAGE_MAJOR_SECTION_IDS } from "./media-page-structure.js";
import type { MediaPlpResolvedPresentation } from "./presentation.js";
import { readMediaPlpStringField } from "./presentation.js";

const webSrc = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const repoRoot = join(webSrc, "../../..");

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

const atlantic: TrustedMediaResource = {
  id: "the-atlantic",
  name: "The Atlantic",
  logoLabel: "A",
  country: "United States",
  categoryId: "independent-investigative",
  explanation: "Trusted explanation of editorial standards for participants.",
  websiteUrl: "https://www.theatlantic.com/",
  sortOrder: 2,
};

function sampleMedia(): CivicMediaCenterPublic {
  return {
    overview: {
      title: "Overview title",
      summary: "Overview summary",
      points: [
        { id: "p1", heading: "H1", body: "B1" },
        { id: "p2", heading: "H2", body: "B2" },
      ],
    },
    selectionPrinciples: [
      {
        id: "editorial-transparency",
        title: "Independence of trusted media evidence",
        description: "Principle description explaining independence requirements.",
      },
      {
        id: "transparent-sourcing",
        title: "Transparent sourcing",
        description: "Principle description explaining transparent sourcing.",
      },
    ],
    trustedMediaCategories: [
      { id: "international-wire-service", title: "Wire", sortOrder: 1 },
      { id: "independent-investigative", title: "Investigative", sortOrder: 2 },
    ],
    trustedMedia: [reuters, atlantic],
    factChecking: [
      {
        id: "fact-a",
        name: "Fact A",
        logoLabel: "F",
        mission: "Mission",
        coverage: "Global",
        websiteUrl: "https://example.com/fact",
        sortOrder: 1,
      },
    ],
    propagandaAnalysis: [
      {
        id: "prop-a",
        name: "Prop A",
        logoLabel: "P",
        focus: "Focus",
        explanation: "Explain",
        websiteUrl: "https://example.com/prop",
        sortOrder: 1,
      },
    ],
    faq: [
      { id: "faq-1", question: "Q1?", answer: "A1" },
      { id: "faq-2", question: "Q2?", answer: "A2" },
    ],
    initiativeFlow: {
      title: "Flow",
      summary: "Summary",
      stages: ["S1", "S2", "S3"],
    },
  } as CivicMediaCenterPublic;
}

function plp(
  entityId: string,
  mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK",
  presentation: Record<string, string>,
): MediaPlpResolvedPresentation {
  return {
    mode,
    presentation,
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
    entityId,
    locale: "uk",
    canonicalVersion: "v-fixture",
  };
}

afterEach(() => {
  setMediaPlpWebEnabledForTests(null);
});

describe("Reset 03C.1 Media structural parity", () => {
  it("A: root-cause regression — dual PLP page omitted major sections", () => {
    // Historical defect: CivicMediaCenterPlpContent only rendered principles+trusted.
    const pageContent = readFileSync(
      join(webSrc, "features/civic-media-center/components/CivicMediaCenterPageContent.tsx"),
      "utf8",
    );
    const pipeline = readFileSync(
      join(webSrc, "features/civic-media-center/components/CivicPipelineWorkflow.tsx"),
      "utf8",
    );
    const composed = `${pageContent}\n${pipeline}`;
    for (const id of MEDIA_PAGE_MAJOR_SECTION_IDS) {
      assert.match(
        composed,
        new RegExp(`(id|sectionId)=["']${id}["']`),
        `missing section hook ${id}`,
      );
    }
    assert.match(pageContent, /PublicNewsSection/);
    assert.match(pageContent, /CivicPipelineWorkflow/);
    assert.match(pageContent, /fact-checking/);
    assert.match(pageContent, /propaganda-analysis/);
    assert.match(pageContent, /id="faq"/);
    assert.match(pageContent, /id="overview"/);
    assert.match(pageContent, /civic-media-page__container/);
    // Former dual page must not be a separate simplified DOM tree.
    const plpModule = readFileSync(
      join(webSrc, "features/language/media-plp/CivicMediaCenterPlpContent.tsx"),
      "utf8",
    );
    assert.match(plpModule, /CivicMediaCenterPageContent/);
    assert.doesNotMatch(plpModule, /civic-media-page__inner/);
    assert.doesNotMatch(plpModule, /HuxDirectorySection/);
  });

  it("B/C: shared renderer structural inventory preserved", () => {
    assert.deepEqual([...MEDIA_PAGE_MAJOR_SECTION_IDS], [
      "overview",
      "initiative-flow",
      "news-widgets",
      "selection-principles",
      "trusted-media",
      "fact-checking",
      "propaganda-analysis",
      "faq",
    ]);
    const mediaRoute = readFileSync(join(webSrc, "app/media/page.tsx"), "utf8");
    assert.match(mediaRoute, /CivicMediaCenterPageContent/);
    assert.doesNotMatch(mediaRoute, /CivicMediaCenterPlpContent/);
  });

  it("D/E/F: reuters localized + atlantic canonical; all trusted preserved; no mix", () => {
    const media = sampleMedia();
    const trustedById = {
      reuters: plp("reuters", "PUBLISHED_LOCALIZED", {
        explanation: "[uk] Independent international news agency",
      }),
      "the-atlantic": plp("the-atlantic", "CANONICAL_FALLBACK", {
        explanation: atlantic.explanation,
      }),
    };
    const principlesById = {
      "editorial-transparency": {
        mode: "CANONICAL_FALLBACK" as const,
        presentation: {
          title: media.selectionPrinciples[0]!.title,
          description: media.selectionPrinciples[0]!.description,
        },
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        entityId: "editorial-transparency",
        locale: "uk",
        canonicalVersion: "v-fixture",
      },
      "transparent-sourcing": {
        mode: "CANONICAL_FALLBACK" as const,
        presentation: {
          title: media.selectionPrinciples[1]!.title,
          description: media.selectionPrinciples[1]!.description,
        },
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        entityId: "transparent-sourcing",
        locale: "uk",
        canonicalVersion: "v-fixture",
      },
    };

    const editorial = applyMediaPlpPresentationsToEditorial({
      media,
      trustedById,
      principlesById,
    });

    assert.equal(Object.keys(editorial.trustedExplanationsById).length, 2);
    assert.equal(
      editorial.trustedExplanationsById.reuters,
      "[uk] Independent international news agency",
    );
    assert.equal(
      editorial.trustedExplanationsById["the-atlantic"],
      atlantic.explanation,
    );
    assert.equal(editorial.selectionPrinciples.length, 2);
    assert.equal(editorial.faq.length, 2);
    assert.equal(editorial.overview.points.length, 2);
    // Overview/FAQ remain present (canonical) — missing PLP != missing content.
    assert.ok(editorial.overview.title);
    assert.ok(editorial.faq[0]?.question);

    assert.equal(trustedById.reuters.mode, "PUBLISHED_LOCALIZED");
    assert.equal(trustedById["the-atlantic"].mode, "CANONICAL_FALLBACK");
    assert.notEqual(
      readMediaPlpStringField(trustedById.reuters.presentation, "explanation"),
      readMediaPlpStringField(trustedById["the-atlantic"].presentation, "explanation"),
    );
  });

  it("G: flag defaults ON (Reset 01)", () => {
    setMediaPlpWebEnabledForTests(null);
    assert.equal(isMediaPlpWebEnabled(), true);
  });

  it("H: flag ON path skips legacy generate-on-miss", () => {
    const pageContent = readFileSync(
      join(webSrc, "features/civic-media-center/components/CivicMediaCenterPageContent.tsx"),
      "utf8",
    );
    assert.match(pageContent, /skipClientTranslation:\s*plpMode/);
    assert.match(pageContent, /applyMediaPlpPresentationsToEditorial/);
    const hook = readFileSync(
      join(
        webSrc,
        "features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
      ),
      "utf8",
    );
    assert.match(hook, /skipClientTranslation/);
  });

  it("O/P/Q: read-path isolation remains thin", () => {
    const files = [
      "features/language/media-plp/apply-media-plp-editorial.ts",
      "features/language/media-plp/load-media-plp-ssr.ts",
      "features/language/media-plp/media-plp-api.ts",
      "app/media/page.tsx",
      "features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
    ];
    for (const rel of files) {
      const text = readFileSync(join(webSrc, rel), "utf8");
      assert.doesNotMatch(
        text,
        /gemini|thin-gemini|media-plp-materializer|GEMINI_API_KEY/,
      );
    }
    // Shared page may still mention generate only inside the legacy hook path;
    // PLP mode must pass skipClientTranslation.
    const pageContent = readFileSync(
      join(webSrc, "features/civic-media-center/components/CivicMediaCenterPageContent.tsx"),
      "utf8",
    );
    assert.doesNotMatch(pageContent, /generateContentTranslation\(/);
  });

  it("ledger documents live structural failure + rollback", () => {
    const ledger = readFileSync(
      join(
        repoRoot,
        "project/architecture/core/PUBLISHED_LOCALIZATION_LEGACY_REMOVAL_LEDGER_v1.0.md",
      ),
      "utf8",
    );
    assert.match(ledger, /CONSUMER_READY_PENDING_LIVE_ACCEPTANCE/);
    assert.match(ledger, /structural acceptance failed|rolled back|03C\.1/i);
    assert.match(ledger, /LEGACY_ACTIVE_RUNTIME_DEFAULT` \| \*\*30\*\*/);
  });
});
