import type { AuthIdentity } from "@hu/types";

import { bootstrapAuthIdentity } from "../../auth/auth.identity.js";
import { getMemberById } from "../../member/member-access.js";
import type { RequestIdentity } from "./request-identity.types.js";

export async function resolveBootstrapRequestIdentity(): Promise<RequestIdentity> {
  const member = await getMemberById(bootstrapAuthIdentity.memberId);

  return {
    participantId: bootstrapAuthIdentity.memberId,
    displayName: member?.profile.displayName,
    role: bootstrapAuthIdentity.roles[0],
  };
}

export async function requestIdentityFromAuth(auth: AuthIdentity): Promise<RequestIdentity> {
  const member = await getMemberById(auth.memberId);

  return {
    participantId: auth.memberId,
    displayName: member?.profile.displayName,
    role: auth.roles[0],
  };
}
