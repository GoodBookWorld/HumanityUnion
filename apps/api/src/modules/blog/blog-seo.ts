/**
 * Pack 16C — plain-text SEO/social metadata sanitization (no HTML/scripts).
 * Pack 17D — HU platform channel distribution permissions (Pack 17C destinations).
 */
import type {
  BlogAuthorExternalSocialAccountPreference,
  BlogCoverMedia,
  BlogHuPlatformDistributionChannel,
  BlogHuSocialDistributionPreference,
  BlogPublicationDistribution,
  BlogPublicationOptimization,
  BlogPost,
  PlatformSocialNetworkId,
  PublicBlogPostSeo,
} from "@hu/types";
import { PLATFORM_SOCIAL_NETWORK_IDS } from "@hu/types";

import { listPublicPlatformSocialAccounts } from "../platform-social-accounts/index.js";
import { resolveBlogCoverMedia } from "./blog-cover-media.js";
import { BlogValidationError } from "./blog.errors.js";

export const BLOG_SEO_TITLE_MAX = 70;
export const BLOG_SEO_DESCRIPTION_MAX = 320;
export const BLOG_SEO_TITLE_GUIDE = 60;
export const BLOG_SEO_DESCRIPTION_GUIDE = 160;

const EXTERNAL_PROVIDERS = new Set(["facebook", "x", "linkedin", "other"]);
const PLATFORM_NETWORK_SET = new Set<string>(PLATFORM_SOCIAL_NETWORK_IDS);

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

/**
 * Pack 17D — accept networkId + permitted only.
 * Reject client-supplied destination URLs / credentials.
 */
export function validateHuPlatformChannels(
  value: unknown,
): readonly BlogHuPlatformDistributionChannel[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new BlogValidationError("distribution.huPlatformChannels must be an array.");
  }

  const byNetwork = new Map<PlatformSocialNetworkId, BlogHuPlatformDistributionChannel>();
  for (const [index, entry] of value.slice(0, 8).entries()) {
    if (!entry || typeof entry !== "object") {
      throw new BlogValidationError(`huPlatformChannels[${index}] is invalid.`);
    }
    const row = entry as Record<string, unknown>;
    if ("url" in row || "destinationUrl" in row || "accountUrl" in row) {
      throw new BlogValidationError(
        "huPlatformChannels must not include account URLs — destinations are resolved server-side.",
      );
    }
    if ("token" in row || "accessToken" in row || "password" in row || "oauth" in row) {
      throw new BlogValidationError("huPlatformChannels must not include credentials.");
    }
    const networkId = typeof row.networkId === "string" ? row.networkId : "";
    if (!PLATFORM_NETWORK_SET.has(networkId)) {
      throw new BlogValidationError(`huPlatformChannels[${index}].networkId is unsupported.`);
    }
    byNetwork.set(networkId as PlatformSocialNetworkId, {
      networkId: networkId as PlatformSocialNetworkId,
      permitted: row.permitted === true,
    });
  }

  return PLATFORM_SOCIAL_NETWORK_IDS.map(
    (networkId) =>
      byNetwork.get(networkId) ?? {
        networkId,
        permitted: false,
      },
  );
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

function deriveHuSocialShare(
  channels: readonly BlogHuPlatformDistributionChannel[],
  explicit: BlogHuSocialDistributionPreference,
): BlogHuSocialDistributionPreference {
  if (channels.some((channel) => channel.permitted)) {
    return "opt_in";
  }
  if (explicit === "opt_out") {
    return "opt_out";
  }
  return channels.length > 0 ? "unset" : explicit;
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
    const huPlatformChannels = validateHuPlatformChannels(dist.huPlatformChannels);
    const explicitShare = validateHuSocialShare(dist.huSocialShare);
    const authorExternalAccounts = validateExternalAccounts(dist.authorExternalAccounts).map(
      (account) => ({
        ...account,
        enabled: false,
        connectionStatus: "not_connected" as const,
      }),
    );
    distribution = {
      huSocialShare: deriveHuSocialShare(huPlatformChannels, explicitShare),
      huPlatformChannels,
      authorExternalAccounts,
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

/**
 * Pack 17D — only configured/enabled Pack 17C accounts may remain permitted.
 */
export async function gateBlogPublicationOptimizationAgainstPlatformAccounts(
  optimization: BlogPublicationOptimization | undefined,
): Promise<BlogPublicationOptimization | undefined> {
  if (!optimization?.distribution?.huPlatformChannels) {
    return optimization;
  }

  const publicAccounts = await listPublicPlatformSocialAccounts();
  const configured = new Set(publicAccounts.accounts.map((account) => account.networkId));
  const gatedChannels = optimization.distribution.huPlatformChannels.map((channel) => ({
    networkId: channel.networkId,
    permitted: channel.permitted === true && configured.has(channel.networkId),
  }));

  return {
    ...optimization,
    distribution: {
      ...optimization.distribution,
      huPlatformChannels: gatedChannels,
      huSocialShare: deriveHuSocialShare(
        gatedChannels,
        optimization.distribution.huSocialShare,
      ),
      authorExternalAccounts: (optimization.distribution.authorExternalAccounts ?? []).map(
        (account) => ({
          ...account,
          enabled: false,
          connectionStatus: "not_connected" as const,
        }),
      ),
    },
  };
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
