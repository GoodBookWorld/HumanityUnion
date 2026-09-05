/**
 * Pack 08K.3 — locale-aware geographic display-name resolver.
 *
 * Canonical storage remains ISO / dataset codes and English dataset fields.
 * Participant-facing labels resolve: identity → locale display name → English fallback.
 *
 * Country names: Intl.DisplayNames (standards-based).
 * UN region / subregion labels: finite controlled platform overrides (not prose MT).
 * Administrative regions: dataset English name with optional overrides; unknown → fallback.
 *
 * Never mutates canonical IDs/codes. No Gemini. No per-page dictionaries.
 */

import {
  getCountryByCode,
  getRegionByCode,
  normalizeCountryInput,
  normalizeRegionInput,
  OTHER_REGION_CODE,
  OTHER_REGION_SLUG,
} from "./geography.helpers.js";

export type GeographicDisplayKind =
  | "country"
  | "admin_region"
  | "un_region"
  | "un_subregion";

export type GeographicDisplayNameResult = {
  readonly kind: GeographicDisplayKind;
  /** Stable identity (ISO code, region code, or English UN key). */
  readonly identity: string;
  readonly locale: string;
  readonly displayName: string;
  readonly source: "intl" | "platform_override" | "canonical_english" | "fallback";
};

/** BCP47 → Intl / override locale keys (Language Registry–aligned aliases). */
export function normalizeGeographicDisplayLocale(locale: string): string {
  const raw = locale.trim().replace(/_/g, "-");
  if (!raw) {
    return "en";
  }
  const lower = raw.toLowerCase();
  if (lower === "en" || lower.startsWith("en-")) {
    return "en";
  }
  if (lower === "uk" || lower === "ua" || lower.startsWith("uk-") || lower.startsWith("ua-")) {
    return "uk";
  }
  if (
    lower === "zh-hant" ||
    lower.startsWith("zh-hant") ||
    lower === "zh-tw" ||
    lower === "zh-hk" ||
    lower === "zh-mo"
  ) {
    return "zh-Hant";
  }
  if (lower === "zh" || lower === "zh-hans" || lower.startsWith("zh-hans") || lower === "zh-cn") {
    return "zh-Hans";
  }
  if (lower === "ar" || lower.startsWith("ar-")) {
    return "ar";
  }
  return raw;
}

const UN_REGION_OVERRIDES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  Africa: { uk: "Африка", "zh-Hant": "非洲", ar: "أفريقيا" },
  Americas: { uk: "Америка", "zh-Hant": "美洲", ar: "الأمريكتان" },
  Asia: { uk: "Азія", "zh-Hant": "亞洲", ar: "آسيا" },
  Europe: { uk: "Європа", "zh-Hant": "歐洲", ar: "أوروبا" },
  Oceania: { uk: "Океанія", "zh-Hant": "大洋洲", ar: "أوقيانوسيا" },
  Polar: { uk: "Полярні регіони", "zh-Hant": "極地", ar: "المناطق القطبية" },
};

