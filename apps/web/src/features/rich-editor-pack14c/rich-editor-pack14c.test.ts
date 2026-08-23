/**
 * Pack 14C — Author rich publication editor layout & toolbar contracts.
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

describe("Pack 14C — Author rich publication editor", () => {
  it("desktop layout dominates with settings rail; Assistant is compact", () => {
    const css = readWeb("features/blog/publishing.css");
    assert.match(css, /2\.6fr/);
    assert.match(css, /blog-post-editor--pack14c/);
    assert.match(css, /blog-rich-text__toolbar-sticky/);
    assert.match(css, /member-workspace__assistant-compact/);

    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /Publication settings/);
    assert.match(editor, /blog-post-editor__title-input/);
    assert.match(editor, /Save failed/);
    assert.match(editor, /Cover is separate from inline article images/);

    const newPage = readWeb("app/workspace/publishing/new/page.tsx");
    assert.match(newPage, /assistantPlacement="compact"/);
    const editPage = readWeb("app/workspace/publishing/[postId]/page.tsx");
    assert.match(editPage, /assistantPlacement="compact"/);
  });

  it("toolbar supports headings, marks, lists, link, align, inline image upload at caret", () => {
    const rich = readWeb("features/blog/components/BlogRichTextEditor.tsx");
    assert.match(rich, /toggleHeading\(\{ level: 2 \}\)/);
    assert.match(rich, /toggleHeading\(\{ level: 3 \}\)/);
    assert.match(rich, /toggleBold/);
    assert.match(rich, /toggleItalic/);
    assert.match(rich, /toggleUnderline/);
    assert.match(rich, /toggleBulletList/);
    assert.match(rich, /toggleOrderedList/);
    assert.match(rich, /setTextAlign/);
    assert.match(rich, /uploadBlogImage/);
    assert.match(rich, /Insert at caret/);
    assert.match(rich, /Image description \/ alt text/);
    assert.match(rich, /Do not leave blank|never auto-generated/i);
    assert.match(rich, /setImage\(\{ src: pendingImageSrc, alt:/);
    assert.doesNotMatch(rich, /window\.prompt\("Image URL/);
  });

  it("settings sidebar holds category, tags, date, cover, excerpt; content is canvas-only", () => {
    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /blog-post-editor__aside/);
    assert.match(editor, /Publication date/);
    assert.match(editor, /BLOG_PUBLICATION_DATE_MIN/);
    assert.match(editor, /BlogCoverField/);
    assert.match(editor, /Excerpt/);
    assert.match(editor, /Submit for Review/);
    assert.match(editor, /Preview/);
    assert.match(editor, /manual Save Draft only/);
  });
});
