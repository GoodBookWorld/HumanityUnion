/**
 * Production Completion Pack 02G Task 06 — multilingual layout resilience contracts.
 * Deterministic CSS/source assertions; no live translation provider calls.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  LAYOUT_STRESS_FIXTURES,
  LAYOUT_STRESS_VIEWPORTS,
} from "./layout-stress-fixtures-pack02g-task06";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, rel), "utf8");
}

describe("Production Completion Pack 02G Task 06 — layout resilience", () => {
  it("1–5 shared translated field wrapping / control / height / min-width / URL contracts", () => {
    const viewCss = readWeb("src/features/language/components/translated-content-view.css");
    const fieldsCss = readWeb("src/features/language/components/public-translated-fields.css");
    const fieldsTsx = readWeb("src/features/language/components/PublicTranslatedFields.tsx");

    assert.match(viewCss, /\.hu-translated-content\s*\{[^}]*min-width:\s*0/s);
    assert.match(viewCss, /\.hu-translated-content__body\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(viewCss, /\.hu-translated-content__body\s*\{[^}]*word-break:\s*break-word/s);
    assert.match(viewCss, /\.hu-translated-content__body\s*\{[^}]*max-height:\s*none/s);
    assert.match(viewCss, /\.hu-translated-content__body\s*\{[^}]*overflow:\s*visible/s);
    assert.doesNotMatch(
      viewCss,
      /\.hu-translated-content__body\s*\{[^}]*overflow:\s*hidden/s,
    );
    assert.match(viewCss, /\.hu-translated-content__toggle\s*\{[^}]*white-space:\s*normal/s);
    assert.match(viewCss, /\.hu-translated-content__toggle\s*\{[^}]*max-width:\s*100%/s);
    assert.match(viewCss, /padding-inline:\s*0\.7rem/);
    assert.match(viewCss, /text-align:\s*start/);

    assert.match(fieldsCss, /\.hu-public-translated-fields\s*\{[^}]*min-width:\s*0/s);
    assert.match(fieldsCss, /\.hu-public-translated-field\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(fieldsCss, /\.hu-civic-public-translated-section\s*\{[^}]*min-width:\s*0/s);

    assert.match(fieldsTsx, /public-translated-fields\.css/);
    assert.match(fieldsTsx, /hu-public-translated-fields/);
    assert.doesNotMatch(fieldsTsx, /LAYOUT_STRESS|translateText|gemini|openai/);
  });

  it("6–7 archive cards and detail tolerate long Ukrainian-style title/summary/narrative", () => {
    const archiveCss = readWeb(
      "src/features/public-civic-archive/components/civic-archive-results.css",
    );
    const detailCss = readWeb("src/app/civic-archive/civic-archive-page.css");
    const cardText = readWeb(
      "src/features/public-civic-archive/components/CivicArchiveCardTranslatedText.tsx",
    );

    assert.match(archiveCss, /\.civic-archive-mini-card__title\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(
      archiveCss,
      /\.civic-archive-mini-card__summary\s*\{[^}]*overflow-wrap:\s*anywhere/s,
    );
    assert.doesNotMatch(archiveCss, /-webkit-line-clamp:\s*[23]/);
    assert.match(
      archiveCss,
      /\.civic-archive-record-card__title\s*\{[^}]*overflow-wrap:\s*anywhere/s,
    );
    assert.match(
      archiveCss,
      /\.civic-archive-record-card__body\s*\{[^}]*min-width:\s*0/s,
    );
    assert.match(archiveCss, /inset-inline-start:\s*0/);
    assert.match(archiveCss, /inset-inline-end:\s*0/);
    assert.match(archiveCss, /to inline-end/);
    assert.match(cardText, /civic-archive-card-translated-text/);
    assert.match(detailCss, /\.civic-archive-detail__section\s*\{[^}]*min-width:\s*0/s);
    assert.match(detailCss, /overflow-wrap:\s*anywhere/);

    assert.ok(LAYOUT_STRESS_FIXTURES.uk.title.length > LAYOUT_STRESS_FIXTURES.en.title.length);
    assert.ok(LAYOUT_STRESS_FIXTURES.uk.summary.length > LAYOUT_STRESS_FIXTURES.en.summary.length);
  });

  it("8 Civic Media editorial sections tolerate expansion", () => {
    const mediaCss = readWeb("src/features/civic-media-center/civic-media-center.css");
    const editorial = readWeb(
      "src/features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
    );
    assert.match(mediaCss, /\.civic-media-translated-editorial\s*\{[^}]*min-width:\s*0/s);
    assert.match(mediaCss, /\.civic-media-translated-editorial\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(editorial, /civic-media-translated-editorial/);
    assert.match(editorial, /CivicPublicTranslatedSection/);
    assert.doesNotMatch(editorial, /diagramSvg|websiteUrl|trustedMedia/);
  });

  it("9–11 CJK line-breaking, RTL document direction, logical CSS on touched surfaces", () => {
    const viewCss = readWeb("src/features/language/components/translated-content-view.css");
    const layout = readWeb("src/app/layout.tsx");
    const collective = readWeb(
      "src/app/collective-decisions/public/public-collective-decision-page.css",
    );
    const initiative = readWeb(
      "src/app/initiatives/public/[initiativeId]/public-initiative-page.css",
    );

    assert.match(viewCss, /word-break:\s*break-word/);
    assert.match(LAYOUT_STRESS_FIXTURES.zhHant.title, /[\u4e00-\u9fff]/);
    assert.ok(!LAYOUT_STRESS_FIXTURES.zhHant.title.includes(" "));
    assert.ok(LAYOUT_STRESS_FIXTURES.zhHant.title.length > 10);
    assert.equal(LAYOUT_STRESS_FIXTURES.ar.dir, "rtl");
    assert.match(layout, /dir=\{documentLocale\.textDirection\}/);
    assert.match(collective, /text-align:\s*start/);
    assert.match(collective, /padding-inline-start:\s*1\.25rem/);
    assert.doesNotMatch(collective, /text-align:\s*left/);
    assert.doesNotMatch(collective, /padding-left:/);
    assert.match(initiative, /text-align:\s*start/);
    assert.match(initiative, /padding-inline-start:\s*1\.25rem/);
  });

  it("12–13 essential actions readable; English baseline fixtures remain present", () => {
    const viewCss = readWeb("src/features/language/components/translated-content-view.css");
    const archiveCss = readWeb(
      "src/features/public-civic-archive/components/civic-archive-results.css",
    );
    assert.match(viewCss, /\.hu-translated-content__toggle\s*\{[^}]*white-space:\s*normal/s);
    assert.match(archiveCss, /\.civic-archive-results__control\s*\{[^}]*white-space:\s*normal/s);
    assert.equal(LAYOUT_STRESS_FIXTURES.en.locale, "en");
    assert.match(LAYOUT_STRESS_FIXTURES.en.title, /Community water/);
  });

  it("14–16 Initiative / Analysis / Petition translated surfaces remain wired", () => {
    const petition = readWeb(
      "src/features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    const analysis = readWeb(
      "src/features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisPublicResult.tsx",
    );
    const initiativeHero = readWeb(
      "src/features/public-initiative-experience/components/PublicExperienceHero.tsx",
    );
    assert.match(petition, /PublicTranslatedFields/);
    assert.match(analysis, /PublicTranslatedFields/);
    assert.match(initiativeHero, /sourceKind:\s*"initiative"/);
    assert.match(initiativeHero, /resolveTranslatedContent|generateContentTranslation/);
  });

  it("17 Task 05 civic surfaces remain wired", () => {
    const surfaces: Array<{ file: string; kind: string }> = [
      {
        file: "src/app/improvement-proposals/public/[proposalId]/page.tsx",
        kind: "improvement_proposal",
      },
      {
        file: "src/app/initiatives/public/[initiativeId]/revisions/[version]/page.tsx",
        kind: "initiative_revision",
      },
      {
        file: "src/app/decision-sessions/public/[sessionId]/page.tsx",
        kind: "decision_session",
      },
      {
        file: "src/app/collective-decisions/public/[decisionId]/page.tsx",
        kind: "collective_decision",
      },
      {
        file: "src/app/initiative-implementation-commitments/public/[commitmentId]/page.tsx",
        kind: "implementation_commitment",
      },
      {
        file: "src/app/implementation-tracking/public/[trackingId]/page.tsx",
        kind: "implementation_tracking",
      },
      {
        file: "src/app/public-responses/[responseId]/page.tsx",
        kind: "official_response",
      },
      {
        file: "src/app/public-impact/[impactId]/page.tsx",
        kind: "public_impact",
      },
    ];

    for (const surface of surfaces) {
      const src = readWeb(surface.file);
      assert.match(src, /CivicPublicTranslatedSection/);
      assert.match(src, new RegExp(`sourceKind="${surface.kind}"`));
    }

    assert.match(
      readWeb("src/app/civic-archive/[initiativeId]/page.tsx"),
      /CivicArchiveTranslatedNarrative/,
    );
    assert.match(
      readWeb("src/features/public-civic-archive/components/PublicArchiveInitiativeCard.tsx"),
      /CivicArchiveCardTranslatedText/,
    );
    assert.match(
      readWeb("src/features/civic-media-center/components/CivicMediaCenterPageContent.tsx"),
      /CivicMediaTranslatedEditorial/,
    );
  });

  it("18–22 no provider calls in layout tests; no Blog/Discussion/search/SEO architecture changes", () => {
    const fixtures = readWeb(
      "src/features/language/layout-stress-fixtures-pack02g-task06.ts",
    );
    assert.match(fixtures, /LAYOUT_STRESS_FIXTURES/);
    assert.doesNotMatch(fixtures, /generateContentTranslation|translateText|gemini|openai/);

    const civic = readWeb("src/features/language/components/CivicPublicTranslatedSection.tsx");
    assert.doesNotMatch(civic, /blog_post|discussion_comment|hreflang|searchEnabled|seoIndexing/);

    const editorial = readWeb(
      "src/features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
    );
    assert.doesNotMatch(editorial, /blog_post|discussion_comment/);

    const profileCss = readWeb("src/components/member/profile-field.css");
    assert.match(profileCss, /overflow-wrap:\s*anywhere/);
    assert.ok(LAYOUT_STRESS_FIXTURES.longUnbrokenUrl.includes("https://"));
    assert.ok(LAYOUT_STRESS_FIXTURES.pathologicalTitle.length > 120);
  });

  it("records representative viewports; scrollWidth gate deferred (no DOM harness)", () => {
    assert.equal(LAYOUT_STRESS_VIEWPORTS.mobile, 375);
    assert.equal(LAYOUT_STRESS_VIEWPORTS.tablet, 900);
    assert.equal(LAYOUT_STRESS_VIEWPORTS.desktop, 1280);
    // Web unit stack is source/CSS contract tests (tsx --test), not viewport DOM.
    // scrollWidth <= clientWidth remains Task 07 staging / Pack 02J acceptance.
  });
});
