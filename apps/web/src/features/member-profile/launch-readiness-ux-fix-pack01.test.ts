import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { DESKTOP_CAPSULE_NAVIGATION } from "../public-experience/constants.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const webRoot = path.resolve(webSrc, "..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Launch Readiness UX Fix Pack 01 — Blog / Profile / Header", () => {
  it("1 — Blog index uses the canonical page container", () => {
    const index = read("features/blog/components/BlogIndexPageContent.tsx");
    assert.match(index, /className="blog-page hu-page-container"/);

    const css = read("features/blog/blog.css");
    assert.match(css, /\.blog-page,\s*\n\.blog-article\s*\{[\s\S]*margin-inline:\s*auto/m);
    assert.match(css, /var\(--hu-page-max-width\)/);
    assert.doesNotMatch(css, /--blog-page-max-width/);
  });

  it("2/3 — Article outer container is centered; reading measure stays narrower", () => {
    const article = read("features/blog/components/BlogArticlePageContent.tsx");
    assert.match(article, /className="blog-article hu-page-container"/);

    const css = read("features/blog/blog.css");
    assert.match(
      css,
      /\.blog-article-body\s*\{[\s\S]*max-width:\s*var\(--hu-reading-max-width\)/m,
    );
    assert.match(css, /\.blog-article-body\s*\{[\s\S]*margin-inline:\s*auto/m);
  });

  it("4-17 — Public Profile surface renders projection-gated fields and Member badge", () => {
    const surface = read("features/member-profile/components/ParticipantProfileSurface.tsx");
    const css = read("features/member-profile/components/participant-profile-surface.css");
    const presentation = read("features/member-profile/participant-profile-surface-presentation.ts");

    assert.match(surface, /hasVisibleParticipationArea/);
    assert.match(surface, /Participation Area/);
    assert.match(surface, /hasVisibleSkills/);
    assert.match(surface, /Professional Links/);
    assert.match(surface, /hasVisibleBiography/);
    assert.match(surface, /hasVisibleOrganization/);
    assert.match(surface, /shouldShowMemberBadge/);
    assert.match(surface, /PUBLIC_MEMBER_BADGE_SRC/);
    assert.match(surface, /id="professional-links"/);
    assert.match(surface, /id="biography"/);
    assert.match(surface, /id="organization"/);
    assert.match(surface, /id="participation-area"/);
    assert.match(surface, /id="skills"/);
    assert.match(surface, /public-member-page__statistics/);
    assert.match(surface, /personal-statistics__grid/);
    assert.match(surface, /public-member-page__profile-context/);

    assert.match(css, /\.public-member-page__member-badge\s*\{[\s\S]*width:\s*48px/m);
    assert.match(css, /\.public-member-page__member-badge\s*\{[\s\S]*height:\s*48px/m);
    assert.match(css, /object-fit:\s*contain/);

    assert.match(presentation, /MEMBER_BADGE_IMAGE_PATH/);
    assert.match(presentation, /Humanity Union Member/);
    assert.match(
      read("features/membership/membership.constants.ts"),
      /member-badge\.webp/,
    );
    assert.doesNotMatch(surface, /Not provided/);
    assert.doesNotMatch(surface, /participationAreaId/);
  });

  it("18-21 — Guest Log in includes icon; accessible name and capsule stay intact", () => {
    const auth = read("design-system/components/HeaderAuthUtility.tsx");
    assert.match(auth, /\/icons\/workspace\/login\.png/);
    assert.match(auth, /humanity-header__login-link/);
    assert.match(auth, /Log in/);
    assert.match(auth, /aria-hidden="true"/);
    assert.match(auth, /AuthenticatedHeaderTools/);

    assert.ok(existsSync(path.join(webRoot, "public/icons/workspace/login.png")));

    const labels = DESKTOP_CAPSULE_NAVIGATION.map((item) => item.label);
    assert.deepEqual(labels, ["Home", "Institutions", "Initiatives", "Knowledge", "Search"]);

    const tools = read("design-system/components/AuthenticatedHeaderTools.tsx");
    assert.match(tools, /HeaderWorkspaceLink/);
    assert.match(tools, /HeaderNotificationsLink/);
  });
});
