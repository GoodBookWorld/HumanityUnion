/**
 * Pack 08I.9 — Lifecycle dynamic presentation + SSR-first PIE/Media.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  looksLikeRawI18nKey,
} from "../public-initiative-experience/normalize-initiative-status-code.js";
import { resolveInitiativeDetailPresentation } from "../public-initiative-experience/resolve-initiative-detail-presentation.js";
import {
  lifecycleRecordUsesWarmTranslation,
} from "../public-initiative-experience/lifecycle-record-warm-matrix.js";
import {
  buildCanonicalCivicMediaEditorial,
  overlayCivicMediaEditorialFromFields,
} from "../civic-media-center/components/CivicMediaTranslatedEditorial.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

/** Mounted Lifecycle PublicResults that must not prefer raw EN when warm exists. */
const PUBLIC_RESULT_SOURCES = [
  {
    kind: "decision_session",
    file: "features/initiative-decision-session-lifecycle/components/InitiativeDecisionSessionPublicResult.tsx",
  },
  {
    kind: "collective_decision",
    file: "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionPublicResult.tsx",
  },
  {
    kind: "implementation_commitment",
    file: "features/initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentPublicResult.tsx",
  },
  {
    kind: "implementation_tracking",
    file: "features/initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingPublicResult.tsx",
  },
  {
    kind: "improvement_proposal",
    file: "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsPublicResult.tsx",
  },
  {
    kind: "official_response",
    file: "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponsePublicResult.tsx",
  },
  {
    kind: "petition",
    file: "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
  },
  {
    kind: "collaborative_analysis",
    file: "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisPublicResult.tsx",
  },
] as const;

describe("Pack 08I.9 — Lifecycle sourceKind matrix + presentation", () => {
  it("lifecycle sourceKind warm matrix covers mounted civic kinds", () => {
    assert.equal(lifecycleRecordUsesWarmTranslation("initiative"), true);
    assert.equal(lifecycleRecordUsesWarmTranslation("collaborative_analysis"), true);
    assert.equal(lifecycleRecordUsesWarmTranslation("petition"), true);
    assert.equal(lifecycleRecordUsesWarmTranslation("initiative_revision"), true);
    assert.equal(lifecycleRecordUsesWarmTranslation("decision_session"), true);
    assert.equal(lifecycleRecordUsesWarmTranslation("collective_decision"), true);
    assert.equal(lifecycleRecordUsesWarmTranslation("implementation_commitment"), true);
    assert.equal(lifecycleRecordUsesWarmTranslation("implementation_tracking"), true);
    assert.equal(lifecycleRecordUsesWarmTranslation("official_response"), true);
    assert.equal(lifecycleRecordUsesWarmTranslation("improvement_proposal"), true);
    assert.equal(lifecycleRecordUsesWarmTranslation("public_impact"), true);
    assert.equal(lifecycleRecordUsesWarmTranslation("civic_archive"), true);
    assert.equal(lifecycleRecordUsesWarmTranslation(undefined), false);
  });

  it("LifecycleTranslatedRecordCard is the mounted record presentation boundary", () => {
    const panel = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    const card = readWeb(
      "features/public-initiative-experience/components/LifecycleTranslatedRecordCard.tsx",
    );
    assert.match(panel, /LifecycleTranslatedRecordCard/);
    assert.match(card, /CivicPublicTranslatedSection|PublicTranslatedFields/);
    assert.match(card, /statusCode/);
    assert.match(card, /lifecycleRecordTitles/);
    assert.match(card, /looksLikeRawI18nKey/);
  });

  it("lifecycleRecordTitles catalogs exist for uk/zh-Hant/ar/en", async () => {
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const { messages } = await loadUiMessagesForLocale(locale);
      const experience = (messages as Record<string, unknown>).initiativeExperience as
        | Record<string, unknown>
        | undefined;
      const titles = experience?.lifecycleRecordTitles as Record<string, string> | undefined;
      assert.ok(titles, `missing lifecycleRecordTitles for ${locale}`);
      for (const code of [
        "discussion_completed",
        "improvement_proposals_collection",
        "election_results",
        "official_response_package",
        "public_impact_report",
      ]) {
        assert.ok(titles[code]?.trim(), `${locale}.${code}`);
        assert.equal(looksLikeRawI18nKey(titles[code] ?? ""), false);
      }
    }
  });

  it("PublicResults use warm translation sections (no ContentFields dual-render)", () => {
    for (const entry of PUBLIC_RESULT_SOURCES) {
      const src = readWeb(entry.file);
      assert.match(
        src,
        /CivicPublicTranslatedSection|PublicTranslatedFields/,
        `${entry.kind} missing warm presentation`,
      );
    }
    const proposals = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsPublicResult.tsx",
    );
    assert.doesNotMatch(proposals, /InitiativeImprovementProposalsContentFields/);
  });

  it("Public Impact / Civic Archive prefer semantic labels over raw EN headings", () => {
    const impact = readWeb(
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactReportRenderer.tsx",
    );
    const archive = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveDocumentRenderer.tsx",
    );
    assert.match(impact, /resolvePublicImpactSectionDisplayLabel/);
    assert.match(impact, /semanticHeading/);
    assert.match(archive, /resolveLifecycleStageDisplayLabel/);
    assert.match(archive, /resolveCivicArchiveSectionDisplayLabel/);
  });
});

