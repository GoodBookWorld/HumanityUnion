import type {
  ExternalAuthorLinkFinalization,
  ExternalAuthorLinkState,
  IntegrityMediaCollaborationStatus,
} from "./external-author-link.types.js";

/**
 * Rows created before collaboration control omit the field.
 * Readers treat that absence as active. No backfill is required.
 */
export function resolveIntegrityMediaCollaborationStatus(link: {
  collaborationStatus?: IntegrityMediaCollaborationStatus | null;
}): IntegrityMediaCollaborationStatus {
  if (
    link.collaborationStatus === "active" ||
    link.collaborationStatus === "blocked" ||
    link.collaborationStatus === "archived"
  ) {
    return link.collaborationStatus;
  }

  return "active";
}

/**
 * Ordinary HU→IM collaboration. Identity link and author setup stay separate:
 * this is false while the link is disabled, provisional, setup is pending, or
 * collaboration is blocked or archived. A missing finalization field stays allowed.
 */
export function isOrdinaryIntegrityMediaCollaborationAllowed(link: {
  state: ExternalAuthorLinkState;
  authorActivationPending?: boolean;
  authorDeletionPending?: boolean;
  collaborationStatus?: IntegrityMediaCollaborationStatus | null;
  linkFinalization?: ExternalAuthorLinkFinalization | null;
}): boolean {
  return (
    link.state === "linked" &&
    link.authorActivationPending !== true &&
    link.authorDeletionPending !== true &&
    link.linkFinalization !== "provisional" &&
    resolveIntegrityMediaCollaborationStatus(link) === "active"
  );
}
