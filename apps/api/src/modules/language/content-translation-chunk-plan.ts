/**
 * Generic Content Translation chunk planner.
 *
 * Short field maps stay one structured request.
 * Oversized maps are split into ordered segments that fit a conservative
 * output budget. HTML tags, attributes, entities, and URLs are never split.
 * No locale branches and no new environment variables.
 */

import { ContentTranslationValidationError } from "./content-translation-failure-metadata.js";
import { resolveTranslationConfig } from "./translation.config.js";

/** Output characters assumed per token. Conservative for every target language. */
export const CONTENT_TRANSLATION_OUTPUT_CHARS_PER_TOKEN = 2;

/** Source prose may grow this much in the target language, plus JSON wrapping. */
export const CONTENT_TRANSLATION_EXPANSION_FACTOR = 2;

/** Leave headroom under maxOutputTokens so a chunk does not finish on the ceiling. */
export const CONTENT_TRANSLATION_OUTPUT_HEADROOM_NUMERATOR = 3;
export const CONTENT_TRANSLATION_OUTPUT_HEADROOM_DENOMINATOR = 4;

/** One warm attempt may issue at most this many provider requests. */
export const CONTENT_TRANSLATION_MAX_CHUNK_REQUESTS = 24;

const HTML_TOKEN =
  /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g;
const ATOM =
  /&(?:#x[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]+);|https?:\/\/[^\s<>"']+|\s+|[^\s&<]+/g;

export type ContentTranslationPlanMode = "single" | "chunked" | "unsplittable";

type AssemblyPiece =
  | { readonly kind: "raw"; readonly value: string }
  | {
      readonly kind: "slot";
      readonly id: string;
      readonly value: string;
      readonly entry: "whole" | "segment";
    };

type FieldAssembly = {
  readonly key: string;
  readonly pieces: readonly AssemblyPiece[];
};

export type ContentTranslationRequestPlan = {
  readonly capable: boolean;
  readonly mode: ContentTranslationPlanMode;
  readonly requests: readonly Readonly<Record<string, string>>[];
  readonly assembly: readonly FieldAssembly[] | null;
};

export function contentTranslationUsableOutputChars(maxOutputTokens: number): number {
  const tokens = Math.floor(maxOutputTokens);
  return Math.floor(
    (tokens * CONTENT_TRANSLATION_OUTPUT_CHARS_PER_TOKEN * CONTENT_TRANSLATION_OUTPUT_HEADROOM_NUMERATOR) /
      CONTENT_TRANSLATION_OUTPUT_HEADROOM_DENOMINATOR,
  );
}

export function resolveContentTranslationMaxOutputTokens(explicit?: number): number {
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return Math.floor(explicit);
  }
  const configured = resolveTranslationConfig().maxOutputTokens;
  if (Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured);
  }
  return 4096;
}

/**
 * True when this field map can be translated without repeating one oversized
 * structured response. A single in-budget request does not release the
 * truncation hold. An unsplittable atom does not either.
 */
export function contentTranslationChunkPlanReleasesTruncationHold(
  fields: Readonly<Record<string, string>>,
  maxOutputTokens?: number,
): boolean {
  const plan = planContentTranslationRequests(fields, maxOutputTokens);
  return plan.capable && plan.mode === "chunked";
}