const UN_SUBREGION_OVERRIDES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "Northern America": { uk: "Північна Америка", "zh-Hant": "北美洲", ar: "أمريكا الشمالية" },
  "South America": { uk: "Південна Америка", "zh-Hant": "南美洲", ar: "أمريكا الجنوبية" },
  "Central America": { uk: "Центральна Америка", "zh-Hant": "中美洲", ar: "أمريكا الوسطى" },
  Caribbean: { uk: "Карибський басейн", "zh-Hant": "加勒比地區", ar: "الكاريبي" },
  "Western Europe": { uk: "Західна Європа", "zh-Hant": "西歐", ar: "أوروبا الغربية" },
  "Eastern Europe": { uk: "Східна Європа", "zh-Hant": "東歐", ar: "أوروبا الشرقية" },
  "Northern Europe": { uk: "Північна Європа", "zh-Hant": "北歐", ar: "أوروبا الشمالية" },
  "Southern Europe": { uk: "Південна Європа", "zh-Hant": "南歐", ar: "أوروبا الجنوبية" },
  "Western Asia": { uk: "Західна Азія", "zh-Hant": "西亞", ar: "آسيا الغربية" },
  "Eastern Asia": { uk: "Східна Азія", "zh-Hant": "東亞", ar: "آسيا الشرقية" },
  "Southern Asia": { uk: "Південна Азія", "zh-Hant": "南亞", ar: "آسيا الجنوبية" },
  "Central Asia": { uk: "Центральна Азія", "zh-Hant": "中亞", ar: "آسيا الوسطى" },
  "South-Eastern Asia": { uk: "Південно-Східна Азія", "zh-Hant": "東南亞", ar: "جنوب شرق آسيا" },
  "Northern Africa": { uk: "Північна Африка", "zh-Hant": "北非", ar: "شمال أفريقيا" },
  "Western Africa": { uk: "Західна Африка", "zh-Hant": "西非", ar: "غرب أفريقيا" },
  "Eastern Africa": { uk: "Східна Африка", "zh-Hant": "شرق أفريقيا", ar: "شرق أفريقيا" },
  "Middle Africa": { uk: "Центральна Африка", "zh-Hant": "中非", ar: "وسط أفريقيا" },
  "Southern Africa": { uk: "Південна Африка", "zh-Hant": "南部非洲", ar: "الجنوب الأفريقي" },
  "Australia and New Zealand": {
    uk: "Австралія та Нова Зеландія",
    "zh-Hant": "澳大利亞與紐西蘭",
    ar: "أستراليا ونيوزيلندا",
  },
  Melanesia: { uk: "Меланезія", "zh-Hant": "美拉尼西亞", ar: "ميلانيزيا" },
  Micronesia: { uk: "Мікронезія", "zh-Hant": "密克羅尼西亞", ar: "ميكرونيزيا" },
  Polynesia: { uk: "Полінезія", "zh-Hant": "玻里尼西亞", ar: "بولينيزيا" },
};

const OTHER_REGION_OVERRIDES: Readonly<Record<string, string>> = {
  uk: "Інше / Не вказано",
  "zh-Hant": "其他／未列出",
  ar: "أخرى / غير مدرج",
};

function intlCountryDisplayName(countryCode: string, locale: string): string | null {
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: "region" });
    const name = displayNames.of(countryCode.toUpperCase());
    if (typeof name === "string" && name.trim() && name.toUpperCase() !== countryCode.toUpperCase()) {
      return name.trim();
    }
  } catch {
    // Unsupported locale / runtime — fall through.
  }
  return null;
}

function lookupOverride(
  table: Readonly<Record<string, Readonly<Record<string, string>>>>,
  englishKey: string,
  locale: string,
): string | null {
  const row = table[englishKey];
  if (!row) {
    return null;
  }
  return row[locale] ?? null;
}

/**
 * Resolve a participant-facing country display name from a stable ISO code.
 */
export function resolveCountryDisplayName(input: {
  readonly countryCode: string;
  readonly locale: string;
  readonly fallback?: string;
}): GeographicDisplayNameResult {
  const locale = normalizeGeographicDisplayLocale(input.locale);
  const code = normalizeCountryInput(input.countryCode) ?? input.countryCode.trim().toUpperCase();
  const country = getCountryByCode(code);
  const english = country?.name ?? input.fallback?.trim() ?? code;

  if (!country) {
    return {
      kind: "country",
      identity: code,
      locale,
      displayName: english,
      source: input.fallback ? "fallback" : "fallback",
    };
  }

  if (locale === "en") {
    return {
      kind: "country",
      identity: code,
      locale,
      displayName: english,
      source: "canonical_english",
    };
  }

  const intl = intlCountryDisplayName(code, locale);
  if (intl) {
    return {
      kind: "country",
      identity: code,
      locale,
      displayName: intl,
      source: "intl",
    };
  }

  return {
    kind: "country",
    identity: code,
    locale,
    displayName: english,
    source: "canonical_english",
  };
}

