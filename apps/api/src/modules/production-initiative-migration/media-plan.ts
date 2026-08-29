import type { Document } from "mongodb";

import { SYSTEM_MEDIA_RECOVERY_OWNER } from "./constants.js";
import type { MediaDestinationAction, MediaPlanItem } from "./types.js";

/** Public-CDN purposes written to media_upload_records (see media-object-storage-policy). */
export const CANONICAL_PUBLIC_MEDIA_PURPOSES = new Set([
  "avatar",
  "initiative-image",
  "blog-image",
  "media-resource-logo",
]);

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function hostnameOf(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    return new URL(url.trim()).hostname;
  } catch {
    return null;
  }
}

export function classifyMediaHost(hostname: string | null): MediaPlanItem["hostClassification"] {
  if (!hostname) return "none";
  if (/localhost|127\.0\.0\.1/i.test(hostname)) return "localhost";
  // Staging R2 public hosts commonly include "staging" or known staging CDN patterns.
  if (/staging/i.test(hostname)) return "staging_r2";
  if (/production|prod/i.test(hostname) && /r2|cloudflare|humanityunion/i.test(hostname)) {
    return "production_r2";
  }
  // Heuristic: r2.dev / Cloudflare R2 public without staging marker treated as other (rewrite if migrating)
  if (/\.r2\.dev$/i.test(hostname) || /cloudflarestorage/i.test(hostname)) {
    return /staging/i.test(hostname) ? "staging_r2" : "other";
  }
  return "other";
}

export function decideMediaDestinationAction(input: {
  storageKey: string | null;
  publicPrivate: "public" | "private" | "unknown";
  hostClassification: MediaPlanItem["hostClassification"];
  mediaUploadRecordPresent: boolean;
}): { action: MediaDestinationAction; urlRewriteRequired: boolean } {
  if (!input.storageKey && input.hostClassification === "none") {
    return { action: "NO_COPY", urlRewriteRequired: false };
  }
  if (!input.storageKey && input.hostClassification !== "none") {
    return { action: "ERROR", urlRewriteRequired: true };
  }
  if (input.hostClassification === "localhost") {
    return { action: "ERROR", urlRewriteRequired: true };
  }
  if (input.publicPrivate === "private") {
    return {
      action: "COPY_PRIVATE",
      urlRewriteRequired: input.hostClassification === "staging_r2" || input.hostClassification === "other",
    };
  }
  if (input.hostClassification === "staging_r2" || input.hostClassification === "other") {
    return { action: "COPY_PUBLIC", urlRewriteRequired: true };
  }
  if (input.hostClassification === "production_r2") {
    return { action: "NO_COPY", urlRewriteRequired: false };
  }
  if (!input.mediaUploadRecordPresent && input.storageKey) {
    return { action: "COPY_PUBLIC", urlRewriteRequired: true };
  }
  return { action: "COPY_PUBLIC", urlRewriteRequired: true };
}

/**
 * Authoritative visibility from a canonical media_upload_records document.
 * system-media-recovery ownership and historical-recovery path alone never prove visibility.
 */
export function classifyCanonicalMediaUploadVisibility(doc: Document): {
  publicPrivate: MediaPlanItem["publicPrivate"];
  visibilityAuthority: MediaPlanItem["visibilityAuthority"];
  mediaPurpose: string | null;
  evidence: string;
} {
  const purpose = asString(doc.purpose);
  const visibilityField = asString(doc.visibility) ?? asString(doc.access);
  const bucketRole =
    asString(doc.bucketRole) ??
    asString(doc.storageBucketRole) ??
    asString(doc.objectVisibility);

  if (visibilityField === "private" || bucketRole === "private") {
    return {
      publicPrivate: "private",
      visibilityAuthority: "canonical_media_record",
      mediaPurpose: purpose,
      evidence: visibilityField === "private" ? "visibility/access=private" : "bucketRole=private",
    };
  }
  if (visibilityField === "public" || bucketRole === "public") {
    return {
      publicPrivate: "public",
      visibilityAuthority: "canonical_media_record",
      mediaPurpose: purpose,
      evidence: visibilityField === "public" ? "visibility/access=public" : "bucketRole=public",
    };
  }
  if (purpose && CANONICAL_PUBLIC_MEDIA_PURPOSES.has(purpose)) {
    return {
      publicPrivate: "public",
      visibilityAuthority: "canonical_media_record",
      mediaPurpose: purpose,
      evidence: `purpose=${purpose} (public CDN bucket)`,
    };
  }
  return {
    publicPrivate: "unknown",
    visibilityAuthority: "none",
    mediaPurpose: purpose,
    evidence: "no authoritative visibility/access/purpose/bucketRole",
  };
}

