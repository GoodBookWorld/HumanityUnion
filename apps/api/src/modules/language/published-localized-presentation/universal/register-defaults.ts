/**
 * RESET 04/05 — lazy registration of default domain adapters.
 */

import { INITIATIVE_PLP_ENTITY_TYPES } from "@hu/types";

import { isMediaPlpEntityConsumptionEnabled } from "../media/feature-flag.js";
import { registerPlpConsumptionChecker } from "../feature-boundary.js";
import {
  registerPlpDomainAdapter,
  getPlpDomainAdapter,
} from "./domain-adapter-registry.js";
import { mediaPlpDomainAdapter } from "./adapters/media-plp-adapter.js";
import { initiativeLifecyclePlpDomainAdapter } from "./adapters/initiative-lifecycle-adapter.js";
import { blogKnowledgePlpDomainAdapter } from "./adapters/blog-knowledge-adapter.js";
import { discussionPlpDomainAdapter } from "./adapters/discussion-adapter.js";
import { participantPublicPlpDomainAdapter } from "./adapters/participant-public-adapter.js";

let mediaRegistered = false;
let mediaCheckerRegistered = false;
let initiativeRegistered = false;
let initiativeCheckerRegistered = false;
let remainingRegistered = false;

function isInitiativePlpConsumptionEnabled(entityType: string): boolean {
  if (!(INITIATIVE_PLP_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return false;
  }
  if (process.env.HU_INITIATIVE_PLP_ENABLED === "true") {
    return true;
  }
  // Adapter is registered for build/contracts; HTTP/read gate stays opt-in.
  // Tests may force via HU_INITIATIVE_PLP_ENABLED.
  return false;
}

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
      // already registered
    }
  }
  mediaRegistered = true;
}

export function ensureInitiativeLifecyclePlpAdapterRegistered(): void {
  if (!initiativeCheckerRegistered) {
    registerPlpConsumptionChecker(isInitiativePlpConsumptionEnabled);
    initiativeCheckerRegistered = true;
  }
  if (initiativeRegistered) {
    return;
  }
  if (!getPlpDomainAdapter(initiativeLifecyclePlpDomainAdapter.supportedEntityTypes[0]!)) {
    try {
      registerPlpDomainAdapter(initiativeLifecyclePlpDomainAdapter);
    } catch {
      // already registered
    }
  }
  initiativeRegistered = true;
}

/** Register Blog / Discussion / Participant adapters (build contracts). */
export function ensureRemainingPublicPlpAdaptersRegistered(): void {
  ensureInitiativeLifecyclePlpAdapterRegistered();
  if (remainingRegistered) {
    return;
  }
  for (const adapter of [
    blogKnowledgePlpDomainAdapter,
    discussionPlpDomainAdapter,
    participantPublicPlpDomainAdapter,
  ]) {
    if (!getPlpDomainAdapter(adapter.supportedEntityTypes[0]!)) {
      try {
        registerPlpDomainAdapter(adapter);
      } catch {
        // already registered
      }
    }
  }
  remainingRegistered = true;
}

export function ensureAllDefaultPlpAdaptersRegistered(): void {
  ensureMediaPlpAdapterRegistered();
  ensureRemainingPublicPlpAdaptersRegistered();
}

export function resetMediaPlpAdapterRegistrationForTests(): void {
  mediaRegistered = false;
  mediaCheckerRegistered = false;
}

export function resetInitiativePlpAdapterRegistrationForTests(): void {
  initiativeRegistered = false;
  initiativeCheckerRegistered = false;
  remainingRegistered = false;
}
