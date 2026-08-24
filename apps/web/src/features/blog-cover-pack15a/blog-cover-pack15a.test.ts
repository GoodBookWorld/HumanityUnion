/**
 * Pack 15A — Blog cover preview & media state correction contracts.
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

describe("Pack 15A — Blog cover preview & media state", () => {
  it("canonical cover state is coverMedia (preview + form + save share one value)", () => {
    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /const \[coverMedia, setCoverMedia\]/);
    assert.match(editor, /coverMedia=\{coverMedia\}/);
    assert.match(editor, /setCoverMedia\(next\)/);
    assert.match(editor, /coverMedia,/);
    assert.match(editor, /setCoverMedia\(saved\.coverMedia/);
    assert.doesNotMatch(editor, /previewUrl|coverPreview|coverImageUrl/);

    const field = readWeb("features/blog/components/BlogCoverField.tsx");
    assert.match(field, /coverMedia: BlogCoverMedia \| null/);
    assert.match(field, /onChange\(\{/);
    assert.match(field, /mediaUrl: uploaded\.mediaUrl/);
    assert.match(field, /onChange\(null\)/);
  });

  it("BlogCoverImage recovers when imageUrl arrives after empty mount (failedSrc)", () => {
    const image = readWeb("features/blog/components/BlogCoverImage.tsx");
    assert.match(image, /failedSrc/);
    assert.match(image, /failedSrc === resolved/);
    assert.match(image, /key=\{resolved/);
    assert.doesNotMatch(image, /useState\(!resolved\)/);
  });

  it("cover field shows empty placeholder without false preview; alt is explicit-only", () => {
    const field = readWeb("features/blog/components/BlogCoverField.tsx");
    assert.match(field, /blog-cover-field__empty/);
    assert.match(field, /No cover image selected/);
    assert.match(field, /allowTitleAsAltFallback=\{false\}/);
    assert.match(field, /Do not invent descriptions automatically/);

    const image = readWeb("features/blog/components/BlogCoverImage.tsx");
    assert.match(image, /allowTitleAsAltFallback/);
  });

  it("preview geometry is 16:9 cover without stretch", () => {
    const css = readWeb("features/blog/publishing.css");
    assert.match(css, /\.blog-cover-field__preview[\s\S]*aspect-ratio:\s*16\s*\/\s*9/s);
    assert.match(css, /\.blog-cover-field__preview[\s\S]*overflow:\s*hidden/s);
    assert.match(css, /\.blog-cover-field__image[\s\S]*object-fit:\s*cover/s);
    assert.match(css, /\.blog-cover-field__image[\s\S]*object-position:\s*center/s);
    assert.match(css, /\.blog-cover-field__image[\s\S]*width:\s*100%/s);
  });

  it("failed Replace does not clear prior cover (onChange only after upload success)", () => {
    const field = readWeb("features/blog/components/BlogCoverField.tsx");
    const handle = field.slice(field.indexOf("async function handleFile"));
    const tryBlock = handle.slice(0, handle.indexOf("} catch"));
    assert.match(tryBlock, /await uploadBlogImage/);
    assert.match(tryBlock, /onChange\(/);
    assert.doesNotMatch(tryBlock.slice(0, tryBlock.indexOf("uploadBlogImage")), /onChange\(/);
  });
});
