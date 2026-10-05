/**
 * Page-specific localized SEO eligibility.
 *
 * Shared by hreflang and sitemap. A locale-prefixed URL is advertiseable only
 * when that page's ownership model has an authoritative localized representation.
 * Registry `enabled && seoIndexingEnabled` is necessary and not sufficient.
 * Global localization READY / 100% is not a gate.
 *
 * Knowledge article bodies have no translation owner. Localized article URLs
 * are never advertised; the locale-free English article remains the document.
 */

import { isPublicSeoLocalePath } from "@hu/types";

import { normalizeCanonicalPath } from "./public-site-url";

export type PublicSeoLocalizedPageFamily =
  | "home"
  | "institutions"
  | "initiatives_list"
  | "initiative_detail"
  | "blog_list"
  | "blog_post"
  | "civic_media"
  | "knowledge_list"
  | "knowledge_article"
  | "volunteer"
  | "contact"
  | "membership"
  | "privacy"
  | "terms"
  | "unsupported";

/**
 * Injected owner evidence. Callers fill these from existing public resolvers
 * (published WEB_UI pack, brand, legal, presentation-eligible CT / civic media).
 * This module does not reimplement currentness, sourceVersion, or fingerprints.
 */
export type PublicSeoLocalizedPageEvidence = {
  readonly webUiPublished: boolean;
  readonly brandPublishedForLocale: boolean;
  readonly legalPrivacyPublished: boolean;
  readonly legalTermsPublished: boolean;
  readonly civicMediaCurrent: boolean;
  /** Initiative detail and blog post only. */
  readonly entityCurrent: boolean;
};

export function classifyPublicSeoLocalizedPageFamily(
  localeFreePath: string,
): PublicSeoLocalizedPageFamily {
  const path = normalizeCanonicalPath(localeFreePath);
  if (!isPublicSeoLocalePath(path)) {
    return "unsupported";
  }
  if (path === "/") {
    return "home";
  }
  if (path === "/institutions") {
    return "institutions";
  }
  if (path === "/initiatives") {
    return "initiatives_list";
  }
  if (/^\/initiatives\/public\/[^/]+$/.test(path)) {
    return "initiative_detail";
  }
  if (path === "/blog") {
    return "blog_list";
  }
  if (/^\/blog\/[^/]+$/.test(path)) {
    return "blog_post";
  }
  if (path === "/media") {
    return "civic_media";
  }
  if (path === "/knowledge") {
    return "knowledge_list";
  }
  if (/^\/knowledge\/[^/]+$/.test(path)) {
    return "knowledge_article";
  }
  if (path === "/volunteer") {
    return "volunteer";
  }
  if (path === "/contact") {
    return "contact";
  }
  if (path === "/membership") {
    return "membership";
  }
  if (path === "/privacy") {
    return "privacy";
  }
  if (path === "/terms") {
    return "terms";
  }
  return "unsupported";
}

const CHROME_FAMILIES: ReadonlySet<PublicSeoLocalizedPageFamily> = new Set([
  "institutions",
  "initiatives_list",
  "blog_list",
  "knowledge_list",
  "volunteer",
  "contact",
  "membership",
]);

/**
 * True only when this page, for this evidence, has the localized representation
 * its owner requires. Knowledge articles are never eligible.
 */
export function isPublicSeoLocalizedVariantEligible(input: {
  readonly localeFreePath: string;
  readonly evidence: PublicSeoLocalizedPageEvidence;
}): boolean {
  const family = classifyPublicSeoLocalizedPageFamily(input.localeFreePath);
  const evidence = input.evidence;

  switch (family) {
    case "home":
      return evidence.brandPublishedForLocale && evidence.webUiPublished;
    case "privacy":
      return evidence.legalPrivacyPublished;
    case "terms":
      return evidence.legalTermsPublished;
    case "civic_media":
      return evidence.civicMediaCurrent;
    case "initiative_detail":
    case "blog_post":
      return evidence.entityCurrent;
    case "knowledge_article":
    case "unsupported":
      return false;
    default:
      return CHROME_FAMILIES.has(family) && evidence.webUiPublished;
  }
}
