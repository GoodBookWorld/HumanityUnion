/**
 * Offline owner preparation for Brand Localization and Terminology Glossary.
 *
 * Preserves every non-empty target-language value.
 * Generates only missing values through TranslationProvider.translate.
 * Persists through existing owner contracts. Never publishes Brand.
 * Never activates localization. Never writes WEB_UI / CT / PLP.
 */

import { randomUUID } from "node:crypto";

import {
  CANONICAL_ENGLISH_BRAND_FALLBACK,
  type BrandLocalizationRecord,
  type LanguageCode,
  type TerminologyConcept,
} from "@hu/types";

import type {
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../language/translation-provider.js";
import { TranslationProviderError } from "../language/translation.config.js";
import {
  classifyActivationProviderTransientFailure,
  isActivationProviderTransientError,
} from "../language/activation-provider-transient-recovery.js";
import {
  resolveLanguagePreparationLocaleMetadata,
  type LanguagePreparationLocaleMetadata,
} from "./language-registry-metadata.js";

const BRAND_REQUIRED_FIELDS = [
  "siteName",
  "slogan",
  "heroUnityQuote",
  "seoSiteName",
  "defaultMetaDescription",
] as const;

const BRAND_OPTIONAL_FIELDS = [
  "shortName",
  "seoTitleSuffix",
  "openGraphBrandName",
] as const;

type BrandRequiredField = (typeof BRAND_REQUIRED_FIELDS)[number];
type BrandOptionalField = (typeof BRAND_OPTIONAL_FIELDS)[number];
type BrandField = BrandRequiredField | BrandOptionalField;

export class LanguageOwnerPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LanguageOwnerPreparationError";
  }
}

export type LanguageOwnerFieldOutcome =
  | { readonly field: string; readonly outcome: "preserved" }
  | { readonly field: string; readonly outcome: "generated" }
  | { readonly field: string; readonly outcome: "failed"; readonly reason: string }
  | { readonly field: string; readonly outcome: "gap"; readonly reason: string };

/** Durable cooldown signal — activation must not FAILED for this reason. */
export type LanguageOwnerTransientFailure = {
  readonly kind: "rate_limited" | "unavailable" | "timeout";
  readonly reason: string;
};

export type LanguageOwnerPreparationResult = {
  readonly mode: "dry-run" | "execute";
  readonly locale: string;
  readonly metadata: LanguagePreparationLocaleMetadata;
  readonly brand: {
    readonly existed: boolean;
    readonly status: string | null;
    readonly outcomes: readonly LanguageOwnerFieldOutcome[];
    readonly persisted: boolean;
  };
  readonly terminology: {
    readonly publishedConcepts: number;
    readonly outcomes: readonly LanguageOwnerFieldOutcome[];
    readonly persistedCount: number;
  };
  readonly providerCalls: number;
  /**
   * When set, a transient provider error stopped further work in this attempt.
   * Remaining gaps stay as `gap` (not failed). Activation enters durable cooldown.
   */
  readonly transientFailure?: LanguageOwnerTransientFailure | null;
};

export type LanguageOwnerPreparationInput = {
  readonly argv?: readonly string[];
  readonly locale?: string;
  readonly execute?: boolean;
  /** Default both. Activation may run Brand then Terminology as separate phases. */
  readonly owners?: readonly ("brand" | "terminology")[];
  readonly englishName?: string;
  readonly nativeName?: string;
  readonly textDirection?: string;
  readonly translator?: (request: TranslationProviderRequest) => Promise<TranslationProviderResult>;
  readonly env?: {
    readonly TRANSLATION_PROVIDER?: string;
    readonly HU_READ_ONLY_DIAGNOSTIC?: string;
  };
  readonly getBrand?: (locale: string) => Promise<BrandLocalizationRecord | null>;
  readonly getEnglishBrand?: () => Promise<BrandLocalizationRecord | null>;
  readonly saveBrand?: (record: BrandLocalizationRecord) => Promise<BrandLocalizationRecord>;
  readonly listTerminology?: () => Promise<readonly TerminologyConcept[]>;
  readonly updateTerminology?: (
    conceptId: string,
    preferredTerm: string,
    locale: string,
  ) => Promise<void>;
  readonly resolveRegistryLocale?: Parameters<
    typeof resolveLanguagePreparationLocaleMetadata
  >[0]["resolveRegistryLocale"];
  readonly log?: (line: string) => void;
  readonly now?: () => string;
};