describe("Pack 08I.9 — PIE SSR-first seed + hydration", () => {
  it("server page seeds presentation and loader accepts initialPresentation", () => {
    const page = readWeb("app/initiatives/public/[initiativeId]/page.tsx");
    const loader = readWeb(
      "features/public-initiative-experience/components/CanonicalInitiativeExperienceLoader.tsx",
    );
    const hero = readWeb(
      "features/public-initiative-experience/components/PublicExperienceHero.tsx",
    );
    const overview = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );

    assert.match(page, /loadInitiativeDetailPresentationSeed/);
    assert.match(page, /resolveDocumentHtmlLocale/);
    assert.match(page, /initialPresentation/);
    assert.match(loader, /initialPresentation/);
    assert.match(hero, /initialPresentation/);
    assert.match(hero, /keep SSR seed|!initialPresentation/);
    assert.match(overview, /initialDescription/);
    assert.match(overview, /keep SSR seed|!initialDescription/);
  });

  it("EXISTING UK initiative translation → detail presentation (TRANSLATION_EXISTS_BUT_NOT_DISPLAYED=0)", async () => {
    const fixture = {
      presentationMode: "preferred_translation" as const,
      content: {
        title: "Українська назва ініціативи",
        description: "Український опис ініціативи",
      },
      activeLanguage: "uk" as const,
      originalLanguage: "en" as const,
      originalContent: {
        title: "Canonical English Initiative Title",
        description: "Canonical English Initiative Description",
      },
      translation: null,
      isMachineTranslated: true,
      isStale: false,
      canViewOriginal: true,
      canViewTranslation: true,
    };

    const detail = await resolveInitiativeDetailPresentation(
      {
        initiativeId: "init-uk-ssr",
        canonical: {
          title: "Canonical English Initiative Title",
          description: "Canonical English Initiative Description",
        },
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () => fixture,
        generateContentTranslation: async () => {
          throw new Error("must not generate on resolve path");
        },
      },
    );

    assert.equal(detail.title, "Українська назва ініціативи");
    assert.equal(detail.description, "Український опис ініціативи");
    assert.notEqual(detail.title, "Canonical English Initiative Title");
  });

  it("missing translation → canonical fallback", async () => {
    const detail = await resolveInitiativeDetailPresentation(
      {
        initiativeId: "init-miss",
        canonical: {
          title: "Canonical English Initiative Title",
          description: "Canonical English Initiative Description",
        },
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () => ({
          presentationMode: "original" as const,
          content: {
            title: "Canonical English Initiative Title",
            description: "Canonical English Initiative Description",
          },
          activeLanguage: "en" as const,
          originalLanguage: "en" as const,
          originalContent: {
            title: "Canonical English Initiative Title",
            description: "Canonical English Initiative Description",
          },
          translation: null,
          isMachineTranslated: false,
          isStale: false,
          canViewOriginal: false,
          canViewTranslation: false,
        }),
        generateContentTranslation: async () => {
          throw new Error("seed path must not generate");
        },
      },
    );
    assert.equal(detail.title, "Canonical English Initiative Title");
  });
});

