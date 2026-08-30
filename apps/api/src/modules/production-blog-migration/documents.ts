/**
 * Blog document sanitization / canonical media URL rewrite for production.
 * External HTTPS preserves (e.g. i0.wp.com) are never rewritten.
 *
 * Structured canonical media uses authoritative mediaId→storageKey mapping when
 * provided — never decide production URL eligibility from source hostname alone.
 */

import type { Document } from "mongodb";

import { PRODUCTION_MEDIA_PUBLIC_BASE_URL } from "./constants.js";
import {
  classifyMediaUrlHost,
  isCanonicalHuMediaUrl,
  storageKeyFromMediaUrl,
} from "./media-inventory.js";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function productionMediaUrlForStorageKey(
  storageKey: string,
  publicBaseUrl: string = PRODUCTION_MEDIA_PUBLIC_BASE_URL,
): string {
  const key = storageKey.replace(/^\/+/, "");
  const base = publicBaseUrl.replace(/\/$/, "");
  return `${base}/${key}`;
}

/**
 * Extract a storageKey path from a media URL without requiring HU host membership.
 * External HTTPS preserves (no HU canonical shape) return null.
 */
export function storageKeyFromLooseMediaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  const hostClass = classifyMediaUrlHost(trimmed);
  if (hostClass === "external_https_preserve") {
    // Only refuse true external preserves — r2.dev classifies as external_https_preserve
    // via host classifier, but structured migration media uses those hosts. Callers that
    // have an owned-key set should use tryResolveOwnedStorageKey instead.
    if (!/^https?:\/\/[^/]*\.r2\.dev\//i.test(trimmed) && !isCanonicalHuMediaUrl(trimmed)) {
      return null;
    }
  }
  const fromCanonical = storageKeyFromMediaUrl(trimmed);
  if (fromCanonical) return fromCanonical;
  // *.r2.dev / other https public object URLs: path is the storageKey.
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const path = new URL(trimmed).pathname.replace(/^\/+/, "");
      return path || null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Resolve owned storageKey for a URL when it safely maps to the owned set.
 * External preserves that are not r2.dev/HU never resolve.
 */
export function tryResolveOwnedStorageKey(
  url: string | null | undefined,
  ownedStorageKeys: ReadonlySet<string>,
): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  const hostClass = classifyMediaUrlHost(trimmed);
  if (
    hostClass === "external_https_preserve" &&
    !/^https?:\/\/[^/]*\.r2\.dev\//i.test(trimmed)
  ) {
    return null;
  }
  const key =
    storageKeyFromMediaUrl(trimmed) ??
    (() => {
      if (!/^https?:\/\//i.test(trimmed)) return null;
      try {
        return new URL(trimmed).pathname.replace(/^\/+/, "") || null;
      } catch {
        return null;
      }
    })();
  if (!key || !ownedStorageKeys.has(key)) return null;
  return key;
}

export function rewriteCanonicalBlogMediaUrl(
  url: string | null | undefined,
  publicBaseUrl: string = PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  ownedStorageKeys?: ReadonlySet<string>,
): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (ownedStorageKeys && ownedStorageKeys.size > 0) {
    const owned = tryResolveOwnedStorageKey(trimmed, ownedStorageKeys);
    if (owned) return productionMediaUrlForStorageKey(owned, publicBaseUrl);
  }
  if (!isCanonicalHuMediaUrl(trimmed)) {
    // External HTTPS / unknown — preserve unchanged.
    return trimmed;
  }
  const key = storageKeyFromMediaUrl(trimmed);
  if (!key) return trimmed;
  return productionMediaUrlForStorageKey(key, publicBaseUrl);
}

function rewriteCoverLike(
  value: unknown,
  publicBaseUrl: string,
  mediaIdToStorageKey?: ReadonlyMap<string, string>,
  ownedStorageKeys?: ReadonlySet<string>,
): unknown {
  if (!value || typeof value !== "object") return value;
  const record = { ...(value as Record<string, unknown>) };
  const mediaId = asString(record.mediaId);
  if (mediaId && mediaIdToStorageKey?.has(mediaId)) {
    const storageKey = mediaIdToStorageKey.get(mediaId)!;
    record.mediaUrl = productionMediaUrlForStorageKey(storageKey, publicBaseUrl);
    return record;
  }
  if (typeof record.mediaUrl === "string") {
    record.mediaUrl =
      rewriteCanonicalBlogMediaUrl(record.mediaUrl, publicBaseUrl, ownedStorageKeys) ??
      record.mediaUrl;
  }
  return record;
}