function readFlag(argv: readonly string[], name: string): string | undefined {
  const withEquals = argv.find((arg) => arg.startsWith(`${name}=`));
  if (withEquals) {
    return withEquals.slice(name.length + 1);
  }
  const index = argv.indexOf(name);
  if (index >= 0) {
    return argv[index + 1];
  }
  return undefined;
}

function isNonEmpty(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function parseFlatStringMap(raw: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LanguageOwnerPreparationError("Provider response JSON could not be parsed.");
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new LanguageOwnerPreparationError("Provider response JSON root was not an object.");
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "string" || !value.trim()) {
      throw new LanguageOwnerPreparationError(`Provider value for ${key} must be a non-empty string.`);
    }
    out[key] = value;
  }
  return out;
}

async function translateFlatMap(input: {
  readonly translator: (request: TranslationProviderRequest) => Promise<TranslationProviderResult>;
  readonly locale: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: string;
  readonly values: Readonly<Record<string, string>>;
  readonly owner: "brand" | "terminology";
}): Promise<Record<string, string>> {
  const keys = Object.keys(input.values).sort();
  if (keys.length === 0) {
    return {};
  }
  const payload = Object.fromEntries(keys.map((key) => [key, input.values[key]!]));
  const terminologyContext = [
    `${input.owner} localization preparation rules:`,
    `Target locale: ${input.locale}.`,
    `English language name: ${input.englishName}.`,
    `Native language name: ${input.nativeName}.`,
    `Text direction: ${input.textDirection}.`,
    "Translate only the string values.",
    "Preserve JSON keys exactly.",
    "Return one JSON object with exactly those keys.",
    "Do not invent extra keys.",
  ].join("\n");
  const result = await input.translator({
    sourceLanguage: "en",
    targetLanguage: input.locale as LanguageCode,
    text: JSON.stringify(payload),
    contentType: "structured_json",
    terminologyContext,
    safetyCleared: true,
  });
  const returned = parseFlatStringMap(result.translatedText);
  const missing = keys.filter((key) => !returned[key]);
  if (missing.length > 0) {
    throw new LanguageOwnerPreparationError(`Provider omitted keys: ${missing.join(", ")}`);
  }
  const extra = Object.keys(returned).filter((key) => !keys.includes(key));
  if (extra.length > 0) {
    throw new LanguageOwnerPreparationError(`Provider returned unexpected keys: ${extra.join(", ")}`);
  }
  return returned;
}

function englishBrandSource(english: BrandLocalizationRecord | null): Record<BrandField, string> {
  const fallback = CANONICAL_ENGLISH_BRAND_FALLBACK;
  return {
    siteName: english?.siteName || fallback.siteName,
    slogan: english?.slogan || fallback.slogan,
    heroUnityQuote: english?.heroUnityQuote || fallback.heroUnityQuote,
    seoSiteName: english?.seoSiteName || fallback.seoSiteName,
    defaultMetaDescription: english?.defaultMetaDescription || fallback.defaultMetaDescription,
    shortName: english?.shortName || fallback.shortName,
    seoTitleSuffix: english?.seoTitleSuffix || fallback.seoTitleSuffix,
    openGraphBrandName: english?.openGraphBrandName || fallback.openGraphBrandName,
  };
}

