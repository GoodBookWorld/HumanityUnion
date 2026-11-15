/**
 * Read-only WEB_UI pre-release gate.
 *
 * Compares the English foundation to locale catalogs and reports public,
 * participant, and full-catalog readiness. Does not publish, translate,
 * write Registry/CT, or call Gemini.
 *
 * Live release checks must use the release target's published packs
 * (e.g. public API). Packaged filesystem catalogs are never treated as
 * published Mongo authority.
 */

import {
  isParticipantWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
  type LanguageWebUiReadinessSlice,
  type WebUiMessageTree,
} from "@hu/types";

import { assessWebUiMessageTreeReadiness } from "../language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import {
  collectStringPaths,
  describeStructureMismatch,
  loadBundledEnglishWebUiMessagePack,
} from "./web-ui-message-pack.validate.js";

type MessagePack = Record<string, unknown>;

function readPathValue(messages: MessagePack, dottedPath: string): unknown {
  let current: unknown = messages;
  for (const segment of dottedPath.split(".")) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Readiness against an explicit English path set (for injected test foundations).
 * Avoids validateWebUiMessageTreeAgainstEnglish, which always loads bundled EN.
 */
function assessAgainstExplicitEnglishPaths(input: {
  readonly messages: WebUiMessageTree;
  readonly english: WebUiMessageTree;
  readonly requiredPaths: readonly string[];
}): LanguageWebUiReadinessSlice {
  const target = input.messages as MessagePack;
  const english = input.english as MessagePack;
  let missingKeyCount = 0;
  let emptyKeyCount = 0;
  let structuralInvalidCount = 0;
  const sampleMissingPaths: string[] = [];

  for (const pathKey of input.requiredPaths) {
    const englishValue = readPathValue(english, pathKey);
    const value = readPathValue(target, pathKey);
    if (value === undefined || typeof value !== "string") {
      missingKeyCount += 1;
      if (sampleMissingPaths.length < 12) sampleMissingPaths.push(pathKey);
      continue;
    }
    if (value.trim().length === 0) {
      emptyKeyCount += 1;
      if (sampleMissingPaths.length < 12) sampleMissingPaths.push(pathKey);
      continue;
    }
    if (typeof englishValue === "string") {
      const mismatch = describeStructureMismatch(englishValue, value);
      if (mismatch) {
        structuralInvalidCount += 1;
        if (sampleMissingPaths.length < 12) sampleMissingPaths.push(pathKey);
      }
    }
  }

  return {
    engineReady: true,
    dataReady: missingKeyCount === 0 && emptyKeyCount === 0 && structuralInvalidCount === 0,
    requiredKeyCount: input.requiredPaths.length,
    missingKeyCount,
    emptyKeyCount,
    englishFallbackKeyCount: 0,
    sampleMissingPaths,
    structuralInvalidCount,
  };
}

export type WebUiReleaseGateSourceKind =
  | "live-public-api"
  | "local-catalog-injection"
  | "local-packaged-diagnostic"
  /** Candidate packaged catalogs in the release tree — not published Mongo. */
  | "candidate-packaged";

/**
 * Enabled Production WEB_UI locales gated for candidate packaged coverage.
 * Used when --locales is omitted for --source candidate-packaged.
 * Not derived from a live API call (avoids false PASS / coupling to deploy state).
 */
export const PRODUCTION_WEB_UI_CANDIDATE_LOCALES = [
  "ar",
  "de",
  "en",
  "es",
  "fr",
  "he",
  "ka",
  "pt",
  "uk",
  "zh-Hant",
] as const;

export type WebUiReleaseGateLocaleCatalogStatus =
  | "ok"
  | "missing_published_pack"
  | "source_unavailable"
  | "english_foundation";

export type WebUiReleaseGateLocaleResult = {
  readonly locale: string;
  readonly catalogStatus: WebUiReleaseGateLocaleCatalogStatus;
  readonly sourceKind: WebUiReleaseGateSourceKind;
  /** Published revision when known from live/public pack payload. */
  readonly publishedRevision: number | null;
  readonly public: LanguageWebUiReadinessSlice | null;
  readonly participant: LanguageWebUiReadinessSlice | null;
  readonly full: LanguageWebUiReadinessSlice | null;
  readonly missingKeySamples: readonly string[];
  readonly pass: boolean;
  readonly detail: string;
};

export type WebUiReleaseGateReport = {
  readonly sourceKind: WebUiReleaseGateSourceKind;
  readonly englishKeyCount: number;
  readonly requiredLocales: readonly string[];
  readonly locales: readonly WebUiReleaseGateLocaleResult[];
  readonly pass: boolean;
  readonly failedLocales: readonly string[];
};

export type WebUiReleaseGateCatalogLoad =
  | {
      readonly status: "ok";
      readonly messages: WebUiMessageTree;
      readonly publishedRevision?: number | null;
    }
  | { readonly status: "missing_published_pack" }
  | { readonly status: "source_unavailable"; readonly reason: string };

export class WebUiReleaseGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebUiReleaseGateError";
  }
}

