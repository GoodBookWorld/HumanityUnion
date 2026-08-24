/**
 * Pack 16H — Final Publishing & Authoring certification (API contracts).
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

describe("Pack 16H — API certification contracts", () => {
  it("public visibility excludes draft/review/future scheduled/blocked", () => {
    const repo = readRepo("apps/api/src/modules/blog/persistence/blog.repository.ts");
    assert.match(repo, /status:\s*"published"/);
    assert.match(repo, /administrativelyBlocked:\s*\{\s*\$ne:\s*true\s*\}/);
  });

  it("Trusted Publishing bypasses review notify path; correction remains capability-gated", () => {
    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /trustedPublishing/);
    assert.match(service, /allowTrustedPublishingBypass/);
    assert.match(service, /emitBlogPublicationAdminReviewNotifications/);
    assert.match(service, /startPublishedCorrection/);
    assert.match(
      service,
      /Trusted Authors, Editors, and Administrators correct published posts in place/,
    );
  });

  it("SEO sanitize + social best-effort + category safe delete remain", () => {
    assert.match(readRepo("apps/api/src/modules/blog/blog-seo.ts"), /sanitizeBlogPlainTextMeta/);
    assert.match(
      readRepo("apps/api/src/modules/blog/blog-social-distribution.ts"),
      /enqueueBlogSocialDistributionBestEffort/,
    );
    assert.match(
      readRepo("apps/api/src/modules/blog/blog-category-admin.service.ts"),
      /reassignToCategoryId/,
    );
  });

  it("Assistant reuses platform Lifecycle AI; no Blog-only provider module", () => {
    const authoring = readRepo("apps/api/src/modules/lifecycle-ai/blog-authoring-assistant.ts");
    assert.match(authoring, /LifecycleAi|platform|assistant/i);
    assert.doesNotMatch(authoring, /OpenAiBlogOnly|BlogOnlyProvider/);
    const platform = readRepo("apps/api/src/modules/lifecycle-ai/platform-assistant.service.ts");
    assert.match(platform, /blog.authoring|authoring/i);
  });
});
