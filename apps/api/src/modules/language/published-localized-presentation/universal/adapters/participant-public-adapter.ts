/**
 * RESET 05 — public Participant profile PLP adapter.
 * Only visibility-eligible public/members_only profiles; never contact/security/private data.
 *
 * STEP 15D.14.B.2 — canonicalVersion fingerprints only MACHINE_CONTENT that
 * affects localized presentation (biography + public skills). Protected
 * identity (displayName / organization) is presentation-copied, not translated,
 * and must not STALE PLP when only those fields change.
 *
 * Private skills (skillsVisibility !== public) are PRIVATE_SOURCE_ONLY —
 * excluded from MACHINE_CONTENT, provider payload, and completeness.
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
  skillsVisibility: "public" | "members_only" | "private";
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
  readonly skillsVisibility?: "public" | "members_only" | "private";
  readonly visibility?: "public" | "members_only" | "hidden";
}): void {
  testStore.set(input.profileId, {
    displayName: input.displayName,
    biography: input.biography,
    organization: input.organization ?? "",
    skills: input.skills ?? [],
    skillsVisibility: input.skillsVisibility ?? "public",
    visibility: input.visibility ?? "public",
    revision: 1,
  });
}

/**
 * Fingerprint only localization-affecting MACHINE_CONTENT (Option A).
 * Private skills omitted — must never enter provider or completeness.
 */
export function buildParticipantPublicMachineContentFingerprintInput(input: {
  readonly biography?: string | null;
  readonly skills?: readonly string[] | null;
  readonly skillsVisibility?: string | null;
}): {
  readonly biography: string;
  readonly skills: readonly string[];
} {
  const biography = typeof input.biography === "string" ? input.biography : "";
  const skillsPublic = input.skillsVisibility === "public";
  const skills =
    skillsPublic && Array.isArray(input.skills)
      ? input.skills.filter((s) => typeof s === "string" && s.trim().length > 0)
      : [];
  return { biography, skills };
}

function fingerprintMachineContent(input: {
  readonly biography: string;
  readonly skills: readonly string[];
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        biography: input.biography,
        skills: input.skills,
      }),
    )
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
  readonly skillsVisibility?: string;
}): {
  readonly presentation: PublicPresentationNode;
  readonly canonicalVersion: string;
} {
  const machine = buildParticipantPublicMachineContentFingerprintInput({
    biography: input.biography,
    skills: input.skills,
    skillsVisibility: input.skillsVisibility ?? "public",
  });
  const presentation = buildPresentation({
    profileId: input.profileId,
    displayName: input.displayName,
    biography: machine.biography,
    organization: input.organization ?? "",
    skills: machine.skills,
  });
  return {
    presentation,
    canonicalVersion: fingerprintMachineContent(machine),
  };
}

export const participantPublicPlpDomainAdapter: PlpDomainAdapter = {
  adapterId: "participant_public",
  supportedEntityTypes: [PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE],
  usesConsumerIdentityAuthority: false,
  fingerprintCanonicalVersion: (presentation) => {
    // Adapter registry still calls this with full presentation; derive machine
    // subset so identity edits do not invent a divergent fingerprint.
    const biography =
      presentation &&
      typeof presentation === "object" &&
      !Array.isArray(presentation) &&
      typeof (presentation as Record<string, unknown>).biography === "string"
        ? String((presentation as Record<string, unknown>).biography)
        : "";
    const skillsRaw =
      presentation &&
      typeof presentation === "object" &&
      !Array.isArray(presentation) &&
      Array.isArray((presentation as Record<string, unknown>).skills)
        ? ((presentation as Record<string, unknown>).skills as unknown[])
        : [];
    const skills = skillsRaw.filter(
      (entry): entry is string => typeof entry === "string",
    );
    return fingerprintMachineContent({ biography, skills });
  },
  fieldPolicyFor: () => POLICY,
  async resolveCanonicalEntity(input): Promise<PlpLocalizableEntityContract | null> {
    const seeded = testStore.get(input.entityId);
    if (seeded) {
      if (seeded.visibility === "hidden") {
        return null;
      }
      const built = buildParticipantPublicCanonicalPresentation({
        profileId: input.entityId,
        displayName: seeded.displayName,
        biography: seeded.biography,
        organization: seeded.organization,
        skills: seeded.skills,
        skillsVisibility: seeded.skillsVisibility,
      });
      return {
        entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
        entityId: input.entityId,
        canonicalVersion: built.canonicalVersion,
        localizationSchemaVersion: PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
        canonicalPresentation: built.presentation,
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

    const built = buildParticipantPublicCanonicalPresentation({
      profileId: profile.profileId,
      displayName: profile.displayName,
      biography: profile.biography,
      organization: profile.organization,
      skills: profile.skills,
      skillsVisibility: profile.skillsVisibility,
    });

    return {
      entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
      entityId: profile.profileId,
      canonicalVersion: built.canonicalVersion,
      localizationSchemaVersion: PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
      canonicalPresentation: built.presentation,
      fieldPolicy: POLICY,
      targetLocale: input.locale,
      contentRevision: 1,
    };
  },
};
