/**
 * Reset 03E.11 — Media carousel DOM → ownership semantic closure.
 *
 * Authority is REAL rendered MediaSemanticNode leaves (plus scoped unowned-text
 * heuristics inside carousel cards). Declarative inventory and parent-only
 * markers are insufficient.
 *
 * Test/dev only — never crawl production DOM at request time / never call provider.
 */

import type {
  MediaPageLocalizationStatus,
} from "./media-semantic-contract";
import {
  collectRenderedMediaSemanticNodes,
  summarizeRenderedMediaCoverage,
  type MediaRenderedCoverageReport,
} from "./media-rendered-coverage";

/** Carousel / rail entity types that must close leaf lineage for FULLY_LOCALIZED. */
export const MEDIA_CAROUSEL_PLP_ENTITY_TYPES = [
  "public_news",
  "civic_media_fact_check",
  "civic_media_propaganda",
  "civic_media_principle",
  "civic_media_trusted",
] as const;

export type MediaCarouselPlpEntityType =
  (typeof MEDIA_CAROUSEL_PLP_ENTITY_TYPES)[number];

/**
 * Required semantic paths per entity type (must appear as owned leaves when
 * that entity is rendered on the page).
 *
 * Final Localization Closure 02 — public_news title/summary are
 * original-language PROTECTED_CANONICAL success paths (not Gemini AUTO).
 */
export const MEDIA_CAROUSEL_REQUIRED_SEMANTIC_PATHS: Readonly<
  Record<MediaCarouselPlpEntityType, readonly string[]>
> = {
  public_news: ["title", "summary"],
  civic_media_fact_check: ["mission", "coverage"],
  civic_media_propaganda: ["focus", "explanation"],
  civic_media_principle: ["title", "description"],
  civic_media_trusted: ["explanation"],
};

export type MediaCarouselLeafInventoryRow = {
  readonly surface: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly semanticPath: string | null;
  readonly owner: string;
  readonly result: string;
  readonly fallbackReason: string | null;
  readonly textPreview: string | null;
};

export type MediaCarouselSemanticClosureReport = {
  readonly pack: "RESET_03E.11";
  readonly locale: string;
  readonly coverage: MediaRenderedCoverageReport;
  readonly PAGE_STATUS: MediaPageLocalizationStatus;
  readonly CAROUSEL_PLP_FALLBACK_LEAVES: number;
  readonly CAROUSEL_PLP_LEAVES_MISSING_PATH: number;
  readonly UNOWNED_CARD_TEXT_CANDIDATES: number;
  readonly MISSING_REQUIRED_PATHS: readonly string[];
  /** Reset 03E.13 — distinct public_news cards observed in rendered leaves. */
  readonly PUBLIC_NEWS_CARD_COUNT: number;
  readonly PUBLIC_NEWS_LOCALIZED_CARD_COUNT: number;
  readonly PUBLIC_NEWS_FALLBACK_CARD_COUNT: number;
  readonly PUBLIC_NEWS_OMITTED_CARD_COUNT: number;
  readonly leaves: readonly MediaCarouselLeafInventoryRow[];
  readonly FULLY_LOCALIZED: boolean;
  readonly reasons: readonly string[];
};

/** /media News rail bound (must match MEDIA_PLP_NEWS_BATCH_LIMIT). */
export const MEDIA_PUBLIC_NEWS_CAROUSEL_EXPECTED_COUNT = 12;

const CARD_OPEN_RE =
  /<(article|div)([^>]*\b(?:public-news-card|civic-media-resource-card--verification|civic-media-resource-card--analysis|civic-media-resource-card--principle|civic-media-resource-card--trusted|country-media-rail-card)\b[^>]*)>/gi;

const TEXT_LEAF_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "span",
  "button",
  "a",
  "label",
  "li",
  "strong",
  "em",
  "time",
]);

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractBalancedElement(
  html: string,
  openMatchIndex: number,
  tagName: string,
): string {
  const openTagEnd = html.indexOf(">", openMatchIndex);
  if (openTagEnd < 0) {
    return "";
  }
  const openRe = new RegExp(`<${tagName}\\b`, "gi");
  const closeRe = new RegExp(`</${tagName}>`, "gi");
  let depth = 1;
  let cursor = openTagEnd + 1;
  while (cursor < html.length && depth > 0) {
    openRe.lastIndex = cursor;
    closeRe.lastIndex = cursor;
    const nextOpen = openRe.exec(html);
    const nextClose = closeRe.exec(html);
    if (!nextClose) {
      break;
    }
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      cursor = nextOpen.index + nextOpen[0].length;
    } else {
      depth -= 1;
      if (depth === 0) {
        return html.slice(openMatchIndex, nextClose.index + nextClose[0].length);
      }
      cursor = nextClose.index + nextClose[0].length;
    }
  }
  return html.slice(openMatchIndex);
}

