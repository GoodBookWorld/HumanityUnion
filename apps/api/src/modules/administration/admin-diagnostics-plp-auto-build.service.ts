/**
 * RESET 05C.1 — Admin diagnostics for PLP auto-build (authenticated Admin only).
 * No secrets, article bodies, env values, or Mongo URI.
 */

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { getPlpAutoBuildRuntimeSnapshot } from "../language/published-localized-presentation/universal/plp-auto-build-runtime.js";

async function assertAdminActor(userId: string): Promise<void> {
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  const user = await findAuthUserById(userId);
  if (!user || user.status !== "active" || user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
}

export async function getAdminDiagnosticsPlpAutoBuild(input: {
  actorUserId: string;
}): Promise<Awaited<ReturnType<typeof getPlpAutoBuildRuntimeSnapshot>>> {
  await assertAdminActor(input.actorUserId);
  return getPlpAutoBuildRuntimeSnapshot();
}
