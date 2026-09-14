/**
 * RESET 05 — public Discussion PLP adapter.
 * Preserves Initiative ancestry; private/DM content never enters the tree.
 */

import { createHash } from "node:crypto";

import type {
  PlpFieldPolicyMap,
  PlpLocalizableEntityContract,
  PublicPresentationNode,
} from "@hu/types";
import {
  PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
  protectedTechnical,
} from "@hu/types";

import type { PlpDomainAdapter } from "../domain-adapter-registry.js";

export const DISCUSSION_PLP_ENTITY_TYPE = "discussion_comment" as const;

const POLICY: PlpFieldPolicyMap = {
  commentId: "PROTECTED_CANONICAL",
  initiativeId: "PROTECTED_CANONICAL",
  body: "MACHINE_CONTENT",
};

const store = new Map<
  string,
  {
    initiativeId: string;
    body: string;
    visibility: "public" | "private";
    revision: number;
  }
>();

export function resetDiscussionPlpStoreForTests(): void {
  store.clear();
}

export function seedDiscussionPlpCommentForTests(input: {
  readonly commentId: string;
  readonly initiativeId: string;
  readonly body: string;
  readonly visibility?: "public" | "private";
}): void {
  store.set(input.commentId, {
    initiativeId: input.initiativeId,
    body: input.body,
    visibility: input.visibility ?? "public",
    revision: 1,
  });
}

function fingerprint(presentation: PublicPresentationNode): string {
  return createHash("sha256")
    .update(JSON.stringify(presentation))
    .digest("hex")
    .slice(0, 32);
}

export const discussionPlpDomainAdapter: PlpDomainAdapter = {
  adapterId: "discussion",
  supportedEntityTypes: [DISCUSSION_PLP_ENTITY_TYPE],
  usesConsumerIdentityAuthority: false,
  fingerprintCanonicalVersion: fingerprint,
  fieldPolicyFor: () => POLICY,
  async resolveCanonicalEntity(input): Promise<PlpLocalizableEntityContract | null> {
    const row = store.get(input.entityId);
    if (!row || row.visibility !== "public") {
      return null;
    }
    const presentation: PublicPresentationNode = {
      commentId: protectedTechnical(input.entityId),
      initiativeId: protectedTechnical(row.initiativeId),
      body: row.body,
    };
    return {
      entityType: DISCUSSION_PLP_ENTITY_TYPE,
      entityId: input.entityId,
      canonicalVersion: fingerprint(presentation),
      localizationSchemaVersion: PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
      canonicalPresentation: presentation,
      fieldPolicy: POLICY,
      targetLocale: input.locale,
      contentRevision: row.revision,
    };
  },
};