function findUnownedLeavesInFragment(html: string): string[] {
  const out: string[] = [];
  const stack: { tag: string; semantic: boolean; ariaHidden: boolean }[] = [];
  const tokenRe = /<\/?([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(html)) !== null) {
    if (match[3] != null) {
      const text = decodeHtmlEntities(match[3].trim());
      if (text.length < 2 || /^\d+$/.test(text)) {
        continue;
      }
      const insideSemantic = stack.some((frame) => frame.semantic);
      const insideAriaHidden = stack.some((frame) => frame.ariaHidden);
      if (insideSemantic || insideAriaHidden) {
        continue;
      }
      const leaf = stack[stack.length - 1];
      if (!leaf || !TEXT_LEAF_TAGS.has(leaf.tag)) {
        continue;
      }
      out.push(text);
      continue;
    }

    const tag = (match[1] ?? "").toLowerCase();
    const attrs = match[2] ?? "";
    const raw = match[0];
    if (raw.startsWith("</")) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i]!.tag === tag) {
          stack.splice(i);
          break;
        }
      }
      continue;
    }
    if (/\/>$/.test(raw)) {
      continue;
    }
    stack.push({
      tag,
      semantic: /\bdata-hu-semantic-node="1"/i.test(attrs),
      ariaHidden: /\baria-hidden="true"/i.test(attrs),
    });
  }
  return out;
}

function isCarouselPlpType(value: string | undefined): value is MediaCarouselPlpEntityType {
  return (
    typeof value === "string" &&
    (MEDIA_CAROUSEL_PLP_ENTITY_TYPES as readonly string[]).includes(value)
  );
}

function surfaceForEntityType(entityType: string | undefined): string {
  switch (entityType) {
    case "public_news":
      return "public-news-card";
    case "civic_media_fact_check":
      return "civic-media-resource-card--verification";
    case "civic_media_propaganda":
      return "civic-media-resource-card--analysis";
    case "civic_media_principle":
      return "civic-media-resource-card--principle";
    case "civic_media_trusted":
      return "civic-media-resource-card--trusted";
    default:
      return "unknown";
  }
}

/**
 * Unowned participant text inside carousel card surfaces only.
 * Catches raw chips/bodies that sit outside MediaSemanticNode.
 */
export function findUnownedTextInMediaCarouselCards(html: string): string[] {
  const out: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(CARD_OPEN_RE.source, "gi");
  while ((match = re.exec(html)) !== null) {
    const tagName = match[1] ?? "div";
    const cardHtml = extractBalancedElement(html, match.index, tagName);
    for (const candidate of findUnownedLeavesInFragment(cardHtml)) {
      out.push(candidate);
    }
  }
  return out;
}

function collectRenderedFallbackReasons(html: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of collectRenderedMediaSemanticNodes(html)) {
    if (
      node.entityType &&
      node.entityId &&
      node.semanticPath &&
      node.fallbackReason
    ) {
      map.set(
        `${node.entityType}\0${node.entityId}\0${node.semanticPath}`,
        node.fallbackReason,
      );
    }
  }
  return map;
}

/**
 * Page-level carousel semantic closure from real rendered leaves.
 */
