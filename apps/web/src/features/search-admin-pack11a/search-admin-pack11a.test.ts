/**
 * Pack 11A — /search warm filter surface + Admin Overview Profile display-name binding.
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

describe("Pack 11A — /search warm filter surface", () => {
  it("filters reuse canonical --hu-color-accent warm color-mix (no hardcoded new yellow)", () => {
    const css = readWeb("features/global-search/global-search-page.css");
    const tokens = readWeb("design-system/tokens.css");

    assert.match(tokens, /--hu-color-accent:\s*#df9815/);
    assert.match(
      css,
      /\.global-search-page__filters\s*\{[\s\S]*background:\s*color-mix\(in srgb,\s*var\(--hu-color-accent/,
    );
    assert.match(css, /var\(--hu-color-accent,\s*#df9815\)\s*18%/);
    assert.doesNotMatch(css, /\.global-search-page__filters\s*\{[^}]*background:\s*#f[fF][eE]/);
  });

  it("form controls stay on surface (readable) and Search stays primary", () => {
    const css = readWeb("features/global-search/global-search-page.css");
    const page = readWeb("features/global-search/components/GlobalSearchPageContent.tsx");
    const components = readWeb("design-system/components.css");

    assert.match(page, /className="hu-form-control"/);
    assert.match(page, /variant="primary"/);
    assert.match(css, /do not restyle design-system buttons/i);
    assert.doesNotMatch(css, /\.global-search-page__filters button\s*\{/);
    assert.match(components, /\.hu-form-control[\s\S]*background:\s*var\(--hu-color-surface\)/);
  });

  it("mobile /search filter grid keeps min-width:0 children and responsive columns", () => {
    const css = readWeb("features/global-search/global-search-page.css");
    assert.match(
      css,
      /\.global-search-page__filters > label[\s\S]*min-width:\s*0/,
    );
    assert.match(css, /max-width:\s*100%/);
    assert.match(
      css,
      /@media \(min-width: 768px\)\s*\{\s*\.global-search-page__filters\s*\{[\s\S]*grid-template-columns:\s*repeat\(2/,
    );
  });
});

describe("Pack 11A — Administrator display name from Profile", () => {
  it("Overview binds Display name to getMyMemberProfile + resolveDisplayName", () => {
    const overview = readWeb("features/administration/components/AdminOverviewSection.tsx");

    assert.match(overview, /getMyMemberProfile/);
    assert.match(overview, /resolveDisplayName/);
    assert.match(overview, /MEMBER_PROFILE_UPDATED_EVENT/);
    assert.match(overview, /profileDisplayName/);
    assert.doesNotMatch(overview, /label:\s*"Display name",\s*value:\s*user\.displayName/);
  });

  it("does not introduce duplicate admin display-name storage or auth changes", () => {
    const overview = readWeb("features/administration/components/AdminOverviewSection.tsx");
    const gate = readWeb("features/administration/components/AdminAccessGate.tsx");
    const projection = readFileSync(
      path.resolve(webSrc, "../../api/src/modules/auth/auth-user.projection.ts"),
      "utf8",
    );

    assert.doesNotMatch(overview, /adminDisplayName|updateAdminDisplayName/i);
    assert.match(gate, /isAdminAccountRole|role/);
    assert.match(projection, /displayName:\s*user\.displayName/);
  });

  it("Admin authorization and non-admin nav contract unchanged", () => {
    const foundation = readWeb("features/administration/admin-panel-foundation.test.ts");
    assert.match(foundation, /non-admin does not see Administration/);
    assert.match(foundation, /isAdminAccountRole/);

    const gate = readWeb("features/administration/components/AdminAccessGate.tsx");
    assert.match(gate, /isAdminAccountRole/);
    assert.doesNotMatch(gate, /adminDisplayName/);
  });
});
