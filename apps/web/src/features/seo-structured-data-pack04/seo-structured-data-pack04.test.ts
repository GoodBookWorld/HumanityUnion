/**
 * SEO Pack 04 — Structured Data Foundation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  absoluteStructuredDataUrl,
  buildBlogPostingJsonLd,
  buildBreadcrumbListJsonLd,
  buildOrganizationJsonLd,
  buildProfilePageJsonLd,
  buildRootStructuredData,
  buildWebPageJsonLd,
  buildWebSiteJsonLd,
  HUMANITY_UNION_LOGO_PATH,
  serializeJsonLd,
} from "../../lib/seo/structured-data";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("SEO Pack 04 — WebSite and Organization", () => {
  it("builds WebSite and Organization with absolute URLs", () => {
    const origin = "https://example.org";
    const organization = buildOrganizationJsonLd(origin);
    const website = buildWebSiteJsonLd(origin);

    assert.equal(organization?.["@type"], "Organization");
    assert.equal(organization?.name, "Humanity Union");
    assert.equal(organization?.url, origin);
    assert.equal(organization?.logo, `${origin}${HUMANITY_UNION_LOGO_PATH}`);

    assert.equal(website?.["@type"], "WebSite");
    assert.equal(website?.name, "Humanity Union");
    assert.equal(website?.url, origin);
    assert.deepEqual(website?.publisher, { "@id": `${origin}/#organization` });
    assert.equal(website?.potentialAction, undefined);
  });

  it("omits root structured data when site origin is missing", () => {
    assert.equal(buildRootStructuredData(""), null);
    assert.equal(buildOrganizationJsonLd(""), null);
    assert.equal(buildWebSiteJsonLd(""), null);
    assert.equal(absoluteStructuredDataUrl("/blog", ""), null);
  });
});

describe("SEO Pack 04 — WebPage, Breadcrumbs, Blog, Profile", () => {
  it("builds Country WebPage with Home → Country breadcrumbs (no fake /countries index)", () => {
    const nodes = buildWebPageJsonLd(
      {
        name: "Canada",
        description: "Explore civic activity in Canada on Humanity Union.",
        canonicalPath: "/countries/CA",
        breadcrumbs: [
          { name: "Home", path: "/" },
          { name: "Canada", path: "/countries/CA" },
        ],
      },
      "https://example.org",
    );

    assert.ok(nodes);
    assert.equal(nodes[0]?.["@type"], "WebPage");
    assert.equal(nodes[0]?.url, "https://example.org/countries/CA");
    assert.equal(nodes[1]?.["@type"], "BreadcrumbList");
    const elements = nodes[1]?.itemListElement as Array<{ name: string; item: string }>;
    assert.equal(elements.length, 2);
    assert.equal(elements[0]?.name, "Home");
    assert.equal(elements[1]?.name, "Canada");
    assert.ok(elements.every((entry) => entry.name !== "Countries"));
  });

  it("builds Initiative WebPage with real Initiatives parent route", () => {
    const nodes = buildWebPageJsonLd(
      {
        name: "Open Seas",
        description: "A public initiative.",
        canonicalPath: "/initiatives/public/init_1",
        imageUrl: "https://cdn.example/cover.jpg",
        breadcrumbs: [
          { name: "Home", path: "/" },
          { name: "Initiatives", path: "/initiatives" },
          { name: "Open Seas", path: "/initiatives/public/init_1" },
        ],
      },
      "https://example.org",
    );
    assert.equal(nodes?.[0]?.["@type"], "WebPage");
    assert.equal(nodes?.[0]?.image, "https://cdn.example/cover.jpg");
    assert.equal(nodes?.[1]?.["@type"], "BreadcrumbList");
  });

  it("builds BlogPosting with dates, image, public author, and publisher", () => {
    const nodes = buildBlogPostingJsonLd(
      {
        headline: "Solidarity Notes",
        description: "An excerpt.",
        canonicalPath: "/blog/solidarity-notes",
        imageUrl: "/media/cover.jpg",
        datePublished: "2024-01-01T00:00:00.000Z",
        dateModified: "2024-02-01T00:00:00.000Z",
        author: {
          name: "Ada Lovelace",
          profilePathOrUrl: "/member/ada-lovelace",
          avatarUrl: "/brand/humanity-default-avatar.svg",
        },
      },
      "https://example.org",
    );

    assert.ok(nodes);
    const posting = nodes[0];
    assert.equal(posting?.["@type"], "BlogPosting");
    assert.equal(posting?.headline, "Solidarity Notes");
    assert.equal(posting?.datePublished, "2024-01-01T00:00:00.000Z");
    assert.equal(posting?.dateModified, "2024-02-01T00:00:00.000Z");
    assert.equal(posting?.image, "https://example.org/media/cover.jpg");
    const author = posting?.author as { "@type": string; name: string; url?: string };
    assert.equal(author["@type"], "Person");
    assert.equal(author.name, "Ada Lovelace");
    assert.equal(author.url, "https://example.org/member/ada-lovelace");
    assert.doesNotMatch(JSON.stringify(posting), /publicUserId|authorParticipantId|email/);
    assert.equal((posting?.publisher as { name?: string })?.name, "Humanity Union");
    assert.equal(nodes[1]?.["@type"], "BreadcrumbList");
  });

  it("builds ProfilePage + Person from public profile fields only", () => {
    const nodes = buildProfilePageJsonLd(
      {
        name: "Ada Lovelace",
        description: "Mathematician and writer.",
        canonicalPath: "/member/ada-lovelace",
        imageUrl: "https://cdn.example/ada.jpg",
        organization: "Analytical Engine",
        sameAs: ["https://linkedin.com/in/ada", "not-a-url", "https://x.com/ada"],
      },
      "https://example.org",
    );

    assert.ok(nodes);
    assert.equal(nodes[0]?.["@type"], "ProfilePage");
    const person = nodes[0]?.mainEntity as Record<string, unknown>;
    assert.equal(person["@type"], "Person");
    assert.equal(person.name, "Ada Lovelace");
    assert.equal(person.url, "https://example.org/member/ada-lovelace");
    assert.equal(person.image, "https://cdn.example/ada.jpg");
    assert.equal((person.affiliation as { name?: string })?.name, "Analytical Engine");
    assert.deepEqual(person.sameAs, ["https://linkedin.com/in/ada", "https://x.com/ada"]);
    assert.doesNotMatch(JSON.stringify(nodes), /messagingAvailability|profileId|email|statistics/);
  });

  it("omits page structured data when origin is missing", () => {
    assert.equal(
      buildWebPageJsonLd({ name: "Canada", canonicalPath: "/countries/CA" }, ""),
      null,
    );
    assert.equal(
      buildBlogPostingJsonLd(
        {
          headline: "Post",
          canonicalPath: "/blog/post",
          author: { name: "Ada" },
        },
        "",
      ),
      null,
    );
    assert.equal(
      buildBreadcrumbListJsonLd(
        [
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
        ],
        "",
      ),
      null,
    );
  });
});

describe("SEO Pack 04 — serialization and route wiring", () => {
  it("escapes angle brackets for XSS-safe JSON-LD serialization", () => {
    const serialized = serializeJsonLd({
      "@type": "WebPage",
      name: "Hello </script><script>alert(1)</script>",
    });
    assert.match(serialized, /\\u003c/);
    assert.doesNotMatch(serialized, /<\/script>/);
  });

  it("wires root WebSite/Organization and entity JsonLdScript without Petition schema", () => {
    const layout = readWeb("app/layout.tsx");
    assert.match(layout, /buildRootStructuredData/);
    assert.match(layout, /JsonLdScript/);

    assert.match(readWeb("app/countries/[countryCode]/page.tsx"), /buildWebPageJsonLd/);
    assert.match(readWeb("app/blog/[slug]/page.tsx"), /buildBlogPostingJsonLd/);
    assert.match(readWeb("app/member/[uniqueName]/page.tsx"), /buildProfilePageJsonLd/);
    assert.match(readWeb("app/initiatives/public/[initiativeId]/page.tsx"), /buildWebPageJsonLd/);

    const petition = readWeb("app/petitions/public/[petitionId]/page.tsx");
    assert.doesNotMatch(petition, /JsonLdScript|schema\.org|BlogPosting|ProfilePage/);
  });

  it("does not add Admin JSON-LD editing or schema override stores", () => {
    const structured = readWeb("lib/seo/structured-data/index.ts");
    assert.doesNotMatch(structured, /SeoSettings|json editor|schema override/i);
  });

  it("documents Petition structured-data absence due to Initiative-owned policy", () => {
    const petition = readWeb("app/petitions/public/[petitionId]/page.tsx");
    assert.match(petition, /redirect\(`\/initiatives\/public\//);
    assert.match(petition, /#petition/);
    assert.doesNotMatch(petition, /JsonLdScript|buildWebPageJsonLd/);
  });
});
