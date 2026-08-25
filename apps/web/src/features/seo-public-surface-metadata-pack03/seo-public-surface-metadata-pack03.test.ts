/**
 * SEO Pack 03 — Public Surface Metadata Coverage (Country, Profile, Petition).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getCountryByCode } from "@hu/geography";

import { shouldDisallowSearchIndexing } from "../../lib/platform-indexing";
import { buildPublicPageMetadata } from "../../lib/seo/build-public-page-metadata";
import { formatPublicPageTitle } from "../../lib/seo/normalize-seo-text";
import {
  buildCountryPageDescription,
  buildParticipantProfilePageDescription,
  buildPetitionPageDescription,
  buildUnavailablePublicMetadata,
} from "../../lib/seo/public-surface-copy";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("SEO Pack 03 — Country metadata", () => {
  it("builds unique Country titles with a single Humanity Union suffix", () => {
    const country = getCountryByCode("CA");
    assert.ok(country);
    const meta = buildPublicPageMetadata({
      title: country.name,
      description: buildCountryPageDescription(country.name),
      canonicalPath: `/countries/${country.code}`,
      openGraphType: "website",
    });
    assert.equal(meta.title, `${country.name} | Humanity Union`);
    assert.doesNotMatch(String(meta.title), /Humanity Union \| Humanity Union/);
  });

  it("uses /countries/{countryCode} as canonical and never /country/{slug}", () => {
    const meta = buildPublicPageMetadata({
      title: "Germany",
      description: buildCountryPageDescription("Germany"),
      canonicalPath: "/countries/DE",
    });
    assert.equal(meta.alternates?.canonical, "/countries/DE");
    assert.doesNotMatch(String(meta.alternates?.canonical), /^\/country\//);

    const page = readWeb("app/countries/[countryCode]/page.tsx");
    assert.match(page, /buildPublicPageMetadata/);
    assert.match(page, /\/countries\/\$\{encodeURIComponent\(countryCode\)\}/);
    assert.doesNotMatch(page, /canonicalPath:\s*`\/country\//);
  });

  it("uses a deterministic Country description from known name context", () => {
    assert.equal(
      buildCountryPageDescription("Canada"),
      "Explore civic activity, Participants, and Initiatives in Canada on Humanity Union.",
    );
  });

  it("invalid Country metadata is noindex without a fabricated entity canonical", () => {
    const unavailable = buildUnavailablePublicMetadata("Country not found | Humanity Union");
    assert.equal(unavailable.title, "Country not found | Humanity Union");
    assert.deepEqual(unavailable.robots, { index: false, follow: false, nocache: true });
    assert.equal("alternates" in unavailable, false);

    const page = readWeb("app/countries/[countryCode]/page.tsx");
    assert.match(page, /buildUnavailablePublicMetadata/);
  });

  it("legacy /country/{slug} is not an indexable canonical surface", () => {
    const legacy = readWeb("app/country/[countrySlug]/page.tsx");
    assert.match(legacy, /buildUnavailablePublicMetadata/);
    assert.match(legacy, /redirect\(`\/countries\/\$\{countryCode\}`\)/);
    assert.doesNotMatch(legacy, /buildPublicPageMetadata/);
  });

  it("Country metadata remains noindex when platform indexing is disallowed", () => {
    const prev = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "staging";
    try {
      assert.equal(shouldDisallowSearchIndexing(), true);
      const meta = buildPublicPageMetadata({
        title: "Canada",
        description: buildCountryPageDescription("Canada"),
        canonicalPath: "/countries/CA",
        indexable: true,
      });
      assert.deepEqual(meta.robots, { index: false, follow: false, nocache: true });
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = prev;
    }
  });
});

describe("SEO Pack 03 — Participant Profile metadata", () => {
  it("builds preferred Participant title without duplicate brand suffix", () => {
    const title = formatPublicPageTitle("Ada Lovelace — Participant", "Humanity Union");
    assert.equal(title, "Ada Lovelace — Participant | Humanity Union");

    const meta = buildPublicPageMetadata({
      title: "Ada Lovelace — Participant",
      description: buildParticipantProfilePageDescription({
        publicName: "ada-lovelace",
        displayName: "Ada Lovelace",
        biography: "Mathematician and writer.",
      }),
      canonicalPath: "/member/ada-lovelace",
      openGraphType: "profile",
      socialTitle: "Ada Lovelace",
    });
    assert.equal(meta.title, "Ada Lovelace — Participant | Humanity Union");
    assert.equal(meta.alternates?.canonical, "/member/ada-lovelace");
    assert.equal(meta.openGraph?.title, "Ada Lovelace");
    assert.equal((meta.openGraph as { type?: string } | undefined)?.type, "profile");
  });

  it("builds description only from safe public fields", () => {
    assert.equal(
      buildParticipantProfilePageDescription({
        publicName: "ada",
        displayName: "Ada",
        biography: "Public biography text.",
        organization: "Analytical Engine",
      }),
      "Public biography text.",
    );
    assert.equal(
      buildParticipantProfilePageDescription({
        publicName: "ada",
        displayName: "Ada",
        organization: "Analytical Engine",
      }),
      "Ada is a Participant with Analytical Engine on Humanity Union.",
    );
    assert.equal(
      buildParticipantProfilePageDescription({ publicName: "ada", displayName: "Ada" }),
      "Ada is a Participant on Humanity Union.",
    );
  });

  it("route metadata uses public display name and shared builder", () => {
    const page = readWeb("app/member/[uniqueName]/page.tsx");
    const start = page.indexOf("export async function generateMetadata");
    const end = page.indexOf("\n}\n\n/**", start);
    const metadataFn = page.slice(start, end > start ? end + 2 : page.length);
    assert.match(metadataFn, /buildPublicPageMetadata/);
    assert.match(metadataFn, /displayName\?\.trim\(\) \|\| profile\.publicName/);
    assert.match(metadataFn, /\/member\/\$\{encodeURIComponent\(profile\.publicName\)\}/);
    assert.match(metadataFn, /openGraphType:\s*"profile"/);
    assert.match(
      metadataFn,
      /buildParticipantProfilePageDescription\(\{[\s\S]*?publicName:[\s\S]*?displayName:[\s\S]*?biography:[\s\S]*?organization:/m,
    );
    assert.doesNotMatch(metadataFn, /email|messagingAvailability|profileId|statistics/);
  });

  it("non-public / missing profiles use noindex unavailable metadata", () => {
    const page = readWeb("app/member/[uniqueName]/page.tsx");
    assert.match(page, /status === "restricted"/);
    assert.match(page, /buildUnavailablePublicMetadata/);
    assert.match(page, /Participant not found/);
  });

  it("does not leak private identity fields into surface copy helpers", () => {
    const copy = readWeb("lib/seo/public-surface-copy.ts");
    assert.doesNotMatch(copy, /email|messagingAvailability|profileId|memberId|password/i);
  });

  it("staging protection cannot be overridden for profiles", () => {
    const prev = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "development";
    try {
      const meta = buildPublicPageMetadata({
        title: "Ada — Participant",
        canonicalPath: "/member/ada",
        openGraphType: "profile",
        indexable: true,
      });
      assert.deepEqual(meta.robots, { index: false, follow: false, nocache: true });
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = prev;
    }
  });
});

describe("SEO Pack 03 — Petition metadata", () => {
  it("keeps Petition description helper for public copy", () => {
    const description = buildPetitionPageDescription({
      title: "Protect Coastal Waters",
      purpose: "Endorse coastal protection for communities.",
    });
    assert.equal(description, "Endorse coastal protection for communities.");
  });

  it("legacy public Petition route is noindex redirect without self-canonical", () => {
    const page = readWeb("app/petitions/public/[petitionId]/page.tsx");
    assert.match(page, /generateMetadata/);
    assert.match(page, /getPublicPetition/);
    assert.match(page, /buildUnavailablePublicMetadata/);
    assert.match(page, /redirect\(`\/initiatives\/public\//);
    assert.match(page, /#petition/);
    assert.match(page, /index:\s*false/);
    assert.doesNotMatch(page, /buildPublicPageMetadata/);
    assert.doesNotMatch(page, /canonicalPath:\s*`\/petitions\/public/);
    assert.doesNotMatch(page, /signatures|signer|participantId|moderation/i);
  });

  it("falls back to a deterministic Petition description", () => {
    assert.equal(
      buildPetitionPageDescription({ title: "Clean Rivers" }),
      "Clean Rivers — a public Petition on Humanity Union.",
    );
  });

  it("staging protection remains authoritative for Petitions", () => {
    const prev = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "staging";
    try {
      const meta = buildPublicPageMetadata({
        title: "Petition",
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

describe("SEO Pack 03 — sitemap alignment", () => {
  it("Country metadata canonical matches Pack 02 sitemap Country paths", () => {
    const countriesProvider = readWeb("lib/seo/sitemap/providers/countries.ts");
    assert.match(countriesProvider, /\/countries\/\$\{encodeURIComponent\(country\.code\)\}/);
    const page = readWeb("app/countries/[countryCode]/page.tsx");
    assert.match(page, /\/countries\/\$\{encodeURIComponent\(countryCode\)\}/);
  });

  it("does not add unsafe Petition sitemap enumeration in this Pack", () => {
    const builder = readWeb("lib/seo/sitemap/build-public-sitemap.ts");
    assert.doesNotMatch(builder, /petitions\/public/);
  });
});
