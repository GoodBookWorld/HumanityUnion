/**
 * Blog document sanitization / canonical media URL rewrite for production.
 * External HTTPS preserves (e.g. i0.wp.com) are never rewritten.
 */

import type { Document } from "mongodb";

import { PRODUCTION_MEDIA_PUBLIC_BASE_URL } from "./constants.js";
import {
  isCanonicalHuMediaUrl,
  storageKeyFromMediaUrl,
} from "./media-inventory.js";

export function rewriteCanonicalBlogMediaUrl(
  url: string | null | undefined,
  publicBaseUrl: string = PRODUCTION_MEDIA_PUBLIC_BASE_URL,
): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (!isCanonicalHuMediaUrl(trimmed)) {
    // External HTTPS / unknown — preserve unchanged.
    return trimmed;
  }
  const key = storageKeyFromMediaUrl(trimmed);
  if (!key) return trimmed;
  const base = publicBaseUrl.replace(/\/$/, "");
  return `${base}/${key.replace(/^\/+/, "")}`;
}

function rewriteCoverLike(value: unknown, publicBaseUrl: string): unknown {
  if (!value || typeof value !== "object") return value;
  const record = { ...(value as Record<string, unknown>) };
  if (typeof record.mediaUrl === "string") {
    record.mediaUrl =
      rewriteCanonicalBlogMediaUrl(record.mediaUrl, publicBaseUrl) ?? record.mediaUrl;
  }
  return record;
}

/** Rewrite img src attributes that point at canonical HU media only. */
export function rewriteCanonicalMediaUrlsInHtml(
  html: string | null | undefined,
  publicBaseUrl: string = PRODUCTION_MEDIA_PUBLIC_BASE_URL,
): string | null {
  if (html == null) return null;
  return html.replace(
    /(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)\2/gi,
    (_full, prefix: string, quote: string, src: string) => {
      const rewritten = rewriteCanonicalBlogMediaUrl(src, publicBaseUrl) ?? src;
      return `${prefix}${quote}${rewritten}${quote}`;
    },
  );
}

export function sanitizeBlogPostForMigration(
  doc: Document,
  publicBaseUrl: string = PRODUCTION_MEDIA_PUBLIC_BASE_URL,
): Document {
  const out: Document = { ...doc };
  const postId =
    (typeof out.postId === "string" && out.postId.trim()) ||
    (typeof out._id === "string" ? out._id : null);
  if (postId) {
    out.postId = postId;
    out._id = postId;
  }
  if (out.coverMedia) {
    out.coverMedia = rewriteCoverLike(out.coverMedia, publicBaseUrl);
  }
  if (out.optimization && typeof out.optimization === "object") {
    const opt = { ...(out.optimization as Record<string, unknown>) };
    if (opt.socialImage) {
      opt.socialImage = rewriteCoverLike(opt.socialImage, publicBaseUrl);
    }
    out.optimization = opt;
  }
  if (typeof out.content === "string") {
    out.content = rewriteCanonicalMediaUrlsInHtml(out.content, publicBaseUrl);
  }
  return out;
}

export function sanitizeMediaUploadRecordForBlogMigration(
  doc: Document,
  publicBaseUrl: string = PRODUCTION_MEDIA_PUBLIC_BASE_URL,
): Document {
  const out: Document = { ...doc };
  const mediaId =
    (typeof out.mediaId === "string" && out.mediaId.trim()) ||
    (typeof out._id === "string" ? out._id : null);
  if (mediaId) {
    out.mediaId = mediaId;
    out._id = mediaId;
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
