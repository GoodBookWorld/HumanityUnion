/**
 * Offline WEB_UI draft builder.
 *
 * Calls TranslationProvider.translate directly. Does not import, publish,
 * activate, or write ContentTranslation, Civic Media, Registry, or Mongo cooldown.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isPublicReaderWebUiRequiredPath,
  type LanguageCode,
  type WebUiMessageTree,
} from "@hu/types";

import { extractJsonObjectText, planPlpProviderBatches } from "../language/media-plp-materializer/provider-response-contract.js";
import { HUMANITY_UNION_TRANSLATION_TERMINOLOGY } from "../language/hu-terminology-glossary.js";
import type { TranslationProviderRequest, TranslationProviderResult } from "../language/translation-provider.js";
import { TranslationProviderError } from "../language/translation.config.js";
import {
  collectStringPaths,
  inspectMessageStructure,
  loadBundledEnglishWebUiMessagePack,
  selectEnglishWebUiMessages,
  validateWebUiMessageTreeAgainstEnglish,
} from "./web-ui-message-pack.validate.js";
import {
  classifyEnglishIdenticalWebUiTree,
} from "./web-ui-identical-classification.js";
import {
  protectWebUiMessageForProvider,
  restoreWebUiMessageFromProvider,
  WebUiMessageStructureError,
} from "./web-ui-message-structure-protect.js";

const PROTECTION_VERSION = 1;
const SOURCE_NOTE = "offline WEB_UI draft; not published";
const DEFAULT_RETRY_DELAY_MS = 1_500;
/**
 * Offline draft generation is not a request path.
 * Match the existing 60s PLP provider timeout without raising the runtime default.
 */
export const OFFLINE_WEB_UI_PROVIDER_TIMEOUT_MS = 60_000;

export class WebUiDraftBuilderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebUiDraftBuilderError";
  }
}

export class WebUiDraftBatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebUiDraftBatchError";
  }
}

export type WebUiDraftTextDirection = "ltr" | "rtl";
export type WebUiDraftTerminologyMode = "english-seed" | "live";

export interface WebUiDraftBatchPlan {
  readonly id: string;
  readonly namespace: string;
  readonly keys: readonly string[];
}

export interface WebUiDraftManifest {
  readonly locale: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: WebUiDraftTextDirection;
  readonly scope: "public";
  readonly sourceHash: string;
  readonly protectionVersion: number;
  readonly provider: string | null;
  readonly model: string | null;
  readonly terminologyMode: WebUiDraftTerminologyMode;
  readonly leafCount: number;
  readonly batchCount: number;
  readonly completedBatchCount: number;
  readonly failedBatchCount: number;
  readonly failedBatches: readonly {
    readonly id: string;
    readonly paths: readonly string[];
    readonly reason: string;
  }[];
  readonly englishIdenticalPaths: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WebUiDraftRunResult {
  readonly mode: "dry-run" | "execute";
  readonly locale: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: WebUiDraftTextDirection;
  readonly leafCount: number;
  readonly batchCount: number;
  readonly providerCalls: number;
  readonly terminologyMode: WebUiDraftTerminologyMode;
  readonly artifactPath: string | null;
  readonly completedBatchCount: number;
  readonly failedBatchCount: number;
  readonly acceptedIdenticalCount?: number;
  readonly suspiciousIdenticalCount?: number;
}

export interface WebUiDraftBuilderInput {
  readonly argv?: readonly string[];
  readonly locale?: string;
  readonly execute?: boolean;
  readonly useLiveTerminology?: boolean;
  readonly englishName?: string;
  readonly nativeName?: string;
  readonly textDirection?: WebUiDraftTextDirection;
  readonly includePaths?: readonly string[];
  readonly translator?: (request: TranslationProviderRequest) => Promise<TranslationProviderResult>;
  readonly outRoot?: string;
  readonly retryDelayMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly env?: {
    readonly TRANSLATION_PROVIDER?: string;
    readonly HU_READ_ONLY_DIAGNOSTIC?: string;
  };
  readonly model?: string;
  readonly loadLiveTerminology?: (locale: string) => Promise<string>;
  readonly resolveRegistryLocale?: (locale: string) => Promise<{
    readonly locale: string;
    readonly englishName: string;
    readonly nativeName: string;
    readonly textDirection: string;
  } | null>;
  readonly log?: (line: string) => void;
  readonly now?: () => string;
}

type BatchCheckpoint = {
  id: string;
  keys: string[];
  status: "ok" | "failed";
  attempts: number;
  reason?: string;
};

export function canonicalizeWebUiDraftLocale(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new WebUiDraftBuilderError("locale is required.");
  }
  const canonical = trimmed
    .split("-")
    .map((part, index) => {
      if (index === 0) {
        return part.toLowerCase();
      }
      if (/^[A-Za-z]{4}$/.test(part)) {
        return `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`;
      }
      if (/^[A-Za-z]{2}$/.test(part) || /^[0-9]{3}$/.test(part)) {
        return part.toUpperCase();
      }
      return part.toLowerCase();
    })
    .join("-");
  if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(canonical)) {
    throw new WebUiDraftBuilderError(`Invalid locale: ${input}`);
  }
  if (canonical === "en") {
    throw new WebUiDraftBuilderError(
      "The canonical English catalog cannot be the target of a WEB_UI draft.",
    );
  }
  return canonical;
}

