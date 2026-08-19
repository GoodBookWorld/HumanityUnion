/**
 * Reusable civic share payload — public Initiative / Petition surfaces only.
 * Never include private draft, admin, email, or unpublished collaboration data.
 */
export type CivicShareContentType = "initiative" | "petition";

export interface CivicSharePayload {
  readonly url: string;
  readonly title: string;
  readonly image?: string;
  readonly optionalText?: string;
  readonly contentType: CivicShareContentType;
  readonly initiativeId: string;
  readonly petitionId?: string;
}

export function isCivicSharePayloadPublic(payload: CivicSharePayload): boolean {
  const url = payload.url.trim();
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url, "https://humanityunion.invalid");
    const path = parsed.pathname;
    if (path.includes("/admin") || path.includes("/workspace") || path.includes("/draft")) {
      return false;
    }
    if (payload.contentType === "initiative") {
      return path.includes("/initiatives/public/");
    }
    if (payload.contentType === "petition") {
      return (
        path.includes("/initiatives/public/") ||
        path.includes("/petitions/public/") ||
        path.includes("/petitions/")
      );
    }
    return false;
  } catch {
    return false;
  }
}
