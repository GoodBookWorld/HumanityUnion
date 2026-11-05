/**
 * UI-IMPROVEMENTS-02 — Publications/Categories tables hand scrolling back to the
 * page at their edges; the member profile Message button mirrors in RTL.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `rule ${selector}`);
  return match[1]!;
}

function wrapperClasses(file: string): string[] {
  return [...read(file).matchAll(/className="(admin-publishing-table-wrap[^"]*)"/g)].map(
    (match) => match[1]!,
  );
}

const PUBLISHING = "features/administration/components/AdminPublishingSection.tsx";
const CATEGORIES = "features/administration/components/AdminBlogCategoriesPanel.tsx";
const SUBSCRIBERS = "features/administration/components/AdminViewsSubscribersSection.tsx";

describe("UI-IMPROVEMENTS-02 — Publishing scroll chaining", () => {
  const css = read("features/administration/components/admin-publishing.css");

  it("1. Publications and Categories use the 600px scroll area with page chaining", () => {
    const publications = wrapperClasses(PUBLISHING).filter((c) => c.includes("--scroll-y"));
    const categories = wrapperClasses(CATEGORIES);
    assert.equal(publications.length, 1);
    assert.equal(categories.length, 1);
    for (const classes of [publications[0]!, categories[0]!]) {
      assert.match(classes, /admin-publishing-table-wrap--scroll-y/);
      assert.match(classes, /admin-publishing-table-wrap--scroll-chain/);
      assert.match(classes, /admin-publishing-table-wrap--directory/);
    }
    assert.match(categories[0]!, /admin-blog-categories__table-wrap/);
  });

  it("2. chaining modifier restores native overscroll only on the combined selector", () => {
    const chain = ruleBody(
      css,
      ".admin-publishing-table-wrap--scroll-y.admin-publishing-table-wrap--scroll-chain",
    );
    assert.match(chain, /overscroll-behavior-y:\s*auto/);
    assert.doesNotMatch(chain, /height|overflow/);
    assert.ok(
      css.indexOf("--scroll-y.admin-publishing-table-wrap--scroll-chain") >
        css.indexOf(".admin-publishing-table-wrap--scroll-y {"),
    );
    const scroll = ruleBody(css, ".admin-publishing-table-wrap--scroll-y");
    assert.match(scroll, /height:\s*600px/);
    assert.match(scroll, /overflow-y:\s*auto/);
    assert.match(scroll, /overflow-x:\s*auto/);
    assert.match(
      ruleBody(css, ".admin-publishing-table-wrap--scroll-y thead th"),
      /position:\s*sticky/,
    );
  });

  it("3. Subscribers and other tables keep their existing behaviour", () => {
    const subscribers = wrapperClasses(SUBSCRIBERS);
    assert.deepEqual(subscribers, [
      "admin-publishing-table-wrap admin-publishing-table-wrap--scroll-y",
    ]);
    assert.match(
      ruleBody(css, ".admin-publishing-table-wrap--scroll-y"),
      /overscroll-behavior-y:\s*contain/,
    );
    const pendingWraps = wrapperClasses(PUBLISHING).filter((c) => !c.includes("--scroll-y"));
    assert.ok(pendingWraps.length >= 2);
    for (const classes of pendingWraps) {
      assert.doesNotMatch(classes, /--scroll-chain/);
    }
    for (const file of [
      "features/administration/components/AdminBetaAccessSection.tsx",
      "features/administration/components/AdminAuditSection.tsx",
      "features/blog/components/MyPublicationsTable.tsx",
    ]) {
      assert.doesNotMatch(read(file), /--scroll-y|--scroll-chain/, file);
    }
  });

  it("4. native scrolling only: no wheel or scroll handlers added", () => {
    for (const file of [PUBLISHING, CATEGORIES]) {
      assert.doesNotMatch(read(file), /onWheel|addEventListener\("wheel"|onScroll/, file);
    }
  });
});

describe("UI-IMPROVEMENTS-02 — member profile Message button", () => {
  const css = read("features/member-profile/components/participant-profile-surface.css");

  it("5. RTL moves the button to the left edge; LTR rule unchanged", () => {
    const ltr = ruleBody(css, ".public-member-page__message-action");
    assert.match(ltr, /position:\s*absolute/);
    assert.match(ltr, /right:\s*var\(--hu-space-3, 0\.75rem\)/);
    assert.match(ltr, /bottom:\s*var\(--hu-space-3, 0\.75rem\)/);
    assert.doesNotMatch(ltr, /left:/);
    const rtl = ruleBody(css, '[dir="rtl"] .public-member-page__message-action');
    assert.match(rtl, /right:\s*auto/);
    assert.match(rtl, /left:\s*var\(--hu-space-3, 0\.75rem\)/);
  });

  it("6. RTL rule outranks the responsive right-offset rules at every breakpoint", () => {
    const responsive = [...css.matchAll(/^\s+\.public-member-page__message-action\s*\{[^}]*\}/gm)];
    assert.ok(responsive.length >= 2, "tablet and mobile rules exist");
    for (const rule of responsive) {
      assert.doesNotMatch(rule[0], /\[dir/);
    }
    assert.doesNotMatch(css, /\[dir="ltr"\] \.public-member-page__message-action/);
    const component = read("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.match(
      component,
      /<div className="public-member-page__message-action">\s*<DirectMessageAction/,
    );
  });
});