export function resolveOfflineWebUiProviderTimeoutMs(configuredTimeoutMs: number): number {
  const configured = Number.isFinite(configuredTimeoutMs) ? configuredTimeoutMs : 0;
  return Math.max(configured, OFFLINE_WEB_UI_PROVIDER_TIMEOUT_MS);
}

export function planWebUiDraftBatches(
  flat: Readonly<Record<string, string>>,
): readonly WebUiDraftBatchPlan[] {
  const byNamespace = new Map<string, Record<string, string>>();
  for (const key of Object.keys(flat).sort()) {
    const namespace = key.split(".")[0] || key;
    const bucket = byNamespace.get(namespace) ?? {};
    bucket[key] = flat[key] ?? "";
    byNamespace.set(namespace, bucket);
  }
  const plans: WebUiDraftBatchPlan[] = [];
  for (const namespace of [...byNamespace.keys()].sort()) {
    const batches = planPlpProviderBatches(byNamespace.get(namespace) ?? {});
    for (const batch of batches) {
      const keys = Object.keys(batch).sort();
      plans.push({
        id: createHash("sha256").update(keys.join("\n")).digest("hex").slice(0, 16),
        namespace,
        keys,
      });
    }
  }
  return plans;
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

/** Public: English public catalog fingerprint for activation checkpoints. */
export function hashWebUiEnglishFlatMap(flat: Readonly<Record<string, string>>): string {
  return hashFlat(flat);
}

function unflatten(flat: Readonly<Record<string, string>>): WebUiMessageTree {
  const root: Record<string, unknown> = {};
  for (const [pathKey, value] of Object.entries(flat)) {
    const segments = pathKey.split(".");
    let cursor = root;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index] ?? "";
      const next = cursor[segment];
      if (next == null || typeof next !== "object" || Array.isArray(next)) {
        cursor[segment] = {};
      }
      cursor = cursor[segment] as Record<string, unknown>;
    }
    cursor[segments[segments.length - 1] ?? ""] = value;
  }
  return root as WebUiMessageTree;
}

/** Public: assemble a message tree from a flat path map. */
export function unflattenWebUiMessageMap(
  flat: Readonly<Record<string, string>>,
): WebUiMessageTree {
  return unflatten(flat);
}

function sameTokenList(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((token, index) => token === sortedRight[index]);
}

function assertStructureMatches(english: string, translated: string): void {
  const source = inspectMessageStructure(english);
  const target = inspectMessageStructure(translated);
  if (source.balanced && !target.balanced) {
    throw new WebUiDraftBatchError("Message structure is unbalanced.");
  }
  if (!sameTokenList(source.placeholders, target.placeholders)) {
    throw new WebUiDraftBatchError("Placeholders do not match English.");
  }
  if (!sameTokenList(source.richTags, target.richTags)) {
    throw new WebUiDraftBatchError("Rich-text tags do not match English.");
  }
}

