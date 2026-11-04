/**
 * SEO-BING-01.3 — owner-approved legacy WordPress redirects in next.config.ts.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PUBLIC_SEO_LOCALE_RESERVED_TOP_SEGMENTS } from "@hu/types";

import nextConfig from "../../../next.config";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const appDir = path.join(webSrc, "app");

const APPROVED = [
  ["/who-owns-the-earth", "/blog/who-owns-the-earth"],
  ["/breaking-stereotypes", "/blog/breaking-stereotypes"],
  ["/world-protection-corps", "/blog/world-protection-corps"],
  ["/leader", "/blog/leader"],
] as const;

async function loadRedirects() {
  assert.equal(typeof nextConfig.redirects, "function");
  return nextConfig.redirects!();
}

describe("SEO-BING-01.3 — legacy WordPress redirects", () => {
  it("keeps the existing rule and adds exactly the four approved permanent redirects", async () => {
    const redirects = await loadRedirects();
    assert.deepEqual(
      redirects.map(({ source, destination, permanent }) => ({ source, destination, permanent })),
      [
        { source: "/knowledge/media", destination: "/media", permanent: true },
        ...APPROVED.map(([source, destination]) => ({ source, destination, permanent: true })),
      ],
    );
  });

  it("uses exact paths only: no wildcards, parameters, locales or homepage targets", async () => {
    for (const { source, destination } of await loadRedirects()) {
      assert.match(source, /^(\/[a-z0-9-]+)+$/, `${source} must be an exact path`);
      assert.match(destination, /^(\/[a-z0-9-]+)+$/, `${destination} must be an exact path`);
      assert.notEqual(destination, "/");
    }
    for (const [source, destination] of APPROVED) {
      assert.equal(destination, `/blog${source}`, "each legacy article maps to the same blog slug");
    }
  });

  it("redirects in a single hop", async () => {
    const redirects = await loadRedirects();
    const sources = new Set(redirects.map((redirect) => redirect.source));
    for (const { destination } of redirects) {
      assert.equal(sources.has(destination), false, `${destination} must not redirect again`);
    }
  });

  it("does not shadow an existing route, reserved segment or locale", () => {
    const topLevel = new Set(readdirSync(appDir).map((entry) => entry.toLowerCase()));
    for (const [source] of APPROVED) {
      const segment = source.slice(1);
      assert.equal(topLevel.has(segment), false, `${source} collides with app/${segment}`);
      assert.equal(PUBLIC_SEO_LOCALE_RESERVED_TOP_SEGMENTS.has(segment), false);
      assert.doesNotMatch(
        segment,
        /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i,
        `${source} looks like a locale`,
      );
    }
    assert.ok(
      existsSync(path.join(appDir, "blog", "[slug]", "page.tsx")),
      "blog article route exists",
    );
  });
});
