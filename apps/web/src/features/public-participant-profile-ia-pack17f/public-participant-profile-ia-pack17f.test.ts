/**
 * Pack 17F — Public Participant profile information architecture.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const webRoot = path.resolve(webSrc, "..");
const apiSrc = path.resolve(webRoot, "../api/src");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readApi(relativePath: string): string {
  return readFileSync(path.join(apiSrc, relativePath), "utf8");
}

describe("Pack 17F — public participant profile information architecture", () => {
  it("verifies exact workspace icon assets exist", () => {
    for (const icon of [
      "biography.png",
      "publications.png",
      "skills.png",
      "organization.png",
    ]) {
      assert.ok(
        existsSync(path.join(webRoot, "public/icons/workspace", icon)),
        `missing public/icons/workspace/${icon}`,
      );
    }
  });

  it("orders Organization above Skills in statistics; Biography below top row once", () => {
    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");
    const organizationIdx = surface.indexOf('id="organization"');
    const skillsIdx = surface.indexOf('id="skills"');
    const statisticsIdx = surface.indexOf("public-member-page__statistics");
    const biographySectionIdx = surface.indexOf("public-member-page__biography");
    const identityIdx = surface.indexOf("public-member-page__identity");

    assert.ok(statisticsIdx > identityIdx);
    assert.ok(organizationIdx > statisticsIdx);
    assert.ok(skillsIdx > organizationIdx);
    assert.ok(biographySectionIdx > skillsIdx);
    assert.equal((surface.match(/id="biography"/g) ?? []).length, 1);
    assert.equal((surface.match(/id="organization"/g) ?? []).length, 1);

    // Biography must not remain inside the identity card after Pack 17F.
    const identityBlock = surface.slice(
      identityIdx,
      surface.indexOf("public-member-page__statistics"),
    );
    assert.doesNotMatch(identityBlock, /id="biography"/);
    assert.doesNotMatch(identityBlock, /id="organization"/);

    assert.match(surface, /icons\/workspace\/biography\.png/);
    assert.match(surface, /icons\/workspace\/organization\.png/);
    assert.match(surface, /icons\/workspace\/skills\.png/);
    assert.match(surface, /hu-surface-raised/);
  });

  it("keeps professional social icon links and omits empty networks via display helper", () => {
    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.match(surface, /facebookUrl=\{profile\.facebookUrl\}/);
    assert.match(surface, /youtubeUrl=\{profile\.youtubeUrl\}/);
    assert.match(surface, /instagramUrl=\{profile\.instagramUrl\}/);
    assert.match(surface, /xUrl=\{profile\.xUrl\}/);
    assert.match(surface, /MemberProfessionalLinksDisplay/);

    const links = readWeb(
      "features/member-profile/components/MemberProfessionalLinksSection.tsx",
    );
    assert.match(links, /hasConfiguredProfessionalLinks/);
    assert.match(links, /rel="noopener noreferrer"/);
    assert.match(links, /icons8-facebook\.svg/);
    assert.match(links, /icons8-youtube\.svg/);
    assert.match(links, /icons8-instagram\.svg/);
    assert.match(links, /icons8-x\.svg/);
  });

  it("Recent Public Initiatives uses Pack 17A disclosure semantics", () => {
    const disclosure = readWeb(
      "features/member-profile/components/RecentPublicInitiativesDisclosure.tsx",
    );
    assert.match(disclosure, /aria-expanded=\{open\}/);
    assert.match(disclosure, /aria-controls=/);
    assert.match(disclosure, /hu-tab-control/);
    assert.match(disclosure, /icons\/workspace\/publications\.png/);
    assert.match(disclosure, /Recent Public Initiatives/);
    assert.match(disclosure, /type="button"/);
    assert.doesNotMatch(disclosure, /modal|dialog/i);

    const css = readWeb("features/member-profile/components/participant-profile-surface.css");
    assert.match(css, /\.public-member-page__initiatives-toggle/);
    assert.match(css, /#ffffff/);
    assert.match(css, /\.public-member-page__initiatives-panel\.is-open/);

    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.match(surface, /RecentPublicInitiativesDisclosure/);
    assert.match(surface, /hu-surface-raised/);
  });

  it("initiative list remains publicly filtered server-side; responsive full-width contract", () => {
    const store = readApi("modules/initiatives/initiative.store.ts");
    assert.match(store, /listPublicInitiativesBySteward/);
    assert.match(store, /isInitiativeEligibleForPublicProjection/);

    const service = readApi("modules/member-profile/member-profile.service.ts");
    assert.match(service, /listPublicInitiativesBySteward/);
    assert.match(service, /recentPublicInitiatives/);

    const css = readWeb("features/member-profile/components/participant-profile-surface.css");
    assert.match(css, /\.public-member-page__biography[\s\S]*width:\s*100%/);
    assert.match(css, /@media \(max-width: 767px\)[\s\S]*grid-template-columns:\s*1fr/);
    assert.match(
      css,
      /@media \(max-width: 480px\)[\s\S]*\.public-member-page__biography[\s\S]*width:\s*100%/,
    );
  });
});
