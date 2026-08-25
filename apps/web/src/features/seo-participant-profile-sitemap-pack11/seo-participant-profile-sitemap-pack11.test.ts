/**
 * SEO Pack 11 — Public Participant Profile Sitemap Enumeration.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildParticipantProfileSeoInventoryRow,
  isSeoPageOverrideEditableFamily,
} from "../administration/admin-seo-console-model";
import {
  buildSeoDiagnosticsSnapshot,
  getSeoSitemapProviderById,
  getSeoSurfaceById,
} from "../administration/admin-seo-diagnostics-model";
import { buildPublicPageMetadata } from "../../lib/seo/build-public-page-metadata";
import { buildUnavailablePublicMetadata } from "../../lib/seo/public-surface-copy";
import { shouldDisallowSearchIndexing } from "../../lib/platform-indexing";
import { buildProfilePageJsonLd } from "../../lib/seo/structured-data";
import { dedupeSitemapPathEntries } from "../../lib/seo/sitemap/dedupe-sitemap-entries";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const apiSrc = path.resolve(dir, "../../../../api/src");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readApi(relativePath: string): string {
  return readFileSync(path.join(apiSrc, relativePath), "utf8");
}

describe("SEO Pack 11 — public enumeration API privacy", () => {
  it("queries only active public profiles with minimal projection", () => {
    const repository = readApi("modules/member-profile/member-profile.repository.ts");
    const start = repository.indexOf("listPublicSitemapMemberProfileDocuments");
    assert.ok(start >= 0);
    const fnSlice = repository.slice(start, start + 900);
    assert.match(fnSlice, /profileVisibility:\s*"public"/);
    assert.match(fnSlice, /status:\s*"active"/);
    assert.match(fnSlice, /publicName:\s*1/);
    assert.match(fnSlice, /updatedAt:\s*1/);
    assert.doesNotMatch(fnSlice, /email|messagingPolicy|skillsVisibility|biography/);

    const service = readApi("modules/sitemap/public-sitemap.service.ts");
    assert.match(service, /toPublicSitemapParticipantProfileEntry/);
    assert.match(service, /profileVisibility !== "public"/);
  });

  it("exposes a dedicated public sitemap route", () => {
    const routes = readApi("modules/sitemap/public-sitemap.routes.ts");
    assert.match(routes, /\/participant-profiles/);
    assert.match(routes, /listPublicSitemapParticipantProfiles/);
    assert.doesNotMatch(routes, /email|messagingPolicy|admin/);
  });
});

describe("SEO Pack 11 — sitemap provider", () => {
  it("emits /member/{uniqueName} and isolates failures", () => {
    const provider = readWeb("lib/seo/sitemap/providers/participant-profiles.ts");
    assert.match(provider, /\/api\/v1\/public\/sitemap\/participant-profiles/);
    assert.match(provider, /\/member\/\$\{encodeURIComponent\(publicName\)\}/);

    const builder = readWeb("lib/seo/sitemap/build-public-sitemap.ts");
    assert.match(builder, /participant-profiles/);
    assert.match(builder, /collectProviderEntries\("participant-profiles"/);
    assert.doesNotMatch(builder, /\/petitions\//);
  });

  it("dedupes duplicate profile paths", () => {
    const deduped = dedupeSitemapPathEntries([
      { path: "/member/ada", lastModified: "2024-01-01" },
      { path: "member/ada", lastModified: "2024-02-01" },
      { path: "/member/bob" },
    ]);
    assert.equal(deduped.length, 2);
    assert.equal(deduped[0]?.path, "/member/ada");
    assert.equal(deduped[0]?.lastModified, "2024-01-01");
  });
});

describe("SEO Pack 11 — Admin diagnostics and Pages", () => {
  it("marks Profile sitemap covered/Healthy", () => {
    assert.equal(getSeoSurfaceById("participant-profile")?.sitemap, "covered");
    assert.equal(getSeoSitemapProviderById("participant-profiles")?.state, "covered");

    const snapshot = buildSeoDiagnosticsSnapshot({
      NEXT_PUBLIC_PLATFORM_MODE: "production",
      NEXT_PUBLIC_SITE_URL: "https://example.org",
    });
    assert.equal(
      snapshot.sitemap.find((row) => row.id === "sitemap-participant-profiles")?.status,
      "healthy",
    );
    assert.equal(
      snapshot.metadata.find((row) => row.id === "metadata-participant-profile")?.status,
      "healthy",
    );
    assert.equal(
      snapshot.structuredData.find((row) => row.id === "structured-data-participant-profile")
        ?.status,
      "healthy",
    );
  });

  it("enumerates Profiles in Pages inventory without enabling Edit SEO", () => {
    const row = buildParticipantProfileSeoInventoryRow({ publicName: "ada-lovelace" });
    assert.equal(row.canonicalPath, "/member/ada-lovelace");
    assert.equal(row.sitemap, "healthy");
    assert.equal(row.seoMode, "automatic");
    assert.equal(isSeoPageOverrideEditableFamily("participant-profile"), false);

    const inventory = readWeb("features/administration/admin-seo-page-inventory.ts");
    assert.match(inventory, /loadParticipantProfileInventoryRows|listPublicSitemapParticipantProfiles/);
  });
});

describe("SEO Pack 11 — metadata and Structured Data alignment", () => {
  it("keeps Profile canonical and ProfilePage url on /member/{uniqueName}", () => {
    const meta = buildPublicPageMetadata({
      title: "Ada — Participant",
      description: "Ada is a Participant on Humanity Union.",
      canonicalPath: "/member/ada-lovelace",
      openGraphType: "profile",
    });
    assert.equal(meta.alternates?.canonical, "/member/ada-lovelace");

    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org";
    try {
      const nodes = buildProfilePageJsonLd({
        name: "Ada Lovelace",
        description: "Ada is a Participant on Humanity Union.",
        canonicalPath: "/member/ada-lovelace",
      });
      assert.ok(nodes);
      const profilePage = nodes?.find((node) => node["@type"] === "ProfilePage");
      assert.equal(profilePage?.url, "https://example.org/member/ada-lovelace");
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prev;
    }

    const page = readWeb("app/member/[uniqueName]/page.tsx");
    assert.match(page, /canonicalPath:\s*`\/member\/\$\{encodeURIComponent\(profile\.publicName\)\}`/);
    assert.match(page, /buildUnavailablePublicMetadata/);
  });

  it("keeps restricted/missing profiles noindex and staging protection", () => {
    const unavailable = buildUnavailablePublicMetadata("Public Profile | Humanity Union");
    assert.deepEqual(unavailable.robots, { index: false, follow: false, nocache: true });

    const prev = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "staging";
    try {
      assert.equal(shouldDisallowSearchIndexing(), true);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = prev;
    }
  });

  it("keeps Petition excluded from sitemap", () => {
    assert.doesNotMatch(readWeb("lib/seo/sitemap/build-public-sitemap.ts"), /\/petitions\//);
    assert.equal(getSeoSurfaceById("petition")?.sitemap, "not_applicable");
  });
});