function isEnglishFoundationLocale(locale: string): boolean {
  return locale.trim().toLowerCase() === "en";
}

/**
 * Assess one locale catalog tree (or absence) against the English foundation.
 * Reuses assessWebUiMessageTreeReadiness for public / participant / full scopes.
 */
export function assessWebUiReleaseGateLocale(input: {
  readonly locale: string;
  readonly sourceKind: WebUiReleaseGateSourceKind;
  readonly catalog: WebUiReleaseGateCatalogLoad;
  readonly loadEnglishFoundation?: () => WebUiMessageTree;
}): WebUiReleaseGateLocaleResult {
  const locale = input.locale.trim();
  if (!locale) {
    throw new WebUiReleaseGateError("locale is required.");
  }

  if (isEnglishFoundationLocale(locale)) {
    return {
      locale,
      catalogStatus: "english_foundation",
      sourceKind: input.sourceKind,
      publishedRevision: null,
      public: null,
      participant: null,
      full: null,
      missingKeySamples: [],
      pass: true,
      detail: "English is the WEB_UI foundation source; pack completeness is not gated.",
    };
  }

  if (input.catalog.status === "source_unavailable") {
    return {
      locale,
      catalogStatus: "source_unavailable",
      sourceKind: input.sourceKind,
      publishedRevision: null,
      public: null,
      participant: null,
      full: null,
      missingKeySamples: [],
      pass: false,
      detail: `Source unavailable (fail closed): ${input.catalog.reason}`,
    };
  }

  if (input.catalog.status === "missing_published_pack") {
    return {
      locale,
      catalogStatus: "missing_published_pack",
      sourceKind: input.sourceKind,
      publishedRevision: null,
      public: null,
      participant: null,
      full: null,
      missingKeySamples: ["(no published WEB_UI pack)"],
      pass: false,
      detail:
        input.sourceKind === "local-packaged-diagnostic"
          ? "No packaged catalog file for locale (diagnostic only; packaged ≠ published)."
          : input.sourceKind === "candidate-packaged"
            ? "No packaged catalog file for locale in this candidate (candidate ≠ live published)."
            : "No published WEB_UI pack for locale.",
    };
  }

  let english: WebUiMessageTree;
  try {
    english = (input.loadEnglishFoundation?.() ??
      loadBundledEnglishWebUiMessagePack()) as WebUiMessageTree;
  } catch {
    return {
      locale,
      catalogStatus: "source_unavailable",
      sourceKind: input.sourceKind,
      publishedRevision: null,
      public: null,
      participant: null,
      full: null,
      missingKeySamples: ["(english foundation catalog missing)"],
      pass: false,
      detail: "English foundation catalog unavailable (fail closed).",
    };
  }

  // Bind required paths to this run's English foundation (fixture or bundled EN).
  const fullPaths = collectStringPaths(english as never);
  const publicPaths = fullPaths.filter((pathKey) => isPublicReaderWebUiRequiredPath(pathKey));
  const participantPaths = fullPaths.filter((pathKey) => isParticipantWebUiRequiredPath(pathKey));

  const useInjectedEnglish = typeof input.loadEnglishFoundation === "function";
  const publicReady = useInjectedEnglish
    ? assessAgainstExplicitEnglishPaths({
        messages: input.catalog.messages,
        english,
        requiredPaths: publicPaths,
      })
    : assessWebUiMessageTreeReadiness({
        messages: input.catalog.messages,
        requiredPaths: publicPaths,
      });
  const participantReady = useInjectedEnglish
    ? assessAgainstExplicitEnglishPaths({
        messages: input.catalog.messages,
        english,
        requiredPaths: participantPaths,
      })
    : assessWebUiMessageTreeReadiness({
        messages: input.catalog.messages,
        requiredPaths: participantPaths,
      });
  const fullReady = useInjectedEnglish
    ? assessAgainstExplicitEnglishPaths({
        messages: input.catalog.messages,
        english,
        requiredPaths: fullPaths,
      })
    : assessWebUiMessageTreeReadiness({
        messages: input.catalog.messages,
        requiredPaths: fullPaths,
      });

  const samples = [
    ...fullReady.sampleMissingPaths,
    ...publicReady.sampleMissingPaths,
    ...participantReady.sampleMissingPaths,
  ];
  const missingKeySamples = [...new Set(samples)].slice(0, 24);
  const pass =
    publicReady.dataReady === true &&
    participantReady.dataReady === true &&
    fullReady.dataReady === true;

  const parts = [
    `public ready=${publicReady.dataReady} missing=${publicReady.missingKeyCount}/${publicReady.requiredKeyCount}`,
    `participant ready=${participantReady.dataReady} missing=${participantReady.missingKeyCount}/${participantReady.requiredKeyCount}`,
    `full ready=${fullReady.dataReady} missing=${fullReady.missingKeyCount}/${fullReady.requiredKeyCount}`,
  ];
  if (missingKeySamples.length > 0 && !pass) {
    parts.push(`samples: ${missingKeySamples.slice(0, 8).join(", ")}`);
  }

  return {
    locale,
    catalogStatus: "ok",
    sourceKind: input.sourceKind,
    publishedRevision:
      input.catalog.publishedRevision === undefined ? null : input.catalog.publishedRevision,
    public: publicReady,
    participant: participantReady,
    full: fullReady,
    missingKeySamples,
    pass,
    detail: parts.join("; "),
  };
}

