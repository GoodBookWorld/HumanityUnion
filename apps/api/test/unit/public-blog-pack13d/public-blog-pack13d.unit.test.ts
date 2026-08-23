/**
 * Pack 13D — public Blog authors directory + route wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 13D — public Blog authors API contracts", () => {
  it("exposes /authors before /:slug and aggregates visible latest posts only", () => {
    const routes = readRepo("apps/api/src/modules/blog/blog.routes.ts");
    const authorsIndex = routes.indexOf('publicBlogRouter.get("/authors"');
    const slugIndex = routes.indexOf('publicBlogRouter.get("/:slug"');
    assert.ok(authorsIndex > 0);
    assert.ok(authorsIndex < slugIndex);
    assert.match(routes, /listPublicBlogAuthors/);

    const repo = readRepo("apps/api/src/modules/blog/persistence/blog.repository.ts");
    assert.match(repo, /listLatestPublicBlogPostsByAuthor/);
    assert.match(repo, /administrativelyBlocked:\s*\{\s*\$ne:\s*true\s*\}/);
    assert.match(repo, /status:\s*"published"/);
    assert.match(repo, /publishedAt:\s*\{\s*\$lte:\s*now/);

    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /listPublicBlogAuthors/);
    assert.match(service, /latestPublication/);
  });
});
