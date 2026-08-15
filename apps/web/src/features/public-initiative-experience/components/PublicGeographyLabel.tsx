import {
  formatPublicGeography,
  type PublicGeographyInput,
} from "@hu/geography";

export function PublicGeographyLabel({
  geography,
  className,
}: {
  geography: PublicGeographyInput | string;
  className?: string;
}) {
  const label = typeof geography === "string" ? geography : formatPublicGeography(geography);

  return <span className={className}>{label}</span>;
}
