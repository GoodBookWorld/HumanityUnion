/**
 * Pack 18D — Final Block 18 Publishing UI & Participant Profile certification.
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

describe("Pack 18D — final Block 18 publishing UI & participant profile certification", () => {
  it("18A toolbar is static at top of editor; chrome non-sticky; main scrolls", () => {
    const css = readWeb("features/blog/publishing.css");

    const chromeBlock = css.match(/\.blog-post-editor__chrome\s*\{[^}]+\}/);
    assert.ok(chromeBlock);
    assert.match(chromeBlock[0], /position:\s*static/);
    assert.doesNotMatch(chromeBlock[0], /position:\s*sticky/);

    assert.match(
      css,
      /\.blog-rich-text--ckeditor\s+\.ck\.ck-editor__top\s*\{[^}]*position:\s*static/s,
    );
    assert.doesNotMatch(css, /\.ck\.ck-editor__top[\s\S]{0,240}position:\s*sticky/s);
    assert.doesNotMatch(css, /\.ck\.ck-editor__top[\s\S]{0,240}--hu-scroll-margin-top/s);
    assert.match(css, /\.ck\.ck-editor__main[\s\S]*overflow-y:\s*auto/s);
    assert.match(css, /overscroll-behavior:\s*auto/);
    assert.match(css, /\.ck\.ck-editor__top[\s\S]*flex:\s*0\s+0\s+auto/s);

    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /Article Content/);
    assert.match(editor, /BlogRichTextEditor/);
  });

  it("18B Assistant intel heading + full-width Open chat; no duplicate HU heading", () => {
    assert.ok(existsSync(path.join(webRoot, "public/icons/workspace/intel.webp")));

    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /icons\/workspace\/intel\.webp/);
    assert.match(editor, /blog-post-editor__assistant-heading/);

    const panel = readWeb("features/blog/components/BlogAuthoringAssistantPanel.tsx");
    assert.match(panel, /aria-label="Humanity Union Assistant"/);
    assert.doesNotMatch(panel, /<h3[^>]*>\s*Humanity Union Assistant\s*<\/h3>/);
    assert.match(panel, /blog-authoring-assistant__open-chat/);
    assert.match(panel, /variant="primary"/);
    assert.match(panel, /Title suggestions/);
    assert.match(panel, /\bApply\b/);
    assert.match(panel, /\bReplace\b/);
    assert.match(panel, /\bDismiss\b/);
    assert.match(panel, /never silently rewrites|never publishes/i);
    assert.doesNotMatch(panel, /publishBlogPost|submitBlogPostForReview/);

    const css = readWeb("features/blog/publishing.css");
    assert.match(css, /\.blog-authoring-assistant__open-chat[\s\S]*width:\s*100%/s);
  });

  it("18B Distribution icons from shared catalog; semantics preserved", () => {
    const icons = readWeb(
      "features/platform-social-accounts/platform-social-network-icons.ts",
    );
    for (const network of ["facebook", "youtube", "instagram", "x"]) {
      assert.match(icons, new RegExp(network));
    }

    const panel = readWeb("features/blog/components/BlogPublicationOptimizationPanel.tsx");
    assert.match(panel, /PLATFORM_SOCIAL_NETWORK_ICON_PATHS/);
    assert.match(panel, /platform-social-network-icons/);
    assert.match(panel, /blog-publication-optimization__network-icon/);
    assert.match(panel, /aria-hidden="true"/);
    assert.match(panel, /huPlatformChannels/);
    assert.match(panel, /Humanity Union social distribution/);
    assert.doesNotMatch(panel, /facebookUrl|profile\.facebook/);

    const distribution = readApi("modules/blog/blog-social-distribution.ts");
    assert.match(distribution, /blocked_not_published/);
    assert.match(distribution, /awaiting_provider/);
    assert.doesNotMatch(distribution, /Published to Facebook|Posted to Instagram/i);
  });

  it("18C compact profile card IA: identity → info|stats → biography → initiatives", () => {
    const surface = readWeb(
      "features/member-profile/components/ParticipantProfileSurface.tsx",
    );
    assert.match(surface, /public-member-page__card/);
    assert.match(surface, /public-member-page__body-row/);
    assert.match(surface, /public-member-page__info/);
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

    assert.equal((surface.match(/id="organization"/g) ?? []).length, 1);
    const statsBlock = surface.slice(statsIdx, bioIdx);
    assert.doesNotMatch(statsBlock, /id="organization"/);
    assert.doesNotMatch(statsBlock, /id="skills"/);
    assert.match(surface.slice(infoIdx, statsIdx), /id="professional-links"/);
    assert.match(surface.slice(infoIdx, statsIdx), /id="organization"/);
    assert.match(surface.slice(infoIdx, statsIdx), /id="skills"/);
    assert.match(surface, /DirectMessageAction/);
    assert.match(surface, /MemberProfessionalLinksDisplay/);

    const css = readWeb(
      "features/member-profile/components/participant-profile-surface.css",
    );
    assert.match(css, /max-width:\s*54rem/);
    assert.match(css, /--hu-shadow-elevated/);
    assert.doesNotMatch(css, /height:\s*100vh|max-height:\s*100vh/);
  });

  it("icon runtime assets + design-system tokens present", () => {
    for (const asset of [
      "intel.webp",
      "biography.png",
      "publications.png",
      "organization.png",
      "skills.png",
    ]) {
      assert.ok(
        existsSync(path.join(webRoot, "public/icons/workspace", asset)),
        `missing ${asset}`,
      );
    }
    for (const icon of [
      "icons8-facebook.svg",
      "icons8-youtube.svg",
      "icons8-instagram.svg",
      "icons8-x.svg",
    ]) {
      assert.ok(existsSync(path.join(webRoot, "public/icons/civic", icon)));
    }

    const tokens = readWeb("design-system/tokens.css");
    assert.match(tokens, /--hu-shadow-elevated/);
    assert.match(tokens, /--hu-shadow-subtle|--hu-shadow-inset-field/);

    const disclosure = readWeb(
      "features/member-profile/components/RecentPublicInitiativesDisclosure.tsx",
    );
    assert.match(disclosure, /aria-expanded=\{open\}/);
    assert.match(disclosure, /publications\.png/);
  });
});
