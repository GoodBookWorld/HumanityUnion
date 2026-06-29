import type { AuthIdentity } from "@hu/types";

export const bootstrapAuthIdentity: AuthIdentity = {
  id: "auth-bootstrap-001",
  email: "bootstrap@humanityunion.local",
  provider: "email",
  status: "active",
  roles: ["member"],
  memberId: "member-bootstrap-001",
  createdAt: "2026-06-28T00:00:00.000Z",
  updatedAt: "2026-06-28T00:00:00.000Z",
};

export function getCurrentAuthIdentity(): AuthIdentity {
  return bootstrapAuthIdentity;
}
