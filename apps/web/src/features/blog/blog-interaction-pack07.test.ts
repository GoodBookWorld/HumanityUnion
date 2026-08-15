import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Blog Interaction Pack 07 — Web", () => {
  it("Article page includes reactions and comments", () => {
    const article = read("features/blog/components/BlogArticlePageContent.tsx");
    assert.match(article, /BlogReactionControls/);
    assert.match(article, /BlogCommentsSection/);
  });

  it("Reaction controls expose labeled accessible pressed state", () => {
    const reactions = read("features/blog/components/BlogReactionControls.tsx");
    assert.match(reactions, /Was this publication helpful/);
    assert.match(reactions, /aria-pressed/);
    assert.match(reactions, /Helpful/);
    assert.match(reactions, /Not Helpful/);
    assert.match(reactions, /not Author quality or reputation/);
    assert.doesNotMatch(reactions, /Author scores|trust percentages|reputation metrics/i);
  });

  it("Comments section supports guest guidance, composer, one-level reply", () => {
    const comments = read("features/blog/components/BlogCommentsSection.tsx");
    assert.match(comments, /Sign in/);
    assert.match(comments, /post a comment/);
    assert.match(comments, /Post Comment/);
    assert.match(comments, /Reply/);
    assert.match(comments, /comment-\$\{/);
    assert.match(comments, /textarea/);
    assert.doesNotMatch(comments, /BlogRichTextEditor|TipTap/);
  });

  it("Interaction API uses public Blog routes and never forges author", () => {
    const api = read("features/blog/interaction-api.ts");
    assert.match(api, /\/api\/v1\/public\/blog\//);
    assert.match(api, /comments/);
    assert.match(api, /reactions/);
    assert.doesNotMatch(api, /authorParticipantId/);
  });
});
