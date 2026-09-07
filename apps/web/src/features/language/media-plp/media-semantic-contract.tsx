/**
 * Reset 03E.1 / 03E.3 — render-boundary semantic ownership + structural refs.
 * Attribution comes from the rendering path (this component), not a parallel inventory list.
 * Production: lightweight data-* attributes only (no translated bodies). Coverage is test/dev.
 * Reset 03E.11.1 — polymorphic `as` + native element props (e.g. time.dateTime, a.href).
 */

import {
  createElement,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactElement,
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
  /** When result is CANONICAL_FALLBACK — e.g. NO_PUBLISHED_SNAPSHOT */
  readonly fallbackReason?: string;
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

/** Custom semantic props — never overridden by native HTML attributes. */
type MediaSemanticNodeOwnProps = {
  readonly owner: MediaSemanticOwner;
  readonly result: MediaSemanticResult;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly semanticPath?: string;
  readonly messageKey?: string;
  /** Reset 03E.11 — why PLP_ENTITY fell back (availability, not localization success). */
  readonly fallbackReason?: string;
  readonly children?: ReactNode;
  readonly className?: string;
};

/**
 * Polymorphic props: custom semantic contract + native props for `as`.
 * Collisions with own props / `as` are omitted from the native side.
 */
export type MediaSemanticNodeProps<T extends ElementType = "span"> =
  MediaSemanticNodeOwnProps & {
    readonly as?: T;
  } & Omit<ComponentPropsWithoutRef<T>, keyof MediaSemanticNodeOwnProps | "as">;

/**
 * Every participant-facing Media semantic text node should render through this boundary.
 */
export function MediaSemanticNode<T extends ElementType = "span">(
  props: MediaSemanticNodeProps<T>,
): ReactElement {
  const {
    owner,
    result,
    entityType,
    entityId,
    semanticPath,
    messageKey,
    fallbackReason,
    as,
    children,
    className,
    ...rest
  } = props;

  return createElement(
    as ?? "span",
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
      ...(fallbackReason && result === "CANONICAL_FALLBACK"
        ? { "data-hu-fallback-reason": fallbackReason }
        : {}),
    },
    children,
  );
}
