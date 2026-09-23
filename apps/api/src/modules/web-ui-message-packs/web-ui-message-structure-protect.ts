/**
 * Protect WEB_UI message syntax before an offline provider call, then restore it.
 * Natural language inside an ICU branch stays translatable. Token names do not.
 */

import {
  protectBrandTokensForMachineTranslation,
  restoreBrandTokensAfterMachineTranslation,
} from "@hu/types";

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

export class WebUiMessageStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebUiMessageStructureError";
  }
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

function findBalancedEnd(input: string, openIndex: number): number {
  let depth = 0;
  let index = openIndex;
  while (index < input.length) {
    if (input[index] === "'" && input[index + 1] === "'") {
      index += 2;
      continue;
    }
    if (input[index] === "'") {
      const end = input.indexOf("'", index + 1);
      index = end === -1 ? input.length : end + 1;
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
): { readonly text: string; readonly index: number } {
  let text = "";
  while (index < input.length) {
    if (stopOnBrace && input[index] === "}") {
      return { text, index };
    }
    if (input[index] === "'" && input[index + 1] === "'") {
      text += "''";
      index += 2;
      continue;
    }
    if (input[index] === "'") {
      const end = input.indexOf("'", index + 1);
      const next = end === -1 ? input.length : end + 1;
      text += input.slice(index, next);
      index = next;
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
  const abandon = (): { readonly text: string; readonly index: number } => {
    slots.length = slotMark;
    const end = findBalancedEnd(input, openIndex);
    return { text: slot(slots, input.slice(openIndex, end)), index: end };
  };
  const name = readIdent(input, openIndex + 1);
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
    const inner = parseMessage(input, cursor, slots, true);
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
