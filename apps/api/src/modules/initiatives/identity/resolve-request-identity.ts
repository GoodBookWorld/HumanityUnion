import type { Request } from "express";

import {
  requestIdentityFromAuth,
  resolveBootstrapRequestIdentity,
} from "./bootstrap-request-identity.js";
import type { RequestIdentity } from "./request-identity.types.js";

/**
 * Resolves the current request participant for Initiative lifecycle operations.
 * Uses req.auth when middleware is present; falls back to bootstrap dev identity.
 */
export function resolveRequestIdentity(req?: Request): RequestIdentity {
  if (req?.auth?.memberId) {
    return requestIdentityFromAuth(req.auth);
  }

  return resolveBootstrapRequestIdentity();
}
