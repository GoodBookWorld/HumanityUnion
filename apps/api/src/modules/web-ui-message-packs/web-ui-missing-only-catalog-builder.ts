/**
 * Missing-only WEB_UI catalog preparation.
 *
 * Builds a complete locale catalog by preserving every existing published leaf
 * and translating only paths absent from the published pack. Supports the full
 * English foundation (ordinary + non-ordinary). Reuses translateWebUiProviderBatch.
 *
 * Does not publish, import, activate, write Mongo, Content Translation, or Registry.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isOrdinaryWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
  type LanguageCode,
  type WebUiMessageTree,
} from "@hu/types";

import { HUMANITY_UNION_TRANSLATION_TERMINOLOGY } from "../language/hu-terminology-glossary.js";
import type {
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../language/translation-provider.js";
import { mergeMissingPackagedWebUiMessages } from "./merge-missing-packaged-web-ui-messages.js";
import {
  buildWebUiDraftTerminologyContext,
  canonicalizeWebUiDraftLocale,
  hashWebUiEnglishFlatMap,
  isWebUiProviderBatchNonRetryable,
  planWebUiDraftBatches,
  resolveOfflineWebUiProviderTimeoutMs,
  translateWebUiProviderBatch,
  unflattenWebUiMessageMap,
  type WebUiDraftBatchPlan,
  type WebUiDraftTextDirection,
  type WebUiDraftTerminologyMode,
} from "./web-ui-draft-builder.js";
import {
  collectStringPaths,
  describeStructureMismatch,
  loadBundledEnglishWebUiMessagePack,
} from "./web-ui-message-pack.validate.js";

const SOURCE_NOTE = "offline missing-only WEB_UI catalog; not published";
const DEFAULT_RETRY_DELAY_MS = 1_500;
const PROTECTION_VERSION = 1;

export class WebUiMissingOnlyCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebUiMissingOnlyCatalogError";
  }
}

export type WebUiMissingOnlyExistingPack = {
  readonly locale: string;
  readonly revision: number | null;
  readonly messages: WebUiMessageTree;
};

/** Hard pilot ceilings — never raise without a new task authorization. */
export const WEB_UI_MISSING_ONLY_PILOT_MAX_KEYS = 10;
export const WEB_UI_MISSING_ONLY_PILOT_MAX_BATCHES = 2;

export type WebUiMissingOnlyPilotLimits = {
  readonly maxKeys: number;
  readonly maxBatches: number;
};

export type WebUiMissingOnlyCatalogPlan = {
  readonly locale: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: WebUiDraftTextDirection;
  readonly publishedRevision: number | null;
  readonly englishSourceHash: string;
  readonly englishKeyCount: number;
  readonly existingKeyCount: number;
  /** Paths selected for this run (full missing set, or pilot subset). */
  readonly missingPaths: readonly string[];
  /** Total missing vs English before any pilot subset. */
  readonly totalMissingKeyCount: number;
  readonly missingOrdinaryCount: number;
  readonly missingNonOrdinaryCount: number;
  readonly batchCount: number;
  /** Best-case provider HTTP calls (one per batch). */
  readonly estimatedProviderCallsMin: number;
  /** Worst-case with one missing-key recovery per batch. */
  readonly estimatedProviderCallsMax: number;
  readonly batches: readonly WebUiDraftBatchPlan[];
  readonly pilot: WebUiMissingOnlyPilotLimits | null;
};

export type WebUiMissingOnlyCatalogRunResult = {
  readonly mode: "dry-run" | "execute";
  readonly locale: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: WebUiDraftTextDirection;
  readonly publishedRevision: number | null;
  readonly englishSourceHash: string;
  readonly existingKeyCount: number;
  readonly missingKeyCount: number;
  readonly totalMissingKeyCount: number;
  readonly finalKeyCount: number;
  readonly batchCount: number;
  readonly providerCalls: number;
  readonly completedBatchCount: number;
  readonly failedBatchCount: number;
  readonly terminologyMode: WebUiDraftTerminologyMode;
  readonly artifactPath: string | null;
  readonly planPath: string | null;
  readonly preservedExact: boolean;
  readonly pilot: WebUiMissingOnlyPilotLimits | null;
};

export type WebUiMissingOnlyCatalogBuilderInput = {
  readonly argv?: readonly string[];
  readonly locale?: string;
  readonly execute?: boolean;
  readonly useLiveTerminology?: boolean;
  readonly englishName?: string;
  readonly nativeName?: string;
  readonly textDirection?: WebUiDraftTextDirection;
  readonly publishedRevision?: number | null;
  /** Parsed existing pack (preferred for tests). */
  readonly existingPack?: WebUiMissingOnlyExistingPack;
  /** Path to a published pack snapshot JSON (API envelope or raw messages). */
  readonly existingPackPath?: string;
  /** Bounded pilot: translate at most this many missing keys (≤10). */
  readonly pilotMaxKeys?: number;
  /** Bounded pilot: refuse plans with more than this many batches (≤2). */
  readonly pilotMaxBatches?: number;
  readonly translator?: (
    request: TranslationProviderRequest,
  ) => Promise<TranslationProviderResult>;
  readonly outRoot?: string;
  readonly retryDelayMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly env?: {
    readonly TRANSLATION_PROVIDER?: string;
    readonly HU_READ_ONLY_DIAGNOSTIC?: string;
  };
  readonly model?: string;
  readonly loadLiveTerminology?: (locale: string) => Promise<string>;
  readonly loadEnglishFoundation?: () => WebUiMessageTree;
  readonly log?: (line: string) => void;
  readonly now?: () => string;
};

