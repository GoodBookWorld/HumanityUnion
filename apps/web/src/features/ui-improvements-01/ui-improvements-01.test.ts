/**
 * UI-IMPROVEMENTS-01 — Publishing tabs, scroll tables, Home principle wrapping,
 * Workspace membership cards and Biography RTL background.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const webRoot = path.resolve(webSrc, "..");

function read(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

/** Top-level `{tab === "x" ? ( … ) : null}` blocks of the Publishing section, by tab. */
function publishingTabBlocks(): Map<string, string> {
  const source = read("features/administration/components/AdminPublishingSection.tsx");
  const blocks = new Map<string, string>();
  const opener = /^ {6}\{tab === "([a-z-]+)"[^\n]*\? \($/gm;
  for (const match of source.matchAll(opener)) {
    const start = match.index ?? 0;
    const end = source.indexOf("\n      ) : null}", start);
    assert.ok(end > start, `block for ${match[1]} is closed with ") : null}"`);
    blocks.set(match[1]!, source.slice(start, end));
  }
  return blocks;
}

/** Body of the first rule whose selector list exactly matches `selector`. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `rule ${selector}`);
  return match[1]!;
}

/** Contents of the first `@media <query> {` block that contains `marker`. */
function mediaBlock(css: string, query: string, marker: string): string {
  let from = 0;
  for (;;) {
    const start = css.indexOf(`@media ${query} {`, from);
    assert.ok(start >= 0, `@media ${query} containing ${marker}`);
    const end = css.indexOf("\n}\n", start);
    const block = css.slice(start, end);
    if (block.includes(marker)) {
      return block;
    }
    from = end;
  }
}

describe("UI-IMPROVEMENTS-01 — Admin Publishing tabs", () => {
  it("1. Publications renders only inside the publications tab block", () => {
    const blocks = publishingTabBlocks();
    assert.deepEqual(
      [...blocks.keys()],
      ["pending", "pending-review", "authors", "publications", "categories"],
    );
    for (const [tab, block] of blocks) {
      const hasPublications = block.includes('<ProfileSection title="Publications">');
      assert.equal(hasPublications, tab === "publications", tab);
    }
    const source = read("features/administration/components/AdminPublishingSection.tsx");
    assert.equal(source.match(/<ProfileSection title="Publications">/g)?.length, 1);
    assert.doesNotMatch(source, /\) : \(\s*<ProfileSection title="Publications">/);
  });

  it("2. Categories, Pending and Pending Review keep their own content only", () => {
    const blocks = publishingTabBlocks();
    assert.match(blocks.get("categories")!, /<AdminBlogCategoriesPanel \/>/);
    assert.match(blocks.get("categories")!, /id=\{PUBLICATION_CATEGORIES_HASH\}/);
    assert.match(blocks.get("pending")!, /Pending Author Applications/);
    assert.match(blocks.get("pending-review")!, /Pending Review/);
    for (const tab of ["categories", "pending", "pending-review"]) {
      assert.doesNotMatch(blocks.get(tab)!, /admin-publishing-table-wrap--scroll-y/, tab);
    }
  });
});

describe("UI-IMPROVEMENTS-01 — 600px scroll tables", () => {
  const css = read("features/administration/components/admin-publishing.css");

  it("3. modifier has fixed height, both scroll axes and sticky headers", () => {
    const body = ruleBody(css, ".admin-publishing-table-wrap--scroll-y");
    assert.match(body, /height:\s*600px/);
    assert.match(body, /overflow-y:\s*auto/);
    assert.match(body, /overflow-x:\s*auto/);
    const head = ruleBody(css, ".admin-publishing-table-wrap--scroll-y thead th");
    assert.match(head, /position:\s*sticky/);
    assert.match(head, /top:\s*0/);
    assert.match(head, /background:/);
    assert.ok(
      css.indexOf(".admin-publishing-table-wrap--scroll-y {") >
        css.indexOf(".admin-publishing-table-wrap--directory {"),
      "declared after --directory so its overflow-y wins",
    );
  });

  it("4. applied only to Publications, Categories and Subscribers; shared rules unchanged", () => {
    const users = [
      "features/administration/components/AdminPublishingSection.tsx",
      "features/administration/components/AdminViewsSubscribersSection.tsx",
      "features/administration/components/AdminBlogCategoriesPanel.tsx",
      "features/administration/components/AdminBetaAccessSection.tsx",
      "features/administration/components/AdminAuditSection.tsx",
      "features/blog/components/MyPublicationsTable.tsx",
    ].map((file) => [
      file,
      (read(file).match(/admin-publishing-table-wrap--scroll-y/g) ?? []).length,
    ]);
    assert.deepEqual(Object.fromEntries(users), {
      "features/administration/components/AdminPublishingSection.tsx": 1,
      "features/administration/components/AdminViewsSubscribersSection.tsx": 1,
      "features/administration/components/AdminBlogCategoriesPanel.tsx": 1,
      "features/administration/components/AdminBetaAccessSection.tsx": 0,
      "features/administration/components/AdminAuditSection.tsx": 0,
      "features/blog/components/MyPublicationsTable.tsx": 0,
    });
    assert.match(
      read("features/administration/components/AdminPublishingSection.tsx"),
      /publications\.length > 0 \? \(\s*<div className="admin-publishing-table-wrap admin-publishing-table-wrap--directory admin-publishing-table-wrap--scroll-y[ a-z-]*">/,
    );
    const base = ruleBody(css, ".admin-publishing-table-wrap");
    assert.doesNotMatch(base, /height|overflow-y/);
    assert.match(ruleBody(css, ".admin-publishing-table-wrap--directory"), /overflow-y:\s*hidden/);
  });
});

describe("UI-IMPROVEMENTS-01 — Home principle", () => {
  const css = read("features/public-home-v2/public-home-v2.css");

  it("5. wraps naturally, hidden on mobile, visible from 900px", () => {
    const body = ruleBody(css, ".public-home-v2__humanity-ai-principle");
    assert.match(body, /display:\s*none/);
    assert.match(body, /white-space:\s*normal/);
    assert.match(body, /text-wrap:\s*balance/);
    assert.match(body, /text-align:\s*center/);
    assert.match(body, /padding-inline:/);
    assert.doesNotMatch(body, /nowrap|overflow(-x)?:\s*(clip|hidden)|text-overflow/);
    const desktop = mediaBlock(css, "(min-width: 900px)", "humanity-ai-principle");
    assert.match(desktop, /display:\s*block/);
    const component = read("features/public-home-v2/components/PublicHomeHumanityAiPrinciple.tsx");
    assert.match(component, /t\("humanityAiPrinciple"\)/);
  });
});

describe("UI-IMPROVEMENTS-01 — Workspace membership cards", () => {
  const css = read("features/membership/components/membership-participation-statistics.css");
  const scope = ".membership-workspace-widget__platform-stats";

  it("6. styling is scoped to the Workspace class; public panel rules unchanged", () => {
    const newRules = css.slice(css.indexOf(`${scope} `)).replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...newRules.matchAll(/(?:^|[{};])\s*([^{};@]+?)\s*\{/g)].map(
      (match) => match[1]!,
    );
    assert.ok(selectors.length >= 8);
    for (const selector of selectors) {
      assert.ok(selector.replace(/\s+/g, " ").startsWith(scope), selector);
    }
    assert.match(
      ruleBody(css, ".membership-participation-statistics__item"),
      /background:\s*var\(--hu-color-surface/,
    );
    assert.match(
      read("features/workspace-home/components/WorkspaceHomeDashboard.tsx"),
      /className="membership-workspace-widget__platform-stats"/,
    );
    assert.doesNotMatch(
      read("features/membership/components/MembershipPageContent.tsx"),
      /platform-stats/,
    );
    assert.match(
      read("features/membership/components/MembershipParticipationStatisticsPanel.tsx"),
      /import "\.\/membership-participation-statistics\.css"/,
    );
  });

  it("7. three distinct token backgrounds, centered text, large numbers", () => {
    const item = `${scope} .membership-participation-statistics__item`;
    assert.match(ruleBody(css, item), /text-align:\s*center/);
    assert.match(ruleBody(css, item), /min-width:\s*0/);
    const backgrounds = [1, 2, 3].map((n) => ruleBody(css, `${item}:nth-child(${n})`));
    assert.match(backgrounds[0]!, /var\(--hu-color-primary-soft/);
    assert.match(backgrounds[1]!, /var\(--hu-color-accent/);
    assert.match(backgrounds[2]!, /var\(--hu-color-success/);
    assert.equal(new Set(backgrounds).size, 3);
    const number = ruleBody(css, `${item} dd`);
    assert.match(number, /font-size:\s*clamp\(1\.375rem/);
    assert.match(number, /overflow-wrap:\s*anywhere/);
  });

  it("8. three columns on mobile with smaller wrapping labels", () => {
    const grid = `${scope} .membership-participation-statistics__grid`;
    assert.match(ruleBody(css, grid), /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
    const mobile = css.slice(css.lastIndexOf("@media (max-width: 720px) {"));
    assert.ok(mobile.includes(scope));
    assert.doesNotMatch(mobile, /grid-template-columns:\s*1fr/);
    assert.match(mobile, /dt\s*\{[^}]*font-size:\s*0\.75rem/);
    assert.match(
      ruleBody(css, `${scope} .membership-participation-statistics__item dt`),
      /overflow-wrap:\s*anywhere/,
    );
  });
});

describe("UI-IMPROVEMENTS-01 — Biography background", () => {
  const css = read("features/member-profile/components/participant-profile-surface.css");

  it("9. RTL uses mountains-rtl.webp on the left with a mirrored fade; LTR unchanged", () => {
    assert.ok(existsSync(path.join(webRoot, "public/illustrations/mountains-rtl.webp")));
    const ltr = ruleBody(css, ".public-member-page__biography");
    assert.match(ltr, /url\("\/illustrations\/mountains\.webp"\)/);
    assert.match(ltr, /90deg/);
    assert.match(ltr, /left center,\s*right center,\s*left center/);
    const rtl = ruleBody(css, '[dir="rtl"] .public-member-page__biography');
    assert.match(rtl, /url\("\/illustrations\/mountains-rtl\.webp"\)/);
    assert.doesNotMatch(rtl, /mountains\.webp/);
    assert.match(rtl, /270deg/);
    assert.match(rtl, /right center,\s*left center,\s*right center/);
  });

  it("10. at <=900px mountains stay hidden in both directions", () => {
    const tablet = mediaBlock(css, "(max-width: 900px)", "public-member-page__biography");
    const rule = tablet.match(
      /\.public-member-page__biography,\s*\[dir="rtl"\] \.public-member-page__biography\s*\{([^}]*)\}/,
    );
    assert.ok(rule, "tablet rule lists the RTL selector");
    assert.doesNotMatch(rule[1]!, /url\(/);
    assert.ok(
      css.indexOf("@media (max-width: 900px)") >
        css.indexOf('[dir="rtl"] .public-member-page__biography {'),
      "tablet rule follows the RTL rule",
    );
  });
});
