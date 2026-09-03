/**
 * Pack 08I.8 — World Initiative card title/status/visual + raw i18n key guards.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { resolveInitiativeStatusDisplayLabel } from "../public-initiative-experience/initiative-experience-i18n.js";
import {
  looksLikeRawI18nKey,
  normalizeInitiativeStatusCode,
} from "../public-initiative-experience/normalize-initiative-status-code.js";
import { resolveInitiativeDetailPresentation } from "../public-initiative-experience/resolve-initiative-detail-presentation.js";
import { resolveInitiativeCardPresentation } from "../public-initiative-mini-card/resolve-initiative-card-presentation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("Pack 08I.8 — World Initiative + status key integrity", () => {
  it("normalizes Title-Case publicStatus to canonical snake_case codes", () => {
    assert.equal(normalizeInitiativeStatusCode("Proposal"), "proposal");
    assert.equal(normalizeInitiativeStatusCode("Ready For Poll"), "ready_for_poll");
    assert.equal(normalizeInitiativeStatusCode("ready_for_poll"), "ready_for_poll");
    assert.equal(normalizeInitiativeStatusCode("Discussion"), "discussion");
  });

  it("Title-Case status resolves localized label (RAW_STATUS_I18N_KEY_LEAK=0)", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const label = resolveInitiativeStatusDisplayLabel("Proposal", uk.messages);
    assert.equal(label, "Пропозиція");
    assert.equal(looksLikeRawI18nKey(label), false);
    assert.doesNotMatch(label, /initiativeExperience\.statuses/);

    const ready = resolveInitiativeStatusDisplayLabel("Ready For Poll", uk.messages);
    assert.ok(ready.length > 0);
    assert.equal(looksLikeRawI18nKey(ready), false);
  });

  it("detects raw namespaced i18n key leakage shapes", () => {
    assert.equal(looksLikeRawI18nKey("initiativeExperience.statuses.Proposal"), true);
    assert.equal(looksLikeRawI18nKey("membershipPublic.hero.title"), true);
    assert.equal(looksLikeRawI18nKey("Пропозиція"), false);
    assert.equal(looksLikeRawI18nKey("Ready for poll"), false);
  });

  it("EXISTING UK initiative translation → card title + detail hero/overview fields", async () => {
    const fixture = {
      presentationMode: "preferred_translation" as const,
      content: {
        title: "Українська назва",
        description: "Український опис ініціативи",
      },
      activeLanguage: "uk" as const,
      originalLanguage: "en" as const,
      originalContent: {
        title: "English Title",
        description: "English description",
      },
      translation: null,
      isMachineTranslated: true,
      isStale: false,
      canViewOriginal: true,
      canViewTranslation: true,
    };

    const card = await resolveInitiativeCardPresentation(
      {
        initiativeId: "init-uk-1",
        canonical: { title: "English Title", summary: "English summary" },
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () => fixture,
        generateContentTranslation: async () => {
          throw new Error("must not generate");
        },
      },
    );
    assert.equal(card.title, "Українська назва");
    assert.equal(card.presentationMode, "translated");

    const detail = await resolveInitiativeDetailPresentation(
      {
        initiativeId: "init-uk-1",
        canonical: { title: "English Title", description: "English description" },
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () => fixture,
        generateContentTranslation: async () => {
          throw new Error("must not generate");
        },
      },
    );
    assert.equal(detail.title, "Українська назва");
    assert.equal(detail.description, "Український опис ініціативи");
    assert.equal(detail.originalTitle, "English Title");
  });

  it("World card DOM hierarchy + shared presentation wiring", () => {
    const world = readWeb("features/initiatives/components/WorldInitiativesPageContent.tsx");
    const css = readWeb("features/initiatives/components/world-initiatives-page.css");
    const hero = readWeb(
      "features/public-initiative-experience/components/PublicExperienceHero.tsx",
    );
    const panel = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );

    assert.match(world, /resolveInitiativeCardPresentation/);
    assert.match(world, /world-initiative-card__meta-label/);
    assert.match(world, /world-initiative-card__meta-value/);
    assert.match(world, /resolveInitiativeCardBadgeLabel|resolveInitiativeStatusDisplayLabel/);
    assert.match(css, /font-weight:\s*700/);
    assert.match(css, /world-initiative-card__meta-label/);
    assert.match(css, /world-initiative-card__meta-value/);
    assert.match(hero, /resolveInitiativeDetailPresentation/);
    assert.match(panel, /OverviewTranslatedDescription/);
    assert.match(panel, /lifecycleEmpty\./);
    assert.doesNotMatch(hero, /resolveTranslatedContent\(\{/);
  });
});
