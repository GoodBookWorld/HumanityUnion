/**
 * Reset 03E.1 — derive Media localization coverage from rendered semantic contracts.
 * Test/dev aggregation only — do not crawl the live production DOM at request time.
 */

import type {
  MediaPageLocalizationStatus,
  MediaSemanticNodeRecord,
  MediaSemanticOwner,
  MediaSemanticResult,
} from "./media-semantic-contract";

export type MediaRenderedCoverageReport = {
  readonly TOTAL_SEMANTIC_NODES: number;
  readonly LOCALIZED_NODES: number;
  readonly PROTECTED_CANONICAL_NODES: number;
  readonly CANONICAL_FALLBACK_NODES: number;
  readonly UNOWNED_NODES: number;
  readonly MIXED_ENTITY_VIOLATIONS: number;
  readonly UI_DICTIONARY_NODES: number;
  readonly PLP_ENTITY_NODES: number;
  readonly PAGE_STATUS: MediaPageLocalizationStatus;
  readonly nodes: readonly MediaSemanticNodeRecord[];
};

const OWNER_VALUES = new Set<MediaSemanticOwner>([
  "UI_DICTIONARY",
  "PLP_ENTITY",
  "BRAND",
  "TERMINOLOGY",
  "GEOGRAPHY",
  "PROTECTED_CANONICAL",
  "BUG_UNOWNED",
]);

const RESULT_VALUES = new Set<MediaSemanticResult>([
  "LOCALIZED_DICTIONARY",
  "PUBLISHED_LOCALIZED",
  "CANONICAL_FALLBACK",
  "PROTECTED_CANONICAL",
  "UNOWNED",
]);

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function readAttr(tag: string, name: string): string | undefined {
  const re = new RegExp(`${name}="([^"]*)"`, "i");
  const match = re.exec(tag);
  return match?.[1];
}

/**
 * Collect semantic nodes from SSR/test HTML produced by MediaSemanticNode.
 * Attribute-scan only (nested-safe); does not require paired close tags.
 */
export function collectRenderedMediaSemanticNodes(
  html: string,
): MediaSemanticNodeRecord[] {
  const nodes: MediaSemanticNodeRecord[] = [];
  const re = /<[a-z0-9]+([^>]*\bdata-hu-semantic-node="1"[^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const attrs = match[1] ?? "";
    const rawOwner = readAttr(attrs, "data-hu-semantic-owner");
    const rawResult = readAttr(attrs, "data-hu-semantic-result");
    const owner = (OWNER_VALUES.has(rawOwner as MediaSemanticOwner)
      ? rawOwner
      : "BUG_UNOWNED") as MediaSemanticOwner;
    const result = (RESULT_VALUES.has(rawResult as MediaSemanticResult)
      ? rawResult
      : "UNOWNED") as MediaSemanticResult;
    // Best-effort text: content until next tag (for diagnostics / negative fixtures).
    const after = html.slice(match.index + match[0].length);
    const textMatch = /^([^<]*)/.exec(after);
    const text = decodeHtmlEntities((textMatch?.[1] ?? "").trim());
    nodes.push({
      owner,
      result,
      entityType: readAttr(attrs, "data-hu-plp-entity"),
      entityId: readAttr(attrs, "data-hu-plp-id"),
      text: text || undefined,
    });
  }
  return nodes;
}

/**
 * Detect participant-facing text in Media sections that lacks a semantic-node ancestor.
 * Heuristic for negative tests / nested-component discovery — test-only.
 */
export function findUnownedMediaTextCandidates(html: string): string[] {
  const mediaRootMatch =
    /<(main|div)([^>]*\bcivic-media-page\b[^>]*)>([\s\S]*?)<\/\1>/i.exec(html) ??
    /<(main|div)([^>]*\bdata-hu-media-renderer="shared"[^>]*)>([\s\S]*?)<\/\1>/i.exec(
      html,
    );
  const root = mediaRootMatch?.[3] ?? html;
  const candidates: string[] = [];
  const textRe =
    /<(h[1-6]|p|span|button|a|label|li|strong|em)(\s[^>]*)?>([^<]{2,})<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = textRe.exec(root)) !== null) {
    const openAttrs = match[2] ?? "";
    const text = decodeHtmlEntities(match[3]!.trim());
    if (!text || text.length < 2) {
      continue;
    }
    if (/^\d+$/.test(text)) {
      continue;
    }
    // Skip if this element itself is a semantic node.
    if (/\bdata-hu-semantic-node="1"\b/.test(openAttrs)) {
      continue;
    }
    // Skip decorative / aria-hidden numbers.
    if (/\baria-hidden="true"\b/.test(openAttrs)) {
      continue;
    }
    // Look backward for nearest semantic-node open tag without close — approximate.
    const before = root.slice(0, match.index);
    const lastSemanticOpen = before.lastIndexOf('data-hu-semantic-node="1"');
    if (lastSemanticOpen >= 0) {
      const afterOpen = before.slice(lastSemanticOpen);
      // If a closing tag for a semantic wrapper appears after open, ownership may have ended.
      // Conservative: if open exists and no `</` immediately unbalanced — treat as owned when
      // the text is nested inside a tag that had semantic-node on an ancestor in the last 2kb.
      const window = before.slice(Math.max(0, lastSemanticOpen - 50));
      if (
        /data-hu-semantic-node="1"/.test(window) &&
        !/<\/(article|section|main|div)>\s*$/.test(before.slice(-40))
      ) {
        // Still may be nested; require explicit ancestor by checking if between open and here
        // we don't close the semantic element. Use simpler rule: if parent attrs already checked.
        const slice = before.slice(lastSemanticOpen);
        const openTagEnd = slice.indexOf(">");
        if (openTagEnd >= 0) {
          const tagStart = before.lastIndexOf("<", lastSemanticOpen);
          const tagNameMatch = /<([a-z0-9]+)/i.exec(before.slice(tagStart));
          const tagName = tagNameMatch?.[1];
          if (tagName) {
            const closeRe = new RegExp(`</${tagName}>`, "gi");
            const region = root.slice(lastSemanticOpen, match.index);
            const closes = region.match(closeRe)?.length ?? 0;
            const opens = region.match(new RegExp(`<${tagName}\\b`, "gi"))?.length ?? 0;
            if (opens > closes) {
              continue; // still inside semantic node
            }
          }
        }
      }
    }
    candidates.push(text);
  }
  return candidates;
}