export async function runLanguageOwnerPreparation(
  input: LanguageOwnerPreparationInput = {},
): Promise<LanguageOwnerPreparationResult> {
  const argv = input.argv ?? [];
  const execute = input.execute ?? argv.includes("--execute");
  const localeRaw = input.locale ?? readFlag(argv, "--locale") ?? "";
  if (!localeRaw.trim()) {
    throw new LanguageOwnerPreparationError("locale is required.");
  }
  const metadata = await resolveLanguagePreparationLocaleMetadata({
    locale: localeRaw.trim(),
    englishName: input.englishName ?? readFlag(argv, "--english-name"),
    nativeName: input.nativeName ?? readFlag(argv, "--native-name"),
    textDirection: input.textDirection ?? readFlag(argv, "--text-direction"),
    resolveRegistryLocale: input.resolveRegistryLocale,
  });
  const locale = metadata.locale;
  if (locale === "en") {
    throw new LanguageOwnerPreparationError("English is the Brand/Terminology source locale, not a preparation target.");
  }

  const log = input.log ?? ((line: string) => console.log(line));
  const now = input.now ?? (() => new Date().toISOString());

  const getBrand =
    input.getBrand ??
    (async (target: string) => {
      const module = await import("../brand-localization/brand-localization.repository.js");
      return module.getBrandLocalizationByLocale(target);
    });
  const getEnglishBrand =
    input.getEnglishBrand ??
    (async () => {
      const module = await import("../brand-localization/brand-localization.repository.js");
      return module.getBrandLocalizationByLocale("en");
    });
  const saveBrand =
    input.saveBrand ??
    (async (record: BrandLocalizationRecord) => {
      const module = await import("../brand-localization/brand-localization.repository.js");
      const existing = await module.getBrandLocalizationByLocale(record.locale);
      if (existing) {
        return module.updateBrandLocalizationRecord(record.locale, record);
      }
      return module.upsertBrandLocalization(record);
    });
  const listTerminology =
    input.listTerminology ??
    (async () => {
      const module = await import("../language/terminology-glossary/terminology-glossary.repository.js");
      await module.ensureTerminologyGlossarySeeded();
      return module.listTerminologyConcepts();
    });
  const updateTerminology =
    input.updateTerminology ??
    (async (conceptId: string, preferredTerm: string, targetLocale: string) => {
      const module = await import("../language/terminology-glossary/terminology-glossary.repository.js");
      await module.updateTerminologyConcept(conceptId, {
        translations: {
          [targetLocale]: {
            preferredTerm,
            aliases: [],
          },
        },
      });
    });

  const existingBrand = await getBrand(locale);
  const englishBrand = await getEnglishBrand();
  const englishFields = englishBrandSource(englishBrand);
  const brandMissing: BrandField[] = [];
  const brandOutcomes: LanguageOwnerFieldOutcome[] = [];
  const owners = new Set(input.owners ?? ["brand", "terminology"]);
  const prepareBrand = owners.has("brand");
  const prepareTerminology = owners.has("terminology");

  if (prepareBrand) {
    for (const field of [...BRAND_REQUIRED_FIELDS, ...BRAND_OPTIONAL_FIELDS]) {
      const current = existingBrand?.[field];
      if (isNonEmpty(current)) {
        brandOutcomes.push({ field, outcome: "preserved" });
      } else {
        brandMissing.push(field);
        brandOutcomes.push({
          field,
          outcome: "gap",
          reason: "missing-target-value",
        });
      }
    }
  }

  const concepts = prepareTerminology
    ? (await listTerminology()).filter((concept) => concept.status === "published")
    : [];
  const terminologyMissing: TerminologyConcept[] = [];
  const terminologyOutcomes: LanguageOwnerFieldOutcome[] = [];
  if (prepareTerminology) {
    for (const concept of concepts) {
      const preferred = concept.translations[locale]?.preferredTerm;
      if (isNonEmpty(preferred)) {
        terminologyOutcomes.push({ field: concept.conceptId, outcome: "preserved" });
      } else {
        terminologyMissing.push(concept);
        terminologyOutcomes.push({
          field: concept.conceptId,
          outcome: "gap",
          reason: "missing-preferred-term",
        });
      }
    }
  }

  if (!execute) {
    log(
      [
        "Language owner preparation dry-run",
        `locale: ${locale}`,
        `englishName: ${metadata.englishName}`,
        `nativeName: ${metadata.nativeName}`,
        `textDirection: ${metadata.textDirection}`,
        `metadataSource: ${metadata.source}`,
        `brandExisted: ${Boolean(existingBrand)}`,
        `brandMissingFields: ${brandMissing.length}`,
        `terminologyPublished: ${concepts.length}`,
        `terminologyMissingPreferred: ${terminologyMissing.length}`,
        "provider calls: 0",
        "persistence: 0",
      ].join("\n"),
    );
    return {
      mode: "dry-run",
      locale,
      metadata,
      brand: {
        existed: Boolean(existingBrand),
        status: existingBrand?.status ?? null,
        outcomes: brandOutcomes,
        persisted: false,
      },
      terminology: {
        publishedConcepts: concepts.length,
        outcomes: terminologyOutcomes,
        persistedCount: 0,
      },
      providerCalls: 0,
    };
  }

  const needsProvider = brandMissing.length > 0 || terminologyMissing.length > 0;
  let translator = input.translator;
  if (needsProvider) {
    const envProvider = input.env?.TRANSLATION_PROVIDER ?? process.env.TRANSLATION_PROVIDER;
    const envDiagnostic = input.env?.HU_READ_ONLY_DIAGNOSTIC ?? process.env.HU_READ_ONLY_DIAGNOSTIC;
    if (envDiagnostic === "1") {
      throw new LanguageOwnerPreparationError("REFUSED: read-only diagnostic cannot call the translation provider.");
    }
    if (envProvider?.trim().toLowerCase() !== "gemini") {
      throw new LanguageOwnerPreparationError("REFUSED: --execute requires TRANSLATION_PROVIDER=gemini.");
    }
    if (!translator) {
      const { assertGeminiTranslationConfigured, resolveTranslationConfig } = await import(
        "../language/translation.config.js"
      );
      const { GeminiTranslationProvider } = await import(
        "../language/providers/gemini-translation-provider.js"
      );
      const { resolveOfflineWebUiProviderTimeoutMs } = await import(
        "../web-ui-message-packs/web-ui-draft-builder.js"
      );
      const config = resolveTranslationConfig();
      if (config.provider !== "gemini") {
        throw new LanguageOwnerPreparationError("REFUSED: --execute requires TRANSLATION_PROVIDER=gemini.");
      }
      assertGeminiTranslationConfigured(config);
      const provider = new GeminiTranslationProvider({
        ...config,
        timeoutMs: resolveOfflineWebUiProviderTimeoutMs(config.timeoutMs),
      });
      translator = (request) => provider.translate(request);
    }
  }

  let providerCalls = 0;
  let transientFailure: LanguageOwnerTransientFailure | null = null;
  const generatedBrand: Partial<Record<BrandField, string>> = {};
  if (prepareBrand && brandMissing.length > 0) {
    const toTranslate = Object.fromEntries(
      brandMissing.map((field) => [field, englishFields[field]]),
    );
    try {
      providerCalls += 1;
      const translated = await translateFlatMap({
        translator: translator!,
        locale,
        englishName: metadata.englishName,
        nativeName: metadata.nativeName,
        textDirection: metadata.textDirection,
        values: toTranslate,
        owner: "brand",
      });
      for (const field of brandMissing) {
        generatedBrand[field] = translated[field]!;
      }
      for (let index = 0; index < brandOutcomes.length; index += 1) {
        const row = brandOutcomes[index]!;
        if (row.outcome === "gap" && generatedBrand[row.field as BrandField]) {
          brandOutcomes[index] = { field: row.field, outcome: "generated" };
        }
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Brand generation failed.";
      const transientKind = classifyActivationProviderTransientFailure(error);
      if (isActivationProviderTransientError(error) && transientKind) {
        // Leave missing fields as gap — activation will durable-cooldown and resume.
        transientFailure = { kind: transientKind, reason };
      } else {
        for (let index = 0; index < brandOutcomes.length; index += 1) {
          const row = brandOutcomes[index]!;
          if (row.outcome === "gap") {
            brandOutcomes[index] = { field: row.field, outcome: "failed", reason };
          }
        }
        if (error instanceof TranslationProviderError && error.code === "safety_rejected") {
          throw error;
        }
      }
    }
  }

  let brandPersisted = false;
  if (prepareBrand) {
    const requiredReady = BRAND_REQUIRED_FIELDS.every(
      (field) => isNonEmpty(existingBrand?.[field]) || isNonEmpty(generatedBrand[field]),
    );
    if (requiredReady && (brandMissing.length === 0 || Object.keys(generatedBrand).length > 0 || !existingBrand)) {
      const timestamp = now();
      const next: BrandLocalizationRecord = {
        brandId: existingBrand?.brandId ?? `brand-${locale}-${randomUUID().slice(0, 8)}`,
        locale,
        siteName: (isNonEmpty(existingBrand?.siteName)
          ? existingBrand!.siteName
          : generatedBrand.siteName)!,
        slogan: (isNonEmpty(existingBrand?.slogan) ? existingBrand!.slogan : generatedBrand.slogan)!,
        heroUnityQuote: (isNonEmpty(existingBrand?.heroUnityQuote)
          ? existingBrand!.heroUnityQuote
          : generatedBrand.heroUnityQuote)!,
        seoSiteName: (isNonEmpty(existingBrand?.seoSiteName)
          ? existingBrand!.seoSiteName
          : generatedBrand.seoSiteName)!,
        defaultMetaDescription: (isNonEmpty(existingBrand?.defaultMetaDescription)
          ? existingBrand!.defaultMetaDescription
          : generatedBrand.defaultMetaDescription)!,
        status: existingBrand?.status ?? "draft",
        createdAt: existingBrand?.createdAt ?? timestamp,
        updatedAt: timestamp,
        updatedByParticipantId: existingBrand?.updatedByParticipantId ?? null,
        ...(isNonEmpty(existingBrand?.shortName)
          ? { shortName: existingBrand!.shortName }
          : isNonEmpty(generatedBrand.shortName)
            ? { shortName: generatedBrand.shortName }
            : {}),
        ...(isNonEmpty(existingBrand?.seoTitleSuffix)
          ? { seoTitleSuffix: existingBrand!.seoTitleSuffix }
          : isNonEmpty(generatedBrand.seoTitleSuffix)
            ? { seoTitleSuffix: generatedBrand.seoTitleSuffix }
            : {}),
        ...(isNonEmpty(existingBrand?.openGraphBrandName)
          ? { openGraphBrandName: existingBrand!.openGraphBrandName }
          : isNonEmpty(generatedBrand.openGraphBrandName)
            ? { openGraphBrandName: generatedBrand.openGraphBrandName }
            : {}),
      };
      if (brandMissing.some((field) => isNonEmpty(generatedBrand[field])) || !existingBrand) {
        await saveBrand(next);
        brandPersisted = true;
      }
    }
  }

  let terminologyPersisted = 0;
  if (prepareTerminology && !transientFailure) {
    for (const concept of terminologyMissing) {
      try {
        providerCalls += 1;
        const translated = await translateFlatMap({
          translator: translator!,
          locale,
          englishName: metadata.englishName,
          nativeName: metadata.nativeName,
          textDirection: metadata.textDirection,
          values: { preferredTerm: concept.canonicalEnglishTerm },
          owner: "terminology",
        });
        await updateTerminology(concept.conceptId, translated.preferredTerm!, locale);
        terminologyPersisted += 1;
        const index = terminologyOutcomes.findIndex((row) => row.field === concept.conceptId);
        if (index >= 0) {
          terminologyOutcomes[index] = { field: concept.conceptId, outcome: "generated" };
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Terminology generation failed.";
        const transientKind = classifyActivationProviderTransientFailure(error);
        if (isActivationProviderTransientError(error) && transientKind) {
          // Stop further concept calls this attempt; remaining stay as gap.
          transientFailure = { kind: transientKind, reason };
          break;
        }
        const index = terminologyOutcomes.findIndex((row) => row.field === concept.conceptId);
        if (index >= 0) {
          terminologyOutcomes[index] = { field: concept.conceptId, outcome: "failed", reason };
        }
        if (error instanceof TranslationProviderError && error.code === "safety_rejected") {
          throw error;
        }
      }
    }
  }

  log(
    [
      "Language owner preparation complete",
      `locale: ${locale}`,
      `brandPersisted: ${brandPersisted}`,
      `terminologyPersisted: ${terminologyPersisted}`,
      `providerCalls: ${providerCalls}`,
      "published: false",
      "activation: false",
    ].join("\n"),
  );

  return {
    mode: "execute",
    locale,
    metadata,
    brand: {
      existed: Boolean(existingBrand),
      status: existingBrand?.status ?? (brandPersisted ? "draft" : null),
      outcomes: brandOutcomes,
      persisted: brandPersisted,
    },
    terminology: {
      publishedConcepts: concepts.length,
      outcomes: terminologyOutcomes,
      persistedCount: terminologyPersisted,
    },
    providerCalls,
    transientFailure,
  };
}
