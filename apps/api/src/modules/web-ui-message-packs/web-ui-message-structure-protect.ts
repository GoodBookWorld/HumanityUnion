/**
 * Protect WEB_UI message syntax before an offline provider call, then restore it.
 * Natural language inside an ICU branch stays translatable. Token names do not.
 */

import {
  protectBrandTokensForMachineTranslation,
  restoreBrandTokensAfterMachineTranslation,
} from "@hu/types";

import { advanceIcuApostropheFriendly } from "./web-ui-icu-apostrophe.js";

const ICU_TYPES = new Set(["plural", "select", "selectordinal"]);
const BRAND_MACHINE_SENTINEL = "__HU_BRAND_SITE_NAME__";

function sentinelPattern(): RegExp {
  return /⟦w(\d+)⟧/g;
}

/** Exact internal protection token grammar (`⟦w0⟧`, `⟦w12⟧`, …). */
export const WEB_UI_PROTECTION_SENTINEL_PATTERN = /⟦w\d+⟧/g;

/**
 * Step 15D.4.1 — when English has zero protected slots, remove exact invented
 * protection tokens the provider may have hallucinated. Does not touch other
 * bracketed text or invalid sentinel-like syntax.
 */
export function stripInventedZeroSlotProtectionSentinels(providerValue: string): string {
  const without = providerValue.replace(WEB_UI_PROTECTION_SENTINEL_PATTERN, "");
  // Collapse horizontal whitespace runs created by token removal; keep newlines.
  return without.replace(/[^\S\n]{2,}/g, " ").trim();
}

export function countExactProtectionSentinels(value: string): number {
  return [...value.matchAll(sentinelPattern())].length;
}

/** True when any protected payload value already contains exact `⟦wN⟧` tokens. */
export function batchProtectedPayloadContainsSentinels(
  protectedPayload: Readonly<Record<string, string>>,
): boolean {
  return Object.values(protectedPayload).some((text) => countExactProtectionSentinels(text) > 0);
}

/**
 * Step 15D.4.1 — sentinel copy rules only when the protected payload actually has slots.
 * Locale-independent.
 */
export function webUiProtectionSentinelInstructions(batchContainsProtectionSentinels: boolean): string {
  if (batchContainsProtectionSentinels) {
    return [
      "Values may contain protection sentinels such as ⟦w0⟧.",
      "Copy every sentinel exactly. Do not translate, reorder, split, or drop sentinels.",
      "Translate only natural-language text around sentinels.",
    ].join("\n");
  }
  return "These values contain no protection tokens. Do not invent tokens such as ⟦w0⟧.";
}

/**
 * Provider-facing copy for the span contract.
 * Every leaf is an ordered array of non-empty human spans.
 * Empty spans, placeholders, ICU grammar, and Brand sentinels stay local.
 */
export function webUiProviderSpanInstructions(): string {
  return [
    "Every catalog key is independent.",
    "Return one JSON object with the same keys.",
    "Each value must be a JSON array of strings.",
    "Do not return a scalar string for any key, including a key with one fragment.",
    "Do not flatten arrays across keys.",
    "Each key has its own array length. Do not copy one key's length onto another.",
    "Preserve fragment order.",
    "Do not merge, split, add, or omit fragments.",
    "Do not insert placeholders, tags, or brace expressions.",
    "Empty structural spans are not included in this request. Do not add empty strings.",
  ].join("\n");
}

/**
 * Exact integer length for each requested leaf, in request order.
 * The lines name the count only. They do not repeat fragment text.
 */
export function webUiProviderCardinalityLines(input: {
  readonly keys: readonly string[];
  readonly payload: Readonly<Record<string, readonly string[]>>;
}): string {
  return input.keys
    .map((key) => {
      const count = input.payload[key]?.length ?? 0;
      return [
        `${key} expects exactly ${count} translated strings.`,
        `Return one JSON array of length ${count}.`,
        "Preserve order.",
        "Do not merge, split, add, or omit fragments.",
        "Do not convert the array into a scalar string.",
      ].join(" ");
    })
    .join("\n");
}

export class WebUiMessageStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebUiMessageStructureError";
  }
}

