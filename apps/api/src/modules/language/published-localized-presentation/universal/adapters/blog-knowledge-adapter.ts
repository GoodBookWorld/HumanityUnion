/**
 * RESET 05 — Blog/Knowledge/Publications PLP adapter (registered; build-ready).
 * Document bodies remain policy-gated; title/excerpt are MACHINE_CONTENT.
 */

import { createHash } from "node:crypto";

import type {
  PlpFieldPolicyMap,
  PlpLocalizableEntityContract,
  PublicPresentationNode,
} from "@hu/types";
import {
  PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
  controlledTerminologyValue,
  protectedTechnical,
} from "@hu/types";

import type { PlpDomainAdapter } from "../domain-adapter-registry.js";

export const BLOG_PLP_ENTITY_TYPE = "blog_post" as const;

const POLICY: PlpFieldPolicyMap = {
  postId: "PROTECTED_CANONICAL",
  title: "MACHINE_CONTENT",
  excerpt: "MACHINE_CONTENT",
  /** Body may be excluded from machine layers by eligibility — default protected. */
  content: "MANUAL_OR_AUTHOR_APPROVED",
  category: "CONTROLLED_VOCABULARY",
};

const store = new Map<
  string,
  { title: string; excerpt: string; content: string; category: string; revision: number }
>();

export function resetBlogPlpStoreForTests(): void {
  store.clear();
}

export function seedBlogPlpPostForTests(input: {
  readonly postId: string;
  readonly title: string;
  readonly excerpt: string;
  readonly content?: string;
  readonly category?: string;
}): void {
  store.set(input.postId, {
    title: input.title,
    excerpt: input.excerpt,
    content: input.content ?? "",
    category: input.category ?? "",
    revision: 1,
  });
}

function fingerprint(presentation: PublicPresentationNode): string {
  return createHash("sha256")
    .update(JSON.stringify(presentation))
    .digest("hex")
    .slice(0, 32);
}

export const blogKnowledgePlpDomainAdapter: PlpDomainAdapter = {
  adapterId: "blog_knowledge",
  supportedEntityTypes: [BLOG_PLP_ENTITY_TYPE],
  usesConsumerIdentityAuthority: false,
  fingerprintCanonicalVersion: fingerprint,
  fieldPolicyFor: () => POLICY,
  async resolveCanonicalEntity(input): Promise<PlpLocalizableEntityContract | null> {
    const row = store.get(input.entityId);
    if (!row) {
      return null;
    }
    const presentation: PublicPresentationNode = {
      postId: protectedTechnical(input.entityId),
      title: row.title,
      excerpt: row.excerpt,
      content: protectedTechnical(row.content),
      category: row.category
        ? controlledTerminologyValue(row.category)
        : protectedTechnical(""),
    };
    return {
      entityType: BLOG_PLP_ENTITY_TYPE,
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