describe("Pack 08I.9 — Media SSR-first seed + hydration", () => {
  it("media page async-seeds editorial; hook preserves SSR seed", () => {
    const page = readWeb("app/media/page.tsx");
    const content = readWeb(
      "features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
    );
    const editorial = readWeb(
      "features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
    );
    const seed = readWeb("features/civic-media-center/load-civic-media-editorial-seed.ts");

    assert.match(page, /async function CivicMediaPage|export default async function/);
    assert.match(page, /loadCivicMediaEditorialSeed/);
    assert.match(page, /resolveDocumentHtmlLocale/);
    assert.match(page, /initialEditorial/);
    assert.match(content, /initialEditorial/);
    assert.match(content, /initialMedia/);
    assert.match(editorial, /initialEditorial/);
    assert.match(editorial, /do not force canonical when SSR seed/);
    assert.match(seed, /resolveTranslatedContent/);
    assert.doesNotMatch(seed, /generateContentTranslation/);
  });

  it("EXISTING UK structured media → overlay keeps structure (STRUCTURED_RENDERING_REGRESSION=0)", () => {
    const media = {
      overview: {
        title: "Canonical Media Overview EN",
        summary: "Canonical Media Summary EN",
        points: [
          { id: "trust", heading: "EN One", body: "EN A" },
          { id: "verify", heading: "EN Two", body: "EN B" },
          { id: "act", heading: "EN Three", body: "EN C" },
        ],
      },
      selectionPrinciples: [
        { id: "editorial-transparency", title: "EN P1", description: "EN D1", whyItMatters: "EN W1" },
      ],
      faq: [{ id: "q1", question: "EN Q?", answer: "EN A." }],
      initiativeFlow: {
        title: "EN Flow",
        summary: "EN Flow summary",
        stages: ["News", "Verification", "Initiative"],
      },
      factChecking: [],
      propagandaAnalysis: [],
      trustedMedia: [],
      trustedMediaCategories: [],
    } as const;

    const overlay = overlayCivicMediaEditorialFromFields(
      media as never,
      {
        overviewTitle: "Огляд медіа УК",
        overviewSummary: "Підсумок медіа УК",
        overviewPoints: JSON.stringify([
          { heading: "Довіра", body: "Текст1" },
          { heading: "Перевірка", body: "Текст2" },
          { heading: "Дія", body: "Текст3" },
        ]),
        selectionPrinciples: JSON.stringify([
          { title: "Прозорість", description: "Опис" },
        ]),
        faq: JSON.stringify([{ question: "Питання?", answer: "Відповідь." }]),
        initiativeFlowTitle: "Потік",
        initiativeFlowSummary: "Опис потоку",
        initiativeFlowStages: "Новини\nПеревірка\nІніціатива",
      },
      buildCanonicalCivicMediaEditorial(media as never).translationChrome,
    );

    assert.equal(overlay.overview.title, "Огляд медіа УК");
    assert.notEqual(overlay.overview.title, "Canonical Media Overview EN");
    assert.equal(overlay.overview.points.length, 3);
    assert.equal(overlay.overview.points[0]?.heading, "Довіра");
    assert.equal(overlay.faq[0]?.question, "Питання?");
    assert.deepEqual(overlay.initiativeFlow.stages, ["Новини", "Перевірка", "Ініціатива"]);
  });
});

describe("Pack 08I.9 — locale + raw token guards", () => {
  it("zh-TW alias path uses document locale resolver (SSR_CLIENT_LOCALE_DIVERGENCE=0)", () => {
    const pie = readWeb("app/initiatives/public/[initiativeId]/page.tsx");
    const media = readWeb("app/media/page.tsx");
    assert.match(pie, /resolveDocumentHtmlLocale/);
    assert.match(media, /resolveDocumentHtmlLocale/);
    // Alias authority lives in Language Registry (zh-TW → zh-Hant) used by document locale.
    const registry = readFileSync(
      path.resolve(webSrc, "../../../packages/types/src/domain/language-registry.ts"),
      "utf8",
    );
    assert.match(registry, /zh-TW/);
    assert.match(registry, /zh-Hant/);
  });

  it("Arabic locale catalog loads lifecycle record titles", async () => {
    const { messages } = await loadUiMessagesForLocale("ar");
    const experience = (messages as Record<string, unknown>).initiativeExperience as Record<
      string,
      unknown
    >;
    const titles = experience.lifecycleRecordTitles as Record<string, string>;
    assert.match(titles.public_impact_report ?? "", /أثر|تقرير/);
  });

  it("raw domain token / i18n key patterns are guarded in lifecycle card", () => {
    const card = readWeb(
      "features/public-initiative-experience/components/LifecycleTranslatedRecordCard.tsx",
    );
    assert.match(card, /looksLikeRawI18nKey/);
    assert.match(card, /statusCode/);
    assert.equal(looksLikeRawI18nKey("initiativeExperience.statuses.Proposal"), true);
    assert.equal(looksLikeRawI18nKey("lifecycle.states.published"), true);
  });
});