function isLocalizedResult(result: MediaSemanticResult): boolean {
  return result === "LOCALIZED_DICTIONARY" || result === "PUBLISHED_LOCALIZED";
}

function isTranslatableFallback(node: MediaSemanticNodeRecord): boolean {
  if (node.owner === "PROTECTED_CANONICAL" || node.result === "PROTECTED_CANONICAL") {
    return false;
  }
  return node.result === "CANONICAL_FALLBACK";
}

/**
 * Detect field-level hybrid within the same PLP entity:
 * same entityId with both PUBLISHED_LOCALIZED and CANONICAL_FALLBACK results.
 */
export function countMixedEntityViolations(
  nodes: readonly MediaSemanticNodeRecord[],
): number {
  const byEntity = new Map<string, Set<MediaSemanticResult>>();
  for (const node of nodes) {
    if (node.owner !== "PLP_ENTITY" || !node.entityId) {
      continue;
    }
    const key = `${node.entityType ?? "plp"}:${node.entityId}`;
    const set = byEntity.get(key) ?? new Set();
    set.add(node.result);
    byEntity.set(key, set);
  }
  let violations = 0;
  for (const results of byEntity.values()) {
    if (results.has("PUBLISHED_LOCALIZED") && results.has("CANONICAL_FALLBACK")) {
      violations += 1;
    }
  }
  return violations;
}

export function computeMediaPageLocalizationStatus(input: {
  readonly locale: string;
  readonly unownedNodes: number;
  readonly mixedEntityViolations: number;
  readonly canonicalFallbackNodes: number;
  readonly localizedNodes: number;
  readonly totalSemanticNodes: number;
}): MediaPageLocalizationStatus {
  if (input.unownedNodes > 0 || input.mixedEntityViolations > 0) {
    return "INVALID_COVERAGE";
  }
  if (input.locale === "en") {
    // English canonical is the source language — dictionary + PLP published both OK.
    if (input.canonicalFallbackNodes === 0 || input.localizedNodes > 0) {
      return input.canonicalFallbackNodes === 0
        ? "FULLY_LOCALIZED"
        : "PARTIALLY_LOCALIZED";
    }
    return "CANONICAL_ONLY";
  }
  // Non-English: FULLY_LOCALIZED requires no translatable canonical fallback.
  if (input.canonicalFallbackNodes === 0 && input.localizedNodes > 0) {
    return "FULLY_LOCALIZED";
  }
  if (input.localizedNodes === 0 && input.totalSemanticNodes > 0) {
    return "CANONICAL_ONLY";
  }
  if (input.canonicalFallbackNodes > 0 && input.localizedNodes > 0) {
    return "PARTIALLY_LOCALIZED";
  }
  if (input.canonicalFallbackNodes > 0) {
    return "CANONICAL_ONLY";
  }
  return "PARTIALLY_LOCALIZED";
}

