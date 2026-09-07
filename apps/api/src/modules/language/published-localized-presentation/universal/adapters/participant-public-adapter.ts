/**
 * RESET 05 — public Participant profile PLP adapter.
 * Only visibility=public fields; never contact/security/private data.
 */

import { createHash } from "node:crypto";

import type {
  PlpFieldPolicyMap,
  PlpLocalizableEntityContract,
  PublicPresentationNode,
} from "@hu/types";
import {
  PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
  protectedIdentity,
  protectedTechnical,
} from "@hu/types";

import type { PlpDomainAdapter } from "../domain-adapter-registry.js";

export const PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE = "participant_public" as const;

const POLICY: PlpFieldPolicyMap = {
  profileId: "PROTECTED_CANONICAL",
  displayName: "PROTECTED_CANONICAL",
  biography: "MACHINE_CONTENT",
  organization: "MACHINE_CONTENT",
};

const store = new Map<
  string,
  {
    displayName: string;
    biography: string;
    organization: string;
    visibility: "public" | "members_only" | "hidden";
    revision: number;
  }
>();

export function resetParticipantPublicPlpStoreForTests(): void {
  store.clear();
}

export function seedParticipantPublicPlpForTests(input: {
  readonly profileId: string;
  readonly displayName: string;
  readonly biography: string;
  readonly organization?: string;
  readonly visibility?: "public" | "members_only" | "hidden";
}): void {
  store.set(input.profileId, {
    displayName: input.displayName,
    biography: input.biography,
    organization: input.organization ?? "",
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

export const participantPublicPlpDomainAdapter: PlpDomainAdapter = {
  adapterId: "participant_public",
  supportedEntityTypes: [PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE],
  usesConsumerIdentityAuthority: false,
  fingerprintCanonicalVersion: fingerprint,
  fieldPolicyFor: () => POLICY,
  async resolveCanonicalEntity(input): Promise<PlpLocalizableEntityContract | null> {
    const row = store.get(input.entityId);
    if (!row || row.visibility !== "public") {
      return null;
    }
    const presentation: PublicPresentationNode = {
      profileId: protectedTechnical(input.entityId),
      displayName: protectedIdentity(row.displayName),
      biography: row.biography,
      organization: row.organization,
    };
    return {
      entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
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