export function planContentTranslationRequests(
  fields: Readonly<Record<string, string>>,
  maxOutputTokens?: number,
): ContentTranslationRequestPlan {
  const usable = contentTranslationUsableOutputChars(
    resolveContentTranslationMaxOutputTokens(maxOutputTokens),
  );
  const entries = Object.entries(fields).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  if (entries.length === 0 || estimateDocument(entries) <= usable) {
    return {
      capable: true,
      mode: "single",
      requests: entries.length === 0 ? [] : [Object.fromEntries(entries)],
      assembly: null,
    };
  }

  const maxSourceChars = Math.max(1, Math.floor((usable - 48) / CONTENT_TRANSLATION_EXPANSION_FACTOR));
  const assembly: FieldAssembly[] = [];
  const packed: Array<{ id: string; value: string; estimate: number }> = [];
  let segmentIndex = 0;

  for (const [key, value] of entries) {
    if (value.length === 0) {
      assembly.push({ key, pieces: [{ kind: "raw", value }] });
      continue;
    }
    const wholeEstimate = estimateWholeFieldOutput(key, value);
    if (wholeEstimate <= usable) {
      assembly.push({
        key,
        pieces: [{ kind: "slot", id: key, value, entry: "whole" }],
      });
      packed.push({ id: key, value, estimate: wholeEstimate });
      continue;
    }
    const pieces = segmentOversizedField(value, maxSourceChars, () => {
      const id = `chunk${segmentIndex}`;
      segmentIndex += 1;
      return id;
    });
    if (!pieces) {
      return unsplittable();
    }
    assembly.push({ key, pieces });
    for (const piece of pieces) {
      if (piece.kind !== "slot") {
        continue;
      }
      const estimate = estimateSegment(piece.id, piece.value);
      if (estimate > usable) {
        return unsplittable();
      }
      packed.push({ id: piece.id, value: piece.value, estimate });
    }
  }

  const requests: Record<string, string>[] = [];
  let batch: Record<string, string> = {};
  let used = 2;
  let count = 0;
  const flush = () => {
    if (count === 0) {
      return;
    }
    requests.push(batch);
    batch = {};
    used = 2;
    count = 0;
  };
  for (const entry of packed) {
    if (count > 0 && used + entry.estimate > usable) {
      flush();
    }
    batch[entry.id] = entry.value;
    used += entry.estimate;
    count += 1;
  }
  flush();

  if (requests.length === 0 || requests.length > CONTENT_TRANSLATION_MAX_CHUNK_REQUESTS) {
    return unsplittable();
  }
  return {
    capable: true,
    mode: "chunked",
    requests,
    assembly,
  };
}

export async function translateContentTranslationFieldMap(input: {
  readonly fields: Readonly<Record<string, string>>;
  readonly maxOutputTokens?: number;
  readonly translate: (
    fields: Readonly<Record<string, string>>,
  ) => Promise<Readonly<Record<string, string>>>;
}): Promise<Record<string, string>> {
  const plan = planContentTranslationRequests(input.fields, input.maxOutputTokens);
  if (!plan.capable || plan.mode === "unsplittable") {
    throw new ContentTranslationValidationError(
      "INVALID_PROVIDER_PAYLOAD",
      "Content translation document cannot be split inside the output budget.",
      "malformed_response",
      null,
      null,
      "truncated",
    );
  }
  if (plan.mode === "single") {
    if (plan.requests.length === 0) {
      return {};
    }
    return { ...(await input.translate(input.fields)) };
  }

  const translated = new Map<string, string>();
  for (const request of plan.requests) {
    const response = await input.translate(request);
    for (const key of Object.keys(request)) {
      const value = response[key];
      if (typeof value !== "string" || value.trim().length === 0) {
        throw new ContentTranslationValidationError(
          "INVALID_PROVIDER_PAYLOAD",
          "Translation provider omitted a content chunk.",
          "malformed_response",
          null,
          null,
          "malformed_json",
        );
      }
      translated.set(key, value);
    }
  }

  const assembled: Record<string, string> = {};
  for (const field of plan.assembly ?? []) {
    let text = "";
    for (const piece of field.pieces) {
      if (piece.kind === "raw") {
        text += piece.value;
        continue;
      }
      const value = translated.get(piece.id);
      if (typeof value !== "string") {
        throw new ContentTranslationValidationError(
          "INVALID_PROVIDER_PAYLOAD",
          "Translation provider omitted a content chunk.",
          "malformed_response",
          null,
          null,
          "malformed_json",
        );
      }
      text += value;
    }
    assembled[field.key] = text;
  }
  return assembled;
}

function unsplittable(): ContentTranslationRequestPlan {
  return { capable: false, mode: "unsplittable", requests: [], assembly: null };
}

function estimateDocument(entries: readonly [string, string][]): number {
  let total = 2;
  for (const [key, value] of entries) {
    total += estimateWholeFieldOutput(key, value);
  }
  return total;
}

function estimateWholeFieldOutput(key: string, value: string): number {
  const measured = measureCopiedAndProse(value);
  return key.length + 12 + measured.copied + Math.ceil(measured.prose * CONTENT_TRANSLATION_EXPANSION_FACTOR);
}

function estimateSegment(id: string, value: string): number {
  return id.length + 8 + Math.ceil(value.length * CONTENT_TRANSLATION_EXPANSION_FACTOR);
}