/**
 * Resolve UN M49-style region label (Africa, Americas, …) from English dataset key.
 */
export function resolveUnRegionDisplayName(input: {
  readonly englishRegion: string;
  readonly locale: string;
}): GeographicDisplayNameResult {
  const locale = normalizeGeographicDisplayLocale(input.locale);
  const identity = input.englishRegion.trim();
  if (!identity) {
    return {
      kind: "un_region",
      identity: "",
      locale,
      displayName: "",
      source: "fallback",
    };
  }
  if (locale === "en") {
    return {
      kind: "un_region",
      identity,
      locale,
      displayName: identity,
      source: "canonical_english",
    };
  }
  const override = lookupOverride(UN_REGION_OVERRIDES, identity, locale);
  if (override) {
    return {
      kind: "un_region",
      identity,
      locale,
      displayName: override,
      source: "platform_override",
    };
  }
  return {
    kind: "un_region",
    identity,
    locale,
    displayName: identity,
    source: "canonical_english",
  };
}

export function resolveUnSubregionDisplayName(input: {
  readonly englishSubregion: string;
  readonly locale: string;
}): GeographicDisplayNameResult {
  const locale = normalizeGeographicDisplayLocale(input.locale);
  const identity = input.englishSubregion.trim();
  if (!identity) {
    return {
      kind: "un_subregion",
      identity: "",
      locale,
      displayName: "",
      source: "fallback",
    };
  }
  if (locale === "en") {
    return {
      kind: "un_subregion",
      identity,
      locale,
      displayName: identity,
      source: "canonical_english",
    };
  }
  const override = lookupOverride(UN_SUBREGION_OVERRIDES, identity, locale);
  if (override) {
    return {
      kind: "un_subregion",
      identity,
      locale,
      displayName: override,
      source: "platform_override",
    };
  }
  return {
    kind: "un_subregion",
    identity,
    locale,
    displayName: identity,
    source: "canonical_english",
  };
}

/**
 * Administrative region (ISO 3166-2 style code) display name.
 * Canonical code unchanged; English dataset name is the default fallback.
 */
export function resolveAdminRegionDisplayName(input: {
  readonly countryCode: string;
  readonly regionCode: string;
  readonly locale: string;
  readonly fallback?: string;
}): GeographicDisplayNameResult {
  const locale = normalizeGeographicDisplayLocale(input.locale);
  const countryCode = normalizeCountryInput(input.countryCode) ?? input.countryCode.trim().toUpperCase();
  const regionCode =
    normalizeRegionInput(countryCode, input.regionCode) ?? input.regionCode.trim();
  const identity = `${countryCode}::${regionCode}`;

  if (regionCode === OTHER_REGION_SLUG || regionCode === OTHER_REGION_CODE) {
    const displayName =
      locale === "en"
        ? "Other / Not listed"
        : (OTHER_REGION_OVERRIDES[locale] ?? "Other / Not listed");
    return {
      kind: "admin_region",
      identity,
      locale,
      displayName,
      source: locale === "en" ? "canonical_english" : "platform_override",
    };
  }

  const region = getRegionByCode(countryCode, regionCode);
  const english = region?.name ?? input.fallback?.trim() ?? regionCode;

  return {
    kind: "admin_region",
    identity,
    locale,
    displayName: english,
    source: region ? "canonical_english" : "fallback",
  };
}

/** Convenience: country display string only. */
export function getLocalizedCountryDisplayName(
  countryCode: string,
  locale: string,
  fallback?: string,
): string {
  return resolveCountryDisplayName({ countryCode, locale, fallback }).displayName;
}

/** Convenience: admin region display string only. */
export function getLocalizedAdminRegionDisplayName(
  countryCode: string,
  regionCode: string,
  locale: string,
  fallback?: string,
): string {
  return resolveAdminRegionDisplayName({
    countryCode,
    regionCode,
    locale,
    fallback,
  }).displayName;
}
