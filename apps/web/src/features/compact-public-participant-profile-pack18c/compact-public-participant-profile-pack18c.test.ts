/**
 * Pack 18C — Compact public Participant Profile card presentation.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const webRoot = path.resolve(webSrc, "..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 18C — compact public participant profile card", () => {
  it("uses one outer card: identity → info|stats → biography → initiatives", () => {
    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.match(surface, /public-member-page__card/);
    assert.match(surface, /public-member-page__body-row/);
    assert.match(surface, /public-member-page__info/);
    assert.match(surface, /public-member-page__statistics/);
    assert.match(surface, /size=\{88\}/);

    const identityIdx = surface.indexOf("public-member-page__identity");
    const heroIdx = surface.indexOf("public-member-page__hero");
    const bodyIdx = surface.indexOf("public-member-page__body-row");
    const infoIdx = surface.indexOf("public-member-page__info");
    const statsIdx = surface.indexOf("public-member-page__statistics");
    const bioIdx = surface.indexOf('id="biography"');
    const initiativesIdx = surface.indexOf("<RecentPublicInitiativesDisclosure");

    assert.ok(heroIdx > 0 && identityIdx > 0 && bodyIdx > heroIdx);
    assert.ok(infoIdx > bodyIdx && statsIdx > infoIdx);
    assert.ok(bioIdx > statsIdx && initiativesIdx > bioIdx);

    // Organization only once, in info card (not under statistics).
    assert.equal((surface.match(/id="organization"/g) ?? []).length, 1);
    const statsBlock = surface.slice(statsIdx, bioIdx);
    assert.doesNotMatch(statsBlock, /id="organization"/);
    assert.doesNotMatch(statsBlock, /id="skills"/);
    assert.match(surface.slice(infoIdx, statsIdx), /id="organization"/);
    assert.match(surface.slice(infoIdx, statsIdx), /id="skills"/);
    assert.match(surface.slice(infoIdx, statsIdx), /id="professional-links"/);
  });

  it("compact card CSS uses Pack 17A tokens without fixed viewport clipping", () => {
    const css = readWeb("features/member-profile/components/participant-profile-surface.css");
    assert.match(css, /\.public-member-page__card/);
    assert.match(css, /max-width:\s*54rem/);
    assert.match(css, /--hu-shadow-elevated/);
    assert.match(css, /--hu-shadow-subtle/);
    assert.match(css, /\.public-member-page__body-row[\s\S]*grid-template-columns:\s*repeat\(2/s);
    assert.doesNotMatch(css, /height:\s*100vh|max-height:\s*100vh|overflow:\s*hidden\s*;\s*\/\*\s*clip/);
    assert.match(css, /@media \(max-width: 767px\)[\s\S]*grid-template-columns:\s*1fr/);
  });

  it("preserves disclosure, icons, and Message action wiring", () => {
    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.match(surface, /DirectMessageAction/);
    assert.match(surface, /MemberProfessionalLinksDisplay/);
    assert.match(surface, /RecentPublicInitiativesDisclosure/);
    assert.match(surface, /biography\.png/);
    assert.match(surface, /organization\.png/);
    assert.match(surface, /skills\.png/);

    const disclosure = readWeb(
      "features/member-profile/components/RecentPublicInitiativesDisclosure.tsx",
    );
    assert.match(disclosure, /aria-expanded=\{open\}/);
    assert.match(disclosure, /publications\.png/);

    for (const icon of [
      "biography.png",
      "publications.png",
      "skills.png",
      "organization.png",
    ]) {
      assert.ok(existsSync(path.join(webRoot, "public/icons/workspace", icon)));
    }
  });
});
