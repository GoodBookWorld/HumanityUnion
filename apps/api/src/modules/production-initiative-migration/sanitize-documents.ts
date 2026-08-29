import type { Document } from "mongodb";

import {
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  STRIPE_OPERATIONAL_FIELDS,
} from "./constants.js";
import { extractStorageKeyFromUrl } from "./media-plan.js";

/**
 * Strip staging Stripe Test operational IDs. Never invent Live Stripe IDs.
 * Preserves HU business-state fields (status, paidAt, refundedAt, amounts, etc.).
 */
export function sanitizeStripeOperationalFields(doc: Document): Document {
  const out: Document = { ...doc };
  for (const field of STRIPE_OPERATIONAL_FIELDS) {
    if (field in out) {
      out[field] = null;
    }
  }
  return out;
}

/** Preserve shippingAddress on the destination document — callers must never log it. */
export function sanitizeBadgeApplicationForMigration(doc: Document): Document {
  const sanitized = sanitizeStripeOperationalFields(doc);
  // shippingAddress retained intentionally for fulfillment; redaction is a logging concern.
  return sanitized;
}

export function rewritePublicMediaUrl(
  url: string | null | undefined,
  publicBaseUrl: string = PRODUCTION_MEDIA_PUBLIC_BASE_URL,
): string | null {
  if (!url?.trim()) return null;
  const key = extractStorageKeyFromUrl(url.trim());
  if (!key) return url.trim();
  const base = publicBaseUrl.replace(/\/$/, "");
  return `${base}/${key.replace(/^\/+/, "")}`;
}

/**
 * Rewrite Initiative metadata public media URLs to production public base.
 * Preserves lifecycleProfile exactly (including null/absent) — never invents STANDARD.
 */
export function sanitizeInitiativeDocumentForMigration(
  doc: Document,
  publicBaseUrl: string = PRODUCTION_MEDIA_PUBLIC_BASE_URL,
): Document {
  const out: Document = { ...doc };
  // Ensure _id === initiativeId when both string ids
  const initiativeId =
    typeof out.initiativeId === "string" && out.initiativeId.trim()
      ? out.initiativeId.trim()
      : typeof out._id === "string"
        ? out._id
        : null;
  if (initiativeId) {
    out.initiativeId = initiativeId;
    out._id = initiativeId;
  }

  if (out.metadata && typeof out.metadata === "object") {
    const metadata = { ...(out.metadata as Record<string, unknown>) };
    if (typeof metadata.imageUrl === "string") {
      metadata.imageUrl = rewritePublicMediaUrl(metadata.imageUrl, publicBaseUrl) ?? metadata.imageUrl;
    }
    if (metadata.coverMedia && typeof metadata.coverMedia === "object") {
      const cover = { ...(metadata.coverMedia as Record<string, unknown>) };
      if (typeof cover.url === "string") {
        cover.url = rewritePublicMediaUrl(cover.url, publicBaseUrl) ?? cover.url;
      }
      metadata.coverMedia = cover;
    }
    out.metadata = metadata;
  }

  // lifecycleProfile: leave as-is (key absent, null, STANDARD, PUBLIC_CHOICE, …)
  return out;
}

export function sanitizeMediaUploadRecordForMigration(
  doc: Document,
  publicBaseUrl: string = PRODUCTION_MEDIA_PUBLIC_BASE_URL,
): Document {
  const out = sanitizeStripeOperationalFields({ ...doc });
  if (typeof out.mediaUrl === "string") {
    out.mediaUrl = rewritePublicMediaUrl(out.mediaUrl, publicBaseUrl) ?? out.mediaUrl;
  }
  if (typeof out.publicUrl === "string") {
    out.publicUrl = rewritePublicMediaUrl(out.publicUrl, publicBaseUrl) ?? out.publicUrl;
  }
  return out;
}

/** Fields that must never appear in sanitized reports. */
export const PRIVATE_REPORT_KEYS = [
  "shippingAddress",
  "addressLine1",
  "addressLine2",
  "recipientName",
  "phone",
  "passwordHash",
  "stripeCheckoutSessionId",
  "stripePaymentIntentId",
  "stripeCustomerId",
  "stripeChargeId",
] as const;

export function stripPrivateFieldsForReport(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripPrivateFieldsForReport);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if ((PRIVATE_REPORT_KEYS as readonly string[]).includes(key)) {
        if (key === "shippingAddress") {
          out.shippingDataPresent = true;
        }
        continue;
      }
      out[key] = stripPrivateFieldsForReport(entry);
    }
    return out;
  }
  return value;
}