/**
 * Run the gate for a set of required locales using an injected catalog loader.
 * Loader must return the release-target catalog source (published packs for live).
 */
export function runWebUiReleaseGate(input: {
  readonly sourceKind: WebUiReleaseGateSourceKind;
  readonly requiredLocales: readonly string[];
  readonly loadCatalog: (locale: string) => WebUiReleaseGateCatalogLoad;
  readonly loadEnglishFoundation?: () => WebUiMessageTree;
}): WebUiReleaseGateReport {
  const requiredLocales = [
    ...new Set(input.requiredLocales.map((locale) => locale.trim()).filter(Boolean)),
  ];
  if (requiredLocales.length === 0) {
    throw new WebUiReleaseGateError("At least one required locale is needed.");
  }

  let englishKeyCount = 0;
  try {
    const english = input.loadEnglishFoundation?.() ?? loadBundledEnglishWebUiMessagePack();
    englishKeyCount = collectStringPaths(english as never).length;
  } catch {
    englishKeyCount = 0;
  }

  const locales = requiredLocales.map((locale) =>
    assessWebUiReleaseGateLocale({
      locale,
      sourceKind: input.sourceKind,
      catalog: isEnglishFoundationLocale(locale)
        ? { status: "ok", messages: {} }
        : input.loadCatalog(locale),
      loadEnglishFoundation: input.loadEnglishFoundation,
    }),
  );

  const failedLocales = locales.filter((entry) => !entry.pass).map((entry) => entry.locale);
  return {
    sourceKind: input.sourceKind,
    englishKeyCount,
    requiredLocales,
    locales,
    pass: failedLocales.length === 0 && englishKeyCount > 0,
    failedLocales,
  };
}

export type WebUiReleaseGatePublicFetch = (
  url: string,
) => Promise<{ readonly ok: boolean; readonly status: number; readonly text: () => Promise<string> }>;

/**
 * Load published pack via public API (no Admin auth).
 * 404 → missing_published_pack; transport/parse errors → source_unavailable.
 */