/** Rewrite img src attributes that point at canonical / owned HU media only. */
export function rewriteCanonicalMediaUrlsInHtml(
  html: string | null | undefined,
  publicBaseUrl: string = PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  ownedStorageKeys?: ReadonlySet<string>,
): string | null {
  if (html == null) return null;
  return html.replace(
    /(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)\2/gi,
    (_full, prefix: string, quote: string, src: string) => {
      const rewritten =
        rewriteCanonicalBlogMediaUrl(src, publicBaseUrl, ownedStorageKeys) ?? src;
      return `${prefix}${quote}${rewritten}${quote}`;
    },
  );
}

export function sanitizeBlogPostForMigration(
  doc: Document,
  publicBaseUrl: string = PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  mediaIdToStorageKey?: ReadonlyMap<string, string>,
): Document {
  const ownedStorageKeys = mediaIdToStorageKey
    ? new Set(mediaIdToStorageKey.values())
    : undefined;
  const out: Document = { ...doc };
  const postId =
    (typeof out.postId === "string" && out.postId.trim()) ||
    (typeof out._id === "string" ? out._id : null);
  if (postId) {
    out.postId = postId;
    out._id = postId;
  }
  if (out.coverMedia) {
    out.coverMedia = rewriteCoverLike(
      out.coverMedia,
      publicBaseUrl,
      mediaIdToStorageKey,
      ownedStorageKeys,
    );
  }
  if (out.optimization && typeof out.optimization === "object") {
    const opt = { ...(out.optimization as Record<string, unknown>) };
    if (opt.socialImage) {
      opt.socialImage = rewriteCoverLike(
        opt.socialImage,
        publicBaseUrl,
        mediaIdToStorageKey,
        ownedStorageKeys,
      );
    }
    out.optimization = opt;
  }
  if (typeof out.content === "string") {
    out.content = rewriteCanonicalMediaUrlsInHtml(
      out.content,
      publicBaseUrl,
      ownedStorageKeys,
    );
  }
  return out;
}

export function sanitizeMediaUploadRecordForBlogMigration(
  doc: Document,
  publicBaseUrl: string = PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  mediaIdToStorageKey?: ReadonlyMap<string, string>,
): Document {
  const out: Document = { ...doc };
  const mediaId =
    (typeof out.mediaId === "string" && out.mediaId.trim()) ||
    (typeof out._id === "string" ? out._id : null);
  if (mediaId) {
    out.mediaId = mediaId;
    out._id = mediaId;
  }
  const mappedKey = mediaId ? mediaIdToStorageKey?.get(mediaId) : undefined;
  const storageKey = mappedKey ?? asString(out.storageKey);
  if (storageKey) {
    // Authoritative production URL from storageKey — never retain source host.
    const target = productionMediaUrlForStorageKey(storageKey, publicBaseUrl);
    out.mediaUrl = target;
    if (typeof out.publicUrl === "string" || mappedKey) {
      if (typeof out.publicUrl === "string") out.publicUrl = target;
    }
    return out;
  }
  if (typeof out.mediaUrl === "string") {
    out.mediaUrl =
      rewriteCanonicalBlogMediaUrl(out.mediaUrl, publicBaseUrl) ?? out.mediaUrl;
  }
  if (typeof out.publicUrl === "string") {
    out.publicUrl =
      rewriteCanonicalBlogMediaUrl(out.publicUrl, publicBaseUrl) ?? out.publicUrl;
  }
  return out;
}

/** Copy subscriber document as-is (token hashes preserved). Never log private fields. */
export function prepareBlogSubscriberForMigration(doc: Document): Document {
  const out: Document = { ...doc };
  const subscriberId =
    (typeof out.subscriberId === "string" && out.subscriberId.trim()) ||
    (typeof out._id === "string" ? out._id : null);
  if (subscriberId) {
    out.subscriberId = subscriberId;
    out._id = subscriberId;
  }
  return out;
}

export function prepareBlogDeliveryForMigration(doc: Document): Document {
  const out: Document = { ...doc };
  const deliveryId =
    (typeof out.deliveryId === "string" && out.deliveryId.trim()) ||
    (typeof out._id === "string" ? out._id : null);
  if (deliveryId) {
    out.deliveryId = deliveryId;
    out._id = deliveryId;
  }
  // Historical ledger only — never mark as pending work.
  return out;
}

export function prepareIdentityDocument(
  doc: Document,
  idField: string,
): Document {
  const out: Document = { ...doc };
  const id =
    (typeof out[idField] === "string" && String(out[idField]).trim()) ||
    (typeof out._id === "string" ? out._id : null);
  if (id) {
    out[idField] = id;
    out._id = id;
  }
  return out;
}
