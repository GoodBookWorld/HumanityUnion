/**
 * Pack 16B — Publishing editor sticky stack (header → chrome → CK toolbar).
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

describe("Pack 16B — Publishing editor sticky stack", () => {
  it("defines chrome offset token and stacks CK toolbar below chrome + header", () => {
    const css = readWeb("features/blog/publishing.css");
    assert.match(css, /--hu-publishing-editor-chrome-offset/);
    assert.match(css, /--hu-button-min-height/);
    assert.match(css, /--hu-scroll-margin-top/);

    assert.match(
      css,
      /\.blog-post-editor__chrome[\s\S]*top:\s*var\(--hu-scroll-margin-top/s,
    );
    assert.match(
      css,
      /\.blog-post-editor__chrome[\s\S]*z-index:\s*calc\(var\(--hu-z-sticky/s,
    );

    assert.match(
      css,
      /\.ck\.ck-editor__top[\s\S]*--hu-publishing-editor-chrome-offset/s,
    );
    assert.match(
      css,
      /\.ck\.ck-editor__top[\s\S]*z-index:\s*var\(--hu-z-sticky/s,
    );
  });

  it("aside sticky clears the same chrome band (no magic 3.25rem)", () => {
    const css = readWeb("features/blog/publishing.css");
    assert.match(
      css,
      /\.blog-post-editor__aside[\s\S]*--hu-publishing-editor-chrome-offset/s,
    );
    assert.doesNotMatch(css, /\+ 3\.25rem/);
  });

  it("mobile uses a single sticky layer (chrome static; toolbar below header)", () => {
    const css = readWeb("features/blog/publishing.css");
    const mobile = css.slice(css.indexOf("@media (max-width: 768px)"));
    assert.match(mobile, /\.blog-post-editor__chrome[\s\S]*position:\s*static/s);
    assert.match(
      mobile,
      /\.ck\.ck-editor__top[\s\S]*top:\s*var\(--hu-scroll-margin-top/s,
    );
    assert.doesNotMatch(mobile, /\.ck\.ck-editor__top[\s\S]*top:\s*0\s*;/s);
  });

  it("new + edit publishing routes still mount BlogPostEditor", () => {
    const newPage = readWeb("app/workspace/publishing/new/page.tsx");
    const editPage = readWeb("app/workspace/publishing/[postId]/page.tsx");
    assert.match(newPage, /BlogEditorPageContent|BlogPostEditor/);
    assert.match(editPage, /BlogEditorPageContent|BlogPostEditor/);

    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /blog-post-editor__chrome/);
    assert.match(editor, /blog-post-editor--pack15b/);
  });
});
