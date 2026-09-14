"use client";

import { useLocale } from "next-intl";
import {
  formatPublicGeography,
  type PublicGeographyInput,
} from "@hu/geography";

/**
 * Pack 08K.3 — participant-facing geography label uses interface locale.
 */
export function PublicGeographyLabel({
  geography,
  className,
}: {
  geography: PublicGeographyInput | string;
  className?: string;
}) {
  const locale = useLocale();
  const label =
    typeof geography === "string"
      ? geography
      : formatPublicGeography({ ...geography, locale });

  return <span className={className}>{label}</span>;
}
