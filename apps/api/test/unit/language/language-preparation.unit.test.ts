/**
 * Language owner preparation + WEB_UI identical classification / quality retry.
 * Deterministic provider only — no Gemini.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import type { BrandLocalizationRecord, TerminologyConcept } from "@hu/types";

import { runLanguageOwnerPreparation } from "../../../src/modules/language-preparation/language-owner-preparation.js";
import { resolveLanguagePreparationLocaleMetadata } from "../../../src/modules/language-preparation/language-registry-metadata.js";
import { classifyEnglishIdenticalWebUiValue } from "../../../src/modules/web-ui-message-packs/web-ui-identical-classification.js";
import { runWebUiDraftBuilder } from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import { runWebUiQualityRetry } from "../../../src/modules/web-ui-message-packs/web-ui-quality-retry.js";
import { selectEnglishWebUiMessages } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";
import type {
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../../../src/modules/language/translation-provider.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";

const executeEnv = { TRANSLATION_PROVIDER: "gemini" };
const localeMeta = {
  englishName: "Esperanto",
  nativeName: "Esperanto",
  textDirection: "ltr" as const,
};

function echoFlat(request: TranslationProviderRequest): TranslationProviderResult {
  return {
    translatedText: request.text,
    providerId: "deterministic",
    isPlaceholder: false,
  };
}

function translateFlat(request: TranslationProviderRequest): TranslationProviderResult {
  const parsed = JSON.parse(request.text) as Record<string, string>;
  return {
    translatedText: JSON.stringify(
      Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, `[eo] ${value}`]),
      ),
    ),
    providerId: "deterministic",
    isPlaceholder: false,
  };
}

describe("language preparation automation", () => {
  it("resolves Registry metadata and rejects missing Registry without CLI flags", async () => {
    const metadata = await resolveLanguagePreparationLocaleMetadata({
      locale: "he",
      resolveRegistryLocale: async () => ({
        locale: "he",
        englishName: "Hebrew",
        nativeName: "עברית",
        textDirection: "rtl",
      }),
    });
    assert.equal(metadata.textDirection, "rtl");
    assert.equal(metadata.source, "registry");
    await assert.rejects(
      () =>
        resolveLanguagePreparationLocaleMetadata({
          locale: "xx",
          resolveRegistryLocale: async () => null,
        }),
      /not in the Language Registry/,
    );
  });

  it("preserves existing Brand and Terminology values and fills only gaps", async () => {
    const brands = new Map<string, BrandLocalizationRecord>();
    brands.set("en", {
      brandId: "brand-en",
      locale: "en",
      siteName: "Humanity Union",
      slogan: "WORLD SOLIDARITY",
      heroUnityQuote: "Over time,\nlove and responsibility\nforge humanity",
      seoSiteName: "Humanity Union",
      defaultMetaDescription: "World Solidarity civic technology platform",
      shortName: "Humanity",
      status: "published",
      createdAt: "t0",
      updatedAt: "t0",
    });
    brands.set("eo", {
      brandId: "brand-eo-1",
      locale: "eo",
      siteName: "Existing Site",
      slogan: "",
      heroUnityQuote: "",
      seoSiteName: "",
      defaultMetaDescription: "",
      status: "draft",
      createdAt: "t0",
      updatedAt: "t0",
    });
    const concepts: TerminologyConcept[] = [
      {
        conceptId: "workspace",
        canonicalEnglishTerm: "Workspace",
        category: "domain",
        status: "published",
        translations: {
          eo: { preferredTerm: "Laborspaco", aliases: [] },
        },
        createdAt: "t0",
        updatedAt: "t0",
        updatedByParticipantId: null,
      },
      {
        conceptId: "assistant",
        canonicalEnglishTerm: "Assistant",
        category: "ui",
        status: "published",
        translations: {},
        createdAt: "t0",
        updatedAt: "t0",
        updatedByParticipantId: null,
      },
    ];
    let providerCalls = 0;
    const result = await runLanguageOwnerPreparation({
      locale: "eo",
      ...localeMeta,
      execute: true,
      env: executeEnv,
      resolveRegistryLocale: async () => ({
        locale: "eo",
        ...localeMeta,
      }),
      getBrand: async (locale) => brands.get(locale) ?? null,
      getEnglishBrand: async () => brands.get("en") ?? null,
      saveBrand: async (record) => {
        brands.set(record.locale, record);
        return record;
      },
      listTerminology: async () => concepts,
      updateTerminology: async (conceptId, preferredTerm, locale) => {
        const concept = concepts.find((row) => row.conceptId === conceptId)!;
        concept.translations = {
          ...concept.translations,
          [locale]: { preferredTerm, aliases: [] },
        };
      },
      translator: async (request) => {
        providerCalls += 1;
        return translateFlat(request);
      },
      log: () => undefined,
    });
    assert.equal(brands.get("eo")?.siteName, "Existing Site");
    assert.match(brands.get("eo")?.slogan ?? "", /^\[eo] /);
    assert.equal(brands.get("eo")?.status, "draft");
    assert.equal(concepts[0]?.translations.eo?.preferredTerm, "Laborspaco");
    assert.match(concepts[1]?.translations.eo?.preferredTerm ?? "", /^\[eo] /);
    assert.equal(
      result.brand.outcomes.find((row) => row.field === "siteName")?.outcome,
      "preserved",
    );
    assert.equal(
      result.terminology.outcomes.find((row) => row.field === "workspace")?.outcome,
      "preserved",
    );
    assert.ok(providerCalls >= 2);
  });

  it("records an explicit gap when provider generation fails", async () => {
    const brands = new Map<string, BrandLocalizationRecord>();
    brands.set("en", {
      brandId: "brand-en",
      locale: "en",
      siteName: "Humanity Union",
      slogan: "WORLD SOLIDARITY",
      heroUnityQuote: "quote",
      seoSiteName: "Humanity Union",
      defaultMetaDescription: "desc",
      status: "published",
      createdAt: "t0",
      updatedAt: "t0",
    });
    const concepts: TerminologyConcept[] = [
      {
        conceptId: "assistant",
        canonicalEnglishTerm: "Assistant",
        category: "ui",
        status: "published",
        translations: {},
        createdAt: "t0",
        updatedAt: "t0",
        updatedByParticipantId: null,
      },
    ];
    const result = await runLanguageOwnerPreparation({
      locale: "eo",
      ...localeMeta,
      execute: true,
      env: executeEnv,
      resolveRegistryLocale: async () => ({ locale: "eo", ...localeMeta }),
      getBrand: async () => null,
      getEnglishBrand: async () => brands.get("en") ?? null,
      saveBrand: async (record) => record,
      listTerminology: async () => concepts,
      updateTerminology: async () => {
        throw new Error("should not persist");
      },
      translator: async () => {
        throw new TranslationProviderError("timeout", "timed out");
      },
      log: () => undefined,
    });
    assert.equal(result.terminology.outcomes[0]?.outcome, "failed");
    assert.equal(result.terminology.persistedCount, 0);
    assert.equal(concepts[0]?.translations.eo, undefined);
  });

  it("classifies technical vs suspicious identical values", () => {
    assert.equal(
      classifyEnglishIdenticalWebUiValue({
        path: "a",
        english: "20 CAD",
        localized: "20 CAD",
      })?.kind,
      "accepted-technical",
    );
    assert.equal(
      classifyEnglishIdenticalWebUiValue({
        path: "b",
        english: "media-literacy",
        localized: "media-literacy",
      })?.kind,
      "accepted-technical",
    );
    assert.equal(
      classifyEnglishIdenticalWebUiValue({
        path: "c",
        english: "Membership",
        localized: "Membership",
      })?.kind,
      "suspicious-human",
    );
    assert.equal(
      classifyEnglishIdenticalWebUiValue({
        path: "d",
        english: "Initiative",
        localized: "Initiative",
        preferredEnglishSurfaces: new Map([["Initiative", "ინიციატივა"]]),
      })?.reason,
      "canonical-term-remained-english-despite-preferred-term",
    );
  });

  it("quality-retry touches only suspicious paths and leaves the primary checkpoint intact", async () => {
    const outRoot = mkdtempSync(path.join(tmpdir(), "web-ui-quality-"));
    const prepared = selectEnglishWebUiMessages("public");
    const includePaths = prepared.selectedPaths
      .filter((pathKey) => pathKey.startsWith("navigation."))
      .slice(0, 3);
    await runWebUiDraftBuilder({
      locale: "eo",
      ...localeMeta,
      execute: true,
      includePaths,
      outRoot,
      env: executeEnv,
      model: "test-model",
      log: () => undefined,
      retryDelayMs: 0,
      translator: async (request) => echoFlat(request),
    });
    const primaryDir = path.join(outRoot, "web-ui-eo-draft");
    const primaryManifestBefore = readFileSync(path.join(primaryDir, "manifest.json"), "utf8");
    const preferred = new Map([["Workspace", "Laborspaco"]]);
    let retriedKeys: string[] = [];
    const quality = await runWebUiQualityRetry({
      locale: "eo",
      ...localeMeta,
      execute: true,
      outRoot,
      env: executeEnv,
      model: "test-model",
      preferredEnglishSurfaces: preferred,
      loadLiveTerminology: async () => "Workspace (workspace) => Laborspaco",
      log: () => undefined,
      retryDelayMs: 0,
      translator: async (request) => {
        const parsed = JSON.parse(request.text) as Record<string, string>;
        retriedKeys = Object.keys(parsed).sort();
        return {
          translatedText: JSON.stringify(
            Object.fromEntries(
              Object.entries(parsed).map(([key, value]) => [key, value === "Workspace" ? "Laborspaco" : `[eo] ${value}`]),
            ),
          ),
          providerId: "deterministic",
          isPlaceholder: false,
        };
      },
    });
    assert.ok(retriedKeys.length > 0);
    assert.ok(retriedKeys.every((key) => includePaths.includes(key)));
    assert.equal(readFileSync(path.join(primaryDir, "manifest.json"), "utf8"), primaryManifestBefore);
    assert.equal(existsSync(path.join(outRoot, "web-ui-eo-quality", "manifest.json")), true);
    const artifact = JSON.parse(readFileSync(quality.artifactPath ?? "", "utf8")) as {
      messages: { navigation?: { workspace?: string } };
    };
    if (includePaths.includes("navigation.workspace")) {
      assert.equal(artifact.messages.navigation?.workspace, "Laborspaco");
    }
    assert.doesNotMatch(primaryManifestBefore, /GEMINI_API_KEY|mongodb/i);
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("dry-run owner preparation makes zero provider calls and no persistence", async () => {
    let calls = 0;
    let saved = 0;
    const result = await runLanguageOwnerPreparation({
      locale: "eo",
      ...localeMeta,
      resolveRegistryLocale: async () => ({ locale: "eo", ...localeMeta }),
      getBrand: async () => null,
      getEnglishBrand: async () => null,
      saveBrand: async (record) => {
        saved += 1;
        return record;
      },
      listTerminology: async () => [],
      translator: async () => {
        calls += 1;
        return echoFlat({} as TranslationProviderRequest);
      },
      log: () => undefined,
    });
    assert.equal(result.mode, "dry-run");
    assert.equal(calls, 0);
    assert.equal(saved, 0);
    assert.equal(result.providerCalls, 0);
  });
});
