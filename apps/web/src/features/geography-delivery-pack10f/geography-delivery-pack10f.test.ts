/**
 * Pack 10F — Staging geography runtime delivery recovery.
 * Packaging + fetch error semantics + staging verification guard.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  clearCommunityOptionCacheForTests,
  fetchCommunitiesByRegion,
  GeographyCommunityDeliveryError,
} from "@hu/geography";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const webRoot = path.resolve(webSrc, "..");
const repoRoot = path.resolve(webRoot, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 10F — geography runtime delivery recovery", () => {
  it("Web build copies public into Next standalone artifact", () => {
    const pkg = JSON.parse(readFileSync(path.join(webRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    assert.match(pkg.scripts.build ?? "", /copy-standalone-public-assets/);
    assert.ok(
      existsSync(path.join(webRoot, "scripts/copy-standalone-public-assets.mjs")),
      "missing copy-standalone-public-assets.mjs",
    );
  });

  it("Dockerfile overlays public AFTER standalone (cannot be clobbered)", () => {
    const dockerfile = readFileSync(path.join(webRoot, "Dockerfile"), "utf8");
    const standaloneLine = dockerfile.indexOf("COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone");
    const publicLine = dockerfile.indexOf("COPY --from=build /app/apps/web/public ./apps/web/public");
    assert.ok(standaloneLine >= 0, "standalone COPY missing");
    assert.ok(publicLine > standaloneLine, "public COPY must follow standalone COPY");
  });

  it("dockerignore still allows apps/web/public/data into the build context", () => {
    const dockerignore = readRepo(".dockerignore");
    assert.match(dockerignore, /^data$/m);
    assert.match(dockerignore, /!apps\/web\/public\/data\//);
    assert.match(dockerignore, /!apps\/web\/public\/data\/\*\*/);
  });

  it("fetchCommunitiesByRegion throws on HTTP 404 (delivery failure ≠ empty dataset)", async () => {
    clearCommunityOptionCacheForTests();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("<!DOCTYPE html><html></html>", {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })) as typeof fetch;

    try {
      await assert.rejects(
        () => fetchCommunitiesByRegion("CA", "CA-BC"),
        (error: unknown) => {
          assert.ok(error instanceof GeographyCommunityDeliveryError);
          assert.match(error.message, /City data could not be loaded/);
          assert.equal(error.status, 404);
          return true;
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
      clearCommunityOptionCacheForTests();
    }
  });

  it("fetchCommunitiesByRegion accepts empty JSON array as empty dataset (not delivery failure)", async () => {
    clearCommunityOptionCacheForTests();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      const communities = await fetchCommunitiesByRegion("CA", "CA-BC");
      assert.equal(communities.length, 0);
    } finally {
      globalThis.fetch = originalFetch;
      clearCommunityOptionCacheForTests();
    }
  });

  it("fetchCommunitiesByRegion rejects HTML success bodies", async () => {
    clearCommunityOptionCacheForTests();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("<!DOCTYPE html><html></html>", {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })) as typeof fetch;

    try {
      await assert.rejects(
        () => fetchCommunitiesByRegion("US", "US-CA"),
        GeographyCommunityDeliveryError,
      );
    } finally {
      globalThis.fetch = originalFetch;
      clearCommunityOptionCacheForTests();
    }
  });

  it("CitySelect surfaces delivery failure distinctly from empty cities", () => {
    const city = readWeb("features/geography-integrity/CitySelect.tsx");
    const contract = readWeb("features/geography-integrity/geography-cascade-contract.ts");
    const hook = readWeb("features/geography-integrity/useGeographyCommunityOptions.ts");
    assert.match(contract, /cityDeliveryFailure/);
    assert.match(hook, /deliveryFailed/);
    assert.match(city, /deliveryFailed/);
    assert.match(city, /manage\.geography\.cityDeliveryFailure/);
    assert.match(city, /manage\.geography\.noCities/);
  });

  it("Preferences Preferred Cities distinguishes delivery failure", () => {
    const preferred = readWeb("features/preferences/components/PreferredGeographyFields.tsx");
    assert.match(preferred, /fetchCommunitiesByRegion/);
    assert.match(preferred, /communitiesDeliveryFailed/);
    assert.match(preferred, /GEOGRAPHY_EMPTY_COPY\.cityDeliveryFailure/);
  });

  it("verify:staging reports webGeographyAssets", () => {
    const verify = readRepo("apps/api/src/modules/staging-reconciliation/verify.ts");
    assert.match(verify, /webGeographyAssets/);
    assert.match(verify, /CA-BC\.json/);
    assert.match(verify, /City data|geography\/communities/);
  });

  it("five observed surfaces share CitySelect or fetchCommunitiesByRegion authority", () => {
    const search = readWeb("features/global-search/components/GlobalSearchPageContent.tsx");
    const country = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    const initiative = readWeb("features/initiatives/components/InitiativeFormFields.tsx");
    const participation = readWeb(
      "features/participation-area/components/ParticipationAreaSection.tsx",
    );
    const preferred = readWeb("features/preferences/components/PreferredGeographyFields.tsx");

    assert.match(search, /CitySelect/);
    assert.match(country, /CitySelect/);
    assert.match(initiative, /CitySelect/);
    assert.match(participation, /CitySelect/);
    assert.match(preferred, /fetchCommunitiesByRegion/);
  });
});
