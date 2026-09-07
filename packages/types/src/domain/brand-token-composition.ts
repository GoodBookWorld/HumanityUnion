/**
 * RESET 05C / 05D.4 — reusable Brand Localization token composition.
 *
 * Canonical participant-facing templates may embed `{siteName}` (same ICU shape
 * as Support / Membership catalogs). Machine translation must preserve the token;
 * Brand Localization resolves the display string at compose/render time.
 *
 * RESET 05D.4 — transport sentinel is ASCII-only (`__HU_BRAND_SITE_NAME__`).
 * Unicode corner-bracket sentinels were provider-fragile (Gemini often dropped
 * or mangled them), causing BRAND_TOKEN_PRESERVATION_FAILED after restore.
 */

/** ICU-style placeholder for organization identity owned by Brand Localization. */
export const BRAND_SITE_NAME_TOKEN = "{siteName}" as const;

/**
 * ASCII transport sentinel for machine-translation hops.
 * JSON-safe, Latin-only, unlikely to be “translated” as natural language.
 */
export const BRAND_SITE_NAME_MACHINE_SENTINEL = "__HU_BRAND_SITE_NAME__" as const;

/**
 * Legacy Unicode sentinel (05C–05D.3). Still restored if a provider echoes it.
 * @deprecated Prefer BRAND_SITE_NAME_MACHINE_SENTINEL.
 */
export const BRAND_SITE_NAME_MACHINE_SENTINEL_LEGACY =
  "⟦HU_BRAND_SITE_NAME⟧" as const;

export type BrandTokenValues = {
  readonly siteName: string;
};

export type BrandTokenPart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "brand"; readonly token: typeof BRAND_SITE_NAME_TOKEN };

export type BrandTokenTransportState =
  | "PRESERVED"
  | "MISSING"
  | "ALTERED"
  | "MOVED_OR_UNMAPPABLE";

export type BrandTokenPathTransportReport = {
  readonly SEMANTIC_PATH: string;
  readonly EXPECTED_BRAND_TOKEN_COUNT: number;
  readonly RETURNED_BRAND_TOKEN_COUNT: number;
  readonly TOKEN_STATE: BrandTokenTransportState;
};

const SITE_NAME_TOKEN_RE = /\{siteName\}/g;

/**
 * Compose a template by substituting Brand values for structural tokens.
 * Leaves unknown braces untouched. Empty siteName leaves `{siteName}` intact
 * so callers can detect unresolved Brand (never silently blank identity).
 */
export function composeBrandTokens(
  template: string,
  values: BrandTokenValues,
): string {
  const siteName = values.siteName.trim();
  if (!siteName) {
    return template;
  }
  return template.replaceAll(BRAND_SITE_NAME_TOKEN, siteName);
}

/**
 * Split a template into text / brand parts for semantic rendering
 * (PLP_ENTITY prose + BRAND-owned organization spans).
 */
export function splitBrandTokenParts(template: string): readonly BrandTokenPart[] {
  const parts: BrandTokenPart[] = [];
  let lastIndex = 0;
  const re = new RegExp(SITE_NAME_TOKEN_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: "text", text: template.slice(lastIndex, match.index) });
    }
    parts.push({ kind: "brand", token: BRAND_SITE_NAME_TOKEN });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < template.length) {
    parts.push({ kind: "text", text: template.slice(lastIndex) });
  }
  if (parts.length === 0) {
    return [{ kind: "text", text: template }];
  }
  return parts;
}

export function templateHasBrandSiteNameToken(template: string): boolean {
  return template.includes(BRAND_SITE_NAME_TOKEN);
}

export function countBrandSiteNameTokens(text: string): number {
  const matches = text.match(SITE_NAME_TOKEN_RE);
  return matches?.length ?? 0;
}

/** Protect `{siteName}` before a machine-translation hop. */
export function protectBrandTokensForMachineTranslation(text: string): string {
  return text.replaceAll(BRAND_SITE_NAME_TOKEN, BRAND_SITE_NAME_MACHINE_SENTINEL);
}

