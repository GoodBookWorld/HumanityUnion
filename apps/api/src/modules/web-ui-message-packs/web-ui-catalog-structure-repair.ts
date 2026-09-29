/**
 * Rebuild a localized WEB_UI leaf whose human text is intact but whose ICU
 * skeleton was flattened. Slots stay on the English span plan. The provider
 * is not called.
 */

import type { WebUiMessageTree } from "@hu/types";

import { describeStructureMismatch } from "./web-ui-message-pack.validate.js";
import {
  reconstructWebUiMessageFromProviderSpans,
  segmentWebUiMessageForProvider,
  type WebUiProviderSegmentPlan,
} from "./web-ui-message-structure-protect.js";

const ICU_SKELETON = /^\{([A-Za-z_][A-Za-z0-9_]*),\s*(?:plural|select|selectordinal)\b/;
const SELECTOR_OPEN = /^\s*(?:[A-Za-z_][A-Za-z0-9_]*|=\d+)\s*\{$/;
const SIMPLE_SLOT = /^\{[A-Za-z_][A-Za-z0-9_]*\}$/;

type BranchShape = {
  readonly spans: readonly string[];
  readonly placeholders: readonly string[];
};

/**
 * Return the localized message when it already matches English.
 * When English is representable and the localized leaf flattened an ICU
 * branch, rebuild it from the localized human spans. Otherwise return the
 * localized message unchanged so validation can still reject it.
 */
export function repairRepresentableLocalizedWebUiMessage(
  english: string,
  localized: string,
): string {
  if (describeStructureMismatch(english, localized) == null) {
    return localized;
  }
  const repaired = tryReembedFlattenedIcuBranches(english, localized);
  if (repaired == null || describeStructureMismatch(english, repaired) != null) {
    return localized;
  }
  return repaired;
}

export function repairLocalizedWebUiCatalogTree(
  english: WebUiMessageTree,
  localized: WebUiMessageTree,
): WebUiMessageTree {
  return repairNode(english, localized) as WebUiMessageTree;
}

function repairNode(english: unknown, localized: unknown): unknown {
  if (typeof english === "string" && typeof localized === "string") {
    return repairRepresentableLocalizedWebUiMessage(english, localized);
  }
  if (
    english == null ||
    localized == null ||
    typeof english !== "object" ||
    typeof localized !== "object" ||
    Array.isArray(english) ||
    Array.isArray(localized)
  ) {
    return localized;
  }
  const englishRecord = english as Record<string, unknown>;
  const localizedRecord = localized as Record<string, unknown>;
  const next: Record<string, unknown> = { ...localizedRecord };
  for (const [key, localizedValue] of Object.entries(localizedRecord)) {
    if (Object.prototype.hasOwnProperty.call(englishRecord, key)) {
      next[key] = repairNode(englishRecord[key], localizedValue);
    }
  }
  return next;
}

function tryReembedFlattenedIcuBranches(english: string, localized: string): string | null {
  let plan: WebUiProviderSegmentPlan;
  try {
    plan = segmentWebUiMessageForProvider(english);
  } catch {
    return null;
  }
  const branches = icuBranches(plan);
  if (branches == null) {
    return null;
  }
  const signature = JSON.stringify(branches[0]?.placeholders ?? []);
  const spanCount = branches[0]?.spans.length ?? 0;
  if (
    spanCount === 0 ||
    branches.some(
      (branch) =>
        JSON.stringify(branch.placeholders) !== signature || branch.spans.length !== spanCount,
    )
  ) {
    return null;
  }
  const pluralVariable = pluralVariableName(plan);
  if (!pluralVariable) {
    return null;
  }
  const flattened = flattenedBranch(localized, pluralVariable);
  if (
    flattened == null ||
    JSON.stringify(flattened.placeholders) !== signature ||
    flattened.spans.length !== spanCount
  ) {
    return null;
  }
  const translated = localizedSpansOnEnglishPlan(plan, flattened.spans);
  if (translated == null) {
    return null;
  }
  try {
    return reconstructWebUiMessageFromProviderSpans(english, translated);
  } catch {
    return null;
  }
}

function pluralVariableName(plan: WebUiProviderSegmentPlan): string | null {
  for (const slot of plan.slots) {
    const match = ICU_SKELETON.exec(slot);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

function icuBranches(plan: WebUiProviderSegmentPlan): readonly BranchShape[] | null {
  let sawSkeleton = false;
  const branches: { spans: string[]; placeholders: string[] }[] = [];
  let current: { spans: string[]; placeholders: string[] } | null = null;
  for (let slotIndex = 0; slotIndex < plan.slots.length; slotIndex += 1) {
    const slot = plan.slots[slotIndex] ?? "";
    if (ICU_SKELETON.test(slot)) {
      sawSkeleton = true;
    }
    if (sawSkeleton && SELECTOR_OPEN.test(slot)) {
      current = { spans: [], placeholders: [] };
      branches.push(current);
    }
    if (!current) {
      continue;
    }
    if (SIMPLE_SLOT.test(slot)) {
      current.placeholders.push(slot);
    }
    const spanAfter = plan.spans[slotIndex + 1] ?? "";
    if (spanAfter.length > 0) {
      current.spans.push(spanAfter);
    }
    if (slot === "}") {
      current = null;
    }
  }
  if (!sawSkeleton || branches.length < 2) {
    return null;
  }
  return branches;
}

function flattenedBranch(
  localized: string,
  pluralVariable: string,
): { readonly spans: readonly string[]; readonly placeholders: readonly string[] } | null {
  let plan: WebUiProviderSegmentPlan;
  try {
    plan = segmentWebUiMessageForProvider(localized);
  } catch {
    return null;
  }
  const variableSlot = `{${pluralVariable}}`;
  const spans: string[] = [];
  const placeholders: string[] = [];
  if ((plan.spans[0] ?? "").length > 0) {
    spans.push(plan.spans[0] ?? "");
  }
  for (let slotIndex = 0; slotIndex < plan.slots.length; slotIndex += 1) {
    const slot = plan.slots[slotIndex] ?? "";
    if (slot === variableSlot) {
      // Flattened outer variable. The English skeleton already owns it.
    } else if (SIMPLE_SLOT.test(slot)) {
      placeholders.push(slot);
    } else {
      return null;
    }
    const spanAfter = plan.spans[slotIndex + 1] ?? "";
    if (spanAfter.length > 0) {
      spans.push(spanAfter);
    }
  }
  return { spans, placeholders };
}

function localizedSpansOnEnglishPlan(
  plan: WebUiProviderSegmentPlan,
  localizedSpans: readonly string[],
): readonly string[] | null {
  const translated = [...plan.spans];
  let sawSkeleton = false;
  let open = false;
  let humanInBranch = 0;
  for (let slotIndex = 0; slotIndex < plan.slots.length; slotIndex += 1) {
    const slot = plan.slots[slotIndex] ?? "";
    if (ICU_SKELETON.test(slot)) {
      sawSkeleton = true;
    }
    if (sawSkeleton && SELECTOR_OPEN.test(slot)) {
      open = true;
      humanInBranch = 0;
    }
    const spanIndex = slotIndex + 1;
    if (open && (translated[spanIndex] ?? "").length > 0) {
      const replacement = localizedSpans[humanInBranch];
      if (replacement == null) {
        return null;
      }
      translated[spanIndex] = replacement;
      humanInBranch += 1;
    }
    if (slot === "}" && open) {
      open = false;
    }
  }
  return plan.providerSpanIndexes.map((index) => translated[index] ?? "");
}
