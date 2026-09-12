/**
 * RESET 05 — public Participant profile PLP adapter.
 * Only visibility-eligible public/members_only profiles; never contact/security/private data.
 *
 * Production: loads live MemberProfile from Mongo.
 * Tests may still seed an in-memory override via seedParticipantPublicPlpForTests.
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

import { findMemberProfileByProfileId } from "../../../../member-profile/member-profile.repository.js";
import type { PlpDomainAdapter } from "../domain-adapter-registry.js";

export const PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE = "participant_public" as const;

const POLICY: PlpFieldPolicyMap = {
  profileId: "PROTECTED_CANONICAL",
  displayName: "PROTECTED_CANONICAL",
  // Organization is an identity/proper-name field (parallel to displayName /
  // NON_TRANSLATABLE organizationName). Leaving it MACHINE_CONTENT rejects
  // correct identical provider returns as CONTENT_INTEGRITY_FAILURE.
  biography: "MACHINE_CONTENT",
  organization: "PROTECTED_CANONICAL",
  skills: "MACHINE_CONTENT",
};

type TestSeedRow = {
  displayName: string;
  biography: string;
  organization: string;
  skills: readonly string[];
  visibility: "public" | "members_only" | "hidden";
  revision: number;
};

const testStore = new Map<string, TestSeedRow>();

export function resetParticipantPublicPlpStoreForTests(): void {
  testStore.clear();
}

export function seedParticipantPublicPlpForTests(input: {
  readonly profileId: string;
  readonly displayName: string;
  readonly biography: string;
  readonly organization?: string;
  readonly skills?: readonly string[];
  readonly visibility?: "public" | "members_only" | "hidden";
}): void {
  testStore.set(input.profileId, {
    displayName: input.displayName,
    biography: input.biography,
    organization: input.organization ?? "",
    skills: input.skills ?? [],
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

function isProfileVisibilityEligible(
  visibility: string | undefined,
): visibility is "public" | "members_only" {
  return visibility === "public" || visibility === "members_only";
}

function buildPresentation(input: {
  readonly profileId: string;
  readonly displayName: string;
  readonly biography: string;
  readonly organization: string;
  readonly skills: readonly string[];
}): PublicPresentationNode {
  return {
    profileId: protectedTechnical(input.profileId),
    displayName: protectedIdentity(input.displayName),
    biography: input.biography,
    organization: protectedIdentity(input.organization),
    skills: [...input.skills],
  };
}

export function buildParticipantPublicCanonicalPresentation(input: {
  readonly profileId: string;
  readonly displayName: string;
  readonly biography?: string;
  readonly organization?: string;
  readonly skills?: readonly string[];
}): {
  readonly presentation: PublicPresentationNode;
  readonly canonicalVersion: string;
} {
  const presentation = buildPresentation({
    profileId: input.profileId,
    displayName: input.displayName,
    biography: input.biography ?? "",
    organization: input.organization ?? "",
    skills: input.skills ?? [],
  });
  return {
    presentation,
    canonicalVersion: fingerprint(presentation),
  };
}

export const participantPublicPlpDomainAdapter: PlpDomainAdapter = {
  adapterId: "participant_public",
  supportedEntityTypes: [PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE],
  usesConsumerIdentityAuthority: false,
  fingerprintCanonicalVersion: fingerprint,
  fieldPolicyFor: () => POLICY,
  async resolveCanonicalEntity(input): Promise<PlpLocalizableEntityContract | null> {
    const seeded = testStore.get(input.entityId);
    if (seeded) {
      if (seeded.visibility === "hidden") {
        return null;
      }
      const presentation = buildPresentation({
        profileId: input.entityId,
        displayName: seeded.displayName,
        biography: seeded.biography,
        organization: seeded.organization,
        skills: seeded.skills,
      });
      return {
        entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
        entityId: input.entityId,
        canonicalVersion: fingerprint(presentation),
        localizationSchemaVersion: PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
        canonicalPresentation: presentation,
        fieldPolicy: POLICY,
        targetLocale: input.locale,
        contentRevision: seeded.revision,
      };
    }

    const profile = await findMemberProfileByProfileId(input.entityId);
    if (!profile || profile.status === "suspended") {
      return null;
    }
    if (!isProfileVisibilityEligible(profile.profileVisibility)) {
      return null;
    }

    const presentation = buildPresentation({
      profileId: profile.profileId,
      displayName: profile.displayName,
      biography: profile.biography ?? "",
      organization: profile.organization ?? "",
      skills: profile.skills ?? [],
    });

    return {
      entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
      entityId: profile.profileId,
      canonicalVersion: fingerprint(presentation),
      localizationSchemaVersion: PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
      canonicalPresentation: presentation,
      fieldPolicy: POLICY,
      targetLocale: input.locale,
      contentRevision: 1,
    };
  },
};
