/**
 * Pack 14D — Public Blog discovery: pagination + discovery aggregates (API contracts).
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

describe("Pack 14D — Public Blog discovery (API)", () => {
  it("public list route accepts page/pageSize/includeDiscovery", () => {
    const routes = readRepo("apps/api/src/modules/blog/blog.routes.ts");
    assert.match(routes, /req\.query\.page/);
    assert.match(routes, /req\.query\.pageSize/);
    assert.match(routes, /includeDiscovery/);
    assert.match(routes, /listPublicBlogPosts/);
  });

  it("listPublicBlogPosts returns pagination + discovery side data", () => {
    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /aggregatePublishedBlogPostCountsByCategory/);
    assert.match(service, /getPublicBlogIndexViewCount/);
    assert.match(service, /categoryCounts/);
    assert.match(service, /latestPublications/);
    assert.match(service, /blogIndexViews/);
    assert.match(service, /totalPages/);
    assert.match(service, /pageSize/);
    assert.match(service, /limit:\s*4/);
  });

  it("category counts use one aggregation with visibility filter", () => {
    const repo = readRepo("apps/api/src/modules/blog/persistence/blog.repository.ts");
    assert.match(repo, /aggregatePublishedBlogPostCountsByCategory/);
    assert.match(repo, /\$group/);
    assert.match(repo, /status:\s*"published"/);
    assert.match(repo, /administrativelyBlocked:\s*\{\s*\$ne:\s*true\s*\}/);
    assert.match(repo, /publishedAt:\s*\{\s*\$lte:\s*now/);
  });

  it("Blog Views uses Pack 11 meta counter for /blog only; public getter is aggregate-only", () => {
    const traffic = readRepo(
      "apps/api/src/modules/traffic-analytics/traffic-aggregate.repository.ts",
    );
    assert.match(traffic, /blogIndexAllTimeViews/);
    assert.match(traffic, /pathname === "\/blog"/);
    assert.match(traffic, /getPublicBlogIndexViewCount/);
    assert.doesNotMatch(
      traffic.slice(traffic.indexOf("getPublicBlogIndexViewCount")),
      /visitorId|referrerHost|allTimeSessions/,
    );

    const types = readRepo("packages/types/src/domain/blog.ts");
    assert.match(types, /blogIndexViews\?:/);
    assert.match(types, /PublicBlogCategoryCount/);
    assert.match(types, /latestPublications\?:/);
  });
});