export async function loadPublishedWebUiPackFromPublicApi(input: {
  readonly apiBaseUrl: string;
  readonly locale: string;
  readonly fetchImpl?: WebUiReleaseGatePublicFetch;
}): Promise<WebUiReleaseGateCatalogLoad> {
  const base = input.apiBaseUrl.replace(/\/$/, "");
  const locale = encodeURIComponent(input.locale.trim());
  const url = `${base}/api/v1/web-ui-message-packs?locale=${locale}`;
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    return { status: "source_unavailable", reason: "fetch is not available in this runtime." };
  }

  let response: { ok: boolean; status: number; text: () => Promise<string> };
  try {
    response = await fetchImpl(url);
  } catch (error) {
    return {
      status: "source_unavailable",
      reason: error instanceof Error ? error.message : "public pack request failed",
    };
  }

  if (response.status === 404) {
    return { status: "missing_published_pack" };
  }
  if (!response.ok) {
    return {
      status: "source_unavailable",
      reason: `public pack HTTP ${response.status}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await response.text());
  } catch {
    return { status: "source_unavailable", reason: "public pack response is not JSON" };
  }

  const root = parsed as Record<string, unknown>;
  const payload =
    root.data != null && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const messages = payload.messages;
  if (messages == null || typeof messages !== "object" || Array.isArray(messages)) {
    return { status: "source_unavailable", reason: "public pack payload missing messages" };
  }
  const revision =
    typeof payload.revision === "number" && Number.isInteger(payload.revision)
      ? payload.revision
      : null;
  return {
    status: "ok",
    messages: messages as WebUiMessageTree,
    publishedRevision: revision,
  };
}

/**
 * List enabled public locales from GET /api/v1/languages (no Admin auth).
 * Fail closed on transport/parse errors.
 */
export async function listEnabledLocalesFromPublicApi(input: {
  readonly apiBaseUrl: string;
  readonly fetchImpl?: WebUiReleaseGatePublicFetch;
}): Promise<{ readonly ok: true; readonly locales: readonly string[] } | { readonly ok: false; readonly reason: string }> {
  const base = input.apiBaseUrl.replace(/\/$/, "");
  const url = `${base}/api/v1/languages`;
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    return { ok: false, reason: "fetch is not available in this runtime." };
  }
  let response: { ok: boolean; status: number; text: () => Promise<string> };
  try {
    response = await fetchImpl(url);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "languages request failed",
    };
  }
  if (!response.ok) {
    return { ok: false, reason: `languages HTTP ${response.status}` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await response.text());
  } catch {
    return { ok: false, reason: "languages response is not JSON" };
  }
  const root = parsed as Record<string, unknown>;
  const data =
    root.data != null && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const languages = data.languages;
  if (!Array.isArray(languages)) {
    return { ok: false, reason: "languages payload missing languages array" };
  }
  const locales: string[] = [];
  for (const entry of languages) {
    if (entry == null || typeof entry !== "object") continue;
    const locale = (entry as { locale?: unknown }).locale;
    if (typeof locale === "string" && locale.trim()) {
      locales.push(locale.trim());
    }
  }
  if (locales.length === 0) {
    return { ok: false, reason: "no enabled locales returned" };
  }
  return { ok: true, locales };
}

/** Format a gate report for CLI / CI logs. */
export function formatWebUiReleaseGateReport(report: WebUiReleaseGateReport): string {
  const lines = [
    `WEB_UI release gate`,
    `sourceKind: ${report.sourceKind}`,
    `englishKeys: ${report.englishKeyCount}`,
    `requiredLocales: ${report.requiredLocales.join(", ")}`,
    `result: ${report.pass ? "PASS" : "FAIL"}`,
  ];
  if (report.sourceKind === "local-packaged-diagnostic") {
    lines.push(
      "NOTE: local-packaged-diagnostic is NOT published Mongo authority. Do not treat PASS here as live release readiness.",
    );
  }
  if (report.sourceKind === "candidate-packaged") {
    lines.push(
      "NOTE: candidate-packaged checks release-tree packaged catalogs only. PASS here is not live published readiness — still run --source live-public-api against the deploy target after Admin add-missing.",
    );
  }
  for (const locale of report.locales) {
    lines.push(
      [
        `- ${locale.locale}: ${locale.pass ? "PASS" : "FAIL"}`,
        `status=${locale.catalogStatus}`,
        locale.publishedRevision != null ? `rev=${locale.publishedRevision}` : null,
        locale.detail,
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }
  if (!report.pass) {
    lines.push(`failedLocales: ${report.failedLocales.join(", ") || "(none listed)"}`);
  }
  return lines.join("\n");
}
