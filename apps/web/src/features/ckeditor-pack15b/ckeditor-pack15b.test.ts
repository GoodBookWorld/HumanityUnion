/**
 * Pack 15B — CKEditor 5 authoring workspace contracts (Web).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const webRoot = path.resolve(webSrc, "..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readPkg(): string {
  return readFileSync(path.join(webRoot, "package.json"), "utf8");
}

describe("Pack 15B — CKEditor 5 authoring workspace", () => {
  it("uses official ckeditor5 + react packages; TipTap removed", () => {
    const pkg = readPkg();
    assert.match(pkg, /"ckeditor5"/);
    assert.match(pkg, /"@ckeditor\/ckeditor5-react"/);
    assert.doesNotMatch(pkg, /@tiptap\//);

    const rich = readWeb("features/blog/components/BlogRichTextEditorClient.tsx");
    assert.match(rich, /@ckeditor\/ckeditor5-react/);
    assert.match(rich, /ClassicEditor/);
    assert.match(rich, /BlogCkeditorUploadAdapterPlugin/);
    assert.doesNotMatch(rich, /@tiptap|useEditor|ProseMirror/);

    const shell = readWeb("features/blog/components/BlogRichTextEditor.tsx");
    assert.match(shell, /ssr:\s*false/);
    assert.match(shell, /BlogRichTextEditorClient/);
  });

  it("toolbar includes safe tools; unrestricted fonts omitted", () => {
    const rich = readWeb("features/blog/components/BlogRichTextEditorClient.tsx");
    for (const tool of [
      "heading",
      "bold",
      "italic",
      "underline",
      "link",
      "bulletedList",
      "numberedList",
      "blockQuote",
      "alignment",
      "uploadImage",
      "insertTable",
      "horizontalLine",
      "undo",
      "redo",
    ]) {
      assert.match(rich, new RegExp(`"${tool}"`));
    }
    assert.doesNotMatch(rich, /FontFamily|fontFamily|FontSize|fontSize/);
    assert.match(rich, /Font-family \/ free-form font-size are intentionally omitted/);
  });

  it("upload adapter uses Blog media endpoint, not CK cloud", () => {
    const adapter = readWeb("features/blog/ckeditor-upload-adapter.ts");
    assert.match(adapter, /uploadBlogImage/);
    assert.match(adapter, /FileRepository/);
    assert.doesNotMatch(adapter, /EasyImage|CKBox|ckeditor\.cloud|cloudServices/i);
  });

  it("layout remains dominant canvas + grouped settings; Assistant compact", () => {
    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /blog-post-editor--pack15b/);
    assert.match(editor, /Status &amp; review|Status & review/);
    assert.match(editor, /Publication/);
    assert.match(editor, /blog-settings-media/);
    assert.match(editor, /Discovery/);
    assert.match(editor, /BlogCoverField/);
    assert.match(editor, /Submit for Review/);
    assert.match(editor, /Save Draft/);
    assert.match(editor, /Preview/);

    const css = readWeb("features/blog/publishing.css");
    assert.match(css, /minmax\(0,\s*2\.6fr\)/);
    assert.match(css, /--hu-scroll-margin-top/);
    assert.match(css, /--hu-publishing-editor-chrome-offset|--hu-z-sticky/);
    assert.match(css, /\.ck\.ck-editor__top/);
    assert.match(css, /--hu-publishing-editor-chrome-offset/);

    const newPage = readWeb("app/workspace/publishing/new/page.tsx");
    assert.match(newPage, /assistantPlacement="compact"/);
  });

  it("cover remains Pack 15A field; license key env documented via GPL fallback", () => {
    const rich = readWeb("features/blog/components/BlogRichTextEditorClient.tsx");
    assert.match(rich, /NEXT_PUBLIC_CKEDITOR_LICENSE_KEY/);
    assert.match(rich, /"GPL"/);

    const cover = readWeb("features/blog/components/BlogCoverField.tsx");
    assert.match(cover, /blog-cover-field__preview/);
  });
});
