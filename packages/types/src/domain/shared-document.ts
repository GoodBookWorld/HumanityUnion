/**
 * Communication UX Pack 03.7 — Secure Attachments & Shared Documents. One
 * unified module backs every communication surface (Part 1): Direct
 * Conversations, the Initiative Collaboration Channel, and Collaboration
 * Sessions all produce/consume the exact same `SharedDocument` shape,
 * distinguished only by `context`.
 */

export type SharedDocumentContextType =
  | "direct_conversation"
  | "collaboration_channel"
  | "collaboration_session"
  /** Initiative Lifecycle — Part K, Section 7. Official Response attachments. */
  | "official_response";

/**
 * A discriminated reference to exactly one communication context (Part 1
 * — "every uploaded document belongs to exactly one communication
 * context"). `collaboration_session` always carries `initiativeId` too
 * (never sessionId alone) because Sessions share the Channel's
 * Author-or-Active-Ally authorization boundary, which is resolved at the
 * Initiative level (Part 7/14 — reuse Initiative authorization).
 *
 * Initiative Lifecycle — Part K adds `official_response`: Steward/Author
 * uploads for a Response Candidate / published Response on an Initiative.
 */
export type SharedDocumentContextRef =
  | { contextType: "direct_conversation"; conversationId: string }
  | { contextType: "collaboration_channel"; initiativeId: string }
  | { contextType: "collaboration_session"; initiativeId: string; sessionId: string }
  | {
      contextType: "official_response";
      initiativeId: string;
      /** Candidate id before publish, or published responseId after. */
      responseId: string;
    };

/**
 * Mirrors the exact precedent already established by
 * `InitiativeCoverMediaVerificationStatus`: `rejected`/`malware_detected`
 * are modeled for forward compatibility with a future *asynchronous*
 * scanning/moderation adapter, but under the current synchronous,
 * deterministic checks (Part 4/5), a hard failure is rejected at upload
 * time and NEVER persisted — "Rejected files are never stored as active
 * documents" (Part 3). A stored `SharedDocument` therefore only ever
 * carries `approved` or `review_required` today.
 */
export type SharedDocumentVerificationStatus =
  | "approved"
  | "review_required"
  | "rejected"
  | "malware_detected";

/** The durable record. Every upload is immutable (Part 9): a "replace" creates a new row in the same `documentFamilyId`, never mutates this one's `storageKey`/`size`/etc. */
export interface SharedDocument {
  documentId: string;
  /** Stable across every version of the same logical document; equals `documentId` for version 1. */
  documentFamilyId: string;
  version: number;
  /** False once a newer version has replaced this one (Part 9 — history remains available, but only the latest version is "active"). */
  isLatestVersion: boolean;
  context: SharedDocumentContextRef;
  fileName: string;
  mimeType: string;
  /** Leading dot, e.g. `.pdf` — kept alongside `mimeType` so the frontend never needs to re-derive it for the file-type icon/label (Part 6/11). */
  extension: string;
  size: number;
  verificationStatus: SharedDocumentVerificationStatus;
  uploadedByParticipantId: string;
  uploadedAt: string;
  /** Set once a newer version supersedes this one. */
  supersededAt?: string;
  /** Set once removed (Part 9/10); a removed document is excluded from the active list and is never downloadable again. */
  removedAt?: string;
}

export interface SharedDocumentUploaderIdentity {
  displayName: string;
  avatarUrl?: string;
  profileUrl?: string;
}

/** The client-safe projection — never includes the internal `storageKey` (Part 8: no public URLs, ever). */
export interface SharedDocumentView {
  documentId: string;
  documentFamilyId: string;
  version: number;
  isLatestVersion: boolean;
  context: SharedDocumentContextRef;
  fileName: string;
  mimeType: string;
  extension: string;
  size: number;
  verificationStatus: SharedDocumentVerificationStatus;
  uploadedBy: SharedDocumentUploaderIdentity;
  uploadedByParticipantId: string;
  uploadedAt: string;
  supersededAt?: string;
  /** True only while the viewer is authorized for this document's context AND it is not removed/blocked (Part 8 — every download still re-checks authorization server-side; this is a display hint only). */
  canDownload: boolean;
  /** True only for the Participant who uploaded this document family's current version (Part 9 — replace/remove act on what you uploaded). */
  canManage: boolean;
}

export interface SharedDocumentListResult {
  context: SharedDocumentContextRef;
  /** Latest version of every non-removed document, newest first (Part 11). */
  documents: SharedDocumentView[];
}

/**
 * Communication UX Pack 03.7 Part 12 — Future Compatibility. None of the
 * following are implemented by this pack; these fields exist purely as
 * documented, zero-cost extension points so a future pack can extend
 * `SharedDocument`/`SharedDocumentView` without a breaking shape change:
 *
 * - Document preview (a rendered thumbnail/preview reference)
 * - Collaborative editing (a live co-editing session reference)
 * - Comments (a thread reference scoped to one document)
 * - Version comparison (a diff between two `documentFamilyId` versions)
 * - Approval workflow (a reviewer decision distinct from AI moderation)
 * - Digital signatures (a signature/attestation record)
 */
export type SharedDocumentFutureExtensionPoint =
  | "document_preview"
  | "collaborative_editing"
  | "comments"
  | "version_comparison"
  | "approval_workflow"
  | "digital_signatures";
