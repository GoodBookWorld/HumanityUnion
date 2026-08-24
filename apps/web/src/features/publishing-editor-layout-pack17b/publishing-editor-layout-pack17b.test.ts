/**
 * Pack 17B — Publishing editor layout and scroll architecture.
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

describe("Pack 17B — Publishing editor layout and scroll", () => {
  it("MemberWorkspace compact places Title | Assistant in one header row", () => {
    const workspace = readWeb("components/member/MemberWorkspace.tsx");
    assert.match(workspace, /member-workspace__header--with-assistant/);
    assert.match(workspace, /member-workspace__header-copy/);
    assert.match(workspace, /assistantPlacement === "compact"/);

    const css = readWeb("components/member/member-workspace.css");
    assert.match(css, /header--with-assistant[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);

    const newPage = readWeb("app/workspace/publishing/new/page.tsx");
    assert.match(newPage, /title="New Publication"/);
    assert.match(newPage, /assistantPlacement="compact"/);
    assert.match(newPage, /HumanityUnionAssistantWidget/);
  });

  it("chrome is not sticky; CK desktop viewport scrolls; scroll chaining allowed", () => {
    const css = readWeb("features/blog/publishing.css");
    const chromeBlock = css.match(/\.blog-post-editor__chrome\s*\{[^}]+\}/);
    assert.ok(chromeBlock);
    assert.match(chromeBlock[0], /position:\s*static/);
    assert.match(css, /\.ck\.ck-editor__main[\s\S]*overflow-y:\s*auto/s);
    assert.match(css, /overscroll-behavior:\s*auto/);
    assert.doesNotMatch(css, /overscroll-behavior:\s*contain/);
  });

  it("Publication Optimization stacks full-width tinted sections", () => {
    const panel = readWeb("features/blog/components/BlogPublicationOptimizationPanel.tsx");
    assert.match(panel, /section--seo/);
    assert.match(panel, /section--social/);
    assert.match(panel, /section--distribution/);
    assert.match(panel, /Search Optimization/);
    assert.match(panel, /Social Preview/);
    assert.match(panel, /Distribution/);

    const css = readWeb("features/blog/publishing.css");
    assert.match(css, /optimization__grid[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
    assert.match(css, /section--seo[\s\S]*--hu-color-primary-soft/s);
    assert.match(css, /section--social[\s\S]*--hu-color-accent/s);
    assert.match(css, /section--distribution[\s\S]*--hu-color-bg-subtle/s);
    assert.doesNotMatch(css, /repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  });
});
