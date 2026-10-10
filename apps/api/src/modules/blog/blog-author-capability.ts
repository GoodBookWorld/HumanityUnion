import type { BlogCapability, BlogCapabilityGrant } from "@hu/types";

import {
  findBlogCapabilityGrant,
  upsertBlogCapabilityGrant,
} from "./persistence/blog.repository.js";

/**
 * Ordinary Blog author capability for an existing Participant.
 * Stronger Blog capabilities and Trusted Publishing are preserved and never added.
 */
export interface BlogAuthorCapabilityEnsureResult {
  readonly changed: boolean;
  readonly capabilities: readonly BlogCapability[];
  readonly publishWithoutManualReview: boolean;
}

export interface BlogAuthorCapabilityStore {
  findGrant(participantId: string): Promise<BlogCapabilityGrant | null>;
  saveGrant(grant: BlogCapabilityGrant): Promise<BlogCapabilityGrant>;
}

const defaultStore: BlogAuthorCapabilityStore = {
  findGrant: findBlogCapabilityGrant,
  saveGrant: upsertBlogCapabilityGrant,
};

function satisfiesAuthorCapability(capabilities: readonly BlogCapability[]): boolean {
  return (
    capabilities.includes("author") ||
    capabilities.includes("trusted_author") ||
    capabilities.includes("editor") ||
    capabilities.includes("administrator")
  );
}

/**
 * Adds Blog `author` only when the Participant does not already satisfy it.
 * An existing stronger grant is returned unchanged.
 */
export function planBlogAuthorCapabilityEnsure(input: {
  readonly participantId: string;
  readonly existing: BlogCapabilityGrant | null;
  readonly nowIso: string;
}):
  | {
      readonly changed: false;
      readonly capabilities: readonly BlogCapability[];
      readonly publishWithoutManualReview: boolean;
    }
  | { readonly changed: true; readonly grant: BlogCapabilityGrant } {
  const existing = input.existing;

  if (existing && satisfiesAuthorCapability(existing.capabilities)) {
    return {
      changed: false,
      capabilities: existing.capabilities,
      publishWithoutManualReview: existing.publishWithoutManualReview === true,
    };
  }

  const capabilities = (existing?.capabilities ?? []).filter(
    (capability) => capability !== "author_applicant",
  );
  capabilities.push("author");

  const grant: BlogCapabilityGrant = {
    participantId: input.participantId,
    capabilities,
    updatedAt: input.nowIso,
    ...(existing?.grantedByParticipantId
      ? { grantedByParticipantId: existing.grantedByParticipantId }
      : {}),
    ...(existing?.administrativelyBlocked === true
      ? {
          administrativelyBlocked: existing.administrativelyBlocked,
          administrativeBlockAuthority: existing.administrativeBlockAuthority,
          administrativelyBlockedAt: existing.administrativelyBlockedAt,
          administrativelyBlockedByParticipantId: existing.administrativelyBlockedByParticipantId,
          administrativeBlockReason: existing.administrativeBlockReason,
        }
      : {}),
    ...(existing?.publishWithoutManualReview === true
      ? { publishWithoutManualReview: true }
      : {}),
  };

  return { changed: true, grant };
}

export async function ensureBlogAuthorCapability(
  participantId: string,
  store: BlogAuthorCapabilityStore = defaultStore,
  nowIso: string = new Date().toISOString(),
): Promise<BlogAuthorCapabilityEnsureResult> {
  const existing = await store.findGrant(participantId);
  const plan = planBlogAuthorCapabilityEnsure({ participantId, existing, nowIso });

  if (!plan.changed) {
    return {
      changed: false,
      capabilities: plan.capabilities,
      publishWithoutManualReview: plan.publishWithoutManualReview,
    };
  }

  const saved = await store.saveGrant(plan.grant);
  return {
    changed: true,
    capabilities: saved.capabilities,
    publishWithoutManualReview: saved.publishWithoutManualReview === true,
  };
}
