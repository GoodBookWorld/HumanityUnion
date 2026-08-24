/**
 * Pack 17E — Participant professional social links UI contracts.
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

describe("Pack 17E — participant professional social links UI", () => {
  it("settings form includes icon + URL inputs for Facebook/YouTube/Instagram/X", () => {
    const section = readWeb(
      "features/member-profile/components/MemberProfessionalLinksSection.tsx",
    );
    assert.match(section, /facebookUrl/);
    assert.match(section, /youtubeUrl/);
    assert.match(section, /instagramUrl/);
    assert.match(section, /xUrl/);
    assert.match(section, /icons8-facebook\.svg/);
    assert.match(section, /icons8-youtube\.svg/);
    assert.match(section, /icons8-instagram\.svg/);
    assert.match(section, /icons8-x\.svg/);
    assert.match(section, /not Humanity Union publication/);
    assert.match(section, /rel="noopener noreferrer"/);
    assert.match(section, /aria-label=\{field\.label\}/);
    assert.match(section, /linkedinUrl/);
    assert.match(section, /website/);
  });

  it("canonical civic icons exist for the four networks", () => {
    for (const icon of [
      "icons8-facebook.svg",
      "icons8-youtube.svg",
      "icons8-instagram.svg",
      "icons8-x.svg",
      "icons8-linkedin.svg",
      "website.svg",
    ]) {
      assert.ok(
        existsSync(path.join(webRoot, "public/icons/civic", icon)),
        `missing public/icons/civic/${icon}`,
      );
    }
  });

  it("workspace saves personal social fields on the shared profile API", () => {
    const workspace = readWeb("features/member-profile/components/MemberProfileWorkspace.tsx");
    assert.match(workspace, /facebookUrl: profile\.facebookUrl/);
    assert.match(workspace, /youtubeUrl: profile\.youtubeUrl/);
    assert.match(workspace, /instagramUrl: profile\.instagramUrl/);
    assert.match(workspace, /xUrl: profile\.xUrl/);
    assert.match(workspace, /updateMyMemberProfile/);

    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.match(surface, /facebookUrl=\{profile\.facebookUrl\}/);
    assert.match(surface, /xUrl=\{profile\.xUrl\}/);
  });
});
