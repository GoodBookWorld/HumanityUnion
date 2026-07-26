import type { Request } from "express";

import { isAuthBootstrapFallbackEnabled } from "../../../config/auth.config.js";
import { AuthenticationRequiredError } from "../../auth/auth.errors.js";
import {
  requestIdentityFromAuth,
  resolveBootstrapRequestIdentity,
} from "./bootstrap-request-identity.js";
import type { RequestIdentity } from "./request-identity.types.js";

/**
 * Resolves the current request participant for Initiative lifecycle operations.
 * Uses req.auth when middleware is present; falls back to bootstrap dev identity when enabled.
 */
export async function resolveRequestIdentity(req?: Request): Promise<RequestIdentity> {
  if (req?.auth?.memberId) {
    return await requestIdentityFromAuth(req.auth);
  }

  if (isAuthBootstrapFallbackEnabled()) {
    return await resolveBootstrapRequestIdentity();
  }

  throw new AuthenticationRequiredError();
}