export function planMediaFromInitiativeDocument(input: {
  initiativeId: string;
  doc: Document;
  mediaUploadKeys: ReadonlySet<string>;
}): MediaPlanItem[] {
  const items: MediaPlanItem[] = [];
  const metadata =
    input.doc.metadata && typeof input.doc.metadata === "object"
      ? (input.doc.metadata as Record<string, unknown>)
      : {};

  const imageUrl = asString(metadata.imageUrl);
  if (imageUrl) {
    const host = hostnameOf(imageUrl);
    const hostClassification = classifyMediaHost(host);
    const storageKey = extractStorageKeyFromUrl(imageUrl);
    const mediaUploadRecordPresent = storageKey
      ? input.mediaUploadKeys.has(storageKey)
      : false;
    const decision = decideMediaDestinationAction({
      storageKey,
      publicPrivate: "public",
      hostClassification,
      mediaUploadRecordPresent,
    });
    items.push({
      sourceStorageKey: storageKey,
      publicPrivate: "public",
      // Initiative URL refs are not canonical media-record authority.
      visibilityAuthority: "none",
      owningInitiativeId: input.initiativeId,
      mediaUploadRecordPresent,
      sourceUrlHost: host,
      hostClassification,
      destinationAction: decision.action,
      urlRewriteRequired: decision.urlRewriteRequired,
      sourceCollection: "initiatives",
      recordId: input.initiativeId,
      ownerIsSystemMediaRecovery: false,
      mediaPurpose: null,
    });
  }

  const cover =
    metadata.coverMedia && typeof metadata.coverMedia === "object"
      ? (metadata.coverMedia as Record<string, unknown>)
      : null;
  const coverUrl = asString(cover?.url);
  if (coverUrl) {
    const host = hostnameOf(coverUrl);
    const hostClassification = classifyMediaHost(host);
    const storageKey = extractStorageKeyFromUrl(coverUrl) ?? asString(cover?.storageKey);
    const mediaUploadRecordPresent = storageKey
      ? input.mediaUploadKeys.has(storageKey)
      : false;
    const decision = decideMediaDestinationAction({
      storageKey,
      publicPrivate: "public",
      hostClassification,
      mediaUploadRecordPresent,
    });
    items.push({
      sourceStorageKey: storageKey,
      publicPrivate: "public",
      visibilityAuthority: "none",
      owningInitiativeId: input.initiativeId,
      mediaUploadRecordPresent,
      sourceUrlHost: host,
      hostClassification,
      destinationAction: decision.action,
      urlRewriteRequired: decision.urlRewriteRequired,
      sourceCollection: "initiatives",
      recordId: input.initiativeId,
      ownerIsSystemMediaRecovery: false,
      mediaPurpose: null,
    });
  }

  return items;
}

export function planMediaFromUploadRecord(doc: Document): MediaPlanItem {
  const storageKey = asString(doc.storageKey);
  const mediaUrl = asString(doc.mediaUrl) ?? asString(doc.publicUrl);
  const host = hostnameOf(mediaUrl);
  const hostClassification = classifyMediaHost(host);
  const owner =
    asString(doc.uploadedByParticipantId) ??
    asString(doc.ownerParticipantId) ??
    asString(doc.ownerId);
  const ownerIsSystemMediaRecovery = owner === SYSTEM_MEDIA_RECOVERY_OWNER;
  const classified = classifyCanonicalMediaUploadVisibility(doc);
  const decision = decideMediaDestinationAction({
    storageKey,
    publicPrivate:
      classified.publicPrivate === "unknown" ? "public" : classified.publicPrivate,
    hostClassification,
    mediaUploadRecordPresent: true,
  });
  return {
    sourceStorageKey: storageKey,
    publicPrivate: classified.publicPrivate,
    visibilityAuthority: classified.visibilityAuthority,
    owningInitiativeId: asString(doc.initiativeId),
    mediaUploadRecordPresent: true,
    sourceUrlHost: host,
    hostClassification,
    destinationAction: decision.action,
    urlRewriteRequired: decision.urlRewriteRequired,
    sourceCollection: "media_upload_records",
    recordId: asString(doc.mediaId) ?? asString(doc._id),
    ownerIsSystemMediaRecovery,
    mediaPurpose: classified.mediaPurpose,
  };
}

export function planMediaFromSharedDocument(doc: Document): MediaPlanItem {
  const storageKey = asString(doc.storageKey);
  const decision = decideMediaDestinationAction({
    storageKey,
    publicPrivate: "private",
    hostClassification: "other",
    mediaUploadRecordPresent: Boolean(storageKey),
  });
  return {
    sourceStorageKey: storageKey,
    publicPrivate: "private",
    visibilityAuthority: "none",
    owningInitiativeId: asString(doc.initiativeId),
    mediaUploadRecordPresent: Boolean(storageKey),
    sourceUrlHost: null,
    hostClassification: "other",
    destinationAction: decision.action,
    urlRewriteRequired: decision.urlRewriteRequired,
    sourceCollection: "shared_documents",
    recordId: asString(doc.documentId) ?? asString(doc._id),
    ownerIsSystemMediaRecovery: false,
    mediaPurpose: null,
  };
}

export function extractStorageKeyFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.replace(/^\/+/, "");
    if (!pathname) return null;
    // Strip common public prefixes
    return pathname.replace(/^api\/v1\/media\/files\//, "");
  } catch {
    return null;
  }
}

export function summarizeMediaPlan(items: MediaPlanItem[]): {
  copyPublic: number;
  copyPrivate: number;
  noCopy: number;
  error: number;
  rewriteRequired: number;
} {
  return {
    copyPublic: items.filter((i) => i.destinationAction === "COPY_PUBLIC").length,
    copyPrivate: items.filter((i) => i.destinationAction === "COPY_PRIVATE").length,
    noCopy: items.filter((i) => i.destinationAction === "NO_COPY").length,
    error: items.filter((i) => i.destinationAction === "ERROR").length,
    rewriteRequired: items.filter((i) => i.urlRewriteRequired).length,
  };
}
