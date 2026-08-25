/**
 * Pack 19C.4 — Public Participant Profile visual redesign contracts.
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

describe("Pack 19C.4 — Public Participant Profile visual redesign", () => {
  it("keeps six statistics mapped and privacy filtering unchanged", () => {
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

    const all = buildVisibleStatisticCards({
      initiativesCount: 1,
      collectiveDecisionsCount: 2,
      alliesCount: 3,
      proposalsCount: 4,
      petitionsCount: 5,
      commitmentsFulfilledCount: 6,
    });
    assert.equal(all.length, 6);

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
    assert.equal(hiddenProposals.length, 5);
  });

  it("hero renders branded cover with network layer + avatar identity", () => {
    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.match(surface, /public-member-page__hero/);
    assert.match(surface, /public-member-page__hero-network/);
    assert.match(surface, /ProfileHeroNetwork/);
    assert.match(surface, /HumanityAvatar/);
    assert.match(surface, /size=\{88\}/);
    assert.match(surface, /@\{profile\.publicName\}/);
    assert.match(surface, /id="organization"/);
    assert.match(surface, /id="skills"/);
    assert.match(surface, /id="biography"/);
    assert.match(surface, /RecentPublicInitiativesDisclosure/);
  });

  it("social links stay as anchors with aria-label; icon-only on public surface", () => {
    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");
    const links = readWeb("features/member-profile/components/MemberProfessionalLinksSection.tsx");

    assert.match(surface, /variant="icons"/);
    assert.match(links, /aria-label=\{field\.label\}/);
    assert.match(links, /variant === "icons" \? null : <span>\{field\.label\}<\/span>/);
    assert.match(links, /rel="noopener noreferrer"/);
    assert.match(links, /href=\{href\}/);
  });

  it("Biography wires mountains.webp as section background; tablet hides artwork", () => {
    const css = readWeb("features/member-profile/components/participant-profile-surface.css");

    assert.match(
      css,
      /\.public-member-page__biography\s*\{[\s\S]*url\("\/illustrations\/mountains\.webp"\)/m,
    );
    assert.match(
      css,
      /\.public-member-page__biography-copy\s*\{[\s\S]*width:\s*70%/m,
    );
    assert.match(
      css,
      /@media \(max-width: 900px\)[\s\S]*\.public-member-page__biography\s*\{[\s\S]*background-image:\s*linear-gradient/s,
    );
    assert.ok(existsSync(path.join(webRoot, "public/illustrations/mountains.webp")));
  });

  it("mobile hero disables network animation; reduced-motion stops signals", () => {
    const css = readWeb("features/member-profile/components/participant-profile-surface.css");

    assert.match(
      css,
      /@media \(max-width: 767px\)[\s\S]*\.public-member-page__hero-network\s*\{[\s\S]*display:\s*none/s,
    );
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.match(
      css,
      /prefers-reduced-motion:\s*reduce[\s\S]*\.public-member-page__hero-signal[\s\S]*animation:\s*none/s,
    );
  });

  it("statistics labels prefer container-aware sizing without mid-word breaks", () => {
    const css = readWeb("features/personal-statistics/personal-statistics.css");
    assert.match(css, /container-type:\s*inline-size/);
    assert.match(css, /overflow-wrap:\s*normal/);
    assert.match(css, /word-break:\s*normal/);
    assert.doesNotMatch(css, /word-break:\s*break-all/);
    assert.doesNotMatch(css, /overflow-wrap:\s*break-word/);
  });
});
