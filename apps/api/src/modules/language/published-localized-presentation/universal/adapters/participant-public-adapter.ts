/**
 * RESET 05 / STEP 15D.14.B.2.1 — public Participant profile PLP adapter.
 *
 * Product contract: Participant-authored biography and free-text skills are
 * SOURCE_ORIGINAL. They may be written in any language the Participant chooses.
 * They are NOT mandatory machine-localized platform content.
 *
 * participant_public therefore has no MACHINE_CONTENT translation obligation.
 * Historical PLP rows may remain stored but are not authoritative for these
 * fields and must not override canonical authored presentation.
 *
 * Private skills remain PRIVATE_SOURCE_ONLY (never provider input).
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

/**
 * No MACHINE_CONTENT paths — translation obligation retired for this owner.
 * Identity stays PROTECTED_CANONICAL; biography/skills are SOURCE_ORIGINAL.
 */
const POLICY: PlpFieldPolicyMap = {
  profileId: "PROTECTED_CANONICAL",
  displayName: "PROTECTED_CANONICAL",
  biography: "SOURCE_ORIGINAL",
  organization: "PROTECTED_CANONICAL",
  skills: "SOURCE_ORIGINAL",
};

/** Stable schema marker — no machine localization inputs for this owner. */
export const PARTICIPANT_PUBLIC_SOURCE_ORIGINAL_VERSION =
  "participant_public:source_original:v1" as const;

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
 * Public presentation skills only — private skills never enter presentation
 * or any provider path (privacy invariant).
 */
export function resolveParticipantPublicPresentationSkills(input: {
  readonly skills?: readonly string[] | null;
  readonly skillsVisibility?: string | null;
}): readonly string[] {
  if (input.skillsVisibility !== "public") {
    return [];
  }
  if (!Array.isArray(input.skills)) {
    return [];
  }
  return input.skills.filter(
    (entry) => typeof entry === "string" && entry.trim().length > 0,
  );
}

/**
 * @deprecated B.2.1 — no MACHINE_CONTENT remains. Kept for test compatibility;
 * always returns empty machine inputs.
 */
export function buildParticipantPublicMachineContentFingerprintInput(_input: {
  readonly biography?: string | null;
  readonly skills?: readonly string[] | null;
  readonly skillsVisibility?: string | null;
}): {
  readonly biography: string;
  readonly skills: readonly string[];
} {
  return { biography: "", skills: [] };
}

function fingerprintSourceOriginalOwner(profileId: string): string {
  return createHash("sha256")
    .update(PARTICIPANT_PUBLIC_SOURCE_ORIGINAL_VERSION)
    .update(profileId)
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
  const skills = resolveParticipantPublicPresentationSkills({
    skills: input.skills,
    skillsVisibility: input.skillsVisibility ?? "public",
  });
  const presentation = buildPresentation({
    profileId: input.profileId,
    displayName: input.displayName,
    biography: typeof input.biography === "string" ? input.biography : "",
    organization: input.organization ?? "",
    skills,
  });
  return {
    presentation,
    // Version does not track prose — source-original fields are not localization inputs.
    canonicalVersion: fingerprintSourceOriginalOwner(input.profileId),
  };
}

/** True when this owner has no machine-localization obligation. */
export function participantPublicHasMachineLocalizationObligation(): boolean {
  return Object.values(POLICY).some((ownership) => ownership === "MACHINE_CONTENT");
}

export const participantPublicPlpDomainAdapter: PlpDomainAdapter = {
  adapterId: "participant_public",
  supportedEntityTypes: [PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE],
  usesConsumerIdentityAuthority: false,
  fingerprintCanonicalVersion: (presentation) => {
    const profileId =
      presentation &&
      typeof presentation === "object" &&
      !Array.isArray(presentation) &&
      (presentation as Record<string, unknown>).profileId != null
        ? String(
            typeof (presentation as Record<string, unknown>).profileId === "object" &&
              (presentation as Record<string, unknown>).profileId !== null &&
              "value" in
                ((presentation as Record<string, unknown>).profileId as object)
              ? (
                  (presentation as Record<string, unknown>).profileId as {
                    value: unknown;
                  }
                ).value
              : (presentation as Record<string, unknown>).profileId,
          )
        : "unknown";
    return fingerprintSourceOriginalOwner(profileId);
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
