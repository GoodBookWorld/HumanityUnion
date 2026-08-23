/**
 * Pack 13C — Author publication management + publication date contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { BLOG_PUBLICATION_DATE_MIN, BLOG_POST_STATUSES } from "@hu/types";

import {
  isoToPublicationDateOnly,
  isPublicationDue,
  publicationDateOnlyToIso,
  validatePublicationDateInput,
} from "../../../src/modules/blog/blog-publication-date.js";
import { BlogValidationError } from "../../../src/modules/blog/blog.errors.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 13C — publication date + schedule contracts", () => {
  it("includes scheduled in canonical status vocabulary", () => {
    assert.ok(BLOG_POST_STATUSES.includes("scheduled"));
    assert.equal(BLOG_PUBLICATION_DATE_MIN, "2022-01-01");
  });

  it("allows 2022-01-01 and rejects 2021; stores noon UTC", () => {
    assert.equal(validatePublicationDateInput("2022-01-01"), "2022-01-01");
    assert.equal(publicationDateOnlyToIso("2022-01-01"), "2022-01-01T12:00:00.000Z");
    assert.equal(isoToPublicationDateOnly("2023-04-15T12:00:00.000Z"), "2023-04-15");

    assert.throws(
      () => validatePublicationDateInput("2021-12-31"),
      (error: unknown) => error instanceof BlogValidationError,
    );
  });

  it("treats future publishedAt as not due", () => {
    assert.equal(isPublicationDue("2099-01-01T12:00:00.000Z", "2026-08-23T12:00:00.000Z"), false);
    assert.equal(isPublicationDue("2023-04-15T12:00:00.000Z", "2026-08-23T12:00:00.000Z"), true);
  });

  it("wires cancel-schedule route, scheduler, and public publishedAt gate", () => {
    const routes = readRepo("apps/api/src/modules/blog/blog.routes.ts");
    assert.match(routes, /cancel-schedule/);
    assert.match(routes, /publicationDate/);

    const scheduler = readRepo("apps/api/src/modules/blog/blog-scheduled-publish.scheduler.ts");
    assert.match(scheduler, /releaseDueScheduledBlogPublications/);
    assert.match(scheduler, /startBlogScheduledPublishScheduler/);

    const index = readRepo("apps/api/src/index.ts");
    assert.match(index, /startBlogScheduledPublishScheduler/);

    const repo = readRepo("apps/api/src/modules/blog/persistence/blog.repository.ts");
    assert.match(repo, /publishedAt:\s*\{\s*\$lte:/);
    assert.match(repo, /listDueScheduledBlogPosts/);

    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /status === "scheduled"/);
    assert.match(service, /releaseDueScheduledBlogPublications/);
    assert.match(service, /cancelScheduledBlogPublication/);
  });
});
