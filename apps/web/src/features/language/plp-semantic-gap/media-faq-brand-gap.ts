/**
 * RESET 05C — Media FAQ Brand Localization bypass detection.
 *
 * Flags participant-facing organization identity that bypasses Brand when the
 * locale published Brand siteName differs from English "Humanity Union".
 *
 * Does NOT flag:
 * - External outlet / resource names
 * - Incidental word matches outside FAQ cards
 * - English locale (or when Brand siteName equals the English brand)
 * - Properly BRAND-owned spans (even if English text appears inside them)
 */

import type { PlpSemanticGapFinding, PlpSemanticGapReport } from "./country-initiative-rail-gap";

export type MediaFaqBrandGapKind = "MEDIA_FAQ_BRAND_BYPASS";

const ENGLISH_BRAND_DEFAULT = "Humanity Union";

const FAQ_CARD_RE =
  /<[^>]*class="[^"]*civic-media-resource-card[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article|section|li)>/gi;

/**
 * Strip BRAND-owned semantic nodes so English brand text inside them is ignored.
 */
function stripBrandOwnedNodes(html: string): string {
  return html.replace(
    /<[^>]*data-hu-semantic-owner="BRAND"[^>]*>[\s\S]*?<\/[^>]+>/gi,
    "",
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detect FAQ organization-identity Brand bypass in rendered Media HTML.
 */
export function evaluateMediaFaqBrandSemanticGaps(input: {
  readonly html: string;
  readonly locale: string;
  /** Published (or resolved) Brand siteName for the active locale. */
  readonly brandSiteName: string;
  /** English Brand siteName — defaults to canonical "Humanity Union". */
  readonly englishBrandSiteName?: string;
}): PlpSemanticGapReport {
  const findings: PlpSemanticGapFinding[] = [];
  const englishBrand = (input.englishBrandSiteName ?? ENGLISH_BRAND_DEFAULT).trim();
  const brandSiteName = input.brandSiteName.trim();

  if (!brandSiteName || brandSiteName === englishBrand) {
    return {
      pack: "RESET_05A",
      locale: input.locale,
      findings,
      ok: true,
    };
  }

  const faqSectionMatch = /id="faq"[^>]*>([\s\S]*?)(?:<section\b|<p class="civic-media-page__knowledge-link"|<\/main>)/i.exec(
    input.html,
  );
  const faqHtml = faqSectionMatch?.[1] ?? input.html;

  const englishBrandRe = new RegExp(escapeRegExp(englishBrand), "g");
  let cardMatch: RegExpExecArray | null;
  const cardRe = new RegExp(FAQ_CARD_RE.source, "gi");
  let scannedCards = 0;

  while ((cardMatch = cardRe.exec(faqHtml)) !== null) {
    scannedCards += 1;
    const cardInner = cardMatch[1] ?? "";
    const withoutBrand = stripBrandOwnedNodes(cardInner);
    if (englishBrandRe.test(withoutBrand)) {
      findings.push({
        kind: "MEDIA_FAQ_BRAND_BYPASS",
        surface: "civic-media-page__faq",
        detail: `FAQ renders English organization identity "${englishBrand}" without BRAND ownership while locale Brand siteName is "${brandSiteName}"`,
      });
      break;
    }
  }

  // Fallback when FAQ cards are not class-marked (e.g. minimal fixtures):
  // only scan FAQ section after stripping BRAND nodes.
  if (scannedCards === 0 && faqSectionMatch) {
    const withoutBrand = stripBrandOwnedNodes(faqHtml);
    if (new RegExp(escapeRegExp(englishBrand), "g").test(withoutBrand)) {
      findings.push({
        kind: "MEDIA_FAQ_BRAND_BYPASS",
        surface: "civic-media-page__faq",
        detail: `FAQ section renders English organization identity "${englishBrand}" without BRAND ownership while locale Brand siteName is "${brandSiteName}"`,
      });
    }
  }

  return {
    pack: "RESET_05A",
    locale: input.locale,
    findings,
    ok: findings.length === 0,
  };
}

export function assertNoMediaFaqBrandSemanticGaps(
  report: PlpSemanticGapReport,
): void {
  if (!report.ok) {
    throw new Error(
      report.findings.map((f) => `${f.kind}:${f.surface}:${f.detail}`).join("; "),
    );
  }
}