/** Provider JSON shape did not match the span contract. Not a reconstructed-structure failure. */
export class WebUiProviderPayloadShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebUiProviderPayloadShapeError";
  }
}

/**
 * One leaf returned an array of the wrong length.
 * catalogKey is the first leaf rejected in request order.
 * The message carries counts only, never translated text.
 */
export class WebUiProviderSpanCountError extends WebUiProviderPayloadShapeError {
  readonly catalogKey: string | null;
  readonly expectedSpanCount: number;
  readonly actualSpanCount: number;

  constructor(input: {
    readonly catalogKey?: string | null;
    readonly expectedSpanCount: number;
    readonly actualSpanCount: number;
  }) {
    super(
      `Provider span count ${input.actualSpanCount} does not match ${input.expectedSpanCount}.`,
    );
    this.name = "WebUiProviderSpanCountError";
    this.catalogKey = input.catalogKey ?? null;
    this.expectedSpanCount = input.expectedSpanCount;
    this.actualSpanCount = input.actualSpanCount;
  }
}

export interface WebUiProviderSegmentPlan {
  readonly plain: boolean;
  /** Human spans in source order, including empty spans that are not sent. */
  readonly spans: readonly string[];
  /** Original protected elements in source order. Not sent to the provider. */
  readonly slots: readonly string[];
  /** Indexes of non-empty spans, in source order. */
  readonly providerSpanIndexes: readonly number[];
}

export interface ProtectedWebUiMessage {
  readonly text: string;
  readonly slots: readonly string[];
}

function slot(slots: string[], raw: string): string {
  const token = `⟦w${slots.length}⟧`;
  slots.push(raw);
  return token;
}

function skipWs(input: string, index: number): number {
  let cursor = index;
  while (cursor < input.length && /\s/.test(input[cursor] ?? "")) {
    cursor += 1;
  }
  return cursor;
}

function readIdent(input: string, index: number): string | null {
  const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(input.slice(index));
  return match?.[0] ?? null;
}

function readTag(input: string, index: number): { readonly raw: string; readonly next: number } | null {
  const match = /^<\/?[A-Za-z][A-Za-z0-9]*\b[^>]*>/.exec(input.slice(index));
  if (!match?.[0]) {
    return null;
  }
  return { raw: match[0], next: index + match[0].length };
}

