/**
 * Reset 03E.1 / 03E.3 — render-boundary semantic ownership + structural refs.
 * Attribution comes from the rendering path (this component), not a parallel inventory list.
 * Production: lightweight data-* attributes only (no translated bodies). Coverage is test/dev.
 */

import {
  createElement,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";

/** Who owns the participant-facing semantic string. */
export type MediaSemanticOwner =
  | "UI_DICTIONARY"
  | "PLP_ENTITY"
  | "BRAND"
  | "TERMINOLOGY"
  | "GEOGRAPHY"
  | "PROTECTED_CANONICAL"
  | "BUG_UNOWNED";

/**
 * Delivery result for this node at render time.
 * Distinct from OWNER — PLP_ENTITY + CANONICAL_FALLBACK is owned but not localized.
 */
export type MediaSemanticResult =
  | "LOCALIZED_DICTIONARY"
  | "PUBLISHED_LOCALIZED"
  | "CANONICAL_FALLBACK"
  | "PROTECTED_CANONICAL"
  | "UNOWNED";

export type MediaPageLocalizationStatus =
  | "FULLY_LOCALIZED"
  | "PARTIALLY_LOCALIZED"
  | "CANONICAL_ONLY"
  | "INVALID_COVERAGE";

export type MediaSemanticNodeRecord = {
  readonly owner: MediaSemanticOwner;
  readonly result: MediaSemanticResult;
  readonly entityType?: string;
  readonly entityId?: string;
  /** PLP presentation path, e.g. overviewPoints[0].heading */
  readonly semanticPath?: string;
  /** UI dictionary key, e.g. civicMediaPublic.pipeline.title */
  readonly messageKey?: string;
  readonly text?: string;
};

export function plpModeToSemanticResult(
  mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK" | undefined,
): MediaSemanticResult {
  if (mode === "PUBLISHED_LOCALIZED") {
    return "PUBLISHED_LOCALIZED";
  }
  if (mode === "CANONICAL_FALLBACK") {
    return "CANONICAL_FALLBACK";
  }
  return "UNOWNED";
}

type MediaSemanticNodeProps = {
  readonly owner: MediaSemanticOwner;
  readonly result: MediaSemanticResult;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly semanticPath?: string;
  readonly messageKey?: string;
  readonly as?: ElementType;
  readonly children?: ReactNode;
  readonly className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className" | "result">;

/**
 * Every participant-facing Media semantic text node should render through this boundary.
 */
export function MediaSemanticNode({
  owner,
  result,
  entityType,
  entityId,
  semanticPath,
  messageKey,
  as = "span",
  children,
  className,
  ...rest
}: MediaSemanticNodeProps) {
  return createElement(
    as,
    {
      ...rest,
      className,
      "data-hu-semantic-node": "1",
      "data-hu-semantic-owner": owner,
      "data-hu-semantic-result": result,
      ...(entityType ? { "data-hu-plp-entity": entityType } : {}),
      ...(entityId ? { "data-hu-plp-id": entityId } : {}),
      ...(semanticPath ? { "data-hu-semantic-path": semanticPath } : {}),
      ...(messageKey ? { "data-hu-message-key": messageKey } : {}),
    },
    children,
  );
}
