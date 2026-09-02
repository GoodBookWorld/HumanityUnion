/**
 * Pack 08I.2 / 08I.3 — Admin-managed Brand Localization (not machine-translated).
 * Separate from Terminology Glossary. Never depends on Gemini / TranslationProvider.
 */

export type BrandLocalizationStatus = "draft" | "approved" | "published";

export const BRAND_LOCALIZATION_STATUSES = ["draft", "approved", "published"] as const;

export function isBrandLocalizationStatus(value: unknown): value is BrandLocalizationStatus {
  return (
    typeof value === "string" &&
    (BRAND_LOCALIZATION_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Canonical English hero unity quote visual lines (Home Hero composition).
 * Owned here so Brand Localization seed/fallback and Web presentation share one source.
 */
export const CANONICAL_ENGLISH_HERO_UNITY_QUOTE_LINES = [
  "Over time,",
  "love and responsibility",
  "forge humanity",
] as const;

/** Accessible single-line form of the canonical English hero quote. */
export const CANONICAL_ENGLISH_HERO_UNITY_QUOTE =
  CANONICAL_ENGLISH_HERO_UNITY_QUOTE_LINES.join(" ");

/**
 * Persisted / Admin form stores intentional line breaks as newlines when present.
 * Screen readers should use whitespace-normalized accessible form.
 */
export const CANONICAL_ENGLISH_HERO_UNITY_QUOTE_MULTILINE =
  CANONICAL_ENGLISH_HERO_UNITY_QUOTE_LINES.join("\n");

export interface BrandLocalizationRecord {
  readonly brandId: string;
  /** Canonical Registry locale — immutable after create. */
  readonly locale: string;
  readonly siteName: string;
  readonly shortName?: string;
  readonly slogan: string;
  /** Participant-facing Home Hero unity quote (manual per locale; may include newlines). */
  readonly heroUnityQuote: string;
  readonly seoSiteName: string;
  readonly seoTitleSuffix?: string;
  readonly defaultMetaDescription: string;
  readonly openGraphBrandName?: string;
  readonly status: BrandLocalizationStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedByParticipantId?: string | null;
}

/** Built-in English fallback — never depends on Gemini. */
export const CANONICAL_ENGLISH_BRAND_FALLBACK = {
  siteName: "Humanity Union",
  shortName: "Humanity",
  slogan: "WORLD SOLIDARITY",
  heroUnityQuote: CANONICAL_ENGLISH_HERO_UNITY_QUOTE_MULTILINE,
  seoSiteName: "Humanity Union",
  seoTitleSuffix: "Humanity Union",
  defaultMetaDescription: "World Solidarity civic technology platform",
  openGraphBrandName: "Humanity Union",
} as const;

export interface ResolvedLocalizedBrand {
  /** Locale actually used for values (may be en fallback). */
  readonly locale: string;
  readonly requestedLocale: string;
  readonly siteName: string;
  readonly shortName: string;
  readonly slogan: string;
  readonly heroUnityQuote: string;
  readonly seoSiteName: string;
  readonly seoTitleSuffix: string;
  readonly defaultMetaDescription: string;
  readonly openGraphBrandName: string;
  readonly source: "published_locale" | "published_english" | "builtin_english";
}

export interface BrandLocalizationPublicSummary {
  readonly locale: string;
  readonly siteName: string;
  readonly slogan: string;
  readonly status: "published";
}

export interface BrandLocalizationAdminListResponse {
  readonly brands: readonly BrandLocalizationRecord[];
}

export interface BrandLocalizationUpsertInput {
  readonly locale: string;
  readonly siteName: string;
  readonly shortName?: string;
  readonly slogan: string;
  readonly heroUnityQuote: string;
  readonly seoSiteName: string;
  readonly seoTitleSuffix?: string;
  readonly defaultMetaDescription: string;
  readonly openGraphBrandName?: string;
  readonly status?: BrandLocalizationStatus;
}

export interface BrandLocalizationUpdateInput {
  readonly siteName?: string;
  readonly shortName?: string | null;
  readonly slogan?: string;
  readonly heroUnityQuote?: string;
  readonly seoSiteName?: string;
  readonly seoTitleSuffix?: string | null;
  readonly defaultMetaDescription?: string;
  readonly openGraphBrandName?: string | null;
  readonly status?: BrandLocalizationStatus;
}

/** Normalize quote for assistive tech / single-line display (preserves words). */
export function accessibleHeroUnityQuote(quote: string): string {
  return quote.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
}

/** Split Admin/runtime quote into visual lines (newline-aware). */
export function visualHeroUnityQuoteLines(quote: string): readonly string[] {
  const normalized = quote.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length > 0) {
    return lines;
  }
  const accessible = accessibleHeroUnityQuote(quote);
  return accessible ? [accessible] : [];
}
