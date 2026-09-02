/**
 * Production Completion Pack 02G Task 05 — Web civic translated surface wiring.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, rel), "utf8");
}

describe("Production Completion Pack 02G Task 05 — Web civic translated surfaces", () => {
  it("wires CivicPublicTranslatedSection / archive / media on public routes", () => {
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
      assert.doesNotMatch(src, /generateContentTranslation/);
    }

    const archiveDetail = readWeb("src/app/civic-archive/[initiativeId]/page.tsx");
    assert.match(archiveDetail, /CivicArchiveTranslatedNarrative/);
    assert.match(archiveDetail, /archiveRecordId/);

    const archiveCard = readWeb(
      "src/features/public-civic-archive/components/PublicArchiveInitiativeCard.tsx",
    );
    assert.match(archiveCard, /CivicArchiveCardTranslatedText/);

    const media = readWeb(
      "src/features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
    );
    assert.match(media, /useCivicMediaResolvedEditorial/);
    assert.doesNotMatch(media, /generateContentTranslation/);

    const mediaEditorial = readWeb(
      "src/features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
    );
    assert.match(mediaEditorial, /civic-media-center/);
    assert.match(mediaEditorial, /sourceKind:\s*"civic_media"/);
    assert.doesNotMatch(mediaEditorial, /generateContentTranslation/);
    assert.doesNotMatch(mediaEditorial, /diagramSvg|websiteUrl|trustedMedia/);
  });

  it("keeps Initiative/Analysis/Petition on-demand generate; disables for civic section", () => {
    const fields = readWeb("src/features/language/components/PublicTranslatedFields.tsx");
    assert.match(fields, /enableOnDemandGenerate = true/);
    assert.match(fields, /generateContentTranslation/);

    const civic = readWeb("src/features/language/components/CivicPublicTranslatedSection.tsx");
    assert.match(civic, /enableOnDemandGenerate=\{false\}/);

    const petition = readWeb(
      "src/features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    assert.match(petition, /PublicTranslatedFields/);
    assert.doesNotMatch(petition, /enableOnDemandGenerate=\{false\}/);

    const analysis = readWeb(
      "src/features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisPublicResult.tsx",
    );
    assert.match(analysis, /PublicTranslatedFields/);
  });

  it("does not introduce Blog UI / Discussion / search / SEO translation", () => {
    const civicSection = readWeb("src/features/language/components/CivicPublicTranslatedSection.tsx");
    assert.doesNotMatch(civicSection, /blog_post|discussion_comment|hreflang|searchEnabled|seoIndexing/);
    const mediaEditorial = readWeb(
      "src/features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
    );
    assert.doesNotMatch(mediaEditorial, /blog_post|discussion_comment/);
    assert.doesNotMatch(mediaEditorial, /stableJsonForDisplay|CivicPublicTranslatedSection/);
  });
});
