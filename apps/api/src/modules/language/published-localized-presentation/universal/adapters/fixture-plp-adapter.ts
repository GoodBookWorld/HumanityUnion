/**
 * RESET 04 — non-production fixture adapter.
 * Proves a second domain can use the universal core without modifying core logic.
 */

import type {
  PlpFieldPolicyMap,
  PlpLocalizableEntityContract,
  PublicPresentationNode,
} from "@hu/types";
import {
  PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
  protectedTechnical,
} from "@hu/types";

import { createHash } from "node:crypto";

import type { PlpDomainAdapter } from "../domain-adapter-registry.js";

export const FIXTURE_PLP_ENTITY_TYPE = "fixture_plp_entity" as const;

const FIXTURE_POLICY: PlpFieldPolicyMap = {
  id: "PROTECTED_CANONICAL",
  title: "MACHINE_CONTENT",
  note: "MANUAL_OR_AUTHOR_APPROVED",
};

const fixtureStore = new Map<
  string,
  { title: string; note: string; revision: number }
>();

export function resetFixturePlpStoreForTests(): void {
  fixtureStore.clear();
}

export function seedFixturePlpEntityForTests(input: {
  readonly entityId: string;
  readonly title: string;
  readonly note?: string;
  readonly revision?: number;
}): void {
  fixtureStore.set(input.entityId, {
    title: input.title,
    note: input.note ?? "",
    revision: input.revision ?? 1,
  });
}

function buildTree(entityId: string, title: string, note: string): PublicPresentationNode {
  return {
    id: protectedTechnical(entityId),
    title,
    note,
  };
}

function fingerprint(presentation: PublicPresentationNode): string {
  return createHash("sha256")
    .update(JSON.stringify(presentation))
    .digest("hex")
    .slice(0, 32);
}

export const fixturePlpDomainAdapter: PlpDomainAdapter = {
  adapterId: "fixture_plp",
  supportedEntityTypes: [FIXTURE_PLP_ENTITY_TYPE],
  usesConsumerIdentityAuthority: false,
  fingerprintCanonicalVersion: fingerprint,
  fieldPolicyFor: () => FIXTURE_POLICY,
  async resolveCanonicalEntity(input): Promise<PlpLocalizableEntityContract | null> {
    const row = fixtureStore.get(input.entityId);
    if (!row) {
      return null;
    }
    const presentation = buildTree(input.entityId, row.title, row.note);
    return {
      entityType: FIXTURE_PLP_ENTITY_TYPE,
      entityId: input.entityId,
      canonicalVersion: fingerprint(presentation),
      localizationSchemaVersion: PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
      canonicalPresentation: presentation,
      fieldPolicy: FIXTURE_POLICY,
      targetLocale: input.locale,
      contentRevision: row.revision,
    };
  },
};
