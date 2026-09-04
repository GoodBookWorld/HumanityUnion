/**
 * Pack 08I.15 — universal DEFAULT_LOCALIZABLE contract + coverage gate.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { DEFAULT_LOCALIZABLE_RULE, LOCALIZATION_RESOLUTION_PRIORITY } from "@hu/types";

import {
  ADMIN_MANAGED_LOCALIZATION_DOMAINS,
  CIVIC_CONTENT_MANUAL_OVERRIDE_STATUS,
  CIVIC_CONTENT_SOURCE_KINDS,
  assertParticipantFacingTextClassified,
  classifyLocalizationOwnership,
  isRegisteredNonTranslatableFieldKey,
} from "./localization-ownership.js";
import {
  INTENTIONAL_LOCALIZATION_DEBT,
  runUniversalLocalizationCoverageGate,
} from "./universal-localization-coverage-gate.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("Pack 08I.15 — localization ownership model", () => {
  it("1–2. DEFAULT_LOCALIZABLE: unknown semantic prose classifies as CIVIC_CONTENT", () => {
    assert.equal(
      classifyLocalizationOwnership({ domain: "unknown_semantic" }),
      "CIVIC_CONTENT",
    );
    assert.equal(
      classifyLocalizationOwnership({ sourceKind: "petition" }),
      "CIVIC_CONTENT",
    );
    assert.equal(classifyLocalizationOwnership({ domain: "web_ui" }), "WEB_UI");
    assert.equal(classifyLocalizationOwnership({ domain: "brand" }), "BRAND_LOCALIZATION");
    assert.equal(classifyLocalizationOwnership({ domain: "legal" }), "LEGAL_LOCALIZATION");
    assert.equal(
      classifyLocalizationOwnership({ domain: "terminology" }),
      "CONTROLLED_TERMINOLOGY",
    );
    assert.equal(classifyLocalizationOwnership({ domain: "invariant" }), "NON_TRANSLATABLE");
    assert.match(DEFAULT_LOCALIZABLE_RULE, /localizable by default/i);
  });

  it("20. unclassified participant-facing text fails the coverage assert", () => {
    assert.throws(
      () =>
        assertParticipantFacingTextClassified({
          ownership: null,
          surfaceId: "test-surface",
          fieldKey: "mysteryProse",
        }),
      /UNCLASSIFIED_PARTICIPANT_TEXT/,
    );
    assert.equal(
      assertParticipantFacingTextClassified({
        ownership: "CIVIC_CONTENT",
        surfaceId: "test-surface",
      }),
      "CIVIC_CONTENT",
    );
  });

  it("11–14. WEB_UI / Brand / Legal / Glossary domains stay separate from Gemini", () => {
    assert.deepEqual([...ADMIN_MANAGED_LOCALIZATION_DOMAINS], [
      "BRAND_LOCALIZATION",
      "LEGAL_LOCALIZATION",
    ]);
    assert.equal(CIVIC_CONTENT_MANUAL_OVERRIDE_STATUS.adminWritePathExists, false);
    assert.ok(CIVIC_CONTENT_MANUAL_OVERRIDE_STATUS.modelSupportsHumanAndAuthorApprovedKinds);

    const brand = readWeb("features/brand-localization/resolve-localized-brand.ts");
    assert.doesNotMatch(brand, /getOrCreateContentTranslation|sourceKind:\s*["']brand["']/);
    const legal = readWeb("features/legal/resolve-localized-legal-body.ts");
    assert.doesNotMatch(legal, /getOrCreateContentTranslation|sourceKind:\s*["']legal/);
  });

  it("15. names/IDs/metrics keys are NON_TRANSLATABLE registry", () => {
    assert.equal(isRegisteredNonTranslatableFieldKey("initiativeId"), true);
    assert.equal(isRegisteredNonTranslatableFieldKey("responseNumber"), true);
    assert.equal(isRegisteredNonTranslatableFieldKey("title"), false);
  });

  it("H. resolution priority keeps Admin domains above machine CIVIC", () => {
    assert.equal(LOCALIZATION_RESOLUTION_PRIORITY[0], "BRAND_LOCALIZATION");
    assert.equal(LOCALIZATION_RESOLUTION_PRIORITY[1], "LEGAL_LOCALIZATION");
    assert.ok(LOCALIZATION_RESOLUTION_PRIORITY.includes("CIVIC_CONTENT_CURRENT_MACHINE"));
    assert.equal(
      LOCALIZATION_RESOLUTION_PRIORITY[LOCALIZATION_RESOLUTION_PRIORITY.length - 1],
      "CANONICAL_ENGLISH_FALLBACK",
    );
  });
});

describe("Pack 08I.15 — presentation contracts", () => {
  it("3–6. Initiative + Public Choice cards/detail share Initiative presentation", () => {
    for (const relative of [
      "features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx",
      "features/country-experience/components/CountryInitiativeRailCard.tsx",
      "features/country-experience/components/CountryElectionRailCard.tsx",
      "features/public-initiative-experience/components/PublicInitiativeLatestInitiatives.tsx",
      "features/community-intelligence/components/RelatedInitiativesWidget.tsx",
    ]) {
      const src = readWeb(relative);
      assert.match(
        src,
        /useInitiativeCardTitlePresentation|useCivicInitiativeLocalizedTitle/,
      );
      assert.doesNotMatch(src, /\{initiative\.title\}|\{item\.title\}/);
    }

    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.match(page, /useInitiativePublicPresentation/);
    assert.doesNotMatch(page, /sourceKind:\s*["']public_choice["']/);

    const election = readWeb(
      "features/country-experience/components/CountryElectionRailCard.tsx",
    );
    assert.doesNotMatch(election, /sourceKind:\s*["']public_choice["']/);
  });

  it("3. compact normal Initiative cards still contain no description", () => {
    const mini = readWeb("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    assert.match(mini, /useInitiativeCardTitlePresentation/);
    assert.doesNotMatch(mini, /__description|>\{.*description/);
  });

  it("7–10. Discussion / CA / Petition / later lifecycle use CIVIC_CONTENT pipeline", () => {
    assert.ok(CIVIC_CONTENT_SOURCE_KINDS.includes("discussion_comment"));
    assert.ok(CIVIC_CONTENT_SOURCE_KINDS.includes("collaborative_analysis"));
    assert.ok(CIVIC_CONTENT_SOURCE_KINDS.includes("petition"));
    assert.ok(CIVIC_CONTENT_SOURCE_KINDS.includes("official_response"));
    assert.ok(CIVIC_CONTENT_SOURCE_KINDS.includes("public_impact"));

    const ca = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisPublicResult.tsx",
    );
    assert.match(ca, /PublicTranslatedFields/);
    assert.match(ca, /collaborative_analysis/);

    const petition = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    assert.match(petition, /PublicTranslatedFields/);
    assert.match(petition, /petition/);

    const official = readWeb(
      "features/official-response/components/OfficialResponsesPublicSection.tsx",
    );
    assert.match(official, /PublicTranslatedFields/);
    assert.match(official, /official_response/);
    assert.doesNotMatch(official, /\{(?:latest|response)\.summary\}/);

    const lifecycleCard = readWeb(
      "features/public-initiative-experience/components/LifecycleTranslatedRecordCard.tsx",
    );
    assert.match(lifecycleCard, /CivicPublicTranslatedSection|PublicTranslatedFields|resolveTranslatedContent/);
  });

  it("16–19. fallback / CURRENT / reactive locale / RTL contracts preserved", () => {
    const presentation = readWeb(
      "features/public-initiative-experience/initiative-public-presentation.ts",
    );
    assert.match(presentation, /presentationMode/);
    assert.match(presentation, /mergeInitiativePublicPresentationUpdate/);

    const hook = readWeb(
      "features/public-initiative-experience/use-initiative-public-presentation.ts",
    );
    assert.match(hook, /generation !== requestGeneration\.current/);
    assert.match(hook, /resolved\.activeLanguage !== displayLanguage/);

    const rtl = readWeb("features/language/language.ts");
    assert.match(rtl, /isRtlLanguageCode|RTL_LANGUAGE_CODES/);
  });
});

describe("Pack 08I.15 — universal coverage gate", () => {
  it("governed Initiative-path surfaces have 0 unexpected PUBLIC_SEMANTIC_BYPASS", () => {
    const result = runUniversalLocalizationCoverageGate(webSrc);
    assert.equal(
      result.governedUnexpectedBypasses.length,
      0,
      result.governedUnexpectedBypasses
        .map((f) => `${f.file}:${f.line}:${f.pattern}`)
        .join("\n"),
    );
    assert.equal(result.counters.BRAND_MACHINE_TRANSLATION_BYPASS, 0);
    assert.equal(result.counters.LEGAL_MACHINE_TRANSLATION_BYPASS, 0);
    assert.ok(result.counters.GOVERNED_SURFACE_FILES_SCANNED > 0);
    assert.ok(result.counters.REGISTERED_INTENTIONAL_DEBT === INTENTIONAL_LOCALIZATION_DEBT.length);
  });

  it("intentional debt is explicit (Blog/Media/Knowledge/search/PWA/CI remain listed)", () => {
    const reasons = INTENTIONAL_LOCALIZATION_DEBT.map((d) => d.relativePath).join(" ");
    assert.match(reasons, /global-search/);
    assert.match(reasons, /PwaInitiativeFeed|pwa/);
    assert.match(reasons, /knowledge-center/);
  });
});
