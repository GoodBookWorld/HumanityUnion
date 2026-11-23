/**
 * Plan an explicit published-leaf replacement from the packaged WEB_UI catalog.
 * Does not write, translate, or include keys the caller did not name.
 */

import type { LanguageWebUiReadinessSlice, WebUiMessagePackRecord, WebUiMessagePackStatus, WebUiMessageTree } from "@hu/types";

import {
  describeStructureMismatch,
  loadBundledEnglishWebUiMessagePack,
} from "./web-ui-message-pack.validate.js";

export interface SelectedPackagedReplacement {
  readonly path: string;
  readonly existingValue: string;
  readonly proposedValue: string;
}

export interface PlannedSelectedUpdateEntry {
  readonly path: string;
  readonly existingValue: string | null;
  readonly proposedValue: string | null;
  readonly errors: readonly string[];
}

/** Same contract as WebUiMessagePackSelectedUpdatePreview in @hu/types. */
export interface WebUiSelectedUpdatePreview {
  readonly locale: string;
  readonly currentRevision: number | null;
  readonly packStatus: WebUiMessagePackStatus | null;
  readonly selectedKeyCount: number;
  readonly entries: readonly PlannedSelectedUpdateEntry[];
  readonly validationErrors: readonly string[];
}

/** Same contract as WebUiMessagePackSelectedUpdateResult in @hu/types. */
export interface WebUiSelectedUpdateResult {
  readonly locale: string;
  readonly pack: WebUiMessagePackRecord;
  readonly updatedKeyCount: number;
  readonly paths: readonly string[];
  readonly readiness: LanguageWebUiReadinessSlice;
}

export interface PlannedSelectedPackagedUpdate {
  readonly entries: readonly PlannedSelectedUpdateEntry[];
  readonly validationErrors: readonly string[];
  /** Present only when every selected replacement can be applied exactly. */
  readonly messages: WebUiMessageTree | null;
}

const CONSENT_PATH = "rrpApplication.admin.fields.consentAccepted";
const LEGAL_NAME = "Humanity Union Society";

type MutableTree = { [key: string]: string | MutableTree };

function readLeaf(tree: unknown, dottedPath: string): unknown {
  let current = tree;
  for (const segment of dottedPath.split(".")) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function writeLeaf(tree: MutableTree, dottedPath: string, value: string): void {
  const parts = dottedPath.split(".");
  let cursor: MutableTree = tree;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const next = cursor[parts[index] ?? ""];
    if (next == null || typeof next !== "object" || Array.isArray(next)) {
      return;
    }
    cursor = next;
  }
  cursor[parts[parts.length - 1] ?? ""] = value;
}

export function selectedTranslationProtectionError(
  path: string,
  existingValue: string | null,
  proposedValue: string | null,
): string | null {
  if (path === CONSENT_PATH) {
    return "RRP consent string cannot be changed.";
  }
  if (path === "legalPublic" || path.startsWith("legalPublic.")) {
    return "Privacy Policy text cannot be changed.";
  }
  if (/videoChat|video-chat|liveKit|live-kit/i.test(path)) {
    return "Video Chat text cannot be changed.";
  }
  if (existingValue?.includes(LEGAL_NAME) || proposedValue?.includes(LEGAL_NAME)) {
    return "Humanity Union Society cannot be changed.";
  }
  return null;
}

