/**
 * REGION-500B.2 — region pages use real public region projections (API provider),
 * canonical ISO 3166-2 URLs, and existing catalog labels.
 *
 * Rendered checks live in `region-500b2-real-region-web.playwright.e2e.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { RegionExperiencePublicProjections } from "@hu/types";

import { apiPublicProjectionProvider } from "../public-projection-engine/providers/api-public-projection-provider.js";
import { bootstrapPublicProjectionProvider } from "../public-projection-engine/providers/bootstrap-public-projection-provider.js";
import {
  REGION_INDICATOR_LABEL_KEYS,
  REGION_PIPELINE_STAGE_LABEL_KEYS,
  localizeRegionPipeline,
  localizeRegionStatistics,
  withLocalizedCountryName,
  type CatalogTranslator,
} from "../region-experience/region-projection-labels.js";
import { resolveRegionRoute } from "../region-experience/resolve-region-route.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel: string) => readFileSync(path.join(webSrc, rel), "utf8");
const catalog = (locale: string) =>
  JSON.parse(read(`features/i18n/messages/${locale}.json`)) as Record<string, unknown>;

function translator(messages: Record<string, unknown>): CatalogTranslator {
  const lookup = (key: string) =>
    key
      .split(".")
      .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], messages);
  const t = ((key: string) => String(lookup(key))) as CatalogTranslator;
  t.has = (key: string) => typeof lookup(key) === "string";
  return t;
}

function projection(): RegionExperiencePublicProjections {
  const generatedAt = "2026-11-01T00:00:00.000Z";
  return {
    identity: {
      slug: "CA-BC",
      name: "British Columbia",
      description: "",
      countrySlug: "CA",
      countryLabel: "Canada",
      representativeVisual: { kind: "placeholder", caption: "British Columbia", initials: "BC" },
      source: "projection",
      regionCode: "CA-BC",
      countryCode: "CA",
      administrativeType: "province",
    },
    statistics: {
      scope: "region",
      scopeLabel: "British Columbia",
      generatedAt,
      source: "projection",
      indicators: Object.keys(REGION_INDICATOR_LABEL_KEYS).map((id) => ({
        id,
        label: `API ${id}`,
        value: 1,
        derived: false,
      })),
    },
    pipeline: {
      scope: "region",
      scopeLabel: "British Columbia",
      generatedAt,
      source: "projection",
      stages: (
        Object.keys(REGION_PIPELINE_STAGE_LABEL_KEYS) as Array<
          keyof typeof REGION_PIPELINE_STAGE_LABEL_KEYS
        >
      ).map((stageId) => ({ stageId, label: `API ${stageId}`, count: 1 })),
    },
    latestInitiatives: {
      scope: "region",
      scopeLabel: "British Columbia",
      source: "projection",
      generatedAt,
      initiatives: [
        {
          initiativeId: "initiative-real-1",
          title: "Real initiative",
          summary: "",
          geographicScope: "Kelowna · British Columbia · Canada",
          participationStage: "Proposal",
          publicStatus: "Proposal",
          publicRouteStatus: "active",
          publicInitiativeHref: "/initiatives/public/initiative-real-1",
          relatedPublicLinks: [],
          recencyOrder: 1,
        },
      ],
    },
    communityCatalog: {
      source: "projection",
      generatedAt,
      communities: [
        {
          slug: "16536",
          name: "Kelowna",
          description: "",
          activityArea: "",
          regionLabel: "British Columbia",
          countryLabel: "Canada",
          regionSlug: "CA-BC",
          countrySlug: "CA",
          initiativeCount: 1,
          communityHref: "/search?country=CA&region=CA-BC&community=16536",
          communityRouteStatus: "active",
        },
      ],
    },
  };
}

describe("REGION-500B.2 — canonical region routing", () => {
  it("renders exact ISO codes", () => {
    assert.deepEqual(resolveRegionRoute("CA-BC"), {
      kind: "canonical",
      regionCode: "CA-BC",
      countryCode: "CA",
    });
    assert.deepEqual(resolveRegionRoute("US-CA"), {
      kind: "canonical",
      regionCode: "US-CA",
      countryCode: "US",
    });
    assert.equal(resolveRegionRoute("CA-NU").kind, "canonical");
  });

  it("redirects other casings and unambiguous legacy names to the ISO code", () => {
    for (const input of [
      "ca-bc",
      "Ca-Bc",
      "british-columbia",
      "British%20Columbia",
      "british columbia",
    ]) {
      assert.deepEqual(resolveRegionRoute(input), { kind: "redirect", regionCode: "CA-BC" }, input);
    }
    assert.deepEqual(resolveRegionRoute("california"), { kind: "redirect", regionCode: "US-CA" });
    assert.deepEqual(resolveRegionRoute("ontario"), { kind: "redirect", regionCode: "CA-ON" });
  });

  it("does not guess ambiguous names or unknown values", () => {
    for (const input of ["punjab", "dhaka", "atlantis", "ZZ-ZZ", "CA-ZZ", "", "%E0%A4%A"]) {
      assert.deepEqual(resolveRegionRoute(input), { kind: "not-found" }, input);
    }
  });

  it("never redirects to a URL that redirects again", () => {
    for (const input of ["ca-bc", "british-columbia", "california", "ontario", "us-ca", "fr-bl"]) {
      const first = resolveRegionRoute(input);
      assert.equal(first.kind, "redirect", input);
      if (first.kind === "redirect") {
        assert.equal(resolveRegionRoute(first.regionCode).kind, "canonical", input);
      }
    }
  });

  it("keeps the page dynamic and resolves the route before loading data", () => {
    const page = read("app/region/[regionSlug]/page.tsx");
    assert.match(page, /^export const dynamic = "force-dynamic";$/m);
    assert.match(page, /export async function generateStaticParams\(\)/);
    assert.match(page, /resolveRegionRoute\(regionSlug\)/);
    assert.match(page, /redirect\(regionHref\(route\.regionCode\)\)/);
    assert.match(page, /loadRegionExperiencePageData\(route\.regionCode\)/);
  });
});

describe("REGION-500B.2 — API provider", () => {
  const realFetch = globalThis.fetch;
  const calls: string[] = [];

  function stubFetch(response: () => Response | Promise<Response>) {
    calls.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return response();
    }) as typeof fetch;
  }

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("returns the real projection from the region endpoint", async () => {
    const data = projection();
    stubFetch(() =>
      Response.json({ success: true, data, meta: {}, links: {}, message: "Region loaded." }),
    );
    const result = await apiPublicProjectionProvider.getRegionExperienceProjections("CA-BC");
    assert.deepEqual(result, data);
    assert.equal(calls.length, 1);
    assert.match(calls[0] ?? "", /\/api\/v1\/public\/countries\/CA\/regions\/CA-BC$/);
  });

  it("returns null for a 404 and for codes outside the registry", async () => {
    stubFetch(() =>
      Response.json(
        { success: false, data: null, meta: {}, links: {}, message: "Region not found." },
        { status: 404 },
      ),
    );
    assert.equal(await apiPublicProjectionProvider.getRegionExperienceProjections("CA-BC"), null);

    stubFetch(() => {
      throw new Error("must not be called");
    });
    assert.equal(await apiPublicProjectionProvider.getRegionExperienceProjections("ZZ-ZZ"), null);
    assert.equal(calls.length, 0);
  });

  it("throws on API failure instead of falling back to bootstrap data", async () => {
    stubFetch(() =>
      Response.json(
        { success: false, data: null, meta: {}, links: {}, message: "Down." },
        { status: 503 },
      ),
    );
    await assert.rejects(() => apiPublicProjectionProvider.getRegionExperienceProjections("CA-BC"));

    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    await assert.rejects(() => apiPublicProjectionProvider.getRegionExperienceProjections("CA-BC"));
  });

  it("has no bootstrap region data", () => {
    const source = read(
      "features/public-projection-engine/providers/api-public-projection-provider.ts",
    );
    assert.doesNotMatch(source, /bootstrap\/regions|BOOTSTRAP_REGION/);
  });
});

describe("REGION-500B.2 — bootstrap provider", () => {
  it("serves the British Columbia demonstration page by ISO code and by legacy slug", async () => {
    const byCode = await bootstrapPublicProjectionProvider.getRegionExperienceProjections("CA-BC");
    const bySlug =
      await bootstrapPublicProjectionProvider.getRegionExperienceProjections("british-columbia");
    assert.equal(byCode?.identity.source, "bootstrap");
    assert.equal(byCode, bySlug);
    assert.equal(
      await bootstrapPublicProjectionProvider.getRegionExperienceProjections("CA-ON"),
      null,
    );
    assert.equal(
      await bootstrapPublicProjectionProvider.getRegionExperienceProjections("ZZ-ZZ"),
      null,
    );
  });

  it("links bootstrap country navigation to /countries/{CC}", () => {
    const source = read("features/public-projection-engine/providers/bootstrap/regions.ts");
    assert.doesNotMatch(source, /`\/country\//);
    assert.match(source, /`\/countries\/\$\{/);
  });
});

describe("REGION-500B.2 — labels and localization", () => {
  it("every mapped label key exists in all bundled catalogs", () => {
    const keys = [
      ...Object.values(REGION_INDICATOR_LABEL_KEYS),
      ...Object.values(REGION_PIPELINE_STAGE_LABEL_KEYS),
      "publicGeo.region.identity.scopeLabel",
      "publicGeo.region.initiatives.emptyMessage",
    ];
    for (const locale of ["en", "uk", "ar", "zh-Hant"]) {
      const t = translator(catalog(locale));
      for (const key of keys) {
        assert.ok(t.has(key), `${locale} is missing ${key}`);
      }
    }
  });

  it("replaces API labels of real projections with catalog labels", () => {
    const t = translator(catalog("uk"));
    const statistics = localizeRegionStatistics(projection().statistics, t);
    const pipeline = localizeRegionPipeline(projection().pipeline, t);
    assert.ok(statistics.indicators.every((indicator) => !indicator.label.startsWith("API ")));
    assert.ok(pipeline.stages.every((stage) => !stage.label.startsWith("API ")));
    assert.equal(
      statistics.indicators.find((indicator) => indicator.id === "region-initiatives")?.label,
      t("publicStatistics.metrics.initiatives.label"),
    );
    assert.equal(
      pipeline.stages.find((stage) => stage.stageId === "collaborative-analysis")?.label,
      t("search.entityTypes.analysis"),
    );
  });

  it("leaves bootstrap labels unchanged", () => {
    const t = translator(catalog("uk"));
    const bootstrap = { ...projection().statistics, source: "bootstrap" as const };
    assert.equal(localizeRegionStatistics(bootstrap, t), bootstrap);
  });

  it("uses the localized country name in identity, cards and communities", () => {
    const localized = withLocalizedCountryName(projection(), "Канада");
    assert.equal(localized.identity.countryLabel, "Канада");
    assert.equal(
      localized.latestInitiatives.initiatives[0]?.geographicScope,
      "Kelowna · British Columbia · Канада",
    );
    assert.equal(localized.communityCatalog.communities[0]?.countryLabel, "Канада");
    assert.equal(withLocalizedCountryName(projection(), "Canada").identity.countryLabel, "Canada");
  });
});

describe("REGION-500B.2 — demonstration content stays bootstrap-only", () => {
  it("shows the British Columbia map only for bootstrap data", () => {
    const page = read("features/region-experience/components/RegionExperiencePage.tsx");
    assert.match(page, /identity\.source === "bootstrap" \? \(\s*<RegionalInteractiveMapSection/);
  });

  it("uses existing message keys and hides empty or demonstration-only copy", () => {
    const identity = read("features/region-experience/components/RegionIdentitySection.tsx");
    const latest = read(
      "features/region-experience/components/LatestRegionalInitiativesSection.tsx",
    );
    const discovery = read("features/region-experience/components/CommunityDiscoveryEvidence.tsx");
    assert.match(identity, /region\.identity\.scopeLabel/);
    assert.match(identity, /identity\.description \? \(/);
    assert.match(latest, /t\("emptyMessage"\)/);
    assert.match(
      latest,
      /projection\.source === "bootstrap" \? t\("visitorConclusion"\) : undefined/,
    );
    assert.match(discovery, /catalog\.source === "bootstrap" \?/);
    assert.match(discovery, /community\.description \? \(/);
    assert.match(discovery, /community\.activityArea \? \(/);
  });
});