export function assertCompletePublicWebUiDraft(input: {
  readonly messages: WebUiMessageTree;
  readonly requiredPaths: readonly string[];
}): void {
  const report = validateWebUiMessageTreeAgainstEnglish(input.messages);
  if (report.rejectedUnknownPaths.length > 0) {
    throw new WebUiDraftBuilderError(
      `Unknown WEB_UI paths: ${report.rejectedUnknownPaths.slice(0, 8).join(", ")}`,
    );
  }
  if (report.rejectedNonStringPaths.length > 0) {
    throw new WebUiDraftBuilderError(
      `Non-string WEB_UI leaves: ${report.rejectedNonStringPaths.slice(0, 8).join(", ")}`,
    );
  }
  if (report.placeholderMismatchPaths.length > 0) {
    throw new WebUiDraftBuilderError(
      `Placeholder mismatch: ${report.placeholderMismatchPaths.slice(0, 8).join("; ")}`,
    );
  }
  if (report.emptyPaths.length > 0) {
    throw new WebUiDraftBuilderError(`Empty WEB_UI values: ${report.emptyPaths.slice(0, 8).join(", ")}`);
  }
  const present = new Set(collectStringPaths(input.messages as Record<string, unknown>));
  const missing = input.requiredPaths.filter((pathKey) => !present.has(pathKey));
  if (missing.length > 0) {
    throw new WebUiDraftBuilderError(
      `Public WEB_UI draft is incomplete. Missing ${missing.length} paths, including ${missing.slice(0, 8).join(", ")}`,
    );
  }
  for (const pathKey of present) {
    const value = readPath(input.messages as Record<string, unknown>, pathKey);
    if (typeof value === "string" && (value.includes("⟦w") || value.includes("__HU_BRAND_SITE_NAME__"))) {
      throw new WebUiDraftBuilderError(`Unresolved protection sentinel at ${pathKey}.`);
    }
  }
}

