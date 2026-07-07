import type { OfficialResponseIdentity } from "@hu/types";

import { getCapById } from "../civic-action-package/civic-action-package.store.js";
import { getResponseIdentityForCap, saveResponseIdentity } from "./official-response.store.js";

export function buildReplyIdentifier(capId: string): string {
  const capPackage = getCapById(capId);

  if (!capPackage) {
    throw new Error("Civic Action Package not found.");
  }

  const year = new Date(capPackage.issuedAt).getFullYear();

  return `CAP-${year}-${String(capPackage.capNumber).padStart(6, "0")}`;
}

/** Future mailbox alias architecture: reply+CAP-2029-001245@... */
export function ensureOfficialResponseIdentity(capId: string): OfficialResponseIdentity {
  const existing = getResponseIdentityForCap(capId);

  if (existing) {
    return existing;
  }

  const identity: OfficialResponseIdentity = {
    capId,
    replyIdentifier: buildReplyIdentifier(capId),
    createdAt: new Date().toISOString(),
  };

  return saveResponseIdentity(identity);
}

export function getOfficialResponseIdentity(capId: string): OfficialResponseIdentity | null {
  return getResponseIdentityForCap(capId);
}