function measureCopiedAndProse(value: string): { copied: number; prose: number } {
  if (!looksLikeHtml(value)) {
    let copied = 0;
    let prose = 0;
    for (const atom of splitAtoms(value)) {
      if (atom.translatable) {
        prose += atom.value.length;
      } else {
        copied += atom.value.length;
      }
    }
    return { copied, prose };
  }
  let copied = 0;
  let prose = 0;
  for (const token of tokenizeHtml(value)) {
    if (token.kind === "raw") {
      copied += token.value.length;
      continue;
    }
    for (const atom of splitAtoms(token.value)) {
      if (atom.translatable) {
        prose += atom.value.length;
      } else {
        copied += atom.value.length;
      }
    }
  }
  return { copied, prose };
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-zA-Z][^>]*>/.test(value);
}

function tokenizeHtml(value: string): Array<{ kind: "raw" | "text"; value: string }> {
  const out: Array<{ kind: "raw" | "text"; value: string }> = [];
  const re = new RegExp(HTML_TOKEN.source, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    if (match.index > cursor) {
      out.push({ kind: "text", value: value.slice(cursor, match.index) });
    }
    const token = match[0];
    if (token.length === 0) {
      break;
    }
    out.push({ kind: token.startsWith("<") ? "raw" : "text", value: token });
    cursor = match.index + token.length;
  }
  if (cursor < value.length) {
    out.push({ kind: "text", value: value.slice(cursor) });
  }
  return out;
}

function splitAtoms(text: string): Array<{ translatable: boolean; value: string }> {
  const atoms: Array<{ translatable: boolean; value: string }> = [];
  const re = new RegExp(ATOM.source, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > cursor) {
      atoms.push({ translatable: true, value: text.slice(cursor, match.index) });
    }
    const value = match[0];
    if (value.length === 0) {
      break;
    }
    const translatable = !/^\s+$/.test(value) && !value.startsWith("&") && !/^https?:\/\//.test(value);
    atoms.push({ translatable, value });
    cursor = match.index + value.length;
  }
  if (cursor < text.length) {
    atoms.push({ translatable: true, value: text.slice(cursor) });
  }
  return atoms;
}

function segmentOversizedField(
  value: string,
  maxSourceChars: number,
  nextId: () => string,
): AssemblyPiece[] | null {
  const pieces: AssemblyPiece[] = [];
  const pushAtoms = (text: string): boolean => {
    const groups = groupAtoms(splitAtoms(text), maxSourceChars);
    if (!groups) {
      return false;
    }
    for (const group of groups) {
      if (!group.translatable) {
        pieces.push({ kind: "raw", value: group.value });
        continue;
      }
      pieces.push({
        kind: "slot",
        id: nextId(),
        value: group.value,
        entry: "segment",
      });
    }
    return true;
  };

  if (!looksLikeHtml(value)) {
    return pushAtoms(value) ? pieces : null;
  }
  for (const token of tokenizeHtml(value)) {
    if (token.kind === "raw") {
      pieces.push({ kind: "raw", value: token.value });
      continue;
    }
    if (!pushAtoms(token.value)) {
      return null;
    }
  }
  return pieces;
}

function groupAtoms(
  atoms: readonly { translatable: boolean; value: string }[],
  maxSourceChars: number,
): Array<{ translatable: boolean; value: string }> | null {
  const groups: Array<{ translatable: boolean; value: string }> = [];
  let slot = "";
  let pendingWhitespace = "";
  const flushSlot = () => {
    if (!slot) {
      return;
    }
    groups.push({ translatable: true, value: slot });
    slot = "";
  };
  const flushWhitespace = () => {
    if (!pendingWhitespace) {
      return;
    }
    groups.push({ translatable: false, value: pendingWhitespace });
    pendingWhitespace = "";
  };
  for (const atom of atoms) {
    const whitespace = /^\s+$/.test(atom.value);
    if (!atom.translatable && !whitespace) {
      flushSlot();
      flushWhitespace();
      groups.push({ translatable: false, value: atom.value });
      continue;
    }
    if (whitespace) {
      if (slot) {
        pendingWhitespace += atom.value;
      } else {
        groups.push({ translatable: false, value: atom.value });
      }
      continue;
    }
    if (atom.value.length > maxSourceChars) {
      return null;
    }
    const pendingLength = pendingWhitespace.length;
    if (slot && slot.length + pendingLength + atom.value.length > maxSourceChars) {
      flushSlot();
      flushWhitespace();
    }
    if (pendingWhitespace) {
      slot += pendingWhitespace;
      pendingWhitespace = "";
    }
    slot += atom.value;
  }
  flushSlot();
  flushWhitespace();
  return groups;
}