function buildTerminologyContext(input: {
  readonly locale: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: WebUiDraftTextDirection;
  readonly glossary: string;
}): string {
  return [
    "WEB_UI catalog draft rules:",
    `Target locale: ${input.locale}.`,
    `English language name: ${input.englishName}.`,
    `Native language name: ${input.nativeName}.`,
    `Text direction: ${input.textDirection}.`,
    "The user message is one flat JSON object.",
    "Each JSON key is a stable catalog path. Copy every JSON key exactly.",
    "Translate only the string values. Every returned value must remain a string.",
    "Return one JSON object with exactly those keys. Do not wrap, nest, or rename them.",
    "Values may contain protection sentinels such as ⟦w0⟧.",
    "Copy every sentinel exactly. Do not translate, reorder, split, or drop sentinels.",
    "Translate only natural-language text around sentinels.",
    "Short interface labels may stay identical to English when that is the natural form.",
    "Glossary:",
    input.glossary.trim(),
  ].join("\n");
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
  // GeminiTranslationProvider structured_json preserves JSON keys and translates
  // string values. A translations-array row is accepted only when it already
  // matches that string contract; non-string rows stay rejected.
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
      if (map.has(key)) {
        throw new WebUiDraftBatchError(`Provider returned duplicate key ${key}.`);
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

function isNonRetryable(error: unknown): boolean {
  return (
    error instanceof TranslationProviderError &&
    (error.code === "safety_rejected" ||
      error.code === "not_configured" ||
      error.code === "forbidden" ||
      error.code === "unsupported_language")
  );
}

export type WebUiProviderBatchTranslateResult = {
  readonly values: Readonly<Record<string, string>>;
  /** Provider HTTP calls made for this batch (1, or 2 when missing-key recovery ran). */
  readonly providerCalls: number;
  readonly missingKeyRecoveryAttempted: boolean;
};

async function requestWebUiProviderTranslations(input: {
  readonly locale: string;
  readonly englishFlat: Readonly<Record<string, string>>;
  readonly keys: readonly string[];
  readonly terminologyContext: string;
  readonly translator: (request: TranslationProviderRequest) => Promise<TranslationProviderResult>;
}): Promise<Map<string, string>> {
  const payloadObject: Record<string, string> = {};
  for (const key of input.keys) {
    payloadObject[key] = protectWebUiMessageForProvider(input.englishFlat[key] ?? "").text;
  }
  const result = await input.translator({
    sourceLanguage: "en",
    targetLanguage: input.locale as LanguageCode,
    text: JSON.stringify(payloadObject),
    contentType: "structured_json",
    terminologyContext: input.terminologyContext,
    safetyCleared: true,
  });
  return parseTranslations(result.translatedText);
}

function restoreValidatedWebUiKey(input: {
  readonly key: string;
  readonly providerValue: string;
  readonly english: string;
}): string {
  const restored = restoreWebUiMessageFromProvider(input.providerValue, input.english);
  assertStructureMatches(input.english, restored);
  return restored;
}

/**
 * Shared single-batch WEB_UI translate: protect → provider → restore → structure assert.
 * If the provider omits some expected keys but returns a structurally valid subset,
 * one recovery request is made for the missing keys only, then results are merged.
 * Unexpected keys are still rejected. Structural violations fail immediately.
 * Used by offline draft builder and durable activation ticks. Concurrency remains 1 at caller.
 */
export async function translateWebUiProviderBatch(input: {
  readonly locale: string;
  readonly englishFlat: Readonly<Record<string, string>>;
  readonly keys: readonly string[];
  readonly terminologyContext: string;
  readonly translator: (request: TranslationProviderRequest) => Promise<TranslationProviderResult>;
}): Promise<WebUiProviderBatchTranslateResult> {
  const expected = input.keys;
  let providerCalls = 0;
  providerCalls += 1;
  const returned = await requestWebUiProviderTranslations({
    locale: input.locale,
    englishFlat: input.englishFlat,
    keys: expected,
    terminologyContext: input.terminologyContext,
    translator: input.translator,
  });

  const extra = [...returned.keys()].filter((key) => !expected.includes(key));
  if (extra.length > 0) {
    throw new WebUiDraftBatchError(
      `Provider returned unexpected keys: ${extra.slice(0, 8).join(", ")}`,
    );
  }

  const valid: Record<string, string> = {};
  for (const key of expected) {
    if (!returned.has(key)) {
      continue;
    }
    valid[key] = restoreValidatedWebUiKey({
      key,
      providerValue: returned.get(key) ?? "",
      english: input.englishFlat[key] ?? "",
    });
  }

  const missing = expected.filter((key) => valid[key] === undefined);
  let missingKeyRecoveryAttempted = false;
  if (missing.length > 0) {
    missingKeyRecoveryAttempted = true;
    providerCalls += 1;
    const recovered = await requestWebUiProviderTranslations({
      locale: input.locale,
      englishFlat: input.englishFlat,
      keys: missing,
      terminologyContext: input.terminologyContext,
      translator: input.translator,
    });
    const recoveryExtra = [...recovered.keys()].filter((key) => !missing.includes(key));
    if (recoveryExtra.length > 0) {
      throw new WebUiDraftBatchError(
        `Provider returned unexpected keys: ${recoveryExtra.slice(0, 8).join(", ")}`,
      );
    }
    for (const key of missing) {
      if (!recovered.has(key)) {
        continue;
      }
      valid[key] = restoreValidatedWebUiKey({
        key,
        providerValue: recovered.get(key) ?? "",
        english: input.englishFlat[key] ?? "",
      });
    }
    const stillMissing = expected.filter((key) => valid[key] === undefined);
    if (stillMissing.length > 0) {
      throw new WebUiDraftBatchError(
        `Provider omitted keys after recovery: ${stillMissing.slice(0, 8).join(", ")}`,
      );
    }
  }

  const out: Record<string, string> = {};
  for (const key of expected) {
    const value = valid[key];
    if (value === undefined) {
      throw new WebUiDraftBatchError(`Provider omitted keys: ${key}`);
    }
    out[key] = value;
  }
  return {
    values: out,
    providerCalls,
    missingKeyRecoveryAttempted,
  };
}

/** Operator-facing WEB_UI batch failure detail. Never includes translated values. */
export function sanitizeWebUiActivationFailureDetail(reason: string): string {
  const omitted = reason.match(
    /Provider omitted keys(?: after recovery)?:\s*(.+)$/i,
  );
  if (omitted) {
    const count = omitted[1]!
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean).length;
    return `Public interface translation failed: provider omitted ${count} required key${
      count === 1 ? "" : "s"
    }. Retry activation to continue.`;
  }
  if (/unexpected keys/i.test(reason)) {
    return "Public interface translation failed: provider returned unexpected keys. Retry activation to continue.";
  }
  if (/Placeholder|Rich-text|unbalanced|Protection sentinel|Brand/i.test(reason)) {
    return "Public interface translation failed: structure validation rejected the provider response. Retry activation to continue.";
  }
  if (/timed out|timeout/i.test(reason)) {
    return "Public interface translation failed: provider timed out. Retry activation to continue.";
  }
  if (/rate_limited|HTTP 429/i.test(reason)) {
    return "Public interface translation failed: provider rate limited. Retry activation to continue.";
  }
  return "Public interface translation failed — retry activation";
}

/** Load the canonical English public WEB_UI flat map + required paths. */
export function loadPublicWebUiEnglishCorpus(includePaths?: readonly string[]): {
  readonly flat: Record<string, string>;
  readonly requiredPaths: readonly string[];
} {
  return loadCorpus(includePaths);
}

export function buildWebUiDraftTerminologyContext(input: {
  readonly locale: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: WebUiDraftTextDirection;
  readonly glossary: string;
}): string {
  return buildTerminologyContext(input);
}

export function isWebUiProviderBatchNonRetryable(error: unknown): boolean {
  return isNonRetryable(error);
}

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

function loadCorpus(includePaths: readonly string[] | undefined): {
  readonly flat: Record<string, string>;
  readonly requiredPaths: readonly string[];
} {
  const prepared = selectEnglishWebUiMessages("public");
  const english = loadBundledEnglishWebUiMessagePack();
  const selected = includePaths ?? prepared.selectedPaths;
  const allowed = new Set(prepared.selectedPaths);
  const flat: Record<string, string> = {};
  for (const pathKey of selected) {
    if (!allowed.has(pathKey) || !isPublicReaderWebUiRequiredPath(pathKey)) {
      throw new WebUiDraftBuilderError(`Path is outside the public WEB_UI scope: ${pathKey}`);
    }
    const value = readPath(prepared.messages as Record<string, unknown>, pathKey);
    const canonical = readPath(english, pathKey);
    if (typeof value !== "string" || value !== canonical) {
      throw new WebUiDraftBuilderError(`Path is not canonical English: ${pathKey}`);
    }
    flat[pathKey] = value;
  }
  return { flat, requiredPaths: selected };
}

function checkpointPaths(outRoot: string, locale: string): {
  readonly directory: string;
  readonly artifactPath: string;
  readonly manifestPath: string;
  readonly sourcePath: string;
  readonly mapPath: string;
  readonly batchDir: string;
} {
  const directory = path.join(outRoot, `web-ui-${locale}-draft`);
  return {
    directory,
    artifactPath: path.join(outRoot, `web-ui-${locale}-draft.json`),
    manifestPath: path.join(directory, "manifest.json"),
    sourcePath: path.join(directory, "source.json"),
    mapPath: path.join(directory, "translated-map.json"),
    batchDir: path.join(directory, "batches"),
  };
}

function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

async function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function defaultLiveTerminology(locale: string): Promise<string> {
  const module = await import("../language/terminology-glossary/terminology-glossary.provider-context.js");
  return module.resolveProviderTerminologyContext(locale);
}

export async function runWebUiDraftBuilder(
  input: WebUiDraftBuilderInput = {},
): Promise<WebUiDraftRunResult> {
  const argv = input.argv ?? [];
  const retryIdentical = argv.includes("--retry-identical");
  if (retryIdentical) {
    const { runWebUiQualityRetry } = await import("./web-ui-quality-retry.js");
    const quality = await runWebUiQualityRetry({
      argv,
      locale: input.locale,
      execute: input.execute,
      englishName: input.englishName,
      nativeName: input.nativeName,
      textDirection: input.textDirection,
      translator: input.translator,
      outRoot: input.outRoot,
      retryDelayMs: input.retryDelayMs,
      sleep: input.sleep,
      env: input.env,
      model: input.model,
      loadLiveTerminology: input.loadLiveTerminology,
      log: input.log,
      now: input.now,
    });
    return {
      mode: quality.mode,
      locale: quality.locale,
      englishName: input.englishName ?? readFlag(argv, "--english-name") ?? quality.locale,
      nativeName: input.nativeName ?? readFlag(argv, "--native-name") ?? quality.locale,
      textDirection: (input.textDirection ??
        (readFlag(argv, "--text-direction") as WebUiDraftTextDirection | undefined) ??
        "ltr") as WebUiDraftTextDirection,
      leafCount: quality.retriedPathCount,
      batchCount: quality.retriedPathCount === 0 ? 0 : Math.max(1, quality.providerCalls),
      providerCalls: quality.providerCalls,
      terminologyMode: "live",
      artifactPath: quality.artifactPath,
      completedBatchCount: quality.mode === "execute" ? quality.providerCalls > 0 ? 1 : 0 : 0,
      failedBatchCount: 0,
      acceptedIdenticalCount: quality.acceptedTechnical.length,
      suspiciousIdenticalCount: quality.suspiciousRemaining.length,
    };
  }

  const execute = input.execute ?? argv.includes("--execute");
  const useLiveTerminology = input.useLiveTerminology ?? argv.includes("--use-live-terminology");
  const locale = canonicalizeWebUiDraftLocale(
    input.locale ?? readFlag(argv, "--locale") ?? "",
  );

  let englishName = (input.englishName ?? readFlag(argv, "--english-name") ?? "").trim();
  let nativeName = (input.nativeName ?? readFlag(argv, "--native-name") ?? "").trim();
  let textDirectionRaw = input.textDirection ?? readFlag(argv, "--text-direction") ?? "";
  if (!englishName || !nativeName || (textDirectionRaw !== "ltr" && textDirectionRaw !== "rtl")) {
    try {
      const { resolveLanguagePreparationLocaleMetadata } = await import(
        "../language-preparation/language-registry-metadata.js"
      );
      const metadata = await resolveLanguagePreparationLocaleMetadata({
        locale,
        englishName: englishName || undefined,
        nativeName: nativeName || undefined,
        textDirection: textDirectionRaw || undefined,
        resolveRegistryLocale: input.resolveRegistryLocale,
      });
      englishName = metadata.englishName;
      nativeName = metadata.nativeName;
      textDirectionRaw = metadata.textDirection;
    } catch (error) {
      if (!englishName || !nativeName || (textDirectionRaw !== "ltr" && textDirectionRaw !== "rtl")) {
        throw new WebUiDraftBuilderError(
          error instanceof Error
            ? error.message
            : "Locale metadata requires Registry access or --english-name/--native-name/--text-direction.",
        );
      }
    }
  }
  if (textDirectionRaw !== "ltr" && textDirectionRaw !== "rtl") {
    throw new WebUiDraftBuilderError("textDirection must be ltr or rtl.");
  }
  const textDirection = textDirectionRaw;
  const terminologyMode: WebUiDraftTerminologyMode = useLiveTerminology ? "live" : "english-seed";
  const log = input.log ?? ((line: string) => console.log(line));
  const now = input.now ?? (() => new Date().toISOString());
  const { flat, requiredPaths } = loadCorpus(input.includePaths);
  const batches = planWebUiDraftBatches(flat);
  const sourceHash = hashFlat(flat);

  if (!execute) {
    log(
      [
        "WEB_UI draft dry-run",
        `locale: ${locale}`,
        `englishName: ${englishName}`,
        `nativeName: ${nativeName}`,
        `textDirection: ${textDirection}`,
        "scope: public",
        `leaves: ${requiredPaths.length}`,
        `batches: ${batches.length}`,
        `terminology: ${terminologyMode}`,
        "provider calls: 0",
      ].join("\n"),
    );
    return {
      mode: "dry-run",
      locale,
      englishName,
      nativeName,
      textDirection,
      leafCount: requiredPaths.length,
      batchCount: batches.length,
      providerCalls: 0,
      terminologyMode,
      artifactPath: null,
      completedBatchCount: 0,
      failedBatchCount: 0,
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

  const outRoot = input.outRoot ?? repoTmpRoot();
  const paths = checkpointPaths(outRoot, locale);
  if (existsSync(paths.directory) && !existsSync(paths.manifestPath)) {
    throw new WebUiDraftBuilderError("Checkpoint directory is incomplete. Remove it and start again.");
  }
  mkdirSync(paths.batchDir, { recursive: true });
  const existing = readJson<WebUiDraftManifest>(paths.manifestPath);
  if (existing) {
    if (existing.locale !== locale) {
      throw new WebUiDraftBuilderError("Checkpoint locale does not match this run.");
    }
    if (existing.sourceHash !== sourceHash) {
      throw new WebUiDraftBuilderError(
        "Checkpoint source hash does not match the canonical English catalog. Remove the checkpoint directory and start again.",
      );
    }
    if (existing.terminologyMode !== terminologyMode) {
      throw new WebUiDraftBuilderError("Checkpoint terminology mode does not match this run.");
    }
    if (
      existing.englishName !== englishName ||
      existing.nativeName !== nativeName ||
      existing.textDirection !== textDirection ||
      existing.protectionVersion !== PROTECTION_VERSION
    ) {
      throw new WebUiDraftBuilderError("Checkpoint locale metadata does not match this run.");
    }
    if (
      (existing.provider && existing.provider !== providerLabel) ||
      (existing.model && modelLabel && existing.model !== modelLabel)
    ) {
      throw new WebUiDraftBuilderError("Checkpoint provider configuration does not match this run.");
    }
  }

  const glossary = useLiveTerminology
    ? await (input.loadLiveTerminology ?? defaultLiveTerminology)(locale)
    : HUMANITY_UNION_TRANSLATION_TERMINOLOGY;
  const terminologyContext = buildTerminologyContext({
    locale,
    englishName,
    nativeName,
    textDirection,
    glossary,
  });

  const createdAt = existing?.createdAt ?? now();
  const translated = readJson<Record<string, string>>(paths.mapPath) ?? {};
  let providerCalls = 0;
  let completedBatchCount = 0;
  let failedBatchCount = 0;
  const failedBatches: WebUiDraftManifest["failedBatches"][number][] = [];
  const sleep = input.sleep ?? defaultSleep;
  const retryDelayMs = input.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  const writeManifest = (englishIdenticalPaths: readonly string[]): void => {
    const manifest: WebUiDraftManifest = {
      locale,
      englishName,
      nativeName,
      textDirection,
      scope: "public",
      sourceHash,
      protectionVersion: PROTECTION_VERSION,
      provider: providerLabel,
      model: modelLabel || null,
      terminologyMode,
      leafCount: requiredPaths.length,
      batchCount: batches.length,
      completedBatchCount,
      failedBatchCount,
      failedBatches,
      englishIdenticalPaths,
      createdAt,
      updatedAt: now(),
    };
    writeFileSync(paths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  };

  writeFileSync(
    paths.sourcePath,
    `${JSON.stringify({ locale, sourceHash, scope: "public", messages: unflatten(flat) }, null, 2)}\n`,
  );
  writeManifest([]);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex]!;
    const batchPath = path.join(paths.batchDir, `${batch.id}.json`);
    const previous = readJson<BatchCheckpoint>(batchPath);
    if (
      previous?.status === "ok" &&
      previous.keys.join("\n") === batch.keys.join("\n") &&
      batch.keys.every((key) => typeof translated[key] === "string")
    ) {
      completedBatchCount += 1;
      continue;
    }

    let attempt = 0;
    let done = false;
    let lastReason = "Provider batch failed.";
    while (attempt < 2 && !done) {
      attempt += 1;
      try {
        const restoredBatch = await translateWebUiProviderBatch({
          locale,
          englishFlat: flat,
          keys: batch.keys,
          terminologyContext,
          translator,
        });
        providerCalls += restoredBatch.providerCalls;
        for (const key of batch.keys) {
          translated[key] = restoredBatch.values[key]!;
        }
        done = true;
        log(`[${batchIndex + 1}/${batches.length}] ${batch.namespace} — ok`);
      } catch (error) {
        lastReason = error instanceof Error ? error.message : "Provider batch failed.";
        if (isNonRetryable(error) || attempt >= 2) {
          const checkpoint: BatchCheckpoint = {
            id: batch.id,
            keys: [...batch.keys],
            status: "failed",
            attempts: attempt,
            reason: lastReason,
          };
          writeFileSync(batchPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
          failedBatchCount += 1;
          failedBatches.push({ id: batch.id, paths: batch.keys, reason: lastReason });
          writeFileSync(paths.mapPath, `${JSON.stringify(translated, null, 2)}\n`);
          writeManifest([]);
          log(`[${batchIndex + 1}/${batches.length}] ${batch.namespace} — failed`);
          throw new WebUiDraftBuilderError(lastReason);
        }
        log(`[${batchIndex + 1}/${batches.length}] ${batch.namespace} — retry`);
        await sleep(retryDelayMs);
      }
    }
    if (!done) {
      throw new WebUiDraftBuilderError(lastReason);
    }
    const checkpoint: BatchCheckpoint = {
      id: batch.id,
      keys: [...batch.keys],
      status: "ok",
      attempts: attempt,
    };
    writeFileSync(batchPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
    writeFileSync(paths.mapPath, `${JSON.stringify(translated, null, 2)}\n`);
    completedBatchCount += 1;
    writeManifest([]);
  }

  const englishIdenticalPaths = requiredPaths.filter((pathKey) => translated[pathKey] === flat[pathKey]);
  const messages = unflatten(
    Object.fromEntries(requiredPaths.map((pathKey) => [pathKey, translated[pathKey] ?? ""])),
  );
  assertCompletePublicWebUiDraft({ messages, requiredPaths });
  writeFileSync(
    paths.artifactPath,
    `${JSON.stringify({ locale, status: "draft", sourceNote: SOURCE_NOTE, messages }, null, 2)}\n`,
  );
  writeManifest(englishIdenticalPaths);
  const classification = classifyEnglishIdenticalWebUiTree({
    englishFlat: flat,
    localizedFlat: Object.fromEntries(
      requiredPaths.map((pathKey) => [pathKey, translated[pathKey] ?? ""]),
    ),
  });
  log(
    [
      "WEB_UI draft complete",
      `locale: ${locale}`,
      "scope: public",
      `completedBatches: ${completedBatchCount}`,
      `failedBatches: ${failedBatchCount}`,
      `translatedLeaves: ${requiredPaths.length}`,
      `acceptedIdentical: ${classification.acceptedTechnical.length}`,
      `suspiciousIdentical: ${classification.suspiciousHuman.length}`,
      `artifact: ${paths.artifactPath}`,
    ].join("\n"),
  );
  return {
    mode: "execute",
    locale,
    englishName,
    nativeName,
    textDirection,
    leafCount: requiredPaths.length,
    batchCount: batches.length,
    providerCalls,
    terminologyMode,
    artifactPath: paths.artifactPath,
    completedBatchCount,
    failedBatchCount,
    acceptedIdenticalCount: classification.acceptedTechnical.length,
    suspiciousIdenticalCount: classification.suspiciousHuman.length,
  };
}