function findBalancedEnd(
  input: string,
  openIndex: number,
  numberSignRequiresQuote = false,
): number {
  let depth = 0;
  let index = openIndex;
  while (index < input.length) {
    if (input[index] === "'") {
      index = advanceIcuApostropheFriendly(input, index, {
        numberSignRequiresQuote,
      }).nextIndex;
      continue;
    }
    if (input[index] === "{") {
      depth += 1;
    } else if (input[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
    index += 1;
  }
  return input.length;
}

function parseMessage(
  input: string,
  index: number,
  slots: string[],
  stopOnBrace: boolean,
  numberSignRequiresQuote = false,
): { readonly text: string; readonly index: number } {
  let text = "";
  while (index < input.length) {
    if (stopOnBrace && input[index] === "}") {
      return { text, index };
    }
    if (input[index] === "'") {
      const start = index;
      const advanced = advanceIcuApostropheFriendly(input, index, {
        numberSignRequiresQuote,
      });
      // Preserve apostrophes and any quoted literal syntax exactly for the provider.
      text += input.slice(start, advanced.nextIndex);
      index = advanced.nextIndex;
      continue;
    }
    if (input.startsWith(BRAND_MACHINE_SENTINEL, index)) {
      text += slot(slots, BRAND_MACHINE_SENTINEL);
      index += BRAND_MACHINE_SENTINEL.length;
      continue;
    }
    if (input[index] === "<") {
      const tag = readTag(input, index);
      if (tag) {
        text += slot(slots, tag.raw);
        index = tag.next;
        continue;
      }
    }
    if (input[index] === "#") {
      const previous = index === 0 ? "" : (input[index - 1] ?? "");
      const next = input[index + 1] ?? "";
      if (!/[A-Za-z0-9_]/.test(previous) && !/[A-Za-z0-9_]/.test(next)) {
        text += slot(slots, "#");
        index += 1;
        continue;
      }
    }
    if (input[index] === "{") {
      const argument = parseArgument(input, index, slots);
      text += argument.text;
      index = argument.index;
      continue;
    }
    text += input[index];
    index += 1;
  }
  return { text, index };
}

function parseArgument(
  input: string,
  openIndex: number,
  slots: string[],
): { readonly text: string; readonly index: number } {
  const slotMark = slots.length;
  const name = readIdent(input, openIndex + 1);
  const typePeek = (() => {
    if (!name) {
      return null;
    }
    const afterName = skipWs(input, openIndex + 1 + name.length);
    if (input[afterName] !== ",") {
      return null;
    }
    const typeStart = skipWs(input, afterName + 1);
    return readIdent(input, typeStart);
  })();
  const numberSignRequiresQuote =
    typePeek === "plural" || typePeek === "selectordinal";

  const abandon = (): { readonly text: string; readonly index: number } => {
    slots.length = slotMark;
    const end = findBalancedEnd(input, openIndex, numberSignRequiresQuote);
    return { text: slot(slots, input.slice(openIndex, end)), index: end };
  };
  if (!name) {
    return { text: "{", index: openIndex + 1 };
  }
  const afterName = skipWs(input, openIndex + 1 + name.length);
  if (input[afterName] === "}") {
    return {
      text: slot(slots, input.slice(openIndex, afterName + 1)),
      index: afterName + 1,
    };
  }
  if (input[afterName] !== ",") {
    return abandon();
  }

  let cursor = skipWs(input, afterName + 1);
  const type = readIdent(input, cursor);
  if (!type || !ICU_TYPES.has(type)) {
    return abandon();
  }
  cursor += type.length;
  cursor = skipWs(input, cursor);
  if (input[cursor] !== ",") {
    return abandon();
  }
  cursor += 1;
  const offsetStart = skipWs(input, cursor);
  if (input.slice(offsetStart, offsetStart + 7).toLowerCase() === "offset:") {
    let offsetEnd = offsetStart + 7;
    offsetEnd = skipWs(input, offsetEnd);
    while (/[0-9]/.test(input[offsetEnd] ?? "")) {
      offsetEnd += 1;
    }
    cursor = offsetEnd;
  }

  let text = slot(slots, input.slice(openIndex, cursor));
  while (cursor < input.length) {
    if (input[skipWs(input, cursor)] === "}") {
      const close = skipWs(input, cursor);
      text += slot(slots, input.slice(cursor, close + 1));
      return { text, index: close + 1 };
    }
    const selectorStart = cursor;
    cursor = skipWs(input, cursor);
    if (input[cursor] === "=") {
      cursor += 1;
      while (/[0-9]/.test(input[cursor] ?? "")) {
        cursor += 1;
      }
    } else {
      const selector = readIdent(input, cursor);
      if (!selector) {
        return abandon();
      }
      cursor += selector.length;
    }
    cursor = skipWs(input, cursor);
    if (input[cursor] !== "{") {
      return abandon();
    }
    text += slot(slots, input.slice(selectorStart, cursor + 1));
    cursor += 1;
    const inner = parseMessage(
      input,
      cursor,
      slots,
      true,
      numberSignRequiresQuote,
    );
    text += inner.text;
    cursor = inner.index;
    if (input[cursor] !== "}") {
      return abandon();
    }
    text += slot(slots, "}");
    cursor += 1;
  }

  return abandon();
}

/** Mask Brand, placeholders, ICU syntax, and rich-text tags. Inner words stay visible. */
export function protectWebUiMessageForProvider(english: string): ProtectedWebUiMessage {
  if (english.includes("⟦w")) {
    throw new WebUiMessageStructureError("English source already contains a protection sentinel.");
  }
  const brandProtected = protectBrandTokensForMachineTranslation(english);
  const slots: string[] = [];
  const parsed = parseMessage(brandProtected, 0, slots, false);
  return { text: parsed.text, slots };
}

const SENTINEL_SPLIT = /⟦w\d+⟧/;

/**
 * Split a message into human spans and protected slots.
 * The provider receives only non-empty human spans. Slots stay in application memory.
 */
export function segmentWebUiMessageForProvider(english: string): WebUiProviderSegmentPlan {
  const protectedMessage = protectWebUiMessageForProvider(english);
  if (protectedMessage.slots.length === 0) {
    return {
      plain: true,
      spans: [english],
      slots: [],
      providerSpanIndexes: [],
    };
  }
  const spans = protectedMessage.text.split(SENTINEL_SPLIT);
  if (spans.length !== protectedMessage.slots.length + 1) {
    throw new WebUiMessageStructureError("Protection extraction did not cover the message.");
  }
  return {
    plain: false,
    spans,
    slots: protectedMessage.slots,
    providerSpanIndexes: spans.flatMap((span, index) => (span.length > 0 ? [index] : [])),
  };
}

/**
 * Value placed under one catalog key in the batch JSON request.
 * Plain and structured leaves use the same array grammar.
 */
export function webUiProviderPayloadValue(english: string): readonly string[] {
  const plan = segmentWebUiMessageForProvider(english);
  if (plan.plain) {
    return [english];
  }
  return plan.providerSpanIndexes.map((index) => plan.spans[index] ?? "");
}

/**
 * Interleave translated human spans with the original slots in source order.
 * Brand machine sentinels are restored to `{siteName}` here. Placeholder movement is not accepted.
 */
export function reconstructWebUiMessageFromProviderSpans(
  english: string,
  providerValue: string | readonly string[],
): string {
  const plan = segmentWebUiMessageForProvider(english);
  const expectedCount = plan.plain ? 1 : plan.providerSpanIndexes.length;
  if (!Array.isArray(providerValue) || providerValue.some((span) => typeof span !== "string")) {
    throw new WebUiProviderPayloadShapeError("Provider span list must be an array of strings.");
  }
  if (providerValue.length !== expectedCount) {
    throw new WebUiProviderSpanCountError({
      expectedSpanCount: expectedCount,
      actualSpanCount: providerValue.length,
    });
  }
  if (plan.plain) {
    return providerValue[0] ?? "";
  }
  const translated = [...plan.spans];
  plan.providerSpanIndexes.forEach((spanIndex, providerIndex) => {
    translated[spanIndex] = providerValue[providerIndex] ?? "";
  });
  let text = "";
  for (let index = 0; index < translated.length; index += 1) {
    text += translated[index] ?? "";
    if (index < plan.slots.length) {
      text += plan.slots[index] ?? "";
    }
  }
  return restoreBrandTokensAfterMachineTranslation(text);
}

/** Restore sentinels produced from the canonical English string. Rejects drift.
 * Step 15D.4.1: when English has zero slots, strip exact invented `⟦wN⟧` tokens
 * then re-run the ordinary restore contract. Slots > 0 stay strictly unchanged.
 */
export function restoreWebUiMessageFromProvider(providerValue: string, english: string): string {
  const protectedMessage = protectWebUiMessageForProvider(english);
  let value = providerValue;
  if (
    protectedMessage.slots.length === 0 &&
    countExactProtectionSentinels(value) > 0
  ) {
    value = stripInventedZeroSlotProtectionSentinels(value);
  }
  const matches = [...value.matchAll(sentinelPattern())];
  if (matches.length !== protectedMessage.slots.length) {
    throw new WebUiMessageStructureError(
      `Protection sentinel count ${matches.length} does not match ${protectedMessage.slots.length}.`,
    );
  }
  for (let index = 0; index < matches.length; index += 1) {
    if (Number(matches[index]?.[1]) !== index) {
      throw new WebUiMessageStructureError("Protection sentinels were reordered or renumbered.");
    }
  }
  const restoredSlots = value.replace(sentinelPattern(), (_match, rawIndex: string) => {
    const slotValue = protectedMessage.slots[Number(rawIndex)];
    if (slotValue === undefined) {
      throw new WebUiMessageStructureError("Protection sentinel index is missing.");
    }
    return slotValue;
  });
  const restored = restoreBrandTokensAfterMachineTranslation(restoredSlots);
  if (restored.includes("⟦w") || restored.includes(BRAND_MACHINE_SENTINEL)) {
    throw new WebUiMessageStructureError("Unresolved protection sentinel remains.");
  }
  return restored;
}
