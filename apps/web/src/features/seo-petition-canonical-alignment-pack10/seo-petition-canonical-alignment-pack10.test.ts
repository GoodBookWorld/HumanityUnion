/**
 * SEO Pack 10 — Petition SEO Canonical Alignment (Strategy B: Initiative-owned).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildPetitionFamilyDeferredRow,
  buildStructuredDataTypeCoverage,
} from "../administration/admin-seo-console-model";
import {
  buildSeoDiagnosticsSnapshot,
  getSeoSitemapProviderById,
  getSeoSurfaceById,
} from "../administration/admin-seo-diagnostics-model";
import { buildPublicPageMetadata } from "../../lib/seo/build-public-page-metadata";
import { buildUnavailablePublicMetadata } from "../../lib/seo/public-surface-copy";
import { shouldDisallowSearchIndexing } from "../../lib/platform-indexing";
import { buildPublicPetitionSharePayload } from "../civic-share/civic-share.actions";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const apiSrc = path.resolve(dir, "../../../../api/src");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readApi(relativePath: string): string {
  return readFileSync(path.join(apiSrc, relativePath), "utf8");
}

describe("SEO Pack 10 — legacy Petition route", () => {
  it("keeps compatibility redirect to Initiative #petition", () => {
    const page = readWeb("app/petitions/public/[petitionId]/page.tsx");
    assert.match(page, /redirect\(`\/initiatives\/public\/\$\{encodeURIComponent\(initiativeId\)\}#petition`\)/);
    assert.match(page, /getPublicPetition/);
    assert.doesNotMatch(page, /JsonLdScript|buildWebPageJsonLd|buildPublicPageMetadata/);
  });

  it("is noindex and does not self-canonicalize", () => {
    const page = readWeb("app/petitions/public/[petitionId]/page.tsx");
    assert.match(page, /index:\s*false/);
    assert.match(page, /follow:\s*false/);
    assert.doesNotMatch(page, /canonicalPath/);
    assert.doesNotMatch(page, /alternates/);
    assert.match(page, /buildUnavailablePublicMetadata/);
  });

  it("preserves unavailable/noindex for missing Petitions", () => {
    const unavailable = buildUnavailablePublicMetadata("Petition not found | Humanity Union");
    assert.deepEqual(unavailable.robots, { index: false, follow: false, nocache: true });
    assert.equal("alternates" in unavailable, false);
  });
});

describe("SEO Pack 10 — sitemap and Structured Data policy", () => {
  it("excludes Petition URLs from sitemap intentionally", () => {
    assert.doesNotMatch(readWeb("lib/seo/sitemap/build-public-sitemap.ts"), /petitions\/public/);
    assert.equal(getSeoSitemapProviderById("petitions")?.state, "not_applicable");
    assert.match(
      getSeoSitemapProviderById("petitions")?.summary ?? "",
      /Initiative-owned|not enumerated/i,
    );
    assert.match(
      getSeoSitemapProviderById("petitions")?.detail ?? "",
      /Strategy B|intentionally excluded/i,
    );
  });

  it("keeps Petition Structured Data intentionally absent", () => {
    assert.equal(getSeoSurfaceById("petition")?.structuredData, "not_applicable");
    const coverage = buildStructuredDataTypeCoverage();
    assert.ok(
      coverage.some(
        (entry) =>
          entry.id === "petition-initiative-owned" && entry.status === "not_applicable",
      ),
    );
    assert.doesNotMatch(
      readWeb("app/petitions/public/[petitionId]/page.tsx"),
      /JsonLdScript/,
    );
  });
});

describe("SEO Pack 10 — Admin diagnostics and Pages", () => {
  it("treats Petition canonical/sitemap/SD as N/A without unresolved Warning", () => {
    const petition = getSeoSurfaceById("petition");
    assert.equal(petition?.canonical, "not_applicable");
    assert.equal(petition?.sitemap, "not_applicable");
    assert.equal(petition?.structuredData, "not_applicable");

    const snapshot = buildSeoDiagnosticsSnapshot({
      NEXT_PUBLIC_PLATFORM_MODE: "production",
      NEXT_PUBLIC_SITE_URL: "https://example.org",
    });
    assert.equal(
      snapshot.canonical.find((row) => row.id === "canonical-petition")?.status,
      "not_applicable",
    );
    assert.doesNotMatch(
      snapshot.canonical.find((row) => row.id === "canonical-petition")?.summary ?? "",
      /Unresolved/i,
    );

    const row = buildPetitionFamilyDeferredRow();
    assert.equal(row.canonical, "not_applicable");
    assert.match(row.note ?? "", /Initiative-owned|not independently indexed/i);
    assert.match(row.canonicalPath, /#petition/);
  });
});

describe("SEO Pack 10 — share and internal links", () => {
  it("primary share destination uses Initiative #petition", () => {
    const payload = buildPublicPetitionSharePayload({
      initiativeId: "init-1",
      petitionId: "pet-1",
      title: "Coastal Petition",
      origin: "https://example.org",
    });
    assert.equal(payload.url, "https://example.org/initiatives/public/init-1#petition");

    assert.match(
      readApi("modules/petition/petition.helpers.ts"),
      /#petition/,
    );
    assert.match(
      readApi("modules/petition/public-petition.projection.ts"),
      /#petition/,
    );
    assert.match(
      readApi("modules/initiatives/public-initiative-experience.service.ts"),
      /#petition/,
    );
  });

  it("converts RelatedLinks and stage publicHref to Initiative #petition", () => {
    assert.match(
      readWeb("features/petition/components/RelatedLinks.tsx"),
      /\/initiatives\/public\/\$\{encodeURIComponent\(initiativeId\)\}#petition/,
    );
    assert.doesNotMatch(
      readWeb("features/petition/components/RelatedLinks.tsx"),
      /\/petitions\/public\//,
    );
  });
});

describe("SEO Pack 10 — Initiative SEO and environment safety", () => {
  it("leaves Initiative metadata/canonical path unchanged", () => {
    const page = readWeb("app/initiatives/public/[initiativeId]/page.tsx");
    assert.match(page, /buildPublicPageMetadata/);
    assert.match(page, /canonicalPath/);
    assert.match(page, /\/initiatives\/public\//);
    assert.match(page, /buildWebPageJsonLd/);
  });

  it("keeps staging/development noindex protection", () => {
    const prev = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "staging";
    try {
      assert.equal(shouldDisallowSearchIndexing(), true);
      const meta = buildPublicPageMetadata({
        title: "Initiative",
        canonicalPath: "/initiatives/public/init-1",
        indexable: true,
      });
      assert.deepEqual(meta.robots, { index: false, follow: false, nocache: true });
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = prev;
    }
  });
});
