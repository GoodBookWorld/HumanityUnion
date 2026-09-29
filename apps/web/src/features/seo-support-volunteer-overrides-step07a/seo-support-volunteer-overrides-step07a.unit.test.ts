/**
 * Step 07A — Admin SEO overrides for Support and Volunteer.
 * Volunteer canonical override merges only on the locale-free English SEO document.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Metadata } from "next";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildSeoPageOverrideId,
  isPublicSeoLocalePath,
  resolvePublicSeoLocaleDocument,
  type SeoPageOverrideFields,
} from "@hu/types";

import {
  buildCivicArchiveSeoInventoryRow,
  buildCountrySeoInventoryRows,
  buildInitiativeSeoInventoryRow,
  buildKnowledgeSeoInventoryRow,
  buildSupportSeoInventoryRow,
  buildVolunteerSeoInventoryRow,
  isSeoPageOverrideEditableFamily,
} from "../administration/admin-seo-console-model";
import { loadBundledUiMessagePack } from "../i18n/load-ui-messages";
import { shouldDisallowSearchIndexing } from "../../lib/platform-indexing";
import {
  applyPageSeoOverrideToMetadataInput,
  mergePageSeoOverrideIntoAutomatic,
  selectCanonicalEnglishSeoOverrideForDocument,
} from "../../lib/seo/apply-page-seo-override";
import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";
import { normalizeMetaDescription } from "../../lib/seo/normalize-seo-text";
import { expandPublicSitemapEntriesForSeoLocales } from "../../lib/seo/sitemap/expand-public-sitemap-for-seo-locales";
import { listStaticPublicSitemapEntries } from "../../lib/seo/sitemap/providers/static-public-pages";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const repoRoot = path.resolve(webSrc, "../../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

type Nested = Record<string, unknown>;

function nest(messages: Nested, key: string): Nested {
  const value = messages[key];
  assert.ok(value && typeof value === "object", `missing catalog namespace ${key}`);
  return value as Nested;
}

function str(obj: Nested, key: string): string {
  const value = obj[key];
  assert.equal(typeof value, "string", `expected string ${key}`);
  return value as string;
}

function seoCatalog(locales: readonly string[]) {
  return locales.map((locale, index) => ({
    languageId: `lang-${locale}-${index}`,
    locale,
    textDirection: "ltr" as const,
    aliases: [] as string[],
    enabled: true,
    seoIndexingEnabled: true,
  }));
}

const CATALOG = seoCatalog(["en", "ar", "uk", "zz-FUTURE"]);

const ENGLISH_VOLUNTEER_OVERRIDE: SeoPageOverrideFields = {
  seoTitle: "Canonical Volunteer Title",
  seoDescription: "Canonical English volunteer description.",
  socialTitle: "Volunteer socially",
  socialDescription: "Canonical English volunteer social description.",
};

function languagesOf(meta: Metadata): Record<string, string> | null {
  const languages = meta.alternates?.languages;
  if (!languages || typeof languages !== "object") {
    return null;
  }
  return languages as Record<string, string>;
}

async function volunteerCopy(locale: string): Promise<{ title: string; description: string }> {
  const pack = await loadBundledUiMessagePack(locale);
  assert.ok(pack, `bundled volunteerPublic catalog for ${locale}`);
  const volunteer = nest(pack.messages as Nested, "volunteerPublic");
  return { title: str(volunteer, "title"), description: str(volunteer, "lead") };
}

async function renderVolunteer(input: {
  localeSegment: string | null;
  pathname: string;
  automaticTitle: string;
  automaticDescription: string;
  override: SeoPageOverrideFields | null;
}) {
  const document = resolvePublicSeoLocaleDocument({
    urlLocaleSegment: input.localeSegment,
    catalog: CATALOG,
  });
  const selected = selectCanonicalEnglishSeoOverrideForDocument(
    document.isLocalePrefixedDocument,
    input.override,
  );
  const meta = await buildPublicPageMetadataForRequest({
    ...applyPageSeoOverrideToMetadataInput(
      {
        title: input.automaticTitle,
        description: input.automaticDescription,
        canonicalPath: "/volunteer",
        openGraphSiteName: "Humanity Union",
      },
      selected,
    ),
    localeFreeCanonicalPath: "/volunteer",
    catalog: CATALOG,
    pathname: input.pathname,
    urlLocaleSegment: input.localeSegment,
  });
  return { document, selected, meta };
}

describe("Step 07A — Admin SEO inventory", () => {
  it("exposes Support and Volunteer through the existing Edit SEO workflow", () => {
    const support = buildSupportSeoInventoryRow();
    const volunteer = buildVolunteerSeoInventoryRow({ seoMode: "customized" });
    assert.equal(support.family, "support");
    assert.equal(support.title, "Support");
    assert.equal(support.descriptor.entityKey, "support");
    assert.equal(support.canonicalPath, "/support");
    assert.equal(support.publicHref, "/support");
    assert.equal(support.seoMode, "automatic");
    assert.equal(buildSeoPageOverrideId("support", "support"), "support:support");

    assert.equal(volunteer.family, "volunteer");
    assert.equal(volunteer.title, "Volunteer");
    assert.equal(volunteer.descriptor.entityKey, "volunteer");
    assert.equal(volunteer.canonicalPath, "/volunteer");
    assert.equal(volunteer.seoMode, "customized");
    assert.equal(buildSeoPageOverrideId("volunteer", "volunteer"), "volunteer:volunteer");

    assert.equal(isSeoPageOverrideEditableFamily("support"), true);
    assert.equal(isSeoPageOverrideEditableFamily("volunteer"), true);
    assert.equal(isSeoPageOverrideEditableFamily("country"), true);
    assert.equal(isSeoPageOverrideEditableFamily("initiative"), true);
    assert.equal(isSeoPageOverrideEditableFamily("knowledge"), true);
    assert.equal(isSeoPageOverrideEditableFamily("civic-archive"), true);
    assert.equal(isSeoPageOverrideEditableFamily("blog"), false);

    const pages = readWeb("features/administration/components/AdminSeoPagesView.tsx");
    const inventory = readWeb("features/administration/admin-seo-page-inventory.ts");
    const editor = readWeb("features/administration/components/AdminSeoPageEditorModal.tsx");
    assert.match(inventory, /buildSupportSeoInventoryRow/);
    assert.match(inventory, /buildVolunteerSeoInventoryRow/);
    assert.match(pages, /Edit SEO/);
    assert.match(pages, /value: "support"/);
    assert.match(pages, /value: "volunteer"/);
    assert.match(editor, /seoTitle/);
    assert.match(editor, /seoDescription/);
    assert.match(editor, /socialTitle/);
    assert.match(editor, /socialDescription/);
    assert.match(editor, /socialImageUrl/);
    assert.doesNotMatch(pages, /SupportSeoEditor|VolunteerSeoEditor/);
  });
});

describe("Step 07A — Support metadata override", () => {
  it("keeps WEB_UI fallback, merges fields independently, and keeps /support canonical", async () => {
    const pack = await loadBundledUiMessagePack("en");
    assert.ok(pack);
    const support = nest(pack.messages as Nested, "supportPublic");
    const automaticTitle = str(support, "title").replaceAll("{siteName}", "Humanity Union");
    const automaticDescription = str(support, "subtitle");
    assert.equal(automaticTitle, "Support Humanity Union");
    assert.equal(
      automaticDescription,
      "Help build better conditions for thoughtful collective action.",
    );

    const page = readWeb("app/support/page.tsx");
    assert.match(page, /fetchPublicSeoPageOverride/);
    assert.match(page, /family:\s*"support"/);
    assert.match(page, /entityKey:\s*"support"/);
    assert.match(page, /applyPageSeoOverrideToMetadataInput/);
    assert.match(page, /titleBrandSuffix:\s*""/);
    assert.doesNotMatch(page, /isLocalePrefixedDocument|selectCanonicalEnglishSeoOverrideForDocument/);
    assert.doesNotMatch(page, /locale\s*===\s*["']/);

    const prevMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    const prevPlatform = process.env.PLATFORM_MODE;
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "production";
    delete process.env.PLATFORM_MODE;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const renderSupport = (override: SeoPageOverrideFields | null) =>
      buildPublicPageMetadataForRequest({
        ...applyPageSeoOverrideToMetadataInput(
          {
            title: automaticTitle,
            description: automaticDescription,
            canonicalPath: "/support",
            titleBrandSuffix: "",
            openGraphSiteName: "Humanity Union",
          },
          override,
        ),
        localeFreeCanonicalPath: "/support",
        catalog: CATALOG,
        pathname: "/support",
        urlLocaleSegment: null,
      });

    try {
      const automatic = await renderSupport(null);
      assert.equal(automatic.title, "Support Humanity Union");
      assert.equal(automatic.description, normalizeMetaDescription(automaticDescription));
      assert.equal(automatic.alternates?.canonical, "/support");
      assert.equal(automatic.alternates?.languages, undefined);
      assert.doesNotMatch(String(automatic.title), /\| Humanity Union/);

      const titleOnly = await renderSupport({ seoTitle: "Operator Support Title" });
      assert.equal(titleOnly.title, "Operator Support Title");
      assert.equal(titleOnly.description, normalizeMetaDescription(automaticDescription));
      assert.equal(titleOnly.alternates?.canonical, "/support");
      assert.doesNotMatch(String(titleOnly.title), /\| Humanity Union/);
      assert.equal(titleOnly.openGraph?.images, undefined);

      const descriptionOnly = await renderSupport({
        seoDescription: "Operator support description.",
      });
      assert.equal(descriptionOnly.title, "Support Humanity Union");
      assert.equal(descriptionOnly.description, "Operator support description.");

      const social = mergePageSeoOverrideIntoAutomatic(
        { title: automaticTitle, description: automaticDescription, imageUrl: null },
        { seoTitle: "Operator Support Title" },
      );
      assert.equal(social.socialTitle, automaticTitle);
      assert.equal(social.socialDescription, automaticDescription);
      assert.equal(social.imageUrl, null);

      process.env.NEXT_PUBLIC_PLATFORM_MODE = "staging";
      const staging = await renderSupport({
        seoTitle: "Operator Support Title",
        seoDescription: "Operator support description.",
      });
      assert.equal(shouldDisallowSearchIndexing(), true);
      assert.deepEqual(staging.robots, { index: false, follow: false, nocache: true });
      assert.equal(staging.alternates?.canonical, "/support");
    } finally {
      if (prevMode === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = prevMode;
      if (prevPlatform === undefined) delete process.env.PLATFORM_MODE;
      else process.env.PLATFORM_MODE = prevPlatform;
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
    }
  });
});

describe("Step 07A — Volunteer canonical override isolation", () => {
  it("merges the canonical override only on locale-free /volunteer", async () => {
    const english = await volunteerCopy("en");
    assert.equal(english.title, "Volunteer");
    assert.equal(
      english.description,
      "Your actions today help build a kinder, safer and fairer tomorrow.",
    );

    const page = readWeb("app/volunteer/page.tsx");
    assert.match(page, /volunteerPublic/);
    assert.match(page, /isLocalePrefixedDocument/);
    assert.match(page, /selectCanonicalEnglishSeoOverrideForDocument/);
    assert.match(page, /family:\s*"volunteer"/);
    assert.match(page, /entityKey:\s*"volunteer"/);
    assert.match(page, /canonicalPath:\s*"\/volunteer"/);
    assert.doesNotMatch(page, /locale\s*===\s*["']|urlLocaleSegment\s*===\s*["']/);
    assert.doesNotMatch(page, /searchEnabled|seoIndexingEnabled|isExtendedLocalizationReady/);
    assert.doesNotMatch(
      readWeb("lib/seo/apply-page-seo-override.ts"),
      /locale\s*===\s*["'](ar|uk|zh-Hant|zz-future)["']/,
    );

    const untouched = await renderVolunteer({
      localeSegment: null,
      pathname: "/volunteer",
      automaticTitle: english.title,
      automaticDescription: english.description,
      override: null,
    });
    assert.equal(untouched.document.isLocalePrefixedDocument, false);
    assert.equal(untouched.meta.title, "Volunteer | Humanity Union");
    assert.equal(untouched.meta.description, normalizeMetaDescription(english.description));
    assert.equal(untouched.meta.alternates?.canonical, "/volunteer");
    assert.doesNotMatch(String(untouched.meta.title), /Humanity Union \| Humanity Union/);

    const englishOverride = await renderVolunteer({
      localeSegment: null,
      pathname: "/volunteer",
      automaticTitle: english.title,
      automaticDescription: english.description,
      override: ENGLISH_VOLUNTEER_OVERRIDE,
    });
    assert.equal(englishOverride.meta.title, "Canonical Volunteer Title | Humanity Union");
    assert.equal(englishOverride.meta.description, ENGLISH_VOLUNTEER_OVERRIDE.seoDescription);
    assert.equal(englishOverride.meta.openGraph?.title, "Volunteer socially");
    assert.equal(
      englishOverride.meta.openGraph?.description,
      ENGLISH_VOLUNTEER_OVERRIDE.socialDescription,
    );
    assert.equal(englishOverride.meta.alternates?.canonical, "/volunteer");
    assert.doesNotMatch(String(englishOverride.meta.title), /\| Humanity Union \| Humanity Union/);
    assert.deepEqual(languagesOf(englishOverride.meta), languagesOf(untouched.meta));

    const titleOnly = await renderVolunteer({
      localeSegment: null,
      pathname: "/volunteer",
      automaticTitle: english.title,
      automaticDescription: english.description,
      override: { seoTitle: "Custom Volunteer" },
    });
    assert.equal(titleOnly.meta.title, "Custom Volunteer | Humanity Union");
    assert.equal(titleOnly.meta.description, normalizeMetaDescription(english.description));
    assert.equal(titleOnly.meta.openGraph?.title, english.title);
    assert.equal(titleOnly.meta.openGraph?.images, undefined);

    const descriptionOnly = await renderVolunteer({
      localeSegment: null,
      pathname: "/volunteer",
      automaticTitle: english.title,
      automaticDescription: english.description,
      override: { seoDescription: "Operator volunteer description." },
    });
    assert.equal(descriptionOnly.meta.title, "Volunteer | Humanity Union");
    assert.equal(descriptionOnly.meta.description, "Operator volunteer description.");

    const alreadySuffixed = await renderVolunteer({
      localeSegment: null,
      pathname: "/volunteer",
      automaticTitle: english.title,
      automaticDescription: english.description,
      override: { seoTitle: "Custom Volunteer | Humanity Union" },
    });
    assert.equal(alreadySuffixed.meta.title, "Custom Volunteer | Humanity Union");
  });

  it("keeps localized and future Volunteer documents on volunteerPublic", async () => {
    const arabic = await volunteerCopy("ar");
    const ukrainian = await volunteerCopy("uk");
    assert.notEqual(arabic.title, "Volunteer");
    assert.notEqual(ukrainian.title, "Volunteer");

    const cases = [
      {
        segment: "ar",
        pathname: "/ar/volunteer",
        title: arabic.title,
        description: arabic.description,
      },
      {
        segment: "uk",
        pathname: "/uk/volunteer",
        title: ukrainian.title,
        description: ukrainian.description,
      },
      {
        segment: "zz-future",
        pathname: "/zz-future/volunteer",
        title: "Future locale volunteer title",
        description: "Future locale volunteer description.",
      },
    ];

    for (const row of cases) {
      const without = await renderVolunteer({
        localeSegment: row.segment,
        pathname: row.pathname,
        automaticTitle: row.title,
        automaticDescription: row.description,
        override: null,
      });
      const withOverride = await renderVolunteer({
        localeSegment: row.segment,
        pathname: row.pathname,
        automaticTitle: row.title,
        automaticDescription: row.description,
        override: ENGLISH_VOLUNTEER_OVERRIDE,
      });
      assert.equal(withOverride.document.isLocalePrefixedDocument, true);
      assert.equal(withOverride.selected, null);
      assert.equal(withOverride.meta.title, without.meta.title);
      assert.equal(withOverride.meta.description, without.meta.description);
      assert.equal(String(withOverride.meta.title).includes(row.title), true);
      assert.doesNotMatch(String(withOverride.meta.title), /Canonical Volunteer Title/);
      assert.notEqual(withOverride.meta.description, ENGLISH_VOLUNTEER_OVERRIDE.seoDescription);
      assert.equal(withOverride.meta.alternates?.canonical, row.pathname);
      assert.deepEqual(languagesOf(withOverride.meta), languagesOf(without.meta));
      assert.equal(languagesOf(withOverride.meta)?.["x-default"], "/volunteer");
    }
  });
});

describe("Step 07A — sitemap, hreflang perimeter, and existing families", () => {
  it("does not change sitemap membership, support locale eligibility, or existing families", () => {
    const paths = listStaticPublicSitemapEntries().map((entry) => entry.path);
    assert.ok(paths.includes("/support"));
    assert.ok(paths.includes("/volunteer"));
    assert.equal(isPublicSeoLocalePath("/support"), false);
    assert.equal(isPublicSeoLocalePath("/volunteer"), true);

    const expanded = expandPublicSitemapEntriesForSeoLocales({
      entries: listStaticPublicSitemapEntries(),
      seoIndexableLocales: ["en", "zz-FUTURE"],
    }).map((entry) => entry.path);
    assert.ok(expanded.includes("/volunteer"));
    assert.ok(expanded.includes("/zz-future/volunteer"));
    assert.ok(!expanded.some((entry) => entry.endsWith("/support") && entry !== "/support"));

    const routing = readRepo("packages/types/src/domain/public-seo-locale-routing.ts");
    assert.match(routing, /\^\\\/volunteer\\\/\?\$/);
    assert.doesNotMatch(routing, /\^\\\/support\\\/\?\$/);

    assert.equal(
      buildCountrySeoInventoryRows([{ code: "CA", name: "Canada" }])[0]?.canonicalPath,
      "/countries/CA",
    );
    assert.equal(
      buildInitiativeSeoInventoryRow({ initiativeId: "init-1", title: "Water" }).canonicalPath,
      "/initiatives/public/init-1",
    );
    assert.equal(
      buildKnowledgeSeoInventoryRow({ slug: "article", title: "Article" }).canonicalPath,
      "/knowledge/article",
    );
    assert.equal(
      buildCivicArchiveSeoInventoryRow({ initiativeId: "init-1", title: "Archive" }).canonicalPath,
      "/civic-archive/init-1",
    );

    const supportPage = readWeb("app/support/page.tsx");
    const volunteerPage = readWeb("app/volunteer/page.tsx");
    assert.doesNotMatch(supportPage, /PUBLIC_SEO_LOCALE_PATH_PATTERNS|STATIC_PUBLIC_SITEMAP_PATHS/);
    assert.doesNotMatch(volunteerPage, /PUBLIC_SEO_LOCALE_PATH_PATTERNS|STATIC_PUBLIC_SITEMAP_PATHS/);
    assert.doesNotMatch(
      `${supportPage}\n${volunteerPage}`,
      /contentTranslation|ContentTranslation|isLocalizationReady/,
    );
  });
});
