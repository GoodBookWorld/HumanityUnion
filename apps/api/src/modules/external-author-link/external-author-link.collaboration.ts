import type {
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
 * this is false while the link is disabled, setup is pending, or collaboration
 * is blocked or archived.
 */
export function isOrdinaryIntegrityMediaCollaborationAllowed(link: {
  state: ExternalAuthorLinkState;
  authorActivationPending?: boolean;
  collaborationStatus?: IntegrityMediaCollaborationStatus | null;
}): boolean {
  return (
    link.state === "linked" &&
    link.authorActivationPending !== true &&
    resolveIntegrityMediaCollaborationStatus(link) === "active"
  );
}
