/**
 * Pack 22A — Public initiative mini card meta uses warm accent color.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return readFileSync(path.join(dir, relativePath), "utf8");
}

describe("Pack 22A — public-initiative-mini-card__meta color", () => {
  it("sets meta text to Humanity Union warm accent #df9815", () => {
    const css = read("public-initiative-mini-card.css");
    assert.match(
      css,
      /\.public-initiative-mini-card__meta\s*\{[^}]*color:\s*var\(--hu-color-accent,\s*#df9815\)/s,
    );
  });

  it("does not recolor title, summary, footer date, or support via the meta rule", () => {
    const css = read("public-initiative-mini-card.css");
    const metaBlock = css.match(/\.public-initiative-mini-card__meta\s*\{[^}]*\}/s)?.[0] ?? "";
    assert.match(metaBlock, /#df9815/);
    assert.match(css, /\.public-initiative-mini-card__title\s*\{/);
    assert.match(css, /\.public-initiative-mini-card__summary\s*\{[^}]*color:\s*var\(--hu-color-text-muted\)/s);
    assert.match(css, /\.public-initiative-mini-card__date\s*\{[^}]*color:\s*var\(--hu-color-text-muted\)/s);
    assert.match(css, /\.public-initiative-mini-card__support\s*\{[^}]*color:\s*var\(--hu-color-text-muted\)/s);
  });

  it("keeps Share outside the navigation Link (nested interactive regression)", () => {
    const card = read("PublicInitiativeMiniCard.tsx");
    const shareIdx = card.indexOf("public-initiative-mini-card__share");
    const linkIdx = card.indexOf('className="public-initiative-mini-card__link"');
    assert.ok(shareIdx > 0 && linkIdx > shareIdx);
    assert.doesNotMatch(
      card.slice(card.indexOf("public-initiative-mini-card__meta")),
      /<a |<Link |<button /i,
    );
  });
});
