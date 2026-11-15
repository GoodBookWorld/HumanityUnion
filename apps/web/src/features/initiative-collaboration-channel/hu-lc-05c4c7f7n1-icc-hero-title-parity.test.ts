/**
 * HU-LC-05C.4C.7F.7N.1 — ICC title matches Initiative hero presentation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(HERE, "../..");
const readWeb = (relative: string) => readFileSync(path.join(WEB_SRC, relative), "utf8");

describe("HU-LC-05C.4C.7F.7N.1 — ICC / hero title parity", () => {
  it("hero owns presentation via useInitiativePublicPresentation", () => {
    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    const hero = readWeb(
      "features/public-initiative-experience/components/PublicExperienceHero.tsx",
    );
    assert.match(page, /useInitiativePublicPresentation/);
    assert.match(page, /presentation=\{initiativePresentation\}/);
    assert.match(hero, /presentation\?\.title/);
    assert.match(hero, /displayTitle = presentation\?\.title \?\? title/);
  });

  it("page threads the same presentation title into ICC (no separate page CT)", () => {
    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    const sidebar = readWeb(
      "features/public-initiative-experience/components/PublicExperienceSidebarOrChannel.tsx",
    );
    const workspace = readWeb(
      "features/public-initiative-experience/components/InitiativeCollaborationWorkspace.tsx",
    );
    const channel = readWeb(
      "features/initiative-collaboration-channel/components/InitiativeCollaborationChannel.tsx",
    );
    const hook = readWeb(
      "features/initiative-collaboration-channel/use-icc-initiative-display-title.ts",
    );

    assert.match(page, /initiativeDisplayTitle=\{initiativePresentation\.title\}/);
    assert.match(sidebar, /initiativeDisplayTitle=\{initiativeDisplayTitle\}/);
    assert.match(workspace, /initiativeDisplayTitle=\{initiativeDisplayTitle\}/);
    assert.match(channel, /pagePresentationTitle:\s*initiativeDisplayTitle/);
    assert.match(hook, /usesPagePresentation/);
    assert.match(hook, /if \(usesPagePresentation\)/);
    assert.doesNotMatch(hook, /gemini/i);
    assert.doesNotMatch(channel, /gemini/i);
  });

  it("hero detail resolver remains pair-gated; ICC page path does not invent a second lifecycle", () => {
    const detail = readWeb(
      "features/public-initiative-experience/resolve-initiative-detail-presentation.ts",
    );
    const hook = readWeb(
      "features/initiative-collaboration-channel/use-icc-initiative-display-title.ts",
    );
    assert.match(detail, /completeTranslatedBag/);
    assert.match(detail, /resolvePublicContentTranslationDisplay/);
    assert.match(hook, /pagePresentationTitle/);
    assert.match(
      hook,
      /Only when that is absent[\s\S]*resolveIccInitiativeDisplayTitle|usesPagePresentation[\s\S]*resolveIccInitiativeDisplayTitle/,
    );
  });
});
