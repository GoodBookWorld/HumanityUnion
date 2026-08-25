/**
 * Pack 19C.4C — Messaging button restore & Biography artwork correction.
 * (Superseded visually by Pack 19C.4D secondary CTA + section-background mountains;
 * retained contracts that still apply.)
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

describe("Pack 19C.4C — Messaging button restore & Biography artwork", () => {
  it("cover Messaging uses DirectMessageAction + existing openConversation", () => {
    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");
    const action = readWeb("features/direct-messaging/components/DirectMessageAction.tsx");
    const hook = readWeb("features/direct-messaging/use-open-direct-conversation.ts");

    assert.match(surface, /public-member-page__hero/);
    assert.match(surface, /public-member-page__message-action/);
    assert.match(surface, /DirectMessageAction/);
    assert.match(action, /openConversation\(\{ publicName \}\)/);
    assert.match(action, /profile\.messagingAvailability/);
    assert.match(action, /aria-label=\{accessibleLabel\}/);
    assert.match(hook, /\/workspace\/messages\//);
    assert.match(action, /availability === "hidden" \|\| availability === "unavailable"/);
    assert.doesNotMatch(action, /direct-message-action__unavailable/);
  });

  it("places Messaging bottom-right in the cover", () => {
    const css = readWeb("features/member-profile/components/participant-profile-surface.css");

    assert.match(
      css,
      /\.public-member-page__message-action\s*\{[\s\S]*position:\s*absolute[\s\S]*right:[\s\S]*bottom:/m,
    );
  });

  it("Biography mountains are section background; copy transparent; tablet hides art", () => {
    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");
    const css = readWeb("features/member-profile/components/participant-profile-surface.css");

    assert.doesNotMatch(surface, /biography-art/);
    assert.match(
      css,
      /\.public-member-page__biography\s*\{[\s\S]*url\("\/illustrations\/mountains\.webp"\)/m,
    );
    assert.match(
      css,
      /\.public-member-page__biography\s*\{[\s\S]*background-size:[\s\S]*auto 100%/m,
    );
    assert.match(
      css,
      /\.public-member-page__biography-copy\s*\{[\s\S]*background:\s*transparent/m,
    );
    assert.match(
      css,
      /@media \(max-width: 900px\)[\s\S]*\.public-member-page__biography-copy\s*\{[\s\S]*width:\s*100%/s,
    );
    assert.ok(existsSync(path.join(webRoot, "public/illustrations/mountains.webp")));
  });

  it("preserves six cards, privacy filtering, and mobile cover network-off", () => {
    const css = readWeb("features/member-profile/components/participant-profile-surface.css");

    assert.equal(PERSONAL_STATISTICS_CARDS.length, 6);
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
    assert.match(
      css,
      /@media \(max-width: 767px\)[\s\S]*\.public-member-page__hero-network\s*\{[\s\S]*display:\s*none/s,
    );
  });
});
