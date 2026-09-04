/**
 * Pack 08I.7 — Initiative card shared presentation boundary.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveInitiativeCardPresentation } from "./resolve-initiative-card-presentation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("Pack 08I.7 — Initiative card shared presentation boundary", () => {
  it("MiniCard and WorldInitiativeCard both use useInitiativeCardTitlePresentation", () => {
    const mini = readWeb("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    const world = readWeb("features/initiatives/components/WorldInitiativesPageContent.tsx");
    const hook = readWeb(
      "features/public-initiative-experience/use-initiative-public-presentation.ts",
    );
    const resolver = readWeb(
      "features/public-initiative-mini-card/resolve-initiative-card-presentation.ts",
    );

    assert.match(mini, /useInitiativeCardTitlePresentation/);
    assert.match(world, /useInitiativeCardTitlePresentation/);
    assert.match(world, /function WorldInitiativeCard/);
    assert.match(hook, /usePublicContentReadingContext/);
    assert.match(hook, /resolveInitiativePublicDisplayLanguage/);
    assert.doesNotMatch(mini, /resolveTranslatedContent\s*\(/);
    assert.doesNotMatch(mini, /generateContentTranslation\s*\(/);
    assert.doesNotMatch(world, /resolveTranslatedContent\s*\(/);
    assert.doesNotMatch(world, /generateContentTranslation\s*\(/);
    assert.match(resolver, /sourceKind:\s*"initiative"/);
    assert.match(resolver, /resolvePublicContentTranslationDisplay/);
  });

  it("maps content.title / content.description → title / summary when translated", () => {
    const resolver = readWeb(
      "features/public-initiative-mini-card/resolve-initiative-card-presentation.ts",
    );

    assert.match(resolver, /pickTranslatedField\(resolved,\s*"title",\s*canonical\.title\)/);
    assert.match(
      resolver,
      /pickTranslatedField\(resolved,\s*"description",\s*canonical\.summary\)/,
    );
    assert.match(resolver, /presentationMode:\s*"translated"/);
    assert.match(resolver, /presentationMode === "original"/);
  });

  it("short-circuits when !ready; none still warm-displays when resolve returns translation", async () => {
    const notReady = await resolveInitiativeCardPresentation({
      initiativeId: "init-1",
      canonical: { title: "Canonical Title", summary: "Canonical Summary" },
      readingContext: {
        ready: false,
        readingLanguage: "uk",
        translationPreference: "preferred",
      },
    });
    assert.deepEqual(notReady, {
      title: "Canonical Title",
      summary: "Canonical Summary",
      presentationMode: "original",
      isStale: false,
    });

    const nonePref = await resolveInitiativeCardPresentation(
      {
        initiativeId: "init-1",
        canonical: { title: "Canonical Title", summary: "Canonical Summary" },
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "none",
        },
      },
      {
        resolveTranslatedContent: async () => ({
          presentationMode: "preferred_translation",
          content: { title: "UK Title", description: "UK Summary" },
          activeLanguage: "uk",
          originalLanguage: "en",
          originalContent: { title: "Canonical Title", description: "Canonical Summary" },
          translation: null,
          isMachineTranslated: true,
          isStale: false,
          canViewOriginal: true,
          canViewTranslation: false,
        }),
        generateContentTranslation: async () => {
          throw new Error("must not generate for none");
        },
      },
    );
    assert.equal(nonePref.presentationMode, "translated");
    assert.equal(nonePref.title, "UK Title");
  });

  it("Home + Institutions + World share the initiative card presentation contract", () => {
    const home = readWeb(
      "features/public-home-v2/components/PublicHomeLatestInitiativesSection.tsx",
    );
    const institutions = readWeb(
      "features/institutions/components/InstitutionsLatestInitiativesSection.tsx",
    );
    const mini = readWeb("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    const world = readWeb("features/initiatives/components/WorldInitiativesPageContent.tsx");

    assert.match(home, /from ["'].*public-initiative-mini-card["']/);
    assert.match(home, /PublicInitiativeMiniCard/);
    assert.match(institutions, /from ["'].*public-initiative-mini-card["']/);
    assert.match(institutions, /PublicInitiativeMiniCard/);
    assert.match(mini, /useInitiativeCardTitlePresentation/);
    assert.match(world, /useInitiativeCardTitlePresentation/);
    assert.match(
      world,
      /use-initiative-public-presentation/,
    );
  });

  it("proves TRANSLATION_EXISTS path is wired via resolvePublicContentTranslationDisplay", () => {
    const resolver = readWeb(
      "features/public-initiative-mini-card/resolve-initiative-card-presentation.ts",
    );
    const shared = readWeb(
      "features/language/resolve-public-content-translation-display.ts",
    );

    assert.match(resolver, /resolvePublicContentTranslationDisplay/);
    assert.match(resolver, /sourceKind:\s*"initiative"/);
    assert.match(resolver, /sourceRecordId:\s*input\.initiativeId/);
    assert.match(shared, /resolveTranslatedContent/);
    assert.match(resolver, /TRANSLATION_EXISTS|non-original|presentationMode === "original"/);
    assert.match(shared, /shouldAttemptOnDemandContentTranslation/);
    assert.match(shared, /generateContentTranslation/);
  });

  it("EXISTING current translation fixture → translated title/summary on card presentation", async () => {
    const fixtureUk = {
      presentationMode: "preferred_translation" as const,
      content: {
        title: "Українська назва ініціативи",
        description: "Український опис ініціативи",
      },
      activeLanguage: "uk" as const,
      originalLanguage: "en" as const,
      originalContent: {},
      translation: null,
      isMachineTranslated: true,
      isStale: false,
      canViewOriginal: true,
      canViewTranslation: true,
    };

    const presented = await resolveInitiativeCardPresentation(
      {
        initiativeId: "init-fixture-1",
        canonical: { title: "English Initiative Title", summary: "English summary" },
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () => fixtureUk,
        generateContentTranslation: async () => {
          throw new Error("must not generate when translation exists");
        },
      },
    );

    assert.equal(presented.presentationMode, "translated");
    assert.equal(presented.title, "Українська назва ініціативи");
    assert.equal(presented.summary, "Український опис ініціативи");
    assert.equal(presented.isStale, false);
  });

  it("authenticated explicit none still warm-resolves (generate remains preferred-only)", async () => {
    let resolveCalls = 0;
    let generateCalls = 0;
    const presented = await resolveInitiativeCardPresentation(
      {
        initiativeId: "init-1",
        canonical: { title: "Keep English", summary: "Keep summary" },
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "none",
        },
      },
      {
        resolveTranslatedContent: async () => {
          resolveCalls += 1;
          return {
            presentationMode: "preferred_translation",
            content: { title: "Українська назва", description: "Опис" },
            activeLanguage: "uk",
            originalLanguage: "en",
            originalContent: { title: "Keep English", description: "Keep summary" },
            translation: null,
            isMachineTranslated: true,
            isStale: false,
            canViewOriginal: true,
            canViewTranslation: false,
          };
        },
        generateContentTranslation: async () => {
          generateCalls += 1;
          throw new Error("must not generate when preference is none");
        },
      },
    );
    assert.equal(resolveCalls, 1);
    assert.equal(generateCalls, 0);
    assert.equal(presented.title, "Українська назва");
    assert.equal(presented.presentationMode, "translated");
  });

  it("WorldInitiativeCard localizes chrome via existing catalogs", () => {
    const world = readWeb("features/initiatives/components/WorldInitiativesPageContent.tsx");

    assert.match(world, /useTranslations\("publicInitiativeMiniCard"\)/);
    assert.match(world, /useTranslations\("initiativeExperience"\)/);
    assert.match(world, /tMini\("viewInitiative"\)/);
    assert.match(world, /tExperience\("hero\.activityArea"\)/);
    assert.match(world, /resolveInitiativeCardBadgeLabel/);
    assert.match(world, /tExperience\("overview\.startDate"\)/);
    assert.match(world, /tExperience\("overview\.completionDate"\)/);
    assert.match(world, /resolveActivityAreaDisplayLabel/);
    assert.match(world, /WorkspaceStatusBadge/);
    assert.doesNotMatch(world, />Activity Area</);
    assert.doesNotMatch(world, /View Initiative →/);
  });
});
