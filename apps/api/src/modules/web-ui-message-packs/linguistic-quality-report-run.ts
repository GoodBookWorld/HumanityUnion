/**
 * Load read-only snapshots and build a WEB_UI linguistic quality report.
 * GET requests only. A missing published snapshot is never replaced with a packaged catalog.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { WebUiMessageTree } from "@hu/types";

import { assessWebUiMessageTreeReadiness } from "../language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import { TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS } from "../language/terminology-glossary/terminology-glossary.seed.js";
import {
  buildLinguisticQualityReport,
  parseLinguisticQualityPolicy,
  type GlossaryConceptEvidence,
  type LinguisticQualityCatalog,
  type LinguisticQualityFilter,
  type LinguisticQualityPolicy,
  type LinguisticQualityReport,
} from "./linguistic-quality-report.js";
import { loadPackagedWebUiCatalog } from "./packaged-web-ui-catalog.js";
import {
  compareWebUiCatalogParity,
  flattenWebUiCatalogLeaves,
} from "./web-ui-catalog-parity.js";
import { loadBundledWebUiMessagePackFromFs } from "./web-ui-message-pack.validate.js";
import { loadPublishedWebUiPackFromPublicApi } from "./web-ui-release-gate.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export type LinguisticQualityRegistryLocale = {
  readonly locale: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: "ltr" | "rtl";
  readonly fallbackLocale: string;
};

export type PublishedCatalogSnapshot = {
  readonly revision: number | null;
  readonly messages: WebUiMessageTree;
};

type FetchLike = (
  url: string,
) => Promise<{ readonly ok: boolean; readonly status: number; readonly text: () => Promise<string> }>;

export function defaultLinguisticQualityPolicyPath(): string {
  return path.join(here, "linguistic-quality-policy.json");
}

export function loadLinguisticQualityPolicy(filePath: string = defaultLinguisticQualityPolicyPath()): {
  readonly policy: LinguisticQualityPolicy;
  readonly sha256: string;
} {
  const raw = readFileSync(filePath, "utf8");
  return {
    policy: parseLinguisticQualityPolicy(JSON.parse(raw) as unknown),
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
}

export function parsePublicLanguageRegistry(payload: unknown): {
  readonly locales: readonly LinguisticQualityRegistryLocale[];
  readonly textDirectionDefaultedLocales: readonly string[];
} {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  const languages = data?.languages;
  if (!Array.isArray(languages) || languages.length === 0) {
    throw new Error("Language registry payload has no languages.");
  }
  const locales: LinguisticQualityRegistryLocale[] = [];
  const textDirectionDefaultedLocales: string[] = [];
  for (const entry of languages) {
    const row = asRecord(entry);
    const locale = stringValue(row?.locale);
    const fallbackLocale = stringValue(row?.fallbackLocale);
    if (!locale || !fallbackLocale) {
      throw new Error("Language registry row is missing locale or fallbackLocale.");
    }
    const direction = row?.textDirection;
    const textDirection = direction === "rtl" || direction === "ltr" ? direction : "ltr";
    if (direction !== "rtl" && direction !== "ltr") textDirectionDefaultedLocales.push(locale);
    locales.push({
      locale,
      englishName: stringValue(row?.englishName) ?? locale,
      nativeName: stringValue(row?.nativeName) ?? locale,
      textDirection,
      fallbackLocale,
    });
  }
  return { locales, textDirectionDefaultedLocales };
}

export function selectTargetLocales(registry: readonly LinguisticQualityRegistryLocale[]): {
  readonly canonicalLocale: string;
  readonly targets: readonly LinguisticQualityRegistryLocale[];
} {
  const fallbacks = new Set(registry.map((row) => row.fallbackLocale));
  if (fallbacks.size !== 1) {
    throw new Error("Language registry fallbackLocale values disagree.");
  }
  const canonicalLocale = [...fallbacks][0] ?? "";
  if (!canonicalLocale) throw new Error("Language registry fallbackLocale is empty.");
  return {
    canonicalLocale,
    targets: registry
      .filter((row) => row.locale !== canonicalLocale)
      .sort((left, right) => left.locale.localeCompare(right.locale)),
  };
}

export function glossaryEvidenceFromPreferredTerms(input: {
  readonly preferredByConceptId: ReadonlyMap<string, string> | null;
}): {
  readonly glossary: readonly GlossaryConceptEvidence[];
  readonly unjoinedGlossaryConceptIds: readonly string[];
} {
  const known = new Set(TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS.map((definition) => definition.conceptId));
  const glossary: GlossaryConceptEvidence[] = TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS.map((definition) => {
    if (input.preferredByConceptId == null) {
      return {
        conceptId: definition.conceptId,
        canonicalEnglishTerm: definition.canonicalEnglishTerm,
        preferredTerm: null,
        preferredTermState: "unavailable" as const,
      };
    }
    const preferred = input.preferredByConceptId.get(definition.conceptId)?.trim() ?? "";
    return {
      conceptId: definition.conceptId,
      canonicalEnglishTerm: definition.canonicalEnglishTerm,
      preferredTerm: preferred || null,
      preferredTermState: preferred ? "published" as const : "absent-from-public-map" as const,
    };
  });
  const unjoinedGlossaryConceptIds = input.preferredByConceptId == null
    ? []
    : [...input.preferredByConceptId.keys()].filter((conceptId) => !known.has(conceptId)).sort();
  return { glossary, unjoinedGlossaryConceptIds };
}

export async function loadWebUiLinguisticQualityReport(input: {
  readonly policy: LinguisticQualityPolicy;
  readonly policySha256: string;
  readonly registry: readonly LinguisticQualityRegistryLocale[];
  readonly textDirectionDefaultedLocales?: readonly string[];
  readonly apiBaseUrl?: string;
  readonly fetchImpl?: FetchLike;
  readonly webMessagesDir?: string;
  readonly packagedDir?: string;
  readonly publishedSnapshots?: ReadonlyMap<string, PublishedCatalogSnapshot | null>;
  readonly glossarySnapshots?: ReadonlyMap<string, ReadonlyMap<string, string> | null>;
  readonly brandSnapshots?: ReadonlyMap<string, { readonly siteName: string; readonly source: string } | null>;
  readonly filter?: LinguisticQualityFilter;
  readonly registrySource?: string;
  readonly loadWeb?: (locale: string) => WebUiMessageTree | null;
  readonly loadApi?: (locale: string) => WebUiMessageTree | null;
}): Promise<LinguisticQualityReport> {
  const selected = selectTargetLocales(input.registry);
  const webMessagesDir = input.webMessagesDir ?? path.resolve(here, "../../../../web/src/features/i18n/messages");
  const packagedDir = input.packagedDir ?? path.resolve(here, "../../../assets/packaged-web-ui-catalogs");
  const loadWeb = input.loadWeb ?? loadBundledWebUiMessagePackFromFs;
  const loadApi = input.loadApi ?? loadPackagedWebUiCatalog;
  const englishTree = loadWeb(selected.canonicalLocale);
  if (!englishTree) {
    throw new Error(`Canonical WEB catalog ${selected.canonicalLocale}.json is not available.`);
  }
  const english = flattenWebUiCatalogLeaves(englishTree);
  const packagedEnglish = loadApi(selected.canonicalLocale);
  const englishFoundationMatchesPackaged = packagedEnglish == null
    ? false
    : sameLeaves(english, flattenWebUiCatalogLeaves(packagedEnglish));
  const requiredPaths = [...english.keys()];
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const catalogs: LinguisticQualityCatalog[] = [];
  const unjoined = new Set<string>();
  const publishedSource = input.publishedSnapshots
    ? "supplied-snapshot"
    : input.apiBaseUrl
      ? "public-api"
      : "not-configured";
  const glossarySource = input.glossarySnapshots
    ? "supplied-snapshot"
    : input.apiBaseUrl
      ? "public-api"
      : "not-configured";
  const brandSource = input.brandSnapshots
    ? "supplied-snapshot"
    : input.apiBaseUrl
      ? "public-api"
      : "not-configured";

  for (const locale of selected.targets) {
    const webTree = loadWeb(locale.locale);
    const apiTree = loadApi(locale.locale);
    const published = await resolvePublished(locale.locale, input, fetchImpl);
    const glossary = await resolveGlossary(locale.locale, input, fetchImpl);
    for (const conceptId of glossary.unjoined) unjoined.add(conceptId);
    const brand = await resolveBrand(locale.locale, input, fetchImpl);
    const readiness = published.messages
      ? assessWebUiMessageTreeReadiness({
          messages: published.messages,
          requiredPaths,
          flagEnglishIdenticalAsFallback: false,
        })
      : null;
    catalogs.push({
      locale: locale.locale,
      textDirection: locale.textDirection,
      englishName: locale.englishName,
      nativeName: locale.nativeName,
      web: webTree ? flattenWebUiCatalogLeaves(webTree) : null,
      api: apiTree ? flattenWebUiCatalogLeaves(apiTree) : null,
      published: published.leaves,
      publishedRevision: published.revision,
      publishedStatus: published.status,
      publishedSource: published.source,
      glossaryStatus: glossary.status,
      glossary: glossary.glossary,
      brandStatus: brand.status,
      brandSiteName: brand.siteName,
      brandSource: brand.brandSource,
      readiness,
    });
  }

  const parity = compareWebUiCatalogParity({ webMessagesDir, packagedDir });
  const targetLocales = new Set(selected.targets.map((locale) => locale.locale));
  return buildLinguisticQualityReport({
    policy: input.policy,
    policySha256: input.policySha256,
    canonicalLocale: selected.canonicalLocale,
    english,
    catalogs,
    filter: input.filter,
    provenance: {
      registrySource: input.registrySource ?? "supplied-snapshot",
      publishedSource,
      glossarySource,
      brandSource,
      catalogSource: "repository-catalog-files",
      unjoinedGlossaryConceptIds: [...unjoined].sort(),
      englishFoundationMatchesPackaged,
      webApiParityDiscrepancyCount: parity.discrepancies.filter((item) => targetLocales.has(item.locale)).length,
      textDirectionDefaultedLocales: input.textDirectionDefaultedLocales ?? [],
    },
  });
}

async function resolvePublished(
  locale: string,
  input: {
    readonly apiBaseUrl?: string;
    readonly publishedSnapshots?: ReadonlyMap<string, PublishedCatalogSnapshot | null>;
  },
  fetchImpl: FetchLike,
): Promise<{
  readonly status: "present" | "missing" | "unavailable";
  readonly revision: number | null;
  readonly leaves: ReadonlyMap<string, string> | null;
  readonly messages: WebUiMessageTree | null;
  readonly source: string;
}> {
  if (input.publishedSnapshots) {
    if (!input.publishedSnapshots.has(locale)) {
      return { status: "unavailable", revision: null, leaves: null, messages: null, source: "snapshot-not-supplied" };
    }
    const snapshot = input.publishedSnapshots.get(locale) ?? null;
    if (snapshot == null) {
      return { status: "missing", revision: null, leaves: null, messages: null, source: "supplied-snapshot" };
    }
    return {
      status: "present",
      revision: snapshot.revision,
      leaves: flattenWebUiCatalogLeaves(snapshot.messages),
      messages: snapshot.messages,
      source: "supplied-snapshot",
    };
  }
  if (!input.apiBaseUrl) {
    return { status: "unavailable", revision: null, leaves: null, messages: null, source: "no-published-source" };
  }
  const loaded = await loadPublishedWebUiPackFromPublicApi({
    apiBaseUrl: input.apiBaseUrl,
    locale,
    fetchImpl,
  });
  if (loaded.status === "ok") {
    return {
      status: "present",
      revision: loaded.publishedRevision ?? null,
      leaves: flattenWebUiCatalogLeaves(loaded.messages),
      messages: loaded.messages,
      source: "public-api",
    };
  }
  if (loaded.status === "missing_published_pack") {
    return { status: "missing", revision: null, leaves: null, messages: null, source: "public-api" };
  }
  return { status: "unavailable", revision: null, leaves: null, messages: null, source: "public-api" };
}

async function resolveGlossary(
  locale: string,
  input: {
    readonly apiBaseUrl?: string;
    readonly glossarySnapshots?: ReadonlyMap<string, ReadonlyMap<string, string> | null>;
  },
  fetchImpl: FetchLike,
): Promise<{
  readonly status: "present" | "unavailable";
  readonly source: "present" | "unavailable";
  readonly glossary: readonly GlossaryConceptEvidence[];
  readonly unjoined: readonly string[];
}> {
  let preferred: ReadonlyMap<string, string> | null = null;
  let status: "present" | "unavailable" = "unavailable";
  if (input.glossarySnapshots) {
    if (input.glossarySnapshots.has(locale)) {
      const snapshot = input.glossarySnapshots.get(locale) ?? null;
      if (snapshot) {
        preferred = snapshot;
        status = "present";
      }
    }
  } else if (input.apiBaseUrl) {
    const body = await readPublicJson(
      `${input.apiBaseUrl.replace(/\/$/, "")}/api/v1/terminology-glossary/controlled-lifecycle-preferred-terms?locale=${encodeURIComponent(locale)}`,
      fetchImpl,
    );
    const data = asRecord(asRecord(body)?.data) ?? asRecord(body);
    const terms = asRecord(data?.preferredTermsByConceptId);
    if (terms) {
      preferred = new Map(
        Object.entries(terms).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      );
      status = "present";
    }
  }
  const built = glossaryEvidenceFromPreferredTerms({ preferredByConceptId: preferred });
  return { status, source: status, glossary: built.glossary, unjoined: built.unjoinedGlossaryConceptIds };
}

async function resolveBrand(
  locale: string,
  input: {
    readonly apiBaseUrl?: string;
    readonly brandSnapshots?: ReadonlyMap<string, { readonly siteName: string; readonly source: string } | null>;
  },
  fetchImpl: FetchLike,
): Promise<{
  readonly status: "present" | "unavailable";
  readonly siteName: string | null;
  readonly brandSource: string | null;
  readonly source: "present" | "unavailable";
}> {
  if (input.brandSnapshots) {
    const snapshot = input.brandSnapshots.get(locale) ?? null;
    if (!input.brandSnapshots.has(locale) || snapshot == null) {
      return { status: "unavailable", siteName: null, brandSource: null, source: "unavailable" };
    }
    return { status: "present", siteName: snapshot.siteName, brandSource: snapshot.source, source: "present" };
  }
  if (!input.apiBaseUrl) {
    return { status: "unavailable", siteName: null, brandSource: null, source: "unavailable" };
  }
  const body = await readPublicJson(
    `${input.apiBaseUrl.replace(/\/$/, "")}/api/v1/brand-localization?locale=${encodeURIComponent(locale)}`,
    fetchImpl,
  );
  const data = asRecord(asRecord(body)?.data) ?? asRecord(body);
  const siteName = stringValue(data?.siteName);
  if (!siteName) {
    return { status: "unavailable", siteName: null, brandSource: null, source: "unavailable" };
  }
  return {
    status: "present",
    siteName,
    brandSource: stringValue(data?.source),
    source: "present",
  };
}

async function readPublicJson(url: string, fetchImpl: FetchLike): Promise<unknown | null> {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    return JSON.parse(await response.text()) as unknown;
  } catch {
    return null;
  }
}

function sameLeaves(left: ReadonlyMap<string, string>, right: ReadonlyMap<string, string>): boolean {
  if (left.size !== right.size) return false;
  for (const [key, value] of left) {
    if (right.get(key) !== value) return false;
  }
  return true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
