/**
 * Pack 17G — Social / Publishing / Profile integration certification.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const apiSrc = path.resolve(webSrc, "../../api/src");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readApi(relativePath: string): string {
  return readFileSync(path.join(apiSrc, relativePath), "utf8");
}

describe("Pack 17G — social / publishing / profile integration", () => {
  it("separates Admin platform accounts, Participant personal links, and publication distribution", () => {
    const overview = readWeb("features/administration/components/AdminOverviewSection.tsx");
    const editorsIdx = overview.indexOf('title="Editors"');
    const platformIdx = overview.indexOf('title="Platform social accounts"');
    assert.ok(editorsIdx > 0 && platformIdx > editorsIdx);
    const titles = [...overview.matchAll(/<ProfileSection title="([^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.equal(titles[titles.length - 1], "Platform social accounts");

    const footer = readWeb("features/public-experience/components/FooterSocialLinks.tsx");
    assert.match(footer, /platform-social-accounts-public-api/);
    assert.doesNotMatch(footer, /facebookUrl|linkedinUrl|huPlatformChannels/);
    assert.doesNotMatch(footer, /administration\/admin-platform-social-accounts-api/);

    const distribution = readWeb(
      "features/blog/components/BlogPublicationOptimizationPanel.tsx",
    );
    assert.match(distribution, /platform-social-accounts-public-api/);
    assert.match(distribution, /huPlatformChannels/);
    assert.match(distribution, /not access to your personal social accounts/i);
    assert.doesNotMatch(distribution, /facebookUrl|profile\.facebook/);
    assert.doesNotMatch(distribution, /Author connected social accounts/);

    const personal = readWeb(
      "features/member-profile/components/MemberProfessionalLinksSection.tsx",
    );
    assert.match(personal, /facebookUrl/);
    assert.match(personal, /not Humanity Union publication/);
    assert.doesNotMatch(personal, /huPlatformChannels|platform\/social-accounts/);
  });

  it("server distribution resolves Pack 17C destinations and blocks early publish states", () => {
    const seo = readApi("modules/blog/blog-seo.ts");
    assert.match(seo, /must not include account URLs/);
    assert.match(seo, /gateBlogPublicationOptimizationAgainstPlatformAccounts/);
    assert.match(seo, /listPublicPlatformSocialAccounts/);

    const distribution = readApi("modules/blog/blog-social-distribution.ts");
    assert.match(distribution, /listPublicPlatformSocialAccounts/);
    assert.match(distribution, /blocked_not_published/);
    assert.match(distribution, /administrativelyBlocked/);
    assert.match(distribution, /awaiting_provider/);
    assert.doesNotMatch(distribution, /Published to Facebook|delivered successfully/i);
    assert.match(distribution, /authorExternalAccounts: \[\]/);

    const provider = readApi("modules/blog/blog-social-distribution-provider.ts");
    assert.match(provider, /not_connected/);
    assert.doesNotMatch(provider, /access_token|client_secret|oauth_token/i);
  });

  it("publishing editor layout + Pack 17A surfaces remain coherent", () => {
    const publishingCss = readWeb("features/blog/publishing.css");
    const chromeBlock = publishingCss.match(/\.blog-post-editor__chrome\s*\{[^}]+\}/);
    assert.ok(chromeBlock);
    assert.match(chromeBlock[0], /position:\s*static/);
    assert.match(publishingCss, /overscroll-behavior:\s*auto/);
    assert.match(publishingCss, /optimization__grid[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
    assert.match(publishingCss, /--hu-shadow-elevated/);

    const workspace = readWeb("components/member/MemberWorkspace.tsx");
    assert.match(workspace, /assistantPlacement === "compact"/);

    const adminCss = readWeb("features/administration/components/admin-publishing.css");
    assert.match(adminCss, /--hu-shadow-elevated|--hu-border-card/);
    assert.match(adminCss, /--hu-shadow-inset-field/);
    assert.doesNotMatch(adminCss, /box-shadow:\s*0\s+8px\s+24px/);
  });
});
