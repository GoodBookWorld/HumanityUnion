/**
 * Pack 19C.4D — Direct Message CTA restore & Biography background composition.
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

describe("Pack 19C.4D — Direct Message CTA & Biography background", () => {
  it("restores labeled secondary Direct Message CTA with existing openConversation flow", () => {
    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");
    const action = readWeb("features/direct-messaging/components/DirectMessageAction.tsx");
    const hook = readWeb("features/direct-messaging/use-open-direct-conversation.ts");

    assert.match(surface, /public-member-page__hero/);
    assert.match(surface, /public-member-page__message-action/);
    assert.match(surface, /DirectMessageAction/);
    assert.doesNotMatch(surface, /variant="icon"/);
    assert.match(
      action,
      /className="direct-message-action__button hu-button hu-button--secondary"/,
    );
    assert.match(action, /openConversation\(\{ publicName \}\)/);
    assert.match(action, /profile\.messagingAvailability/);
    assert.match(action, /authStatus !== "authenticated"/);
    assert.match(action, /authStatus === "unauthenticated"/);
    assert.match(action, /\/login\?returnTo=/);
    assert.match(action, /aria-label=\{accessibleLabel\}/);
    assert.match(hook, /\/workspace\/messages\//);
    assert.doesNotMatch(action, /allies-widget__message-button/);
    assert.doesNotMatch(action, /direct-message-action__unavailable/);
  });

  it("places CTA bottom-right in hero; guest CTA uses login returnTo (Pack 19C.4F)", () => {
    const css = readWeb("features/member-profile/components/participant-profile-surface.css");
    const action = readWeb("features/direct-messaging/components/DirectMessageAction.tsx");
    const service = readFileSync(
      path.resolve(webRoot, "../api/src/modules/member-profile/member-profile.service.ts"),
      "utf8",
    );

    assert.match(
      css,
      /\.public-member-page__message-action\s*\{[\s\S]*position:\s*absolute[\s\S]*right:[\s\S]*bottom:/m,
    );
    assert.match(action, /authStatus === "unauthenticated"/);
    assert.match(action, /\/login\?returnTo=/);
    // Self / guest projection still maps to hidden on the server; client guest CTA is auth-entry only.
    assert.match(service, /Guests[\s\S]*"hidden"/);
  });

  it("mountains are biography section background; copy is transparent ~70%", () => {
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
      /\.public-member-page__biography-copy\s*\{[\s\S]*width:\s*70%[\s\S]*max-width:\s*70%/m,
    );
    assert.doesNotMatch(css, /biography-art-image/);
    assert.match(
      css,
      /@media \(max-width: 900px\)[\s\S]*\.public-member-page__biography\s*\{[\s\S]*background-image:\s*linear-gradient/s,
    );
    assert.match(
      css,
      /@media \(max-width: 900px\)[\s\S]*\.public-member-page__biography-copy\s*\{[\s\S]*width:\s*100%/s,
    );
    assert.ok(existsSync(path.join(webRoot, "public/illustrations/mountains.webp")));
  });

  it("preserves six cards and mobile network-off cover", () => {
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
