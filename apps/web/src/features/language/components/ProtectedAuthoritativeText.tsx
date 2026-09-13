/**
 * Localization Simplification Step 02 — protect authoritative Brand / Terminology
 * strings from browser machine translation.
 *
 * Use only for values that are already resolved as platform-owned Brand,
 * controlled terminology, or authoritative Legal document bodies (localized
 * preferred term / published Legal / canonical English Legal fallback).
 * Do not wrap ordinary long-form civic or explanatory UI content.
 */
import {
  createElement,
  Fragment,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";

type ProtectedAuthoritativeTextOwnProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export type ProtectedAuthoritativeTextProps<T extends ElementType = "span"> =
  ProtectedAuthoritativeTextOwnProps & {
    readonly as?: T;
  } & Omit<ComponentPropsWithoutRef<T>, keyof ProtectedAuthoritativeTextOwnProps | "as">;

export function ProtectedAuthoritativeText<T extends ElementType = "span">(
  props: ProtectedAuthoritativeTextProps<T>,
): ReactElement {
  const { as, children, className, ...rest } = props;
  return createElement(
    as ?? "span",
    {
      ...rest,
      className,
      translate: "no",
    },
    children,
  );
}

/**
 * Wrap a resolved controlled term inside an already-localized ICU message
 * without changing catalog tag shapes. Ordinary message chrome stays
 * browser-translatable; only the authoritative term is `translate="no"`.
 */
export function wrapAuthoritativeTermInMessage(
  message: string,
  authoritativeTerm: string,
): ReactNode {
  const term = authoritativeTerm.trim();
  if (!term) {
    return message;
  }
  const index = message.indexOf(term);
  if (index < 0) {
    return message;
  }
  return createElement(
    Fragment,
    null,
    message.slice(0, index),
    createElement(ProtectedAuthoritativeText, null, term),
    message.slice(index + term.length),
  );
}