/**
 * Restore Brand tokens after machine translation.
 * Accepts current ASCII sentinel, legacy Unicode sentinel, and light mangling
 * (whitespace / underscore noise) — never rewrites English brand literals.
 */
export function restoreBrandTokensAfterMachineTranslation(text: string): string {
  return text
    .replaceAll(BRAND_SITE_NAME_MACHINE_SENTINEL, BRAND_SITE_NAME_TOKEN)
    .replaceAll(BRAND_SITE_NAME_MACHINE_SENTINEL_LEGACY, BRAND_SITE_NAME_TOKEN)
    .replace(/__\s*HU_BRAND_SITE_NAME\s*__/gi, BRAND_SITE_NAME_TOKEN)
    .replace(/⟦\s*HU_BRAND_SITE_NAME\s*⟧/g, BRAND_SITE_NAME_TOKEN);
}

/**
 * Classify Brand token survival for one semantic path (no prose logged).
 * Call after restoreBrandTokensAfterMachineTranslation.
 */
export function classifyBrandTokenPathTransport(input: {
  readonly path: string;
  readonly canonicalSource: string;
  readonly restoredTranslated: string;
}): BrandTokenPathTransportReport | null {
  const expected = countBrandSiteNameTokens(input.canonicalSource);
  if (expected === 0) {
    return null;
  }
  const returned = countBrandSiteNameTokens(input.restoredTranslated);
  let state: BrandTokenTransportState;
  if (returned === expected) {
    state = "PRESERVED";
  } else if (returned === 0) {
    state = "MISSING";
  } else if (returned !== expected) {
    state = "ALTERED";
  } else {
    state = "MOVED_OR_UNMAPPABLE";
  }
  // Detect sentinel residue (provider returned placeholder but restore missed).
  if (
    returned === 0 &&
    (/HU_BRAND_SITE_NAME/i.test(input.restoredTranslated) ||
      input.restoredTranslated.includes("⟦") ||
      input.restoredTranslated.includes("__HU_"))
  ) {
    state = "MOVED_OR_UNMAPPABLE";
  }
  return {
    SEMANTIC_PATH: input.path,
    EXPECTED_BRAND_TOKEN_COUNT: expected,
    RETURNED_BRAND_TOKEN_COUNT: returned,
    TOKEN_STATE: state,
  };
}

/**
 * Apply protect → transform → restore around a translation function.
 * Used by PLP materializer provider boundary (token must survive MACHINE layer).
 */
export function withPreservedBrandTokens(
  text: string,
  transform: (protectedText: string) => string,
): string {
  return restoreBrandTokensAfterMachineTranslation(
    transform(protectBrandTokensForMachineTranslation(text)),
  );
}

/**
 * Classify FAQ machine prose independently of Brand token substitution.
 * Brand-only localization of `{siteName}` must NOT count as localized FAQ.
 */
export function classifyFaqMachineProseLocalization(input: {
  readonly template: string;
  readonly canonicalTemplate: string;
  readonly editorialMode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK" | string;
}): {
  readonly hasBrandToken: boolean;
  readonly proseEqualsCanonical: boolean;
  readonly machineLocalized: boolean;
  readonly brandOnlyIllusion: boolean;
} {
  const hasBrandToken = templateHasBrandSiteNameToken(input.template);
  const stripTokens = (value: string) =>
    value.replaceAll(BRAND_SITE_NAME_TOKEN, "").replace(/\s+/g, " ").trim();
  const proseEqualsCanonical =
    stripTokens(input.template) === stripTokens(input.canonicalTemplate);
  const machineLocalized =
    input.editorialMode === "PUBLISHED_LOCALIZED" && !proseEqualsCanonical;
  const brandOnlyIllusion =
    hasBrandToken &&
    proseEqualsCanonical &&
    input.editorialMode !== "PUBLISHED_LOCALIZED";
  return {
    hasBrandToken,
    proseEqualsCanonical,
    machineLocalized,
    brandOnlyIllusion,
  };
}
