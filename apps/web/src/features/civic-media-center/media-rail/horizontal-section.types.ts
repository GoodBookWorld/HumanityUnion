/** Semantic accent applied to section eyebrows and subtle backgrounds. */
export type HorizontalSectionVariant =
  | "default"
  | "civic"
  | "media"
  | "verification"
  | "knowledge"
  | "initiatives"
  | "impact"
  | "pipeline"
  | "news"
  | "trustedMedia"
  | "analysis"
  | "principles";

/** Outer section container treatment. */
export type HorizontalSurfaceStyle = "elevated" | "grouped" | "plain";

export type HorizontalRailLayout = "three-two-one" | "four-two-one" | "four-three-one";

/** @deprecated Use HorizontalSectionVariant */
export type CivicMediaSectionVariant = HorizontalSectionVariant;

/** @deprecated Use HorizontalRailLayout */
export type MediaRailLayout = HorizontalRailLayout;
