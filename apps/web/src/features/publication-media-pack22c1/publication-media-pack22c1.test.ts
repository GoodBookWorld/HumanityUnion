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
});
