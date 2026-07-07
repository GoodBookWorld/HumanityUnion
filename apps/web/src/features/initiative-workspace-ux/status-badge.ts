export type WorkspaceBadgeVariant =
  | "draft"
  | "published"
  | "verified"
  | "completed"
  | "archived"
  | "withdrawn"
  | "pending"
  | "active"
  | "closed"
  | "cancelled"
  | "neutral";

export function formatWorkspaceStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export function resolveWorkspaceBadgeVariant(status: string): WorkspaceBadgeVariant {
  const normalized = status.toLowerCase();

  if (normalized.includes("draft")) {
    return "draft";
  }

  if (normalized.includes("published") || normalized.includes("projected")) {
    return "published";
  }

  if (normalized.includes("verified")) {
    return "verified";
  }

  if (normalized.includes("completed") || normalized.includes("complete")) {
    return "completed";
  }

  if (normalized.includes("archived")) {
    return "archived";
  }

  if (normalized.includes("withdrawn")) {
    return "withdrawn";
  }

  if (normalized.includes("pending")) {
    return "pending";
  }

  if (
    normalized.includes("active") ||
    normalized.includes("opened") ||
    normalized.includes("open")
  ) {
    return "active";
  }

  if (normalized.includes("closed")) {
    return "closed";
  }

  if (normalized.includes("cancel")) {
    return "cancelled";
  }

  return "neutral";
}
