/**
 * Pack 16C — plain-text SEO/social metadata sanitization (no HTML/scripts).
 */
import type {
  BlogAuthorExternalSocialAccountPreference,
  BlogCoverMedia,
  BlogHuSocialDistributionPreference,
  BlogPublicationDistribution,
  BlogPublicationOptimization,
  BlogPost,
  PublicBlogPostSeo,
} from "@hu/types";

import { BlogValidationError } from "./blog.errors.js";
import { resolveBlogCoverMedia } from "./blog-cover-media.js";

export const BLOG_SEO_TITLE_MAX = 70;
export const BLOG_SEO_DESCRIPTION_MAX = 320;
export const BLOG_SEO_TITLE_GUIDE = 60;
export const BLOG_SEO_DESCRIPTION_GUIDE = 160;

const EXTERNAL_PROVIDERS = new Set(["facebook", "x", "linkedin", "other"]);

/** Strip tags/entities and collapse whitespace — SEO fields are plain text only. */
export function sanitizeBlogPlainTextMeta(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[#a-zA-Z0-9]+;/g, " ")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateBlogSeoPlainText(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new BlogValidationError(`${field} must be a string.`);
  }
  const cleaned = sanitizeBlogPlainTextMeta(value);
  if (!cleaned) {
    return undefined;
  }
  if (cleaned.length > maxLength) {
    throw new BlogValidationError(`${field} must be at most ${maxLength} characters.`);
  }
  if (/<|>|script/i.test(cleaned) && /<|>/.test(value)) {
    throw new BlogValidationError(`${field} must not contain HTML.`);
  }
  return cleaned;
}

function validateHuSocialShare(value: unknown): BlogHuSocialDistributionPreference {
  if (value === undefined || value === null || value === "") {
    return "unset";
  }
  if (value === "opt_in" || value === "opt_out" || value === "unset") {
    return value;
  }
  throw new BlogValidationError("distribution.huSocialShare is invalid.");
}

function validateExternalAccounts(
  value: unknown,
): readonly BlogAuthorExternalSocialAccountPreference[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new BlogValidationError("distribution.authorExternalAccounts must be an array.");
  }
  return value.slice(0, 8).map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new BlogValidationError(`authorExternalAccounts[${index}] is invalid.`);
    }
    const row = entry as Record<string, unknown>;
    const provider = typeof row.provider === "string" ? row.provider : "";
    if (!EXTERNAL_PROVIDERS.has(provider)) {
      throw new BlogValidationError(`authorExternalAccounts[${index}].provider is unsupported.`);
    }
    const label =
      typeof row.label === "string" ? sanitizeBlogPlainTextMeta(row.label).slice(0, 80) : undefined;
    const enabled = row.enabled === true;
    // Pack 16C honesty: no credentials — only not_connected until a real integration exists.
    const connectionStatus =
      row.connectionStatus === "connected" || row.connectionStatus === "error"
        ? "not_connected"
        : "not_connected";
    return {
      provider: provider as BlogAuthorExternalSocialAccountPreference["provider"],
      ...(label ? { label } : {}),
      enabled,
      connectionStatus,
    };
  });
}

export function validateBlogPublicationOptimization(
  value: unknown,
): BlogPublicationOptimization | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object") {
    throw new BlogValidationError("optimization must be an object.");
  }
  const input = value as Record<string, unknown>;
  const seoTitle = validateBlogSeoPlainText(input.seoTitle, "seoTitle", BLOG_SEO_TITLE_MAX);
  const seoDescription = validateBlogSeoPlainText(
    input.seoDescription,
    "seoDescription",
    BLOG_SEO_DESCRIPTION_MAX,
  );
  const socialTitle = validateBlogSeoPlainText(
    input.socialTitle,
    "socialTitle",
    BLOG_SEO_TITLE_MAX,
  );
  const socialDescription = validateBlogSeoPlainText(
    input.socialDescription,
    "socialDescription",
    BLOG_SEO_DESCRIPTION_MAX,
  );

  let socialImage: BlogCoverMedia | null | undefined;
  if ("socialImage" in input) {
    socialImage = resolveBlogCoverMedia(input.socialImage);
  }

  let distribution: BlogPublicationDistribution | undefined;
  if ("distribution" in input && input.distribution != null) {
    if (typeof input.distribution !== "object") {
      throw new BlogValidationError("distribution must be an object.");
    }
    const dist = input.distribution as Record<string, unknown>;
    distribution = {
      huSocialShare: validateHuSocialShare(dist.huSocialShare),
      authorExternalAccounts: validateExternalAccounts(dist.authorExternalAccounts),
    };
  }

  const optimization: BlogPublicationOptimization = {
    ...(seoTitle ? { seoTitle } : {}),
    ...(seoDescription ? { seoDescription } : {}),
    ...(socialTitle ? { socialTitle } : {}),
    ...(socialDescription ? { socialDescription } : {}),
    ...(socialImage !== undefined ? { socialImage } : {}),
    ...(distribution ? { distribution } : {}),
  };

  if (Object.keys(optimization).length === 0) {
    return undefined;
  }
  return optimization;
}

export function resolvePublicBlogPostSeo(post: BlogPost): PublicBlogPostSeo {
  const opt = post.optimization;
  const title = opt?.seoTitle?.trim() || post.title;
  const description = opt?.seoDescription?.trim() || post.excerpt || post.title;
  const socialTitle = opt?.socialTitle?.trim() || title;
  const socialDescription = opt?.socialDescription?.trim() || description;
  const socialImage =
    opt?.socialImage !== undefined && opt.socialImage !== null
      ? opt.socialImage
      : post.coverMedia;

  return {
    title,
    description,
    canonicalPath: `/blog/${encodeURIComponent(post.slug)}`,
    socialTitle,
    socialDescription,
    socialImage: socialImage ? { ...socialImage } : null,
  };
}
