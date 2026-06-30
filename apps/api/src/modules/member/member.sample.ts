import type { Member } from "@hu/types";

export const sampleMember: Member = {
  id: "member-bootstrap-001",
  profile: {
    displayName: "Humanity Union Member",
    uniqueName: "humanity-member",
    country: "Canada",
    region: "British Columbia",
    city: "Nelson",
    languages: ["en"],
  },
  status: "active",
  verificationLevel: "email",
  roles: ["member"],
  fair: {
    personal: 0,
    community: 0,
    regional: 0,
    global: 0,
  },
  impactProfile: {
    scope: "community",
    priorityCategories: ["Local Community"],
    preferredTools: ["Proposals"],
    timeCommitment: "30 minutes per day",
  },
  createdAt: "2026-06-28T00:00:00.000Z",
  updatedAt: "2026-06-28T00:00:00.000Z",
};

export function getSampleMemberById(memberId: string): Member | null {
  if (memberId === "member-bootstrap-001") {
    return sampleMember;
  }

  return null;
}