type BatchCheckpoint = {
  id: string;
  keys: string[];
  status: "ok" | "failed";
  attempts: number;
  reason?: string;
};

type MissingOnlyManifest = {
  readonly kind: "web-ui-missing-only" | "web-ui-missing-only-pilot";
  readonly locale: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: WebUiDraftTextDirection;
  readonly publishedRevision: number | null;
  readonly englishSourceHash: string;
  readonly existingKeyCount: number;
  readonly missingKeyCount: number;
  readonly totalMissingKeyCount: number;
  readonly pilotMaxKeys: number | null;
  readonly pilotMaxBatches: number | null;
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
  readonly createdAt: string;
  readonly updatedAt: string;
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

function flattenStringLeaves(
  messages: WebUiMessageTree | null | undefined,
): Map<string, string> {
  const flat = new Map<string, string>();
  if (!messages || typeof messages !== "object" || Array.isArray(messages)) {
    return flat;
  }
  for (const pathKey of collectStringPaths(messages as never)) {
    const value = readPath(messages as Record<string, unknown>, pathKey);
    if (typeof value === "string") {
      flat.set(pathKey, value);
    }
  }
  return flat;
}

function loadEnglishFlat(
  loadEnglishFoundation?: () => WebUiMessageTree,
): {
  readonly tree: WebUiMessageTree;
  readonly flat: Record<string, string>;
  readonly paths: readonly string[];
  readonly sourceHash: string;
} {
  const tree = (loadEnglishFoundation?.() ??
    loadBundledEnglishWebUiMessagePack()) as WebUiMessageTree;
  const pathList = collectStringPaths(tree as never).sort();
  const flat: Record<string, string> = {};
  for (const pathKey of pathList) {
    const value = readPath(tree as Record<string, unknown>, pathKey);
    if (typeof value !== "string") {
      throw new WebUiMissingOnlyCatalogError(`English foundation leaf is not a string: ${pathKey}`);
    }
    flat[pathKey] = value;
  }
  return {
    tree,
    flat,
    paths: pathList,
    sourceHash: hashWebUiEnglishFlatMap(flat),
  };
}

/**
 * Accept API envelopes, `{ locale, revision, messages }`, or a raw message tree.
 */
export function parseWebUiPublishedPackSnapshot(
  raw: unknown,
  expectedLocale?: string,
): WebUiMissingOnlyExistingPack {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new WebUiMissingOnlyCatalogError("Existing pack snapshot must be a JSON object.");
  }
  const root = raw as Record<string, unknown>;
  const payload =
    root.data != null && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;

  let messages: unknown = payload.messages;
  let locale =
    typeof payload.locale === "string" ? canonicalizeWebUiDraftLocale(payload.locale) : "";
  let revision: number | null =
    typeof payload.revision === "number" &&
    Number.isInteger(payload.revision) &&
    payload.revision >= 1
      ? payload.revision
      : null;

  if (messages == null && payload.common != null) {
    messages = payload;
    locale = expectedLocale ? canonicalizeWebUiDraftLocale(expectedLocale) : locale;
  }

  if (messages == null || typeof messages !== "object" || Array.isArray(messages)) {
    throw new WebUiMissingOnlyCatalogError(
      "Existing pack snapshot must include a messages object (or be a raw message tree).",
    );
  }
  if (!locale && expectedLocale) {
    locale = canonicalizeWebUiDraftLocale(expectedLocale);
  }
  if (!locale) {
    throw new WebUiMissingOnlyCatalogError("Existing pack snapshot is missing locale.");
  }
  if (expectedLocale) {
    const expected = canonicalizeWebUiDraftLocale(expectedLocale);
    if (locale !== expected) {
      throw new WebUiMissingOnlyCatalogError(
        `Existing pack locale ${locale} does not match target locale ${expected}.`,
      );
    }
  }

  return {
    locale,
    revision,
    messages: messages as WebUiMessageTree,
  };
}

