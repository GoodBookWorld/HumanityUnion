/**
 * SEO Pack 07 — validate sparse page SEO override fields (Blog limits reused).
 */
import type { SeoPageOverrideFamily, SeoPageOverrideFields } from "@hu/types";
import { SEO_PAGE_OVERRIDE_FAMILIES } from "@hu/types";

import { BlogValidationError } from "../blog/blog.errors.js";
import {
  BLOG_SEO_DESCRIPTION_MAX,
  BLOG_SEO_TITLE_MAX,
  sanitizeBlogPlainTextMeta,
  validateBlogSeoPlainText,
} from "../blog/blog-seo.js";
import { SeoPageOverrideValidationError } from "./seo-page-overrides.errors.js";

export const SEO_PAGE_OVERRIDE_TITLE_MAX = BLOG_SEO_TITLE_MAX;
export const SEO_PAGE_OVERRIDE_DESCRIPTION_MAX = BLOG_SEO_DESCRIPTION_MAX;

const FAMILY_SET = new Set<string>(SEO_PAGE_OVERRIDE_FAMILIES);

function wrapPlainText(value: unknown, field: string, maxLength: number): string | undefined {
  try {
    return validateBlogSeoPlainText(value, field, maxLength);
  } catch (error) {
    if (error instanceof BlogValidationError) {
      throw new SeoPageOverrideValidationError(error.message);
    }
    throw error;
  }
}

export function parseSeoPageOverrideFamily(value: unknown): SeoPageOverrideFamily {
  if (typeof value !== "string" || !FAMILY_SET.has(value)) {
    throw new SeoPageOverrideValidationError(
      `family must be one of: ${SEO_PAGE_OVERRIDE_FAMILIES.join(", ")}.`,
    );
  }
  return value as SeoPageOverrideFamily;
}

export function validateSeoPageEntityKey(
  family: SeoPageOverrideFamily,
  entityKey: unknown,
): string {
  if (typeof entityKey !== "string" || !entityKey.trim()) {
    throw new SeoPageOverrideValidationError("entityKey is required.");
  }
  const key = entityKey.trim();
  if (key.length > 200) {
    throw new SeoPageOverrideValidationError("entityKey must be at most 200 characters.");
  }
  if (/[<>\s]/.test(key)) {
    throw new SeoPageOverrideValidationError("entityKey is invalid.");
  }

  if (family === "country") {
    if (!/^[A-Za-z]{2}$/.test(key)) {
      throw new SeoPageOverrideValidationError("Country entityKey must be an ISO country code.");
    }
    return key.toUpperCase();
  }

  return key;
}

export function expectedCanonicalPathForSeoPage(
  family: SeoPageOverrideFamily,
  entityKey: string,
): string {
  switch (family) {
    case "country":
      return `/countries/${encodeURIComponent(entityKey)}`;
    case "initiative":
      return `/initiatives/public/${encodeURIComponent(entityKey)}`;
    case "knowledge":
      return `/knowledge/${encodeURIComponent(entityKey)}`;
    case "civic-archive":
      return `/civic-archive/${encodeURIComponent(entityKey)}`;
  }
}

export function validateSeoPageCanonicalPath(
  family: SeoPageOverrideFamily,
  entityKey: string,
  canonicalPath: unknown,
): string {
  if (typeof canonicalPath !== "string" || !canonicalPath.trim()) {
    throw new SeoPageOverrideValidationError("canonicalPath is required.");
  }
  const path = canonicalPath.trim();
  if (!path.startsWith("/") || path.includes("://") || /[<>\s]/.test(path)) {
    throw new SeoPageOverrideValidationError("canonicalPath must be a public path starting with /.");
  }

  const expected = expectedCanonicalPathForSeoPage(family, entityKey);
  const unencoded = expected.replace(encodeURIComponent(entityKey), entityKey);
  if (path !== expected && path !== unencoded) {
    throw new SeoPageOverrideValidationError(
      `canonicalPath must match the stable public route for this page (${expected}).`,
    );
  }

  return expected;
}

function validateSocialImageUrl(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new SeoPageOverrideValidationError("socialImageUrl must be a string.");
  }
  const cleaned = sanitizeBlogPlainTextMeta(value);
  if (!cleaned) {
    return undefined;
  }
  if (cleaned.length > 2000) {
    throw new SeoPageOverrideValidationError("socialImageUrl must be at most 2000 characters.");
  }
  if (/^(https?:\/\/)/i.test(cleaned)) {
    try {
      const parsed = new URL(cleaned);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new SeoPageOverrideValidationError("socialImageUrl must be http(s).");
      }
      return cleaned;
    } catch (error) {
      if (error instanceof SeoPageOverrideValidationError) {
        throw error;
      }
      throw new SeoPageOverrideValidationError("socialImageUrl must be a valid URL.");
    }
  }
  if (cleaned.startsWith("/") && !cleaned.startsWith("//")) {
    return cleaned;
  }
  throw new SeoPageOverrideValidationError(
    "socialImageUrl must be an absolute http(s) URL or a site-relative path.",
  );
}

export function validateSeoPageOverrideFields(input: unknown): SeoPageOverrideFields {
  if (input === undefined || input === null) {
    return {};
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new SeoPageOverrideValidationError("fields must be an object.");
  }
  const raw = input as Record<string, unknown>;

  const seoTitle = wrapPlainText(raw.seoTitle, "seoTitle", SEO_PAGE_OVERRIDE_TITLE_MAX);
  const seoDescription = wrapPlainText(
    raw.seoDescription,
    "seoDescription",
    SEO_PAGE_OVERRIDE_DESCRIPTION_MAX,
  );
  const socialTitle = wrapPlainText(raw.socialTitle, "socialTitle", SEO_PAGE_OVERRIDE_TITLE_MAX);
  const socialDescription = wrapPlainText(
    raw.socialDescription,
    "socialDescription",
    SEO_PAGE_OVERRIDE_DESCRIPTION_MAX,
  );
  const socialImageUrl = validateSocialImageUrl(raw.socialImageUrl);

  return {
    ...(seoTitle ? { seoTitle } : {}),
    ...(seoDescription ? { seoDescription } : {}),
    ...(socialTitle ? { socialTitle } : {}),
    ...(socialDescription ? { socialDescription } : {}),
    ...(socialImageUrl ? { socialImageUrl } : {}),
  };
}
