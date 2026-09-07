/**
 * Reset 03E.11.1 — compile-time polymorphic MediaSemanticNode prop contract.
 * Included in `tsc --noEmit` / Next production typecheck. No runtime assertions.
 */

import { createElement, type ElementType } from "react";

import {
  MediaSemanticNode,
  type MediaSemanticNodeProps,
} from "./media-semantic-contract";

/** Lock `T` so excess/native-prop rejection is checked against that element. */
function expectMediaSemanticProps<T extends ElementType>(
  _props: MediaSemanticNodeProps<T>,
): void {
  void _props;
}

/** 1. as="time" + dateTime compiles. */
export const mediaSemanticTimeOk = createElement(MediaSemanticNode, {
  as: "time",
  dateTime: "2026-01-01T00:00:00.000Z",
  owner: "PROTECTED_CANONICAL",
  result: "PROTECTED_CANONICAL",
  children: "31 груд.",
});

expectMediaSemanticProps<"time">({
  as: "time",
  dateTime: "2026-01-01T00:00:00.000Z",
  owner: "PROTECTED_CANONICAL",
  result: "PROTECTED_CANONICAL",
  children: "31 груд.",
});

/** 2. as="a" + href compiles. */
export const mediaSemanticAnchorOk = createElement(MediaSemanticNode, {
  as: "a",
  href: "https://example.com/article",
  target: "_blank",
  rel: "noopener noreferrer",
  owner: "UI_DICTIONARY",
  result: "LOCALIZED_DICTIONARY",
  children: "read",
});

expectMediaSemanticProps<"a">({
  as: "a",
  href: "https://example.com/article",
  owner: "UI_DICTIONARY",
  result: "LOCALIZED_DICTIONARY",
  children: "read",
});

/** 3. Ordinary supported element props compile. */
export const mediaSemanticDivOk = createElement(MediaSemanticNode, {
  as: "div",
  id: "coverage-chips",
  className: "civic-media-resource-card__chips",
  owner: "PLP_ENTITY",
  result: "PUBLISHED_LOCALIZED",
  entityType: "civic_media_fact_check",
  entityId: "snopes",
  semanticPath: "coverage",
  children: null,
});

/** 5. Semantic owner/result/path/reason remain typed. */
export const mediaSemanticFallbackOk = createElement(MediaSemanticNode, {
  as: "p",
  owner: "PLP_ENTITY",
  result: "CANONICAL_FALLBACK",
  entityType: "public_news",
  entityId: "news-1",
  semanticPath: "title",
  fallbackReason: "NO_PUBLISHED_SNAPSHOT",
  messageKey: undefined,
  children: "canonical title",
});

/**
 * 4. Invalid native prop for the selected element is rejected where React
 * typings permit the distinction (dateTime is TimeHTMLAttributes-only).
 */
expectMediaSemanticProps<"div">({
  as: "div",
  // @ts-expect-error dateTime is not a div attribute
  dateTime: "2026-01-01T00:00:00.000Z",
  owner: "PROTECTED_CANONICAL",
  result: "PROTECTED_CANONICAL",
  children: "no",
});

expectMediaSemanticProps<"time">({
  as: "time",
  // @ts-expect-error href is not a time attribute
  href: "https://example.com",
  dateTime: "2026-01-01T00:00:00.000Z",
  owner: "PROTECTED_CANONICAL",
  result: "PROTECTED_CANONICAL",
  children: "no",
});

/** Invalid semantic result must not typecheck. */
expectMediaSemanticProps<"span">({
  as: "span",
  owner: "PLP_ENTITY",
  // @ts-expect-error result must be MediaSemanticResult
  result: "NOT_A_RESULT",
  children: "no",
});