export function loadWebUiPublishedPackSnapshotFromFile(
  filePath: string,
  expectedLocale?: string,
): WebUiMissingOnlyExistingPack {
  if (!existsSync(filePath)) {
    throw new WebUiMissingOnlyCatalogError(`Existing pack snapshot not found: ${filePath}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new WebUiMissingOnlyCatalogError(`Existing pack snapshot is not valid JSON: ${filePath}`);
  }
  return parseWebUiPublishedPackSnapshot(parsed, expectedLocale);
}

function isPlainUiLabel(value: string): boolean {
  return value.trim().length > 0 && !value.includes("{") && !/<[A-Za-z]/.test(value);
}

function isParameterizedMessage(value: string): boolean {
  return /\{[A-Za-z_][A-Za-z0-9_]*\}/.test(value) && !/,\s*plural\b/.test(value);
}

function isIcuPluralMessage(value: string): boolean {
  return /,\s*plural\b/.test(value);
}

function isRichTextMessage(value: string): boolean {
  return /<[A-Za-z][A-Za-z0-9]*\b/.test(value);
}

function isPetitionRelatedPath(pathKey: string): boolean {
  return (
    pathKey.startsWith("initiativeExperience.") ||
    pathKey.includes(".petition") ||
    pathKey.includes("Petition")
  );
}

function parsePositiveIntFlag(
  raw: string | undefined,
  name: string,
): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new WebUiMissingOnlyCatalogError(`${name} must be a positive integer.`);
  }
  return value;
}

export function resolveWebUiMissingOnlyPilotLimits(input: {
  readonly pilotMaxKeys?: number;
  readonly pilotMaxBatches?: number;
}): WebUiMissingOnlyPilotLimits | null {
  if (input.pilotMaxKeys == null && input.pilotMaxBatches == null) {
    return null;
  }
  const maxKeys = input.pilotMaxKeys ?? WEB_UI_MISSING_ONLY_PILOT_MAX_KEYS;
  const maxBatches = input.pilotMaxBatches ?? WEB_UI_MISSING_ONLY_PILOT_MAX_BATCHES;
  if (maxKeys > WEB_UI_MISSING_ONLY_PILOT_MAX_KEYS) {
    throw new WebUiMissingOnlyCatalogError(
      `pilotMaxKeys cannot exceed ${WEB_UI_MISSING_ONLY_PILOT_MAX_KEYS}.`,
    );
  }
  if (maxBatches > WEB_UI_MISSING_ONLY_PILOT_MAX_BATCHES) {
    throw new WebUiMissingOnlyCatalogError(
      `pilotMaxBatches cannot exceed ${WEB_UI_MISSING_ONLY_PILOT_MAX_BATCHES}.`,
    );
  }
  return { maxKeys, maxBatches };
}

/**
 * Deterministic representative sample from missing paths for a bounded pilot.
 * Prefers petition-related strings and covers plain / param / plural / rich when present.
 */
export function selectWebUiMissingOnlyPilotPaths(input: {
  readonly missingPaths: readonly string[];
  readonly englishFlat: Readonly<Record<string, string>>;
  readonly maxKeys: number;
  readonly maxBatches: number;
}): readonly string[] {
  if (input.maxKeys < 1 || input.maxKeys > WEB_UI_MISSING_ONLY_PILOT_MAX_KEYS) {
    throw new WebUiMissingOnlyCatalogError(
      `pilot maxKeys must be 1–${WEB_UI_MISSING_ONLY_PILOT_MAX_KEYS}.`,
    );
  }
  if (input.maxBatches < 1 || input.maxBatches > WEB_UI_MISSING_ONLY_PILOT_MAX_BATCHES) {
    throw new WebUiMissingOnlyCatalogError(
      `pilot maxBatches must be 1–${WEB_UI_MISSING_ONLY_PILOT_MAX_BATCHES}.`,
    );
  }
  if (input.missingPaths.length === 0) {
    throw new WebUiMissingOnlyCatalogError("No missing paths available for pilot selection.");
  }

  const sorted = [...input.missingPaths].sort();
  const petition = sorted.filter(isPetitionRelatedPath);
  const pool = petition.length > 0 ? petition : sorted;
  const selected: string[] = [];

  const take = (predicate: (pathKey: string, value: string) => boolean): void => {
    if (selected.length >= input.maxKeys) {
      return;
    }
    for (const pathKey of pool) {
      if (selected.includes(pathKey)) {
        continue;
      }
      const value = input.englishFlat[pathKey] ?? "";
      if (predicate(pathKey, value)) {
        selected.push(pathKey);
        return;
      }
    }
  };

  take((_pathKey, value) => isPlainUiLabel(value));
  take((_pathKey, value) => isParameterizedMessage(value));
  take((_pathKey, value) => isIcuPluralMessage(value));
  take((_pathKey, value) => isRichTextMessage(value));

  for (const pathKey of pool) {
    if (selected.length >= input.maxKeys) {
      break;
    }
    if (!selected.includes(pathKey)) {
      selected.push(pathKey);
    }
  }

  let candidate = selected.slice(0, input.maxKeys);
  while (candidate.length > 0) {
    const flat: Record<string, string> = {};
    for (const pathKey of candidate) {
      flat[pathKey] = input.englishFlat[pathKey] ?? "";
    }
    const batches = planWebUiDraftBatches(flat);
    if (batches.length <= input.maxBatches) {
      return [...candidate].sort();
    }
    candidate = candidate.slice(0, candidate.length - 1);
  }

  throw new WebUiMissingOnlyCatalogError(
    `Unable to select a pilot sample within ${input.maxBatches} provider batch(es).`,
  );
}

export function computeWebUiMissingOnlyPlan(input: {
  readonly locale: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: WebUiDraftTextDirection;
  readonly publishedRevision: number | null;
  readonly existingMessages: WebUiMessageTree;
  readonly englishFlat: Readonly<Record<string, string>>;
  readonly englishPaths: readonly string[];
  readonly englishSourceHash: string;
  readonly pilot?: WebUiMissingOnlyPilotLimits | null;
}): WebUiMissingOnlyCatalogPlan {
  const locale = canonicalizeWebUiDraftLocale(input.locale);
  const existingFlat = flattenStringLeaves(input.existingMessages);
  const englishPathSet = new Set(input.englishPaths);

  for (const pathKey of existingFlat.keys()) {
    if (!englishPathSet.has(pathKey)) {
      throw new WebUiMissingOnlyCatalogError(
        `Existing pack contains path outside the English foundation: ${pathKey}`,
      );
    }
  }

  const allMissingPaths = input.englishPaths.filter((pathKey) => !existingFlat.has(pathKey));
  const pilot = input.pilot ?? null;
  const missingPaths = pilot
    ? selectWebUiMissingOnlyPilotPaths({
        missingPaths: allMissingPaths,
        englishFlat: input.englishFlat,
        maxKeys: pilot.maxKeys,
        maxBatches: pilot.maxBatches,
      })
    : allMissingPaths;

  let missingOrdinaryCount = 0;
  let missingNonOrdinaryCount = 0;
  for (const pathKey of missingPaths) {
    if (isOrdinaryWebUiRequiredPath(pathKey, isPublicReaderWebUiRequiredPath)) {
      missingOrdinaryCount += 1;
    } else {
      missingNonOrdinaryCount += 1;
    }
  }

  const missingFlat: Record<string, string> = {};
  for (const pathKey of missingPaths) {
    missingFlat[pathKey] = input.englishFlat[pathKey] ?? "";
  }
  const batches = planWebUiDraftBatches(missingFlat);
  if (pilot && batches.length > pilot.maxBatches) {
    throw new WebUiMissingOnlyCatalogError(
      `Pilot plan has ${batches.length} batches; max allowed is ${pilot.maxBatches}.`,
    );
  }

  return {
    locale,
    englishName: input.englishName,
    nativeName: input.nativeName,
    textDirection: input.textDirection,
    publishedRevision: input.publishedRevision,
    englishSourceHash: input.englishSourceHash,
    englishKeyCount: input.englishPaths.length,
    existingKeyCount: existingFlat.size,
    missingPaths,
    totalMissingKeyCount: allMissingPaths.length,
    missingOrdinaryCount,
    missingNonOrdinaryCount,
    batchCount: batches.length,
    estimatedProviderCallsMin: batches.length,
    estimatedProviderCallsMax: batches.length * 2,
    batches,
    pilot,
  };
}

function checkpointPaths(
  outRoot: string,
  locale: string,
  pilot: boolean,
): {
  readonly directory: string;
  readonly artifactPath: string;
  readonly planPath: string;
  readonly manifestPath: string;
  readonly mapPath: string;
  readonly existingSnapshotPath: string;
  readonly batchDir: string;
} {
  const stem = pilot ? `web-ui-${locale}-missing-only-pilot` : `web-ui-${locale}-missing-only`;
  const directory = path.join(outRoot, stem);
  return {
    directory,
    artifactPath: path.join(
      outRoot,
      pilot ? `${stem}.json` : `web-ui-${locale}-missing-only-catalog.json`,
    ),
    planPath: path.join(outRoot, `${stem}-plan.json`),
    manifestPath: path.join(directory, "manifest.json"),
    mapPath: path.join(directory, "translated-map.json"),
    existingSnapshotPath: path.join(directory, "existing-snapshot.json"),
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
  const module = await import(
    "../language/terminology-glossary/terminology-glossary.provider-context.js"
  );
  return module.resolveProviderTerminologyContext(locale);
}

function assertCompleteMissingOnlyCatalog(input: {
  readonly messages: WebUiMessageTree;
  readonly englishPaths: readonly string[];
  readonly englishFlat: Readonly<Record<string, string>>;
  readonly existingFlat: ReadonlyMap<string, string>;
}): void {
  const present = flattenStringLeaves(input.messages);
  const englishPathSet = new Set(input.englishPaths);
  const unknown = [...present.keys()].filter((pathKey) => !englishPathSet.has(pathKey)).sort();
  if (unknown.length > 0) {
    throw new WebUiMissingOnlyCatalogError(
      `Unknown WEB_UI paths: ${unknown.slice(0, 8).join(", ")}`,
    );
  }
  if (present.size !== input.englishPaths.length) {
    throw new WebUiMissingOnlyCatalogError(
      `Catalog leaf count ${present.size} does not match English foundation ${input.englishPaths.length}.`,
    );
  }

  const emptyPaths: string[] = [];
  const placeholderMismatchPaths: string[] = [];
  for (const pathKey of input.englishPaths) {
    const value = present.get(pathKey);
    if (typeof value !== "string") {
      throw new WebUiMissingOnlyCatalogError(`Incomplete catalog; missing ${pathKey}.`);
    }
    if (value.trim().length === 0) {
      emptyPaths.push(pathKey);
      continue;
    }
    if (value.includes("⟦w") || value.includes("__HU_BRAND_SITE_NAME__")) {
      throw new WebUiMissingOnlyCatalogError(`Unresolved protection sentinel at ${pathKey}.`);
    }
    // Published leaves are immutable — do not re-litigate their ICU/rich structure.
    if (input.existingFlat.has(pathKey)) {
      continue;
    }
    const english = input.englishFlat[pathKey] ?? "";
    const mismatch = describeStructureMismatch(english, value);
    if (mismatch) {
      placeholderMismatchPaths.push(`${pathKey} (${mismatch})`);
    }
  }
  if (emptyPaths.length > 0) {
    throw new WebUiMissingOnlyCatalogError(
      `Empty WEB_UI values: ${emptyPaths.slice(0, 8).join(", ")}`,
    );
  }
  if (placeholderMismatchPaths.length > 0) {
    throw new WebUiMissingOnlyCatalogError(
      `Placeholder mismatch: ${placeholderMismatchPaths.slice(0, 8).join("; ")}`,
    );
  }
  for (const [pathKey, expected] of input.existingFlat) {
    if (present.get(pathKey) !== expected) {
      throw new WebUiMissingOnlyCatalogError(
        `Existing published leaf was altered at ${pathKey}.`,
      );
    }
  }
}

function parsePublishedRevisionFlag(raw: string | undefined): number | null | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === "null" || raw === "") {
    return null;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new WebUiMissingOnlyCatalogError(
      "publishedRevision must be a positive integer or null.",
    );
  }
  return value;
}

export async function runWebUiMissingOnlyCatalogBuilder(
  input: WebUiMissingOnlyCatalogBuilderInput = {},
): Promise<WebUiMissingOnlyCatalogRunResult> {
  const argv = input.argv ?? [];
  const execute = input.execute ?? argv.includes("--execute");
  const useLiveTerminology =
    input.useLiveTerminology ?? argv.includes("--use-live-terminology");
  const locale = canonicalizeWebUiDraftLocale(
    input.locale ?? readFlag(argv, "--locale") ?? "",
  );

  const englishName = (input.englishName ?? readFlag(argv, "--english-name") ?? "").trim();
  const nativeName = (input.nativeName ?? readFlag(argv, "--native-name") ?? "").trim();
  const textDirectionRaw =
    input.textDirection ?? readFlag(argv, "--text-direction") ?? "";
  if (!englishName || !nativeName) {
    throw new WebUiMissingOnlyCatalogError(
      "englishName and nativeName are required (--english-name / --native-name).",
    );
  }
  if (textDirectionRaw !== "ltr" && textDirectionRaw !== "rtl") {
    throw new WebUiMissingOnlyCatalogError(
      "textDirection must be ltr or rtl (--text-direction).",
    );
  }
  const textDirection = textDirectionRaw;
  const terminologyMode: WebUiDraftTerminologyMode = useLiveTerminology ? "live" : "english-seed";
  const log = input.log ?? ((line: string) => console.log(line));
  const now = input.now ?? (() => new Date().toISOString());

  const existingPack =
    input.existingPack ??
    loadWebUiPublishedPackSnapshotFromFile(
      input.existingPackPath ?? readFlag(argv, "--existing-pack") ?? "",
      locale,
    );
  if (existingPack.locale !== locale) {
    throw new WebUiMissingOnlyCatalogError(
      `Existing pack locale ${existingPack.locale} does not match target ${locale}.`,
    );
  }

  const revisionFlag = parsePublishedRevisionFlag(readFlag(argv, "--published-revision"));
  const publishedRevision =
    input.publishedRevision !== undefined
      ? input.publishedRevision
      : revisionFlag !== undefined
        ? revisionFlag
        : existingPack.revision;

  const pilot = resolveWebUiMissingOnlyPilotLimits({
    pilotMaxKeys:
      input.pilotMaxKeys ?? parsePositiveIntFlag(readFlag(argv, "--pilot-max-keys"), "pilotMaxKeys"),
    pilotMaxBatches:
      input.pilotMaxBatches ??
      parsePositiveIntFlag(readFlag(argv, "--pilot-max-batches"), "pilotMaxBatches"),
  });

  const english = loadEnglishFlat(input.loadEnglishFoundation);
  const existingFlat = flattenStringLeaves(existingPack.messages);
  const plan = computeWebUiMissingOnlyPlan({
    locale,
    englishName,
    nativeName,
    textDirection,
    publishedRevision,
    existingMessages: existingPack.messages,
    englishFlat: english.flat,
    englishPaths: english.paths,
    englishSourceHash: english.sourceHash,
    pilot,
  });

  const outRoot = input.outRoot ?? repoTmpRoot();
  const paths = checkpointPaths(outRoot, locale, pilot != null);
  mkdirSync(outRoot, { recursive: true });
  writeFileSync(
    paths.planPath,
    `${JSON.stringify(
      {
        ...plan,
        batches: plan.batches.map((batch) => ({
          id: batch.id,
          namespace: batch.namespace,
          keyCount: batch.keys.length,
          keys: batch.keys,
        })),
        missingPaths: plan.missingPaths,
      },
      null,
      2,
    )}\n`,
  );

  if (!execute) {
    log(
      [
        pilot ? "WEB_UI missing-only PILOT dry-run" : "WEB_UI missing-only catalog dry-run",
        `locale: ${locale}`,
        `englishName: ${englishName}`,
        `nativeName: ${nativeName}`,
        `textDirection: ${textDirection}`,
        `publishedRevision: ${publishedRevision === null ? "null" : publishedRevision}`,
        `englishKeys: ${plan.englishKeyCount}`,
        `existingKeys: ${plan.existingKeyCount}`,
        `totalMissingKeys: ${plan.totalMissingKeyCount}`,
        `selectedKeys: ${plan.missingPaths.length}`,
        pilot
          ? `pilotLimits: maxKeys=${pilot.maxKeys} maxBatches=${pilot.maxBatches}`
          : "pilotLimits: none",
        `missingOrdinary: ${plan.missingOrdinaryCount}`,
        `missingNonOrdinary: ${plan.missingNonOrdinaryCount}`,
        `batches: ${plan.batchCount}`,
        `estimatedProviderCalls: ${plan.estimatedProviderCallsMin}–${plan.estimatedProviderCallsMax}`,
        `englishSourceHash: ${plan.englishSourceHash}`,
        `plan: ${paths.planPath}`,
        "provider calls: 0",
        "mode: dry-run (pass --execute to generate)",
      ].join("\n"),
    );
    return {
      mode: "dry-run",
      locale,
      englishName,
      nativeName,
      textDirection,
      publishedRevision,
      englishSourceHash: plan.englishSourceHash,
      existingKeyCount: plan.existingKeyCount,
      missingKeyCount: plan.missingPaths.length,
      totalMissingKeyCount: plan.totalMissingKeyCount,
      finalKeyCount:
        pilot != null
          ? plan.existingKeyCount
          : plan.existingKeyCount + plan.missingPaths.length,
      batchCount: plan.batchCount,
      providerCalls: 0,
      completedBatchCount: 0,
      failedBatchCount: 0,
      terminologyMode,
      artifactPath: null,
      planPath: paths.planPath,
      preservedExact: true,
      pilot,
    };
  }

  if (plan.missingPaths.length === 0) {
    throw new WebUiMissingOnlyCatalogError(
      `No missing WEB_UI keys for locale ${locale}; catalog already matches English foundation.`,
    );
  }

  const envProvider = input.env?.TRANSLATION_PROVIDER ?? process.env.TRANSLATION_PROVIDER;
  const envDiagnostic =
    input.env?.HU_READ_ONLY_DIAGNOSTIC ?? process.env.HU_READ_ONLY_DIAGNOSTIC;
  if (envDiagnostic === "1") {
    throw new WebUiMissingOnlyCatalogError(
      "REFUSED: read-only diagnostic cannot call the translation provider.",
    );
  }
  if (envProvider?.trim().toLowerCase() !== "gemini") {
    throw new WebUiMissingOnlyCatalogError(
      "REFUSED: --execute requires TRANSLATION_PROVIDER=gemini.",
    );
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
      throw new WebUiMissingOnlyCatalogError(
        "REFUSED: --execute requires TRANSLATION_PROVIDER=gemini.",
      );
    }
    assertGeminiTranslationConfigured(config);
    modelLabel = config.geminiModel;
    const provider = new GeminiTranslationProvider({
      ...config,
      timeoutMs: resolveOfflineWebUiProviderTimeoutMs(config.timeoutMs),
    });
    translator = (request) => provider.translate(request);
  }

  if (existsSync(paths.directory) && !existsSync(paths.manifestPath)) {
    throw new WebUiMissingOnlyCatalogError(
      "Checkpoint directory is incomplete. Remove it and start again.",
    );
  }
  mkdirSync(paths.batchDir, { recursive: true });

  const expectedKind = pilot != null ? "web-ui-missing-only-pilot" : "web-ui-missing-only";
  const existing = readJson<MissingOnlyManifest>(paths.manifestPath);
  if (existing) {
    if (existing.kind !== expectedKind) {
      throw new WebUiMissingOnlyCatalogError(
        `Checkpoint kind ${existing.kind} does not match this run (${expectedKind}).`,
      );
    }
    if (existing.locale !== locale) {
      throw new WebUiMissingOnlyCatalogError("Checkpoint locale does not match this run.");
    }
    if (existing.englishSourceHash !== plan.englishSourceHash) {
      throw new WebUiMissingOnlyCatalogError(
        "English foundation drift detected (source hash mismatch). Remove the checkpoint directory and start again.",
      );
    }
    if (existing.publishedRevision !== publishedRevision) {
      throw new WebUiMissingOnlyCatalogError(
        `Published revision drift: checkpoint has ${existing.publishedRevision}, run has ${publishedRevision}.`,
      );
    }
    if (existing.existingKeyCount !== plan.existingKeyCount) {
      throw new WebUiMissingOnlyCatalogError(
        "Existing pack key-count drift versus checkpoint. Remove the checkpoint and start again.",
      );
    }
    if (existing.missingKeyCount !== plan.missingPaths.length) {
      throw new WebUiMissingOnlyCatalogError(
        "Missing-path set drift versus checkpoint. Remove the checkpoint and start again.",
      );
    }
    if (
      existing.pilotMaxKeys !== (pilot?.maxKeys ?? null) ||
      existing.pilotMaxBatches !== (pilot?.maxBatches ?? null)
    ) {
      throw new WebUiMissingOnlyCatalogError(
        "Pilot limit drift versus checkpoint. Remove the checkpoint and start again.",
      );
    }
    if (existing.terminologyMode !== terminologyMode) {
      throw new WebUiMissingOnlyCatalogError("Checkpoint terminology mode does not match this run.");
    }
    if (
      existing.englishName !== englishName ||
      existing.nativeName !== nativeName ||
      existing.textDirection !== textDirection ||
      existing.protectionVersion !== PROTECTION_VERSION
    ) {
      throw new WebUiMissingOnlyCatalogError("Checkpoint locale metadata does not match this run.");
    }
    if (
      (existing.provider && existing.provider !== providerLabel) ||
      (existing.model && modelLabel && existing.model !== modelLabel)
    ) {
      throw new WebUiMissingOnlyCatalogError(
        "Checkpoint provider configuration does not match this run.",
      );
    }
  }

  writeFileSync(
    paths.existingSnapshotPath,
    `${JSON.stringify(
      {
        locale,
        revision: publishedRevision,
        existingKeyCount: plan.existingKeyCount,
        existingFingerprint: createHash("sha256")
          .update(
            [...existingFlat.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => `${k}\0${v}`)
              .join("\n"),
          )
          .digest("hex"),
      },
      null,
      2,
    )}\n`,
  );

  const glossary = useLiveTerminology
    ? await (input.loadLiveTerminology ?? defaultLiveTerminology)(locale)
    : HUMANITY_UNION_TRANSLATION_TERMINOLOGY;
  const terminologyContext = buildWebUiDraftTerminologyContext({
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
  const failedBatches: MissingOnlyManifest["failedBatches"][number][] = [];
  const sleep = input.sleep ?? defaultSleep;
  const retryDelayMs = input.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  const writeManifest = (): void => {
    const manifest: MissingOnlyManifest = {
      kind: expectedKind,
      locale,
      englishName,
      nativeName,
      textDirection,
      publishedRevision,
      englishSourceHash: plan.englishSourceHash,
      existingKeyCount: plan.existingKeyCount,
      missingKeyCount: plan.missingPaths.length,
      totalMissingKeyCount: plan.totalMissingKeyCount,
      pilotMaxKeys: pilot?.maxKeys ?? null,
      pilotMaxBatches: pilot?.maxBatches ?? null,
      protectionVersion: PROTECTION_VERSION,
      provider: providerLabel,
      model: modelLabel || null,
      terminologyMode,
      leafCount: plan.missingPaths.length,
      batchCount: plan.batches.length,
      completedBatchCount,
      failedBatchCount,
      failedBatches,
      createdAt,
      updatedAt: now(),
    };
    writeFileSync(paths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  };
  writeManifest();

  for (let batchIndex = 0; batchIndex < plan.batches.length; batchIndex += 1) {
    const batch = plan.batches[batchIndex]!;
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
          locale: locale as LanguageCode,
          englishFlat: english.flat,
          keys: batch.keys,
          terminologyContext,
          translator,
        });
        providerCalls += restoredBatch.providerCalls;
        for (const key of batch.keys) {
          translated[key] = restoredBatch.values[key]!;
        }
        done = true;
        log(`[${batchIndex + 1}/${plan.batches.length}] ${batch.namespace} — ok`);
      } catch (error) {
        lastReason = error instanceof Error ? error.message : "Provider batch failed.";
        if (isWebUiProviderBatchNonRetryable(error) || attempt >= 2) {
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
          writeManifest();
          log(`[${batchIndex + 1}/${plan.batches.length}] ${batch.namespace} — failed`);
          throw new WebUiMissingOnlyCatalogError(lastReason);
        }
        log(`[${batchIndex + 1}/${plan.batches.length}] ${batch.namespace} — retry`);
        await sleep(retryDelayMs);
      }
    }
    if (!done) {
      throw new WebUiMissingOnlyCatalogError(lastReason);
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
    writeManifest();
  }

  for (const pathKey of plan.missingPaths) {
    if (typeof translated[pathKey] !== "string" || translated[pathKey]!.length === 0) {
      throw new WebUiMissingOnlyCatalogError(
        `Incomplete generation; missing translation for ${pathKey}.`,
      );
    }
    if (existingFlat.has(pathKey)) {
      throw new WebUiMissingOnlyCatalogError(
        `REFUSED: attempted to translate an existing published path ${pathKey}.`,
      );
    }
    const englishValue = english.flat[pathKey] ?? "";
    const mismatch = describeStructureMismatch(englishValue, translated[pathKey]!);
    if (mismatch) {
      throw new WebUiMissingOnlyCatalogError(
        `Placeholder mismatch at ${pathKey}: ${mismatch}`,
      );
    }
  }

  if (pilot != null) {
    const englishSample: Record<string, string> = {};
    const translatedSample: Record<string, string> = {};
    for (const pathKey of plan.missingPaths) {
      englishSample[pathKey] = english.flat[pathKey] ?? "";
      translatedSample[pathKey] = translated[pathKey]!;
    }
    writeFileSync(
      paths.artifactPath,
      `${JSON.stringify(
        {
          locale,
          status: "pilot-candidate",
          sourceNote: `${SOURCE_NOTE}; pilot only`,
          publishedRevision,
          englishSourceHash: plan.englishSourceHash,
          englishName,
          nativeName,
          textDirection,
          existingKeyCount: plan.existingKeyCount,
          totalMissingKeyCount: plan.totalMissingKeyCount,
          pilot,
          translatedPaths: plan.missingPaths,
          englishSample,
          translations: translatedSample,
        },
        null,
        2,
      )}\n`,
    );
    writeManifest();
    log(
      [
        "WEB_UI missing-only PILOT complete",
        `locale: ${locale}`,
        `textDirection: ${textDirection}`,
        `publishedRevision: ${publishedRevision === null ? "null" : publishedRevision}`,
        `existingPreserved: ${plan.existingKeyCount}`,
        `pilotTranslated: ${plan.missingPaths.length}`,
        `totalMissingRemaining: ${plan.totalMissingKeyCount - plan.missingPaths.length}`,
        `providerCalls: ${providerCalls}`,
        `artifact: ${paths.artifactPath}`,
        "not published",
      ].join("\n"),
    );
    return {
      mode: "execute",
      locale,
      englishName,
      nativeName,
      textDirection,
      publishedRevision,
      englishSourceHash: plan.englishSourceHash,
      existingKeyCount: plan.existingKeyCount,
      missingKeyCount: plan.missingPaths.length,
      totalMissingKeyCount: plan.totalMissingKeyCount,
      finalKeyCount: plan.existingKeyCount,
      batchCount: plan.batches.length,
      providerCalls,
      completedBatchCount,
      failedBatchCount,
      terminologyMode,
      artifactPath: paths.artifactPath,
      planPath: paths.planPath,
      preservedExact: true,
      pilot,
    };
  }

  const generatedTree = unflattenWebUiMessageMap(
    Object.fromEntries(plan.missingPaths.map((pathKey) => [pathKey, translated[pathKey]!])),
  );
  const merge = mergeMissingPackagedWebUiMessages({
    existing: existingPack.messages,
    packaged: generatedTree,
  });
  if (merge.missingKeyCount !== plan.missingPaths.length) {
    throw new WebUiMissingOnlyCatalogError(
      `Merge added ${merge.missingKeyCount} keys; expected ${plan.missingPaths.length}.`,
    );
  }
  if (merge.expectedFinalCount !== english.paths.length) {
    throw new WebUiMissingOnlyCatalogError(
      `Merged catalog has ${merge.expectedFinalCount} keys; English foundation has ${english.paths.length}.`,
    );
  }

  assertCompleteMissingOnlyCatalog({
    messages: merge.messages,
    englishPaths: english.paths,
    englishFlat: english.flat,
    existingFlat,
  });

  writeFileSync(
    paths.artifactPath,
    `${JSON.stringify(
      {
        locale,
        status: "catalog-candidate",
        sourceNote: SOURCE_NOTE,
        publishedRevision,
        englishSourceHash: plan.englishSourceHash,
        englishName,
        nativeName,
        textDirection,
        existingKeyCount: plan.existingKeyCount,
        addedKeyCount: plan.missingPaths.length,
        messages: merge.messages,
      },
      null,
      2,
    )}\n`,
  );
  writeManifest();

  log(
    [
      "WEB_UI missing-only catalog complete",
      `locale: ${locale}`,
      `textDirection: ${textDirection}`,
      `publishedRevision: ${publishedRevision === null ? "null" : publishedRevision}`,
      `existingPreserved: ${plan.existingKeyCount}`,
      `added: ${plan.missingPaths.length}`,
      `finalKeys: ${merge.expectedFinalCount}`,
      `providerCalls: ${providerCalls}`,
      `artifact: ${paths.artifactPath}`,
      "not published",
    ].join("\n"),
  );

  return {
    mode: "execute",
    locale,
    englishName,
    nativeName,
    textDirection,
    publishedRevision,
    englishSourceHash: plan.englishSourceHash,
    existingKeyCount: plan.existingKeyCount,
    missingKeyCount: plan.missingPaths.length,
    totalMissingKeyCount: plan.totalMissingKeyCount,
    finalKeyCount: merge.expectedFinalCount,
    batchCount: plan.batches.length,
    providerCalls,
    completedBatchCount,
    failedBatchCount,
    terminologyMode,
    artifactPath: paths.artifactPath,
    planPath: paths.planPath,
    preservedExact: true,
    pilot: null,
  };
}
