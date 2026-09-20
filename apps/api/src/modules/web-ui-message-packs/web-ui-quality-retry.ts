/**
 * Terminology-aware WEB_UI quality retry for suspicious English-identical leaves.
 *
 * Uses a separate checkpoint so the primary draft checkpoint stays valid.
 * Does not import, publish, or activate.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { LanguageCode, WebUiMessageTree } from "@hu/types";

import { extractJsonObjectText } from "../language/media-plp-materializer/provider-response-contract.js";
import type { TranslationProviderRequest, TranslationProviderResult } from "../language/translation-provider.js";
import { TranslationProviderError } from "../language/translation.config.js";
import {
  classifyEnglishIdenticalWebUiTree,
  type WebUiIdenticalClassification,
} from "./web-ui-identical-classification.js";
import {
  collectStringPaths,
  inspectMessageStructure,
  loadBundledEnglishWebUiMessagePack,
  selectEnglishWebUiMessages,
} from "./web-ui-message-pack.validate.js";
import {
  protectWebUiMessageForProvider,
  restoreWebUiMessageFromProvider,
} from "./web-ui-message-structure-protect.js";
import {
  OFFLINE_WEB_UI_PROVIDER_TIMEOUT_MS,
  assertCompletePublicWebUiDraft,
  canonicalizeWebUiDraftLocale,
  planWebUiDraftBatches,
  resolveOfflineWebUiProviderTimeoutMs,
  WebUiDraftBatchError,
  WebUiDraftBuilderError,
  type WebUiDraftTextDirection,
} from "./web-ui-draft-builder.js";

const SOURCE_NOTE = "offline WEB_UI draft; quality-retried; not published";
const DEFAULT_RETRY_DELAY_MS = 1_500;

type QualityManifest = {
  readonly locale: string;
  readonly phase: "quality-retry";
  readonly parentArtifactPath: string;
  readonly parentSourceHash: string;
  readonly terminologyMode: "live";
  readonly suspiciousPathCount: number;
  readonly retriedPathCount: number;
  readonly completedBatchCount: number;
  readonly failedBatchCount: number;
  readonly acceptedTechnicalCount: number;
  readonly suspiciousRemainingCount: number;
  readonly provider: string | null;
  readonly model: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WebUiQualityRetryResult = {
  readonly mode: "dry-run" | "execute";
  readonly locale: string;
  readonly suspiciousPathCount: number;
  readonly retriedPathCount: number;
  readonly providerCalls: number;
  readonly artifactPath: string | null;
  readonly acceptedTechnical: readonly WebUiIdenticalClassification[];
  readonly suspiciousRemaining: readonly WebUiIdenticalClassification[];
};

export type WebUiQualityRetryInput = {
  readonly argv?: readonly string[];
  readonly locale?: string;
  readonly execute?: boolean;
  readonly englishName?: string;
  readonly nativeName?: string;
  readonly textDirection?: WebUiDraftTextDirection;
  readonly translator?: (request: TranslationProviderRequest) => Promise<TranslationProviderResult>;
  readonly outRoot?: string;
  readonly preferredEnglishSurfaces?: ReadonlyMap<string, string>;
  readonly loadPreferredEnglishSurfaces?: (locale: string) => Promise<ReadonlyMap<string, string>>;
  readonly loadLiveTerminology?: (locale: string) => Promise<string>;
  readonly retryDelayMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly env?: {
    readonly TRANSLATION_PROVIDER?: string;
    readonly HU_READ_ONLY_DIAGNOSTIC?: string;
  };
  readonly model?: string;
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

function repoTmpRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../../..", "tmp");
}

function readPath(messages: Record<string, unknown>, dottedPath: string): unknown {
  let current: unknown = messages;
  for (const segment of dottedPath.split(".")) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function unflatten(flat: Readonly<Record<string, string>>): WebUiMessageTree {
  const root: Record<string, unknown> = {};
  for (const [dottedPath, value] of Object.entries(flat)) {
    const segments = dottedPath.split(".");
    let current = root;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index]!;
      const next = current[segment];
      if (next == null || typeof next !== "object" || Array.isArray(next)) {
        current[segment] = {};
      }
      current = current[segment] as Record<string, unknown>;
    }
    current[segments[segments.length - 1]!] = value;
  }
  return root as WebUiMessageTree;
}

function flattenTree(messages: WebUiMessageTree): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pathKey of collectStringPaths(messages)) {
    const value = readPath(messages as Record<string, unknown>, pathKey);
    if (typeof value === "string") {
      out[pathKey] = value;
    }
  }
  return out;
}

function hashFlat(flat: Readonly<Record<string, string>>): string {
  const hash = createHash("sha256");
  for (const key of Object.keys(flat).sort()) {
    hash.update(key);
    hash.update("\0");
    hash.update(flat[key] ?? "");
    hash.update("\0");
  }
  return hash.digest("hex");
}

function parseTranslations(raw: string): Map<string, string> {
  const extracted = extractJsonObjectText(raw);
  if (!extracted.ok) {
    throw new WebUiDraftBatchError("Provider response was not a JSON object.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted.text);
  } catch {
    throw new WebUiDraftBatchError("Provider response JSON could not be parsed.");
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new WebUiDraftBatchError("Provider response JSON root was not an object.");
  }
  const root = parsed as Record<string, unknown>;
  if (Array.isArray(root.translations)) {
    const map = new Map<string, string>();
    for (const row of root.translations) {
      if (row == null || typeof row !== "object" || Array.isArray(row)) {
        throw new WebUiDraftBatchError("Provider translation row was not an object.");
      }
      const key = (row as { key?: unknown }).key;
      const value = (row as { value?: unknown }).value;
      if (typeof key !== "string" || typeof value !== "string") {
        throw new WebUiDraftBatchError("Provider translation row must have string key and value.");
      }
      map.set(key, value);
    }
    return map;
  }
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(root)) {
    if (typeof value !== "string") {
      throw new WebUiDraftBatchError(`Provider translation value for ${key} must be a string.`);
    }
    map.set(key, value);
  }
  return map;
}

function assertStructureMatches(english: string, localized: string): void {
  const source = inspectMessageStructure(english);
  const target = inspectMessageStructure(localized);
  if (!target.balanced) {
    throw new WebUiDraftBatchError("Localized message braces are unbalanced.");
  }
  if ([...target.placeholders].sort().join("\0") !== [...source.placeholders].sort().join("\0")) {
    throw new WebUiDraftBatchError("Localized placeholders do not match English.");
  }
  if ([...target.richTags].sort().join("\0") !== [...source.richTags].sort().join("\0")) {
    throw new WebUiDraftBatchError("Localized rich-text tags do not match English.");
  }
}

async function defaultPreferredSurfaces(locale: string): Promise<ReadonlyMap<string, string>> {
  const module = await import("../language/terminology-glossary/terminology-glossary.provider-context.js");
  const repo = await import("../language/terminology-glossary/terminology-glossary.repository.js");
  await repo.ensureTerminologyGlossarySeeded();
  const concepts = await repo.listTerminologyConcepts();
  const lines = module.listPublishedProviderTerminologyLines(concepts, locale);
  const map = new Map<string, string>();
  for (const line of lines) {
    if (!line.usedEnglishFallback) {
      map.set(line.canonicalEnglishTerm, line.preferredTerm);
    }
  }
  return map;
}

async function defaultLiveTerminology(locale: string): Promise<string> {
  const module = await import("../language/terminology-glossary/terminology-glossary.provider-context.js");
  return module.resolveProviderTerminologyContext(locale);
}

export async function runWebUiQualityRetry(
  input: WebUiQualityRetryInput = {},
): Promise<WebUiQualityRetryResult> {
  const argv = input.argv ?? [];
  const execute = input.execute ?? argv.includes("--execute");
  const locale = canonicalizeWebUiDraftLocale(input.locale ?? readFlag(argv, "--locale") ?? "");
  const englishName = (input.englishName ?? readFlag(argv, "--english-name") ?? locale).trim();
  const nativeName = (input.nativeName ?? readFlag(argv, "--native-name") ?? locale).trim();
  const textDirectionRaw = input.textDirection ?? readFlag(argv, "--text-direction") ?? "ltr";
  if (textDirectionRaw !== "ltr" && textDirectionRaw !== "rtl") {
    throw new WebUiDraftBuilderError("textDirection must be ltr or rtl.");
  }
  const textDirection = textDirectionRaw;
  const log = input.log ?? ((line: string) => console.log(line));
  const now = input.now ?? (() => new Date().toISOString());
  const outRoot = input.outRoot ?? repoTmpRoot();
  const parentArtifactPath = path.join(outRoot, `web-ui-${locale}-draft.json`);
  const parentSourcePath = path.join(outRoot, `web-ui-${locale}-draft`, "source.json");
  if (!existsSync(parentArtifactPath)) {
    throw new WebUiDraftBuilderError(`Primary draft artifact not found: ${parentArtifactPath}`);
  }
  const artifact = JSON.parse(readFileSync(parentArtifactPath, "utf8")) as {
    locale: string;
    status: string;
    sourceNote?: string;
    messages: WebUiMessageTree;
  };
  if (artifact.locale !== locale || artifact.status !== "draft") {
    throw new WebUiDraftBuilderError("Primary draft artifact locale/status is invalid for quality retry.");
  }
  const prepared = selectEnglishWebUiMessages("public");
  const english = loadBundledEnglishWebUiMessagePack();
  const englishFlat: Record<string, string> = {};
  for (const pathKey of prepared.selectedPaths) {
    const value = readPath(prepared.messages as Record<string, unknown>, pathKey);
    const canonical = readPath(english, pathKey);
    if (typeof value === "string" && value === canonical) {
      englishFlat[pathKey] = value;
    }
  }
  const localizedFlat = flattenTree(artifact.messages);
  const preferredEnglishSurfaces =
    input.preferredEnglishSurfaces ??
    (await (input.loadPreferredEnglishSurfaces ?? defaultPreferredSurfaces)(locale));
  const classified = classifyEnglishIdenticalWebUiTree({
    englishFlat,
    localizedFlat,
    preferredEnglishSurfaces,
  });
  const suspiciousPaths = classified.suspiciousHuman.map((row) => row.path);
  const parentSourceHash = existsSync(parentSourcePath)
    ? ((JSON.parse(readFileSync(parentSourcePath, "utf8")) as { sourceHash?: string }).sourceHash ??
      hashFlat(englishFlat))
    : hashFlat(englishFlat);

  if (!execute) {
    log(
      [
        "WEB_UI quality-retry dry-run",
        `locale: ${locale}`,
        `suspicious: ${suspiciousPaths.length}`,
        `acceptedTechnical: ${classified.acceptedTechnical.length}`,
        "terminology: live",
        "provider calls: 0",
        `primaryCheckpointUntouched: true`,
      ].join("\n"),
    );
    return {
      mode: "dry-run",
      locale,
      suspiciousPathCount: suspiciousPaths.length,
      retriedPathCount: 0,
      providerCalls: 0,
      artifactPath: null,
      acceptedTechnical: classified.acceptedTechnical,
      suspiciousRemaining: classified.suspiciousHuman,
    };
  }

  const envProvider = input.env?.TRANSLATION_PROVIDER ?? process.env.TRANSLATION_PROVIDER;
  const envDiagnostic = input.env?.HU_READ_ONLY_DIAGNOSTIC ?? process.env.HU_READ_ONLY_DIAGNOSTIC;
  if (envDiagnostic === "1") {
    throw new WebUiDraftBuilderError("REFUSED: read-only diagnostic cannot call the translation provider.");
  }
  if (envProvider?.trim().toLowerCase() !== "gemini") {
    throw new WebUiDraftBuilderError("REFUSED: --execute requires TRANSLATION_PROVIDER=gemini.");
  }

  let translator = input.translator;
  let providerLabel = input.translator ? "injected" : "gemini";
  let modelLabel = input.model ?? (input.translator ? "injected" : "");
  if (!translator) {
    const { assertGeminiTranslationConfigured, resolveTranslationConfig } = await import(
      "../language/translation.config.js"
    );
    const { GeminiTranslationProvider } = await import(
      "../language/providers/gemini-translation-provider.js"
    );
    const config = resolveTranslationConfig();
    if (config.provider !== "gemini") {
      throw new WebUiDraftBuilderError("REFUSED: --execute requires TRANSLATION_PROVIDER=gemini.");
    }
    assertGeminiTranslationConfigured(config);
    modelLabel = config.geminiModel;
    const provider = new GeminiTranslationProvider({
      ...config,
      timeoutMs: resolveOfflineWebUiProviderTimeoutMs(config.timeoutMs),
    });
    translator = (request) => provider.translate(request);
  }

  const qualityDir = path.join(outRoot, `web-ui-${locale}-quality`);
  const batchDir = path.join(qualityDir, "batches");
  mkdirSync(batchDir, { recursive: true });
  const glossary = await (input.loadLiveTerminology ?? defaultLiveTerminology)(locale);
  const terminologyContext = [
    "WEB_UI catalog quality-retry rules:",
    `Target locale: ${locale}.`,
    `English language name: ${englishName}.`,
    `Native language name: ${nativeName}.`,
    `Text direction: ${textDirection}.`,
    "Translate human-facing English that remained identical to the source.",
    "Use authoritative target-language preferred terminology consistently in exact labels, compounds, sentences, and ICU branches.",
    "Do not leave unchanged human-facing English unless it is genuinely a code, proper identifier, URL, acronym, numeric literal, or other intentionally untranslated token.",
    "Values may contain protection sentinels such as ⟦w0⟧.",
    "Copy every sentinel exactly. Do not translate, reorder, split, or drop sentinels.",
    "The user message is one flat JSON object. Preserve every JSON key exactly.",
    "Glossary:",
    glossary.trim(),
  ].join("\n");

  const suspiciousFlat = Object.fromEntries(
    suspiciousPaths.map((pathKey) => [pathKey, englishFlat[pathKey] ?? ""]),
  );
  const batches = planWebUiDraftBatches(suspiciousFlat);
  const working = { ...localizedFlat };
  let providerCalls = 0;
  let completedBatchCount = 0;
  let failedBatchCount = 0;
  const sleep = input.sleep ?? (async (ms: number) => {
    if (ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  });
  const retryDelayMs = input.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const createdAt = now();

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index]!;
    const batchPath = path.join(batchDir, `${batch.id}.json`);
    let attempt = 0;
    let done = false;
    let lastReason = "Quality batch failed.";
    while (attempt < 2 && !done) {
      attempt += 1;
      try {
        const payloadObject: Record<string, string> = {};
        for (const key of batch.keys) {
          payloadObject[key] = protectWebUiMessageForProvider(englishFlat[key] ?? "").text;
        }
        providerCalls += 1;
        const result = await translator({
          sourceLanguage: "en",
          targetLanguage: locale as LanguageCode,
          text: JSON.stringify(payloadObject),
          contentType: "structured_json",
          terminologyContext,
          safetyCleared: true,
        });
        const returned = parseTranslations(result.translatedText);
        const missing = batch.keys.filter((key) => !returned.has(key));
        if (missing.length > 0) {
          throw new WebUiDraftBatchError(`Provider omitted keys: ${missing.slice(0, 8).join(", ")}`);
        }
        const extra = [...returned.keys()].filter((key) => !batch.keys.includes(key));
        if (extra.length > 0) {
          throw new WebUiDraftBatchError(`Provider returned unexpected keys: ${extra.slice(0, 8).join(", ")}`);
        }
        for (const key of batch.keys) {
          const restored = restoreWebUiMessageFromProvider(returned.get(key) ?? "", englishFlat[key] ?? "");
          assertStructureMatches(englishFlat[key] ?? "", restored);
          working[key] = restored;
        }
        done = true;
        log(`[${index + 1}/${batches.length}] ${batch.namespace} — ok`);
      } catch (error) {
        lastReason = error instanceof Error ? error.message : "Quality batch failed.";
        const nonRetryable =
          error instanceof TranslationProviderError &&
          (error.code === "safety_rejected" ||
            error.code === "not_configured" ||
            error.code === "forbidden" ||
            error.code === "unsupported_language");
        if (nonRetryable || attempt >= 2) {
          failedBatchCount += 1;
          writeFileSync(
            batchPath,
            `${JSON.stringify({ id: batch.id, keys: batch.keys, status: "failed", attempts: attempt, reason: lastReason }, null, 2)}\n`,
          );
          log(`[${index + 1}/${batches.length}] ${batch.namespace} — failed`);
          throw new WebUiDraftBuilderError(lastReason);
        }
        log(`[${index + 1}/${batches.length}] ${batch.namespace} — retry`);
        await sleep(retryDelayMs);
      }
    }
    writeFileSync(
      batchPath,
      `${JSON.stringify({ id: batch.id, keys: batch.keys, status: "ok", attempts: attempt }, null, 2)}\n`,
    );
    completedBatchCount += 1;
  }

  const messages = unflatten(working);
  const presentPaths = Object.keys(working).sort();
  assertCompletePublicWebUiDraft({
    messages,
    requiredPaths: presentPaths,
  });
  writeFileSync(
    parentArtifactPath,
    `${JSON.stringify({ locale, status: "draft", sourceNote: SOURCE_NOTE, messages }, null, 2)}\n`,
  );
  const recomputed = classifyEnglishIdenticalWebUiTree({
    englishFlat,
    localizedFlat: flattenTree(messages),
    preferredEnglishSurfaces,
  });
  const manifest: QualityManifest = {
    locale,
    phase: "quality-retry",
    parentArtifactPath,
    parentSourceHash,
    terminologyMode: "live",
    suspiciousPathCount: suspiciousPaths.length,
    retriedPathCount: suspiciousPaths.length,
    completedBatchCount,
    failedBatchCount,
    acceptedTechnicalCount: recomputed.acceptedTechnical.length,
    suspiciousRemainingCount: recomputed.suspiciousHuman.length,
    provider: providerLabel,
    model: modelLabel || null,
    createdAt,
    updatedAt: now(),
  };
  writeFileSync(path.join(qualityDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  log(
    [
      "WEB_UI quality-retry complete",
      `locale: ${locale}`,
      `retried: ${suspiciousPaths.length}`,
      `acceptedIdentical: ${recomputed.acceptedTechnical.length}`,
      `suspiciousIdentical: ${recomputed.suspiciousHuman.length}`,
      `artifact: ${parentArtifactPath}`,
      `offlineTimeoutFloorMs: ${OFFLINE_WEB_UI_PROVIDER_TIMEOUT_MS}`,
    ].join("\n"),
  );
  return {
    mode: "execute",
    locale,
    suspiciousPathCount: suspiciousPaths.length,
    retriedPathCount: suspiciousPaths.length,
    providerCalls,
    artifactPath: parentArtifactPath,
    acceptedTechnical: recomputed.acceptedTechnical,
    suspiciousRemaining: recomputed.suspiciousHuman,
  };
}
