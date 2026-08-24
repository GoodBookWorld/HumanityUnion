/**
 * Pack 16A — Author published publication management (API contracts + transition table).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertBlogStatusTransition,
  canTransitionBlogStatus,
} from "../../../src/modules/blog/blog-status-transitions.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../..");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 16A — Author published management (API unit)", () => {
  it("published may transition to archived (delete) or draft (correction)", () => {
    assert.equal(canTransitionBlogStatus("published", "archived"), true);
    assert.equal(canTransitionBlogStatus("published", "draft"), true);
    assert.equal(canTransitionBlogStatus("published", "submitted_for_review"), false);
    assert.doesNotThrow(() => assertBlogStatusTransition("published", "draft"));
    assert.doesNotThrow(() => assertBlogStatusTransition("published", "archived"));
  });

  it("service exposes startPublishedCorrection + hardened archive + published update audit", () => {
    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /export async function startPublishedCorrection/);
    assert.match(service, /correction_started/);
    assert.match(service, /blog\.published_correction_started/);
    assert.match(service, /blog\.update_published/);
    assert.match(service, /Only Trusted Authors, Editors, or Administrators may update published posts in place/);
    assert.match(
      service,
      /Trusted Authors, Editors, and Administrators correct published posts in place/,
    );
    assert.match(
      service,
      /This publication is blocked by an administrator and cannot be deleted or archived/,
    );
    assert.match(
      service,
      /This publication is blocked by an administrator and cannot be corrected/,
    );

    const correctionFn = service.slice(service.indexOf("export async function startPublishedCorrection"));
    assert.match(correctionFn, /status:\s*"draft"/);
    assert.match(correctionFn, /invalidateGlobalSearchIndex/);
    assert.match(correctionFn, /assertAuthorPublishingAllowed/);

    const archiveFn = service.slice(service.indexOf("export async function archiveBlogPost"));
    assert.match(archiveFn, /assertAuthorPublishingAllowed/);
    assert.match(archiveFn, /status:\s*"archived"/);

    const routes = readRepo("apps/api/src/modules/blog/blog.routes.ts");
    assert.match(routes, /start-correction/);
    assert.match(routes, /startPublishedCorrection/);
    assert.match(routes, /\/posts\/:postId\/archive/);
  });

  it("audit + editorial history types include Pack 16A actions", () => {
    const admin = readRepo("packages/types/src/domain/administration.ts");
    assert.match(admin, /blog\.update_published/);
    assert.match(admin, /blog\.published_correction_started/);

    const blog = readRepo("packages/types/src/domain/blog.ts");
    assert.match(blog, /correction_started/);
  });

  it("public listing still requires published + not administratively blocked", () => {
    const repo = readRepo("apps/api/src/modules/blog/persistence/blog.repository.ts");
    assert.match(repo, /status:\s*"published"/);
    assert.match(repo, /administrativelyBlocked:\s*\{\s*\$ne:\s*true\s*\}/);
  });
});
