/**
 * RESET 05C — reusable Brand Localization token composition.
 *
 * Canonical participant-facing templates may embed `{siteName}` (same ICU shape
 * as Support / Membership catalogs). Machine translation must preserve the token;
 * Brand Localization resolves the display string at compose/render time.
 *
 * Not a global "Humanity Union" string rewriter — only structural tokens.
 */

/** ICU-style placeholder for organization identity owned by Brand Localization. */
export const BRAND_SITE_NAME_TOKEN = "{siteName}" as const;

/**
 * Opaque sentinel for machine-translation hops. Distinctive so providers are
 * unlikely to "translate" it; restored to BRAND_SITE_NAME_TOKEN afterward.
 */
export const BRAND_SITE_NAME_MACHINE_SENTINEL = "⟦HU_BRAND_SITE_NAME⟧" as const;

export type BrandTokenValues = {
  readonly siteName: string;
};

export type BrandTokenPart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "brand"; readonly token: typeof BRAND_SITE_NAME_TOKEN };

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

/** Protect `{siteName}` before a machine-translation hop. */
export function protectBrandTokensForMachineTranslation(text: string): string {
  return text.replaceAll(BRAND_SITE_NAME_TOKEN, BRAND_SITE_NAME_MACHINE_SENTINEL);
}

/**
 * Restore Brand tokens after machine translation.
 * Tolerates minor whitespace mangling around the sentinel; does not rewrite
 * English brand literals.
 */
export function restoreBrandTokensAfterMachineTranslation(text: string): string {
  return text
    .replaceAll(BRAND_SITE_NAME_MACHINE_SENTINEL, BRAND_SITE_NAME_TOKEN)
    .replace(/⟦\s*HU_BRAND_SITE_NAME\s*⟧/g, BRAND_SITE_NAME_TOKEN);
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
