import type { MembershipStatus } from "@hu/types";

export function formatMemberSince(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function isActiveMembershipStatus(status: MembershipStatus): boolean {
  return status === "active_member";
}
