/**
 * SEO Pack 07 — Admin Page SEO Editor.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildSeoPageOverrideId,
  seoPageOverrideHasCustomFields,
} from "@hu/types";

import {
  applyPageSeoOverrideToMetadataInput,
  mergePageSeoOverrideIntoAutomatic,
  resolveSeoModeFromOverrideFields,
} from "../../lib/seo/apply-page-seo-override";
import { buildPublicPageMetadata } from "../../lib/seo/build-public-page-metadata";
import { shouldDisallowSearchIndexing } from "../../lib/platform-indexing";
import {
  isSeoPageOverrideEditableFamily,
  buildCountrySeoInventoryRows,
  buildPetitionFamilyDeferredRow,
} from "../administration/admin-seo-console-model";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const apiSrc = path.resolve(dir, "../../../../api/src");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readApi(relativePath: string): string {
  return readFileSync(path.join(apiSrc, relativePath), "utf8");
}

describe("SEO Pack 07 — override model and identity", () => {
  it("uses a shared sparse SEO override model with unique page identity", () => {
    assert.equal(buildSeoPageOverrideId("country", "CA"), "country:CA");
    assert.equal(buildSeoPageOverrideId("initiative", "init-1"), "initiative:init-1");
    assert.equal(seoPageOverrideHasCustomFields({}), false);
    assert.equal(seoPageOverrideHasCustomFields({ seoTitle: "X" }), true);

    const model = readApi("modules/seo-page-overrides/seo-page-overrides.service.ts");
    assert.match(model, /seo\.page_override\.(create|update|clear)/);
    assert.match(model, /pageId/);
    assert.doesNotMatch(model, /SeoSettings|globalSeoSettings/);
  });

  it("supports sparse partial overrides and Automatic/Customized modes", () => {
    assert.equal(resolveSeoModeFromOverrideFields({}), "automatic");
    assert.equal(resolveSeoModeFromOverrideFields({ seoDescription: "Only desc" }), "customized");

    const automatic = {
      title: "Canada",
      description: "Automatic description",
      socialTitle: "Canada",
      socialDescription: "Automatic description",
      imageUrl: "/brand/logo.png",
    };

    const partial = mergePageSeoOverrideIntoAutomatic(automatic, {
      seoDescription: "Custom description only",
    });
    assert.equal(partial.title, "Canada");
    assert.equal(partial.description, "Custom description only");
    assert.equal(partial.socialTitle, "Canada");
    assert.equal(partial.imageUrl, "/brand/logo.png");
  });

  it("restores automatic behavior when override fields are empty", () => {
    const automatic = { title: "Water", description: "Auto" };
    const restored = mergePageSeoOverrideIntoAutomatic(automatic, {});
    assert.deepEqual(restored, automatic);
    assert.equal(resolveSeoModeFromOverrideFields({}), "automatic");
  });
});

describe("SEO Pack 07 — metadata precedence", () => {
  it("applies Admin override into Pack 01 metadata builder", () => {
    const meta = buildPublicPageMetadata(
      applyPageSeoOverrideToMetadataInput(
        {
          title: "Canada",
          description: "Automatic country description",
          canonicalPath: "/countries/CA",
          socialTitle: "Canada",
        },
        { seoTitle: "Canada Override", seoDescription: "Custom meta" },
      ),
    );
    assert.match(String(meta.title), /Canada Override/);
    assert.equal(meta.description, "Custom meta");
    assert.ok(meta.alternates?.canonical);
  });

  it("keeps staging/dev noindex authoritative over overrides", () => {
    const prev = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "staging";
    try {
      assert.equal(shouldDisallowSearchIndexing(), true);
      const meta = buildPublicPageMetadata(
        applyPageSeoOverrideToMetadataInput(
          {
            title: "Canada",
            description: "Desc",
            canonicalPath: "/countries/CA",
            indexable: true,
          },
          { seoTitle: "Still noindex" },
        ),
      );
      assert.equal((meta.robots as { index?: boolean }).index, false);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = prev;
    }
  });
});

describe("SEO Pack 07 — editable surfaces and deferrals", () => {
  it("marks Countries and Initiatives editable; Petition deferred; Blog separate", () => {
    assert.equal(isSeoPageOverrideEditableFamily("country"), true);
    assert.equal(isSeoPageOverrideEditableFamily("initiative"), true);
    assert.equal(isSeoPageOverrideEditableFamily("knowledge"), true);
    assert.equal(isSeoPageOverrideEditableFamily("civic-archive"), true);
    assert.equal(isSeoPageOverrideEditableFamily("blog"), false);
    assert.equal(isSeoPageOverrideEditableFamily("petition"), false);

    const countries = buildCountrySeoInventoryRows([{ code: "CA", name: "Canada" }], new Set(["country:CA"]));
    assert.equal(countries[0]?.seoMode, "customized");
    assert.equal(countries[0]?.canonicalPath, "/countries/CA");

    const petition = buildPetitionFamilyDeferredRow();
    assert.equal(petition.seoMode, "deferred");

    const pages = readWeb("features/administration/components/AdminSeoPagesView.tsx");
    assert.match(pages, /Edit SEO/);
    assert.match(pages, /Edit Blog SEO/);
    assert.match(pages, /Initiative-owned — not independently indexed/);
    assert.doesNotMatch(pages, /seo_page_overrides.*blog|family === "blog".*saveAdminSeoPageOverride/);
  });

  it("wires Country/Initiative/Knowledge/Civic metadata with override merge", () => {
    assert.match(readWeb("app/countries/[countryCode]/page.tsx"), /fetchPublicSeoPageOverride/);
    assert.match(readWeb("app/initiatives/public/[initiativeId]/page.tsx"), /applyPageSeoOverrideToMetadataInput/);
    assert.match(readWeb("app/knowledge/[slug]/page.tsx"), /generateMetadata/);
    assert.match(readWeb("app/civic-archive/[initiativeId]/page.tsx"), /generateMetadata/);
  });
});

describe("SEO Pack 07 — API and UI safety", () => {
  it("exposes Admin-only write API and public read for metadata", () => {
    const app = readApi("app.ts");
    assert.match(app, /admin\/seo\/page-overrides/);
    assert.match(app, /public\/seo\/page-overrides/);

    const adminRoutes = readApi("modules/seo-page-overrides/admin-seo-page-overrides.routes.ts");
    assert.match(adminRoutes, /requireAuthenticationMiddleware/);
    assert.match(adminRoutes, /assertAdminActor|upsertAdminSeoPageOverride/);

    const validators = readApi("modules/seo-page-overrides/seo-page-overrides.validators.ts");
    assert.match(validators, /sanitizeBlogPlainTextMeta|validateBlogSeoPlainText/);
    assert.match(validators, /must not contain HTML|socialImageUrl/);
  });

  it("keeps canonical and indexing read-only in the editor UI", () => {
    const editor = readWeb("features/administration/components/AdminSeoPageEditorModal.tsx");
    assert.match(editor, /Restore automatic SEO/);
    assert.match(editor, /Search preview/);
    assert.match(editor, /Canonical:/);
    assert.match(editor, /Indexing:/);
    assert.doesNotMatch(editor, /setCanonical|indexable.*checkbox|robots.*select/i);
    assert.match(editor, /mergePageSeoOverrideIntoAutomatic/);
  });

  it("does not introduce a Blog duplicate override source or SeoSettings store", () => {
    const service = readApi("modules/seo-page-overrides/seo-page-overrides.service.ts");
    assert.doesNotMatch(service, /family === "blog"/);
    assert.doesNotMatch(readWeb("lib/seo/apply-page-seo-override.ts"), /SeoSettings/);
    assert.match(readWeb("app/admin/seo/page.tsx"), /AdminAccessGate/);
  });
});
