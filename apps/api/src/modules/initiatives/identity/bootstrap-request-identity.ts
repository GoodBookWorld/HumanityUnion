import type { AuthIdentity } from "@hu/types";

import { bootstrapAuthIdentity } from "../../auth/auth.identity.js";
import { getMemberById } from "../../member/member.store.js";
import type { RequestIdentity } from "./request-identity.types.js";

export function resolveBootstrapRequestIdentity(): RequestIdentity {
  const member = getMemberById(bootstrapAuthIdentity.memberId);

  return {
    participantId: bootstrapAuthIdentity.memberId,
    displayName: member?.profile.displayName,
    role: bootstrapAuthIdentity.roles[0],
  };
}

export function requestIdentityFromAuth(auth: AuthIdentity): RequestIdentity {
  const member = getMemberById(auth.memberId);

  return {
    participantId: auth.memberId,
    displayName: member?.profile.displayName,
    role: auth.roles[0],
  };
}
