/**
 * Pack 17H — Final Block 17 Social / Publishing / Profile certification.
 * Certification-only contracts; no new product behavior.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const webRoot = path.resolve(webSrc, "..");
const apiSrc = path.resolve(webSrc, "../../api/src");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readApi(relativePath: string): string {
  return readFileSync(path.join(apiSrc, relativePath), "utf8");
}

describe("Pack 17H — final Block 17 social / publishing / profile certification", () => {
  it("17A unified 3D tokens + Admin Publishing / authoring surfaces", () => {
    const tokens = readWeb("design-system/tokens.css");
    assert.match(tokens, /--hu-shadow-elevated/);
    assert.match(tokens, /--hu-shadow-inset-field/);
    assert.match(tokens, /--hu-surface-raised/);

    const components = readWeb("design-system/components.css");
    assert.match(components, /\.hu-tab-control/);
    assert.match(components, /hu-tab-control--selected/);

    const adminSection = readWeb(
      "features/administration/components/AdminPublishingSection.tsx",
    );
    assert.match(adminSection, /hu-tab-control/);
    for (const label of [
      "Pending applications",
      "Pending Review",
      "Authors",
      "Publications",
      "Categories",
    ]) {
      assert.match(adminSection, new RegExp(label));
    }

    const publishingCss = readWeb("features/blog/publishing.css");
    assert.match(publishingCss, /--hu-shadow-elevated/);
    assert.doesNotMatch(publishingCss, /box-shadow:\s*0\s+8px\s+24px/);

    const adminCss = readWeb("features/administration/components/admin-publishing.css");
    assert.match(adminCss, /--hu-shadow-elevated|--hu-border-card/);
    assert.match(adminCss, /--hu-shadow-inset-field/);
    assert.doesNotMatch(adminCss, /box-shadow:\s*0\s+8px\s+24px/);
  });

  it("17B chrome / Assistant / CK scroll / Optimization stack", () => {
    const publishingCss = readWeb("features/blog/publishing.css");
    const chromeBlock = publishingCss.match(/\.blog-post-editor__chrome\s*\{[^}]+\}/);
    assert.ok(chromeBlock);
    assert.match(chromeBlock[0], /position:\s*static/);
    assert.match(publishingCss, /\.ck-editor__main[\s\S]*overflow-y:\s*auto/s);
    assert.match(publishingCss, /overscroll-behavior:\s*auto/);
    assert.match(
      publishingCss,
      /optimization__grid[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    );
    assert.match(publishingCss, /section--seo/);
    assert.match(publishingCss, /section--social/);
    assert.match(publishingCss, /section--distribution/);

    const workspace = readWeb("components/member/MemberWorkspace.tsx");
    assert.match(workspace, /assistantPlacement === "compact"/);

    const editorPage = readWeb("features/blog/components/BlogEditorPageContent.tsx");
    assert.doesNotMatch(editorPage, /HumanityUnionAssistantWidget/);
  });

  it("17C Platform Social Admin LAST + persistence + Footer public API", () => {
    const overview = readWeb("features/administration/components/AdminOverviewSection.tsx");
    const titles = [...overview.matchAll(/<ProfileSection title="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(titles.includes("Editors"));
    assert.equal(titles[titles.length - 1], "Platform social accounts");
    assert.equal(
      titles.filter((t) => t === "Platform social accounts").length,
      1,
      "no duplicate Platform social accounts section",
    );

    const panel = readWeb(
      "features/administration/components/AdminPlatformSocialAccountsPanel.tsx",
    );
    for (const network of ["facebook", "youtube", "instagram", "x"]) {
      assert.match(panel, new RegExp(network));
    }
    assert.match(panel, /URL saved|URL cleared/);
    assert.doesNotMatch(panel, /password|oauth|api[_-]?token|clientSecret/i);

    const collections = readApi("infrastructure/mongodb/mongo-collections.ts");
    assert.match(collections, /platform_social_accounts/);

    const doc = readApi(
      "modules/platform-social-accounts/persistence/platform-social-accounts.mongo-document.ts",
    );
    assert.match(doc, /networkId/);
    assert.doesNotMatch(doc, /accessToken|clientSecret|oauth/i);

    const footer = readWeb("features/public-experience/components/FooterSocialLinks.tsx");
    assert.match(footer, /public-experience-footer__social-list/);
    assert.match(footer, /platform-social-accounts-public-api/);
    assert.doesNotMatch(footer, /administration\/admin-platform-social-accounts-api/);

    const footerLinks = readWeb("features/public-experience/footer-links.ts");
    assert.doesNotMatch(footerLinks, /https:\/\/www\.facebook\.com\/HumanityUnion/);
  });

  it("17D Distribution semantics + server resolve + provider honesty + lifecycle", () => {
    const panel = readWeb("features/blog/components/BlogPublicationOptimizationPanel.tsx");
    assert.match(panel, /Humanity Union social distribution/);
    assert.match(panel, /huPlatformChannels/);
    assert.match(panel, /platform-social-accounts-public-api/);
    assert.doesNotMatch(panel, /facebookUrl|Author connected social accounts/);

    const seo = readApi("modules/blog/blog-seo.ts");
    assert.match(seo, /must not include account URLs|listPublicPlatformSocialAccounts/);
    assert.match(seo, /gateBlogPublicationOptimizationAgainstPlatformAccounts/);

    const distribution = readApi("modules/blog/blog-social-distribution.ts");
    assert.match(distribution, /blocked_not_published/);
    assert.match(distribution, /administrativelyBlocked/);
    assert.match(distribution, /awaiting_provider/);
    assert.doesNotMatch(distribution, /Published to Facebook|Posted to Instagram/i);
    assert.match(distribution, /authorExternalAccounts:\s*\[\]/);

    const provider = readApi("modules/blog/blog-social-distribution-provider.ts");
    assert.match(provider, /not_connected/);
    assert.doesNotMatch(provider, /access_token|client_secret|oauth_token/i);
  });

  it("17E/17F personal links + profile IA + icons; personal ≠ platform", () => {
    const personal = readWeb(
      "features/member-profile/components/MemberProfessionalLinksSection.tsx",
    );
    for (const field of ["facebookUrl", "youtubeUrl", "instagramUrl", "xUrl"]) {
      assert.match(personal, new RegExp(field));
    }
    assert.match(personal, /not Humanity Union publication/);
    assert.doesNotMatch(personal, /huPlatformChannels|platform\/social-accounts/);

    const surface = readWeb(
      "features/member-profile/components/ParticipantProfileSurface.tsx",
    );
    const orgIdx = surface.indexOf('iconSrc="/icons/workspace/organization.png"');
    const skillsIdx = surface.indexOf('iconSrc="/icons/workspace/skills.png"');
    const bioIdx = surface.indexOf('iconSrc="/icons/workspace/biography.png"');
    const pubsIdx = surface.indexOf("<RecentPublicInitiativesDisclosure");
    assert.ok(orgIdx > 0 && skillsIdx > orgIdx, "Organization above Skills");
    assert.ok(bioIdx > 0 && pubsIdx > bioIdx, "Biography then Recent Initiatives");

    const disclosure = readWeb(
      "features/member-profile/components/RecentPublicInitiativesDisclosure.tsx",
    );
    assert.match(disclosure, /aria-expanded/);
    assert.match(disclosure, /publications\.png/);
    assert.match(disclosure, /Recent Public Initiatives/);

    for (const asset of [
      "biography.png",
      "publications.png",
      "skills.png",
      "organization.png",
    ]) {
      assert.ok(
        existsSync(path.join(webRoot, "public/icons/workspace", asset)),
        `missing icon ${asset}`,
      );
    }
  });

  it("17G layering + security route separation", () => {
    const publicApi = readWeb(
      "features/platform-social-accounts/platform-social-accounts-public-api.ts",
    );
    assert.match(publicApi, /\/api\/v1\/platform\/social-accounts/);
    assert.doesNotMatch(publicApi, /\/api\/v1\/admin\/platform\/social-accounts/);

    const adminApi = readWeb(
      "features/administration/admin-platform-social-accounts-api.ts",
    );
    assert.match(adminApi, /\/api\/v1\/admin\/platform\/social-accounts/);

    const footer = readWeb("features/public-experience/components/FooterSocialLinks.tsx");
    const panel = readWeb("features/blog/components/BlogPublicationOptimizationPanel.tsx");
    assert.match(footer, /platform-social-accounts-public-api/);
    assert.match(panel, /platform-social-accounts-public-api/);
    assert.doesNotMatch(footer, /from ["'].*administration\//);
    assert.doesNotMatch(panel, /from ["'].*administration\//);

    const publicRoutes = readApi(
      "modules/platform-social-accounts/public-platform-social-accounts.routes.ts",
    );
    const adminRoutes = readApi(
      "modules/platform-social-accounts/admin-platform-social-accounts.routes.ts",
    );
    assert.match(publicRoutes, /router\.get|get\(/);
    assert.doesNotMatch(publicRoutes, /router\.put|put\(/i);
    assert.match(adminRoutes, /put|PUT/i);
  });
});
