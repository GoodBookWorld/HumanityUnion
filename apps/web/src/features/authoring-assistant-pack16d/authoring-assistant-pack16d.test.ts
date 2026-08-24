/**
 * Pack 16D — Authoring Humanity Union Assistant (Web).
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

describe("Pack 16D — authoring Humanity Union Assistant (web)", () => {
  it("BlogPostEditor mounts Assistant panel with explicit suggestion actions", () => {
    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /BlogAuthoringAssistantPanel/);
    assert.doesNotMatch(editor, /autoPublish|publishAutomatically/i);

    const panel = readWeb("features/blog/components/BlogAuthoringAssistantPanel.tsx");
    assert.match(panel, /Title suggestions/);
    assert.match(panel, /Text correction/);
    assert.match(panel, /Clarity \/ readability/);
    assert.match(panel, /Structure suggestions/);
    assert.match(panel, /SEO title/);
    assert.match(panel, /Meta description/);
    assert.match(panel, /Keywords \/ topics/);
    assert.match(panel, /Social preview/);
    assert.match(panel, /\bApply\b/);
    assert.match(panel, /\bReplace\b/);
    assert.match(panel, /\bDismiss\b/);
    assert.match(panel, /Confirm replace/);
    assert.match(panel, /requestHumanityUnionAssistantAssist/);
    assert.match(panel, /surfaceId: "blog"/);
    assert.match(panel, /never silently rewrites|never publishes/i);
    assert.doesNotMatch(panel, /publishBlogPost|submitBlogPostForReview/);
  });

  it("reuses platform Assistant API — no Blog-only AI provider", () => {
    const panel = readWeb("features/blog/components/BlogAuthoringAssistantPanel.tsx");
    assert.match(panel, /humanity-union-assistant\/api/);
    assert.doesNotMatch(panel, /openai|anthropic|gemini\.google|new BlogAi/i);

    const modal = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantModal.tsx",
    );
    assert.match(modal, /blog_authoring/);
    assert.match(modal, /pagePath/);
  });

  it("publishing editor pages keep Assistant never-publish copy", () => {
    const edit = readWeb("app/workspace/publishing/[postId]/page.tsx");
    const create = readWeb("app/workspace/publishing/new/page.tsx");
    assert.match(edit, /HumanityUnionAssistantWidget/);
    assert.match(edit, /never saves, submits, or publishes|never.*publish/i);
    assert.match(create, /HumanityUnionAssistantWidget/);
    assert.match(create, /never overwrite or publish|never.*publish/i);
  });
});