export function summarizeRenderedMediaCoverage(
  nodes: readonly MediaSemanticNodeRecord[],
  locale: string,
): MediaRenderedCoverageReport {
  const unowned = nodes.filter(
    (n) =>
      n.owner === "BUG_UNOWNED" ||
      n.result === "UNOWNED" ||
      (n.owner as string) === "BUG_UNOWNED",
  );
  const protectedNodes = nodes.filter(
    (n) =>
      n.owner === "PROTECTED_CANONICAL" || n.result === "PROTECTED_CANONICAL",
  );
  const fallback = nodes.filter(isTranslatableFallback);
  const localized = nodes.filter((n) => isLocalizedResult(n.result));
  const mixed = countMixedEntityViolations(nodes);

  const report: MediaRenderedCoverageReport = {
    TOTAL_SEMANTIC_NODES: nodes.length,
    LOCALIZED_NODES: localized.length,
    PROTECTED_CANONICAL_NODES: protectedNodes.length,
    CANONICAL_FALLBACK_NODES: fallback.length,
    UNOWNED_NODES: unowned.length,
    MIXED_ENTITY_VIOLATIONS: mixed,
    UI_DICTIONARY_NODES: nodes.filter((n) => n.owner === "UI_DICTIONARY").length,
    PLP_ENTITY_NODES: nodes.filter((n) => n.owner === "PLP_ENTITY").length,
    PAGE_STATUS: "CANONICAL_ONLY",
    nodes,
  };

  return {
    ...report,
    PAGE_STATUS: computeMediaPageLocalizationStatus({
      locale,
      unownedNodes: report.UNOWNED_NODES,
      mixedEntityViolations: report.MIXED_ENTITY_VIOLATIONS,
      canonicalFallbackNodes: report.CANONICAL_FALLBACK_NODES,
      localizedNodes: report.LOCALIZED_NODES,
      totalSemanticNodes: report.TOTAL_SEMANTIC_NODES,
    }),
  };
}

export function formatMediaRenderedCoverageReport(
  report: MediaRenderedCoverageReport,
): string {
  return [
    `TOTAL_SEMANTIC_NODES=${report.TOTAL_SEMANTIC_NODES}`,
    `LOCALIZED_NODES=${report.LOCALIZED_NODES}`,
    `PROTECTED_CANONICAL_NODES=${report.PROTECTED_CANONICAL_NODES}`,
    `CANONICAL_FALLBACK_NODES=${report.CANONICAL_FALLBACK_NODES}`,
    `UNOWNED_NODES=${report.UNOWNED_NODES}`,
    `MIXED_ENTITY_VIOLATIONS=${report.MIXED_ENTITY_VIOLATIONS}`,
    `PAGE_STATUS=${report.PAGE_STATUS}`,
  ].join("\n");
}

export function assertFullyLocalizedMediaCoverage(
  report: MediaRenderedCoverageReport,
): void {
  if (report.UNOWNED_NODES !== 0) {
    throw new Error(`UNOWNED_NODES=${report.UNOWNED_NODES}`);
  }
  if (report.MIXED_ENTITY_VIOLATIONS !== 0) {
    throw new Error(`MIXED_ENTITY_VIOLATIONS=${report.MIXED_ENTITY_VIOLATIONS}`);
  }
  if (report.CANONICAL_FALLBACK_NODES !== 0) {
    throw new Error(
      `CANONICAL_FALLBACK_NODES=${report.CANONICAL_FALLBACK_NODES} (not FULLY_LOCALIZED)`,
    );
  }
  if (report.PAGE_STATUS !== "FULLY_LOCALIZED") {
    throw new Error(`PAGE_STATUS=${report.PAGE_STATUS}`);
  }
}
