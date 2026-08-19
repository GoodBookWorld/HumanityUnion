import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Participant UX Pack 01 Part 1 — Workspace Quick Actions must open the
 * canonical surface each widget represents (not the public /initiatives list).
 *
 * Source contract (avoids importing the full workspace-home service graph).
 */
const serviceSource = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../src/modules/workspace-home/workspace-home.service.ts",
  ),
  "utf8",
);

function extractBuildQuickActionsBody(): string {
  const start = serviceSource.indexOf("export function buildQuickActions");
  assert.ok(start >= 0, "buildQuickActions must be exported");
  const end = serviceSource.indexOf("\nfunction buildResponsibilities", start);
  assert.ok(end > start, "buildQuickActions body boundary");
  return serviceSource.slice(start, end);
}

describe("Participant UX Pack 01 — Workspace Quick Actions canonical hrefs", () => {
  const body = extractBuildQuickActionsBody();

  it("maps each Quick Action to its canonical destination", () => {
    assert.match(body, /id:\s*"continue-draft-initiative"[\s\S]*?href:\s*firstDraftHref\s*\?\?\s*myInitiativesHref/);
    assert.match(body, /id:\s*"continue-analysis"[\s\S]*?href:\s*myInitiativesHref/);
    assert.match(body, /id:\s*"continue-proposal"[\s\S]*?href:\s*myInitiativesHref/);
    assert.match(body, /id:\s*"continue-revision"[\s\S]*?href:\s*myInitiativesHref/);
    assert.match(body, /id:\s*"open-initiatives"[\s\S]*?href:\s*myInitiativesHref/);
    assert.match(body, /const myInitiativesHref = "\/workspace\/initiatives"/);
    assert.match(body, /id:\s*"participation-area"[\s\S]*?href:\s*"\/member#participation-area"/);
    assert.match(body, /id:\s*"search-civic-records"[\s\S]*?href:\s*"\/search"/);
    assert.match(body, /id:\s*"civic-activity"[\s\S]*?href:\s*"\/civic-activity"/);
    assert.match(body, /id:\s*"create-initiative"[\s\S]*?href:\s*"\/initiatives\/create"/);
    assert.doesNotMatch(body, /href:\s*"\/initiatives"/);
  });
});
