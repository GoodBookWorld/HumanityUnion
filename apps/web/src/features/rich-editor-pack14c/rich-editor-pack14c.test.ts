/**
 * Pack 14C — Author rich publication editor layout & toolbar contracts.
 * Pack 15B retires TipTap for CKEditor while preserving layout/actions contracts.
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
    assert.match(css, /blog-post-editor--pack14c|blog-post-editor--pack15b/);
    assert.match(css, /ck-editor__top|--hu-scroll-margin-top/);
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
    const rich = readWeb("features/blog/components/BlogRichTextEditorClient.tsx");
    assert.match(rich, /heading2|"heading"/);
    assert.match(rich, /"bold"/);
    assert.match(rich, /"italic"/);
    assert.match(rich, /"underline"/);
    assert.match(rich, /"bulletedList"/);
    assert.match(rich, /"numberedList"/);
    assert.match(rich, /"alignment"/);
    assert.match(rich, /uploadImage|BlogCkeditorUploadAdapterPlugin/);
    assert.match(rich, /imageTextAlternative/);
    assert.doesNotMatch(rich, /@tiptap/);
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
