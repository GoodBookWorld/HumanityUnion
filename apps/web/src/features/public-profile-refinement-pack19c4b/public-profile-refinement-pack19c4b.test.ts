/**
 * Pack 19C.4B — Public Profile messaging & Biography refinement contracts.
 * (Updated for Pack 19C.4D Direct Message CTA + section-background mountains.)
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PERSONAL_STATISTICS_CARDS } from "../personal-statistics/personal-statistics-cards.config.js";
import { buildVisibleStatisticCards } from "../member-profile/participant-profile-surface-presentation.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const webRoot = path.resolve(webSrc, "..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 19C.4B — Public Profile messaging & Biography refinement", () => {
  it("keeps DirectMessageAction with eligibility + labeled secondary CTA", () => {
    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");
    const action = readWeb("features/direct-messaging/components/DirectMessageAction.tsx");
    const hook = readWeb("features/direct-messaging/use-open-direct-conversation.ts");

    assert.match(surface, /DirectMessageAction/);
    assert.match(surface, /public-member-page__message-action/);
    assert.match(action, /profile\.messagingAvailability/);
    assert.match(action, /openConversation\(\{ publicName \}\)/);
    assert.match(action, /aria-label=\{accessibleLabel\}/);
    assert.match(
      action,
      /className="direct-message-action__button hu-button hu-button--secondary"/,
    );
    assert.match(hook, /\/workspace\/messages\//);
    assert.match(action, /availability === "hidden" \|\| availability === "unavailable"/);
    assert.doesNotMatch(action, /direct-message-action__unavailable/);
  });

  it("places Messaging in the cover bottom-right", () => {
    const css = readWeb("features/member-profile/components/participant-profile-surface.css");

    assert.match(
      css,
      /\.public-member-page__message-action\s*\{[\s\S]*position:\s*absolute[\s\S]*right:[\s\S]*bottom:/m,
    );
  });

  it("hides Participation Area from public statistics; keeps six cards", () => {
    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");
    const presentation = readWeb(
      "features/member-profile/participant-profile-surface-presentation.ts",
    );

    assert.doesNotMatch(surface, /Participation Area/);
    assert.doesNotMatch(surface, /id="participation-area"/);
    assert.match(surface, /public-member-page__statistics/);
    assert.match(presentation, /buildParticipationAreaLabels/);
    assert.match(presentation, /hasVisibleParticipationArea/);

    assert.deepEqual(
      PERSONAL_STATISTICS_CARDS.map((card) => card.key),
      [
        "initiativesCount",
        "collectiveDecisionsCount",
        "alliesCount",
        "proposalsCount",
        "petitionsCount",
        "commitmentsFulfilledCount",
      ],
    );
    assert.equal(
      buildVisibleStatisticCards({
        initiativesCount: 1,
        collectiveDecisionsCount: 2,
        alliesCount: 3,
        proposalsCount: 4,
        petitionsCount: 5,
        commitmentsFulfilledCount: 6,
      }).length,
      6,
    );
  });

  it("Biography uses section-background mountains with ~70% transparent copy; tablet hides art", () => {
    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");
    const css = readWeb("features/member-profile/components/participant-profile-surface.css");

    assert.doesNotMatch(surface, /biography-art/);
    assert.match(
      css,
      /\.public-member-page__biography\s*\{[\s\S]*url\("\/illustrations\/mountains\.webp"\)/m,
    );
    assert.match(
      css,
      /\.public-member-page__biography-copy\s*\{[\s\S]*width:\s*70%[\s\S]*background:\s*transparent/m,
    );
    assert.match(
      css,
      /@media \(max-width: 900px\)[\s\S]*\.public-member-page__biography-copy\s*\{[\s\S]*width:\s*100%/s,
    );
    assert.ok(existsSync(path.join(webRoot, "public/illustrations/mountains.webp")));
  });

  it("preserves mobile network-off, statistics typography, and privacy filtering", () => {
    const css = readWeb("features/member-profile/components/participant-profile-surface.css");
    const statsCss = readWeb("features/personal-statistics/personal-statistics.css");

    assert.match(
      css,
      /@media \(max-width: 767px\)[\s\S]*\.public-member-page__hero-network\s*\{[\s\S]*display:\s*none/s,
    );
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.match(statsCss, /overflow-wrap:\s*normal/);
    assert.match(statsCss, /word-break:\s*normal/);
    assert.doesNotMatch(statsCss, /word-break:\s*break-all/);

    const hiddenProposals = buildVisibleStatisticCards({
      initiativesCount: 1,
      collectiveDecisionsCount: 2,
      alliesCount: 3,
      petitionsCount: 5,
      commitmentsFulfilledCount: 6,
    });
    assert.equal(
      hiddenProposals.some((card) => card.key === "proposalsCount"),
      false,
    );
  });
});
