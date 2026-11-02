/**
 * REGION-500A — /region/[regionSlug] must render per request.
 *
 * The root layout reads the language cookie. With the API projection provider,
 * generateStaticParams returns no slugs, so without an explicit dynamic export
 * Next registers the route as static and every request fails with
 * "Page changed from static to dynamic at runtime".
 *
 * Set REGION500A_NEXT_DIR to a built `.next` directory to also check the
 * prerender manifest, e.g.
 *
 *   PUBLIC_PROJECTION_PROVIDER=api pnpm --filter @hu/web build
 *   REGION500A_NEXT_DIR=apps/web/.next node --require ./scripts/register-css-cjs-stub.cjs \
 *     --import tsx --test src/features/region-500a-dynamic-route/region-500a-dynamic-route.test.ts
 *
 * Rendered checks live in `region-500a-dynamic-route.playwright.e2e.ts`.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const regionPage = readFileSync(path.join(webSrc, "app/region/[regionSlug]/page.tsx"), "utf8");
const rootLayout = readFileSync(path.join(webSrc, "app/layout.tsx"), "utf8");

describe("REGION-500A — region route contract", () => {
  it("forces dynamic rendering", () => {
    assert.match(regionPage, /^export const dynamic = "force-dynamic";$/m);
  });

  it("keeps generateStaticParams and the existing data resolution", () => {
    assert.match(regionPage, /export async function generateStaticParams\(\)/);
    assert.match(regionPage, /getKnownRegionSlugs\(\)/);
    assert.match(regionPage, /loadRegionExperiencePageData\(regionSlug\)/);
    assert.match(regionPage, /notFound\(\)/);
    assert.match(regionPage, /<RegionExperiencePage projections=\{pageData\.projections\} \/>/);
  });

  it("does not opt out of request-time rendering in any other way", () => {
    assert.doesNotMatch(regionPage, /export const (revalidate|dynamicParams|fetchCache)\b/);
  });

  it("root layout still resolves the document language per request", () => {
    assert.match(rootLayout, /await resolveDocumentHtmlLocale\(\)/);
  });
});

describe("REGION-500A — build output", () => {
  const nextDir = process.env.REGION500A_NEXT_DIR?.trim();
  const manifestPath = nextDir ? path.resolve(nextDir, "prerender-manifest.json") : "";

  it(
    "does not register /region as a static route",
    { skip: !nextDir ? "set REGION500A_NEXT_DIR" : false },
    () => {
      assert.ok(existsSync(manifestPath), `missing ${manifestPath}`);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        routes: Record<string, unknown>;
        dynamicRoutes: Record<string, unknown>;
      };
      assert.equal(manifest.dynamicRoutes["/region/[regionSlug]"], undefined);
      assert.deepEqual(
        Object.keys(manifest.routes).filter((route) => route.startsWith("/region/")),
        [],
      );
    },
  );
});
