import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const indexesPath = path.resolve(
  import.meta.dirname,
  "../../../src/infrastructure/mongodb/mongo-indexes.ts",
);

function publicNewsIndexBlock(source: string): string {
  const marker = "collectionName: MONGO_COLLECTIONS.publicNewsArticles";
  const start = source.indexOf(marker);
  assert.ok(start >= 0, "public_news_articles index declaration missing");
  const next = source.indexOf("collectionName:", start + marker.length);
  assert.ok(next > start);
  return source.slice(start, next);
}

describe("public_news_articles id index", () => {
  it("declares a non-unique public_news_id index and keeps existing indexes", () => {
    const block = publicNewsIndexBlock(readFileSync(indexesPath, "utf8"));
    const idIndex = block.match(/\{\s*key:\s*\{\s*id:\s*1\s*\},\s*name:\s*"public_news_id"\s*\}/);

    assert.ok(idIndex, "public_news_id must be declared as { id: 1 }");
    assert.equal(idIndex[0].includes("unique"), false);

    assert.match(block, /name:\s*"public_news_normalized_article_url_unique"/);
    assert.match(block, /key:\s*\{\s*normalizedArticleUrl:\s*1\s*\}/);
    assert.match(block, /name:\s*"public_news_expires_at_ttl"/);
    assert.match(block, /name:\s*"public_news_published_at"/);
    assert.match(block, /name:\s*"public_news_status_published_at"/);
    assert.match(block, /name:\s*"public_news_source_name"/);
    assert.match(block, /name:\s*"public_news_language"/);
  });
});