export function evaluateMediaCarouselSemanticClosure(input: {
  readonly html: string;
  readonly locale: string;
}): MediaCarouselSemanticClosureReport {
  const nodes = collectRenderedMediaSemanticNodes(input.html);
  const coverage = summarizeRenderedMediaCoverage(nodes, input.locale);
  const fallbackReasons = collectRenderedFallbackReasons(input.html);
  const unownedCardText = findUnownedTextInMediaCarouselCards(input.html);

  const carouselPlpNodes = nodes.filter(
    (n) => n.owner === "PLP_ENTITY" && isCarouselPlpType(n.entityType),
  );

  // public_news original-language leaves use PROTECTED_CANONICAL ownership.
  const publicNewsOwnedNodes = nodes.filter(
    (n) =>
      n.entityType === "public_news" &&
      Boolean(n.entityId) &&
      (n.owner === "PLP_ENTITY" || n.owner === "PROTECTED_CANONICAL"),
  );

  const fallbackLeaves = carouselPlpNodes.filter(
    (n) => n.result === "CANONICAL_FALLBACK" && n.entityType !== "public_news",
  );
  const missingPathLeaves = carouselPlpNodes.filter(
    (n) => !n.semanticPath || !String(n.semanticPath).trim(),
  );

  const renderedByEntity = new Map<string, Set<string>>();
  for (const node of [...carouselPlpNodes, ...publicNewsOwnedNodes]) {
    if (!node.entityType || !node.entityId) {
      continue;
    }
    const key = `${node.entityType}\0${node.entityId}`;
    const set = renderedByEntity.get(key) ?? new Set();
    if (node.semanticPath) {
      set.add(node.semanticPath);
    }
    renderedByEntity.set(key, set);
  }

  const missingRequired: string[] = [];
  for (const [key, paths] of renderedByEntity) {
    const [entityType, entityId] = key.split("\0");
    if (!isCarouselPlpType(entityType)) {
      continue;
    }
    const required = MEDIA_CAROUSEL_REQUIRED_SEMANTIC_PATHS[entityType];
    for (const path of required) {
      if (!paths.has(path)) {
        missingRequired.push(`${entityType}/${entityId}:${path}`);
      }
    }
  }

  // Reset 03E.13 / Closure 02 — per-card public_news ownership.
  // Original-language PROTECTED_CANONICAL (or legacy CANONICAL_FALLBACK) is policy-success.
  const newsCardStates = new Map<
    string,
    { localized: boolean; fallback: boolean; paths: Set<string> }
  >();
  for (const node of publicNewsOwnedNodes) {
    if (!node.entityId) {
      continue;
    }
    const state = newsCardStates.get(node.entityId) ?? {
      localized: true,
      fallback: false,
      paths: new Set<string>(),
    };
    if (node.semanticPath) {
      state.paths.add(node.semanticPath);
    }
    if (
      node.result === "PROTECTED_CANONICAL" ||
      node.result === "CANONICAL_FALLBACK" ||
      node.result === "PUBLISHED_LOCALIZED"
    ) {
      // Original-language-only policy: protected/canonical originals are success.
      // Historical PUBLISHED_LOCALIZED overlays are also treated as present leaves.
    } else {
      state.localized = false;
      state.fallback = true;
    }
    newsCardStates.set(node.entityId, state);
  }

  let publicNewsLocalized = 0;
  let publicNewsFallback = 0;
  let publicNewsOmitted = 0;
  for (const [, state] of newsCardStates) {
    const required = MEDIA_CAROUSEL_REQUIRED_SEMANTIC_PATHS.public_news;
    const hasAllPaths = required.every((path) => state.paths.has(path));
    if (!hasAllPaths) {
      publicNewsOmitted += 1;
      continue;
    }
    if (state.fallback || !state.localized) {
      publicNewsFallback += 1;
    } else {
      publicNewsLocalized += 1;
    }
  }
  const publicNewsCardCount = newsCardStates.size;

  const leaves: MediaCarouselLeafInventoryRow[] = [
    ...carouselPlpNodes,
    ...publicNewsOwnedNodes.filter((n) => n.owner === "PROTECTED_CANONICAL"),
  ].map((n) => {
    const path = n.semanticPath ?? null;
    const reasonKey =
      n.entityType && n.entityId && path
        ? `${n.entityType}\0${n.entityId}\0${path}`
        : null;
    return {
      surface: surfaceForEntityType(n.entityType),
      entityType: n.entityType ?? "",
      entityId: n.entityId ?? "",
      semanticPath: path,
      owner: n.owner,
      result: n.result,
      fallbackReason: reasonKey ? fallbackReasons.get(reasonKey) ?? null : null,
      textPreview: n.text ? n.text.slice(0, 80) : null,
    };
  });

  const reasons: string[] = [];
  if (coverage.UNOWNED_NODES > 0) {
    reasons.push(`UNOWNED_NODES=${coverage.UNOWNED_NODES}`);
  }
  if (coverage.MIXED_ENTITY_VIOLATIONS > 0) {
    reasons.push(`MIXED_ENTITY_VIOLATIONS=${coverage.MIXED_ENTITY_VIOLATIONS}`);
  }
  if (unownedCardText.length > 0) {
    reasons.push(`UNOWNED_CARD_TEXT_CANDIDATES=${unownedCardText.length}`);
  }
  if (missingPathLeaves.length > 0) {
    reasons.push(`CAROUSEL_PLP_LEAVES_MISSING_PATH=${missingPathLeaves.length}`);
  }
  if (missingRequired.length > 0) {
    reasons.push(`MISSING_REQUIRED_PATHS=${missingRequired.length}`);
  }
  if (input.locale.toLowerCase() !== "en" && fallbackLeaves.length > 0) {
    reasons.push(`CAROUSEL_PLP_FALLBACK_LEAVES=${fallbackLeaves.length}`);
  }
  if (
    input.locale.toLowerCase() !== "en" &&
    publicNewsCardCount >= MEDIA_PUBLIC_NEWS_CAROUSEL_EXPECTED_COUNT &&
    publicNewsLocalized < MEDIA_PUBLIC_NEWS_CAROUSEL_EXPECTED_COUNT
  ) {
    reasons.push(
      `PUBLIC_NEWS_NOT_FULLY_LOCALIZED=${publicNewsLocalized}/${publicNewsCardCount}`,
    );
  }
  if (input.locale.toLowerCase() !== "en" && publicNewsOmitted > 0) {
    reasons.push(`PUBLIC_NEWS_OMITTED_CARDS=${publicNewsOmitted}`);
  }

  let pageStatus = coverage.PAGE_STATUS;
  if (
    coverage.UNOWNED_NODES > 0 ||
    coverage.MIXED_ENTITY_VIOLATIONS > 0 ||
    unownedCardText.length > 0 ||
    missingPathLeaves.length > 0 ||
    missingRequired.length > 0 ||
    publicNewsOmitted > 0
  ) {
    pageStatus = "INVALID_COVERAGE";
  } else if (
    input.locale.toLowerCase() !== "en" &&
    (fallbackLeaves.length > 0 || publicNewsFallback > 0)
  ) {
    pageStatus =
      coverage.LOCALIZED_NODES > 0 || publicNewsLocalized > 0
        ? "PARTIALLY_LOCALIZED"
        : "CANONICAL_ONLY";
  }

  const fully =
    pageStatus === "FULLY_LOCALIZED" &&
    reasons.length === 0 &&
    (input.locale.toLowerCase() === "en" || coverage.LOCALIZED_NODES > 0) &&
    (input.locale.toLowerCase() === "en" ||
      publicNewsCardCount === 0 ||
      (publicNewsFallback === 0 &&
        publicNewsOmitted === 0 &&
        publicNewsLocalized === publicNewsCardCount));

  return {
    pack: "RESET_03E.11",
    locale: input.locale,
    coverage,
    PAGE_STATUS: fully ? "FULLY_LOCALIZED" : pageStatus,
    CAROUSEL_PLP_FALLBACK_LEAVES: fallbackLeaves.length,
    CAROUSEL_PLP_LEAVES_MISSING_PATH: missingPathLeaves.length,
    UNOWNED_CARD_TEXT_CANDIDATES: unownedCardText.length,
    MISSING_REQUIRED_PATHS: missingRequired,
    PUBLIC_NEWS_CARD_COUNT: publicNewsCardCount,
    PUBLIC_NEWS_LOCALIZED_CARD_COUNT: publicNewsLocalized,
    PUBLIC_NEWS_FALLBACK_CARD_COUNT: publicNewsFallback,
    PUBLIC_NEWS_OMITTED_CARD_COUNT: publicNewsOmitted,
    leaves,
    FULLY_LOCALIZED: fully,
    reasons,
  };
}

