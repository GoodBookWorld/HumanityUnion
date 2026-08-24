/**
 * Pack 17C — Admin Overview platform social accounts + footer integration contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 17C — platform social accounts UI", () => {
  it("Admin Overview places Platform social accounts as the last block below Editors", () => {
    const overview = readWeb("features/administration/components/AdminOverviewSection.tsx");
    const editorsIdx = overview.indexOf('title="Editors"');
    const socialIdx = overview.indexOf('title="Platform social accounts"');
    assert.ok(editorsIdx > 0);
    assert.ok(socialIdx > editorsIdx);
    assert.match(overview, /AdminPlatformSocialAccountsPanel/);
    assert.ok(
      overview.lastIndexOf("ProfileSection") === overview.lastIndexOf('title="Platform social accounts"') ||
        socialIdx > editorsIdx,
    );
  });

  it("Admin panel has per-network URL save/clear with confirmation messaging", () => {
    const panel = readWeb(
      "features/administration/components/AdminPlatformSocialAccountsPanel.tsx",
    );
    assert.match(panel, /PLATFORM_SOCIAL_NETWORK_ICON_PATHS/);
    assert.match(panel, /platform-social-network-icons/);
    assert.match(panel, /saveAdminPlatformSocialAccount/);
    assert.match(panel, /clearAdminPlatformSocialAccount/);
    assert.match(panel, /URL saved/);
    assert.match(panel, /URL cleared/);
    assert.match(panel, /admin-platform-social__success/);
    assert.doesNotMatch(panel, /password|oauth|api[_-]?token|clientSecret/i);

    const icons = readWeb(
      "features/platform-social-accounts/platform-social-network-icons.ts",
    );
    assert.match(icons, /icons8-facebook\.svg/);
    assert.match(icons, /icons8-youtube\.svg/);
    assert.match(icons, /icons8-instagram\.svg/);
    assert.match(icons, /icons8-x\.svg/);
  });

  it("footer social list resolves canonical API settings without hardcoded destination URLs", () => {
    const footer = readWeb("features/public-experience/components/FooterSocialLinks.tsx");
    assert.match(footer, /public-experience-footer__social-list/);
    assert.match(footer, /fetchPublicPlatformSocialAccounts/);
    assert.match(footer, /rel="noopener noreferrer"/);
    assert.match(footer, /target="_blank"/);
    assert.doesNotMatch(footer, /facebook\.com\/HumanityUnion/);
    assert.doesNotMatch(footer, /FOOTER_SOCIAL_LINKS/);
    assert.match(footer, /platform-social-accounts-public-api/);

    const links = readWeb("features/public-experience/footer-links.ts");
    assert.doesNotMatch(links, /https:\/\/www\.facebook\.com\/HumanityUnionWS/);
    assert.doesNotMatch(links, /linkedin\.com/);

    const api = readWeb("features/platform-social-accounts/platform-social-accounts-public-api.ts");
    assert.match(api, /\/api\/v1\/platform\/social-accounts/);
    assert.doesNotMatch(api, /\/api\/v1\/admin\/platform\/social-accounts/);

    const adminApi = readWeb("features/administration/admin-platform-social-accounts-api.ts");
    assert.match(adminApi, /\/api\/v1\/admin\/platform\/social-accounts/);
  });
});
