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
  it("MiniCard and WorldInitiativeCard both use resolveInitiativeCardPresentation", () => {
    const mini = readWeb("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    const world = readWeb("features/initiatives/components/WorldInitiativesPageContent.tsx");
    const resolver = readWeb(
      "features/public-initiative-mini-card/resolve-initiative-card-presentation.ts",
    );

    assert.match(mini, /resolveInitiativeCardPresentation/);
    assert.match(world, /resolveInitiativeCardPresentation/);
    assert.match(world, /function WorldInitiativeCard/);
    assert.match(world, /usePublicContentReadingContext/);
    assert.match(world, /useEffect/);
    assert.doesNotMatch(mini, /resolveTranslatedContent\s*\(/);
    assert.doesNotMatch(mini, /generateContentTranslation\s*\(/);
    assert.doesNotMatch(world, /resolveTranslatedContent\s*\(/);
    assert.doesNotMatch(world, /generateContentTranslation\s*\(/);
    assert.match(resolver, /sourceKind:\s*"initiative"/);
    assert.match(resolver, /resolveTranslatedContent/);
    assert.match(resolver, /generateContentTranslation/);
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

  it("short-circuits when !ready or preference === none without calling resolve", async () => {
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

    const nonePref = await resolveInitiativeCardPresentation({
      initiativeId: "init-1",
      canonical: { title: "Canonical Title", summary: "Canonical Summary" },
      readingContext: {
        ready: true,
        readingLanguage: "uk",
        translationPreference: "none",
      },
    });
    assert.deepEqual(nonePref, {
      title: "Canonical Title",
      summary: "Canonical Summary",
      presentationMode: "original",
      isStale: false,
    });
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
    assert.match(mini, /resolveInitiativeCardPresentation/);
    assert.match(world, /resolveInitiativeCardPresentation/);
    assert.match(
      world,
      /from ["'].*public-initiative-mini-card\/resolve-initiative-card-presentation["']/,
    );
  });

  it("proves TRANSLATION_EXISTS path is wired via resolveTranslatedContent", () => {
    const resolver = readWeb(
      "features/public-initiative-mini-card/resolve-initiative-card-presentation.ts",
    );

    assert.match(resolver, /deps\.resolveTranslatedContent\(\{|resolveTranslatedContent\(\{/);
    assert.match(resolver, /sourceKind:\s*"initiative"/);
    assert.match(resolver, /sourceRecordId:\s*input\.initiativeId/);
    assert.match(resolver, /language:\s*readingContext\.readingLanguage/);
    assert.match(resolver, /TRANSLATION_EXISTS|non-original|presentationMode === "original"/);
    assert.match(
      resolver,
      /shouldAttemptOnDemandContentTranslation[\s\S]*generateContentTranslation|translationPreference === "preferred"[\s\S]*generateContentTranslation/,
    );
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

  it("authenticated explicit none never calls resolve (interface locale must not override)", async () => {
    let resolveCalls = 0;
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
          throw new Error("unreachable");
        },
        generateContentTranslation: async () => {
          throw new Error("unreachable");
        },
      },
    );
    assert.equal(resolveCalls, 0);
    assert.equal(presented.title, "Keep English");
    assert.equal(presented.presentationMode, "original");
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
