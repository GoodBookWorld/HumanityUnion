/**
 * Pack 22C.1 — Publication editor image position, drag resize, inline icons.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const apiSrc = path.resolve(webSrc, "../../api/src");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readApi(relativePath: string): string {
  return readFileSync(path.join(apiSrc, relativePath), "utf8");
}

describe("Pack 22C.1 — publication image position / resize / inline", () => {
  it("enables ImageResize with percentage unit and preserves image toolbar", () => {
    const rich = readWeb("features/blog/components/BlogRichTextEditorClient.tsx");
    assert.match(rich, /ImageResize/);
    assert.match(rich, /resizeUnit:\s*"%"/);
    assert.match(rich, /imageTextAlternative/);
    assert.match(rich, /toggleImageCaption/);
    for (const style of [
      "inline",
      "block",
      "side",
      "alignLeft",
      "alignCenter",
      "alignRight",
    ]) {
      assert.match(rich, new RegExp(`imageStyle:${style}|"${style}"`));
    }
    assert.doesNotMatch(rich, /image\/gif|ImageResizeButtons/);
  });

  it("public CSS supports all configured CKEditor image styles", () => {
    const css = readWeb("features/blog/blog.css");
    for (const cls of [
      "image-style-align-left",
      "image-style-align-right",
      "image-style-align-center",
      "image-style-side",
      "image-style-block",
      "image-style-inline",
    ]) {
      assert.match(css, new RegExp(`\\.${cls.replace(/-/g, "\\-")}`));
    }
    assert.match(css, /image_resized/);
    assert.match(css, /max-width:\s*100%/);
    assert.match(css, /height:\s*auto/);
    assert.match(css, /clear:\s*both/);
  });

  it("inline image is not forced to display:block", () => {
    const css = readWeb("features/blog/blog.css");
    assert.match(css, /\.blog-article-body img\s*\{[^}]*display:\s*block/s);
    assert.match(
      css,
      /img\.image-style-inline[\s\S]*display:\s*inline-block|image-style-inline[\s\S]*display:\s*inline-block/,
    );
    const publishing = readWeb("features/blog/publishing.css");
    assert.match(publishing, /image-style-inline[\s\S]*inline-block/);
  });

  it("authoring CSS mirrors public position/resize contracts", () => {
    const publishing = readWeb("features/blog/publishing.css");
    for (const cls of [
      "image-style-align-left",
      "image-style-align-right",
      "image-style-align-center",
      "image-style-side",
      "image-style-block",
      "image-style-inline",
      "image_resized",
    ]) {
      assert.match(publishing, new RegExp(cls.replace(/-/g, "\\-").replace(/_/g, "_")));
    }
  });

  it("editor intrinsic figures stay natural; resized figures still fill their percentage", () => {
    const publishing = readWeb("features/blog/publishing.css");
    const css = readWeb("features/blog/blog.css");
    assert.match(
      publishing,
      /\.blog-rich-text--ckeditor \.ck-content figure\.image img\s*\{[^}]*min-width:\s*0/s,
    );
    assert.match(
      publishing,
      /\.blog-rich-text--ckeditor \.ck-content figure\.image img\s*\{[^}]*width:\s*auto/s,
    );
    assert.match(
      publishing,
      /\.blog-rich-text--ckeditor \.ck-content figure\.image_resized img\s*\{[^}]*width:\s*100%/s,
    );
    assert.match(
      publishing,
      /\.blog-rich-text--ckeditor \.ck-content figure\.image_resized img\s*\{[^}]*max-width:\s*100%/s,
    );
    assert.match(
      publishing,
      /@media \(max-width:\s*768px\)[\s\S]*\.blog-rich-text--ckeditor \.ck-content figure\.image-style-align-left[\s\S]*float:\s*none/,
    );
    assert.match(
      publishing,
      /@media \(max-width:\s*768px\)[\s\S]*image-style-inline[\s\S]*max-width:\s*min\(100%,\s*8rem\)/,
    );
    assert.match(css, /\.blog-article-body figure\.image-style-block img\s*\{[^}]*width:\s*auto/s);
    assert.match(css, /\.blog-article-body figure\.image_resized img\s*\{[^}]*width:\s*100%/s);
    assert.match(
      css,
      /@media \(max-width:\s*768px\)[\s\S]*figure\.image-style-align-left[\s\S]*float:\s*none/,
    );
    assert.match(css, /max-width:\s*min\(100%,\s*8rem\)/);
  });

  it("Pack 22C.2 — Blog cover accept includes GIF; ImageResize remains", () => {
    const rich = readWeb("features/blog/components/BlogRichTextEditorClient.tsx");
    assert.match(rich, /ImageResize/);
    assert.match(rich, /resizeUnit:\s*"%"/);
    const cover = readWeb("features/blog/components/BlogCoverField.tsx");
    assert.match(cover, /image\/gif/);
  });

  it("keeps alt/caption toolbar controls", () => {
    const rich = readWeb("features/blog/components/BlogRichTextEditorClient.tsx");
    assert.match(rich, /ImageCaption/);
    assert.match(rich, /imageTextAlternative/);
    assert.match(rich, /toggleImageCaption/);
  });

  it("groups image size, wrap, and block controls and keeps percentage resize", () => {
    const rich = readWeb("features/blog/components/BlogRichTextEditorClient.tsx");
    assert.match(rich, /LinkImage/);
    assert.match(rich, /"resizeImage"/);
    assert.match(rich, /"imageStyle:wrapText"/);
    assert.match(rich, /imageStyle:blockLayout/);
    assert.match(rich, /"linkImage"/);
    for (const control of [
      "resizeImage:original",
      "resizeImage:25",
      "resizeImage:50",
      "resizeImage:100",
      "resizeImage:custom",
      "imageStyle:alignBlockLeft",
      "imageStyle:alignBlockRight",
      "imageStyle:full",
    ]) {
      assert.match(rich, new RegExp(control.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(rich, /resizeUnit:\s*"%"/);
    assert.match(rich, /className:\s*"image-style-block"/);
    assert.match(rich, /className:\s*"image-style-block-align-left"/);
    assert.match(rich, /className:\s*"image-style-block-align-right"/);
    assert.doesNotMatch(rich, /image-style-block-align-center|imageStyle:alignBlockCenter/);

    const css = readWeb("features/blog/blog.css");
    const publishing = readWeb("features/blog/publishing.css");
    const sanitize = readApi("modules/blog/blog-content-sanitize.ts");
    for (const file of [css, publishing, sanitize]) {
      assert.match(file, /image-style-block-align-left/);
      assert.match(file, /image-style-block-align-right/);
    }
    assert.match(css, /\.blog-article-body figure\.image_resized img\s*\{[^}]*width:\s*100%/s);
    assert.match(
      publishing,
      /\.blog-rich-text--ckeditor \.ck-content figure\.image_resized img\s*\{[^}]*width:\s*100%/s,
    );
    assert.match(css, /figure\.image-style-block-align-left\s*\{[^}]*margin-left:\s*0/s);
    assert.match(css, /figure\.image-style-block-align-right\s*\{[^}]*margin-left:\s*auto/s);
    assert.match(publishing, /ck-balloon-panel\.ck-toolbar-container/);
    assert.match(publishing, /flex-wrap:\s*wrap/);
  });
});
