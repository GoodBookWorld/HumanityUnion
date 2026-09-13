/**
 * Localization Simplification Step 02 — protect authoritative Brand / Terminology
 * strings from browser machine translation.
 *
 * Use only for values that are already resolved as platform-owned Brand or
 * controlled terminology (localized preferred term or canonical English fallback).
 * Do not wrap ordinary long-form content.
 */
import {
  createElement,
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