export function planSelectedPackagedWebUiUpdates(input: {
  readonly paths: readonly string[];
  readonly published: WebUiMessageTree | null;
  readonly packaged: WebUiMessageTree | null;
  readonly replacements?: readonly SelectedPackagedReplacement[];
}): PlannedSelectedPackagedUpdate {
  const validationErrors: string[] = [];
  if (input.paths.length === 0) {
    validationErrors.push("At least one selected key path is required.");
  }
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const path of input.paths) {
    if (seen.has(path)) {
      duplicate.add(path);
    }
    seen.add(path);
  }
  for (const path of duplicate) {
    validationErrors.push(`Duplicate selected path: ${path}`);
  }

  const replacementByPath = new Map<string, SelectedPackagedReplacement>();
  for (const replacement of input.replacements ?? []) {
    replacementByPath.set(replacement.path, replacement);
  }

  const english = loadBundledEnglishWebUiMessagePack();
  const entries: PlannedSelectedUpdateEntry[] = [];
  const applicable: Array<{ path: string; proposedValue: string }> = [];

  for (const path of input.paths) {
    if (duplicate.has(path)) {
      continue;
    }
    const errors: string[] = [];
    if (!path.trim() || path.split(".").some((segment) => segment.length === 0)) {
      errors.push("Missing selected path.");
      entries.push({ path, existingValue: null, proposedValue: null, errors });
      continue;
    }

    const englishValue = readLeaf(english, path);
    const publishedValue = input.published ? readLeaf(input.published, path) : undefined;
    const packagedValue = input.packaged ? readLeaf(input.packaged, path) : undefined;
    const existingValue = typeof publishedValue === "string" ? publishedValue : null;
    const proposedValue = typeof packagedValue === "string" ? packagedValue : null;

    if (input.published == null) {
      errors.push("No published WEB_UI pack exists for this locale.");
    } else if (publishedValue === undefined) {
      errors.push("Missing selected published value.");
    } else if (typeof publishedValue !== "string") {
      errors.push("Invalid value type.");
    }

    if (input.packaged == null) {
      errors.push("No packaged WEB_UI catalog is available for this locale.");
    } else if (packagedValue === undefined) {
      errors.push("Missing selected packaged value.");
    } else if (typeof packagedValue !== "string") {
      errors.push("Invalid value type.");
    }

    if (typeof englishValue !== "string") {
      errors.push("Unknown key path.");
    }

    const replacement = replacementByPath.get(path);
    if (input.replacements && !replacement) {
      errors.push("Missing selected replacement value.");
    }
    if (replacement && existingValue != null && replacement.existingValue !== existingValue) {
      errors.push("Existing value does not match the published value.");
    }
    if (replacement && proposedValue != null && replacement.proposedValue !== proposedValue) {
      errors.push("Proposed value is not the packaged catalog value.");
    }
    if (
      replacement &&
      typeof replacement.existingValue !== "string"
    ) {
      errors.push("Invalid value type.");
    }
    if (
      replacement &&
      typeof replacement.proposedValue !== "string"
    ) {
      errors.push("Invalid value type.");
    }

    const confirmedProposed = replacement?.proposedValue ?? proposedValue;
    const protection = selectedTranslationProtectionError(path, existingValue, confirmedProposed);
    if (protection) {
      errors.push(protection);
    }

    if (typeof englishValue === "string" && typeof confirmedProposed === "string") {
      const mismatch = describeStructureMismatch(englishValue, confirmedProposed);
      if (mismatch) {
        errors.push(`Invalid placeholder set: ${mismatch}`);
      }
      if (confirmedProposed.trim().length === 0) {
        errors.push("Missing selected value.");
      }
    }

    if (
      errors.length === 0 &&
      existingValue != null &&
      confirmedProposed != null &&
      existingValue === confirmedProposed
    ) {
      errors.push("Selected value is unchanged.");
    }

    if (errors.length === 0 && confirmedProposed != null) {
      applicable.push({ path, proposedValue: confirmedProposed });
    }
    entries.push({
      path,
      existingValue,
      proposedValue: confirmedProposed,
      errors,
    });
  }

  const entryErrors = entries.some((entry) => entry.errors.length > 0);
  if (validationErrors.length > 0 || entryErrors || input.published == null) {
    return { entries, validationErrors, messages: null };
  }

  const messages = structuredClone(input.published) as MutableTree;
  for (const update of applicable) {
    writeLeaf(messages, update.path, update.proposedValue);
  }
  return { entries, validationErrors, messages };
}
