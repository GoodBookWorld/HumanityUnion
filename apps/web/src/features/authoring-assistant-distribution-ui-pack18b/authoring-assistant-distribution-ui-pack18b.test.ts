/**
 * Pack 18B — Authoring Assistant + Distribution UI refinement.
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

describe("Pack 18B — Assistant and Distribution UI refinement", () => {
  it("Assistant sidebar shows intel icon + Assistant; no duplicate visible HU heading", () => {
    assert.ok(existsSync(path.join(webRoot, "public/icons/workspace/intel.webp")));

    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /icons\/workspace\/intel\.webp/);
    assert.match(editor, /blog-post-editor__assistant-heading/);
    assert.match(editor, />\s*Assistant\s*</);

    const panel = readWeb("features/blog/components/BlogAuthoringAssistantPanel.tsx");
    assert.match(panel, /aria-label="Humanity Union Assistant"/);
    assert.doesNotMatch(panel, /<h3[^>]*>\s*Humanity Union Assistant\s*<\/h3>/);
    assert.match(panel, /Open chat/);
    assert.match(panel, /blog-authoring-assistant__open-chat/);
    assert.match(panel, /variant="primary"/);
    assert.match(panel, /Title suggestions/);
    assert.match(panel, /\bApply\b/);
    assert.match(panel, /\bReplace\b/);
    assert.match(panel, /\bDismiss\b/);
    assert.match(panel, /never silently rewrites|never publishes/i);

    const css = readWeb("features/blog/publishing.css");
    assert.match(css, /\.blog-authoring-assistant__open-chat[\s\S]*width:\s*100%/s);
    assert.match(css, /\.blog-post-editor__assistant-icon/);
  });

  it("Distribution reuses shared platform social icon catalog; checkbox remains accessible", () => {
    const icons = readWeb(
      "features/platform-social-accounts/platform-social-network-icons.ts",
    );
    assert.match(icons, /icons8-facebook\.svg/);
    assert.match(icons, /icons8-youtube\.svg/);
    assert.match(icons, /icons8-instagram\.svg/);
    assert.match(icons, /icons8-x\.svg/);

    const panel = readWeb("features/blog/components/BlogPublicationOptimizationPanel.tsx");
    assert.match(panel, /PLATFORM_SOCIAL_NETWORK_ICON_PATHS/);
    assert.match(panel, /platform-social-network-icons/);
    assert.match(panel, /blog-publication-optimization__network-icon/);
    assert.match(panel, /aria-hidden="true"/);
    assert.match(panel, /huPlatformChannels/);
    assert.match(panel, /Humanity Union social distribution/);
    assert.doesNotMatch(panel, /facebookUrl|profile\.facebook/);

    const footer = readWeb("features/public-experience/components/FooterSocialLinks.tsx");
    assert.match(footer, /PLATFORM_SOCIAL_NETWORK_ICON_PATHS/);

    const admin = readWeb(
      "features/administration/components/AdminPlatformSocialAccountsPanel.tsx",
    );
    assert.match(admin, /PLATFORM_SOCIAL_NETWORK_ICON_PATHS/);

    const personal = readWeb(
      "features/member-profile/components/MemberProfessionalLinksSection.tsx",
    );
    assert.match(personal, /PLATFORM_SOCIAL_NETWORK_ICON_PATHS/);
  });
});
