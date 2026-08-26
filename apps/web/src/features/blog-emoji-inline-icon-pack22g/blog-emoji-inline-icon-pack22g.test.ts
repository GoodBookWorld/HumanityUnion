/**
 * Pack 22G — Blog editor emoji + inline icon contracts.
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

describe("Pack 22G — Blog emoji + inline icon insertion", () => {
  it("emoji toolbar/action exists without native CDN Emoji plugin", () => {
    const rich = readWeb("features/blog/components/BlogRichTextEditorClient.tsx");
    const emojiPlugin = readWeb("features/blog/blog-emoji-plugin.ts");
    assert.match(rich, /BlogEmojiPlugin/);
    assert.match(rich, /BLOG_EMOJI_TOOLBAR_ITEM|blogEmoji/);
    assert.match(emojiPlugin, /createDropdown/);
    assert.match(emojiPlugin, /writer\.insertText/);
    assert.doesNotMatch(rich, /\bEmoji\b,\s*Mention|\bEmojiPicker\b|\bEmojiMention\b/);
    assert.doesNotMatch(emojiPlugin, /definitionsUrl\s*:/);
    assert.doesNotMatch(emojiPlugin, /from\s+["']@ckeditor\/ckeditor5-emoji["']/);
  });

  it("emoji inserts at caret via model text (no raw HTML)", () => {
    const emojiPlugin = readWeb("features/blog/blog-emoji-plugin.ts");
    assert.match(emojiPlugin, /insertEmojiAtSelection/);
    assert.match(emojiPlugin, /insertText\(emoji/);
    assert.match(emojiPlugin, /editing\.view\.focus/);
    assert.doesNotMatch(emojiPlugin, /innerHTML|dangerouslySetInnerHTML|insertHtml|data-cke-emoji/);
  });

  it("emoji palette is local Unicode with multi-codepoint examples", () => {
    const palette = readWeb("features/blog/blog-emoji-palette.ts");
    assert.match(palette, /People/);
    assert.match(palette, /Symbols/);
    assert.match(palette, /Nature/);
    assert.match(palette, /Objects/);
    assert.match(palette, /Flags/);
    // Multi-codepoint / ZWJ-style sequences present in palette (flags / complex emoji).
    assert.match(palette, /🇺🇳|🖥️|🗓️|❤️/);
  });

  it("inline icon reuses Blog FileRepository upload path", () => {
    const rich = readWeb("features/blog/components/BlogRichTextEditorClient.tsx");
    const inline = readWeb("features/blog/blog-inline-icon-plugin.ts");
    assert.match(rich, /BlogInlineIconPlugin/);
    assert.match(rich, /insertInlineIcon|BLOG_INLINE_ICON_TOOLBAR_ITEM/);
    assert.match(inline, /FileRepository/);
    assert.match(inline, /FileDialogButtonView/);
    assert.match(inline, /imageInline/);
    assert.match(inline, /alt:\s*""/);
    assert.match(inline, /image\/jpeg,image\/png,image\/webp,image\/gif/);
    assert.doesNotMatch(inline, /image\/svg|\.svg\b/);
    assert.doesNotMatch(inline, /EasyImage|CKBox|new media API|icon-specific/i);
    assert.match(rich, /uploadImage/);
  });

  it("keeps normal block/aligned image styles and resize unit", () => {
    const rich = readWeb("features/blog/components/BlogRichTextEditorClient.tsx");
    assert.match(rich, /ImageResize/);
    assert.match(rich, /resizeUnit:\s*"%"/);
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
    assert.match(rich, /imageTextAlternative/);
  });

  it("sanitizer still preserves Unicode emoji and inline image classes", () => {
    const sanitize = readApi("modules/blog/blog-content-sanitize.ts");
    assert.match(sanitize, /normalizeBlogNbspArtifacts|Pack 22F/);
    assert.match(sanitize, /image-style-inline/);
    assert.doesNotMatch(sanitize, /stripEmoji|removeEmoji|emoji/i);
  });
});