export function assertMediaCarouselFullyLocalized(
  report: MediaCarouselSemanticClosureReport,
): void {
  if (!report.FULLY_LOCALIZED) {
    throw new Error(
      [
        `PAGE_STATUS=${report.PAGE_STATUS}`,
        ...report.reasons,
        `FALLBACK_LEAVES=${report.CAROUSEL_PLP_FALLBACK_LEAVES}`,
        `MISSING_PATHS=${report.MISSING_REQUIRED_PATHS.join(",")}`,
      ].join("; "),
    );
  }
}

/** Stable forensic table for News / Verification / Analysis expected leaves. */
export function mediaCarouselExpectedLeafContract(): readonly {
  readonly surface: string;
  readonly entityType: MediaCarouselPlpEntityType;
  readonly semanticPath: string;
  readonly owner: "PLP_ENTITY" | "PROTECTED_CANONICAL";
  readonly translatable: boolean;
}[] {
  return [
    {
      surface: "public-news-card",
      entityType: "public_news",
      semanticPath: "title",
      owner: "PROTECTED_CANONICAL",
      translatable: false,
    },
    {
      surface: "public-news-card",
      entityType: "public_news",
      semanticPath: "summary",
      owner: "PROTECTED_CANONICAL",
      translatable: false,
    },
    {
      surface: "civic-media-resource-card--verification",
      entityType: "civic_media_fact_check",
      semanticPath: "mission",
      owner: "PLP_ENTITY",
      translatable: true,
    },
    {
      surface: "civic-media-resource-card--verification",
      entityType: "civic_media_fact_check",
      semanticPath: "coverage",
      owner: "PLP_ENTITY",
      translatable: true,
    },
    {
      surface: "civic-media-resource-card--analysis",
      entityType: "civic_media_propaganda",
      semanticPath: "focus",
      owner: "PLP_ENTITY",
      translatable: true,
    },
    {
      surface: "civic-media-resource-card--analysis",
      entityType: "civic_media_propaganda",
      semanticPath: "explanation",
      owner: "PLP_ENTITY",
      translatable: true,
    },
  ];
}
