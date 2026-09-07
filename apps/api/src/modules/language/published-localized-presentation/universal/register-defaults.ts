/**
 * RESET 04 — lazy registration of default adapters (Media first).
 */

import { isMediaPlpEntityConsumptionEnabled } from "../media/feature-flag.js";
import { registerPlpConsumptionChecker } from "../feature-boundary.js";
import { registerPlpDomainAdapter, getPlpDomainAdapter } from "./domain-adapter-registry.js";
import { mediaPlpDomainAdapter } from "./adapters/media-plp-adapter.js";

let mediaRegistered = false;
let mediaCheckerRegistered = false;

export function ensureMediaPlpAdapterRegistered(): void {
  if (!mediaCheckerRegistered) {
    registerPlpConsumptionChecker(isMediaPlpEntityConsumptionEnabled);
    mediaCheckerRegistered = true;
  }
  if (mediaRegistered) {
    return;
  }
  if (!getPlpDomainAdapter(mediaPlpDomainAdapter.supportedEntityTypes[0]!)) {
    try {
      registerPlpDomainAdapter(mediaPlpDomainAdapter);
    } catch {
      // Already registered in this process.
    }
  }
  mediaRegistered = true;
}

export function resetMediaPlpAdapterRegistrationForTests(): void {
  mediaRegistered = false;
  mediaCheckerRegistered = false;
}
