/**
 * `/me/public-preview` localization contract for `/profile` owner-preview.
 *
 * Authenticated non-owner privacy projection + participant_public CURRENT.
 * No anonymous by-name route required (members_only would 403 that path).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { MemberProfile } from "@hu/types";

import {
  resetPublishedLocalizationPersistenceForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/persistence/repository.js";
import { applyParticipantPublicPlpToProjection } from "../../../src/modules/language/published-localized-presentation/universal/adapters/apply-participant-public-plp.js";
import {
  PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
  participantPublicPlpDomainAdapter,
  resetParticipantPublicPlpStoreForTests,
  seedParticipantPublicPlpForTests,
} from "../../../src/modules/language/published-localized-presentation/universal/adapters/participant-public-adapter.js";
import {
  getPlpDomainAdapter,
  registerPlpDomainAdapter,
} from "../../../src/modules/language/published-localized-presentation/universal/domain-adapter-registry.js";
import {
  resolvePublicMemberProfileHiddenSections,
  toPublicMemberProfile,
} from "../../../src/modules/member-profile/member-profile.projection.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../../..");

function read(relative: string): string {
  return readFileSync(path.join(apiRoot, relative), "utf8");
}

const PROFILE_ID = "owner-preview-plp-members-only-01";
const FUTURE_LOCALE = "xx-Future";

function sampleMembersOnlyProfile(): MemberProfile {
  return {
    profileId: PROFILE_ID,
    userId: "user-owner-preview-1",
    memberNumber: "HU-TEST",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    displayName: "Owner Preview Participant",
    publicName: "owner-preview-participant",
    biography: "Canonical English biography.",
    organization: "Hidden Org When Privacy Off",
    skills: ["Skill Alpha", "Skill Beta"],
    profileVisibility: "members_only",
    showOrganization: false,
    showLocation: true,
    showParticipationArea: true,
    membershipPubliclyVisible: false,
    skillsVisibility: "members_only",
    professionalLinksVisibility: "public",
    showInitiativesStatistics: true,
    showCollectiveDecisionsStatistics: true,
    showAlliesStatistics: true,
    showProposalsStatistics: true,
    showPetitionsStatistics: true,
    showCommitmentsStatistics: true,
    messagingPolicy: "active_allies",
    status: "active",
  };
}

/**
 * Same viewer identity `getMyPublicMemberProfilePreview` forces:
 * authenticated Participant who is not the owner.
 */
async function runOwnerPublicPreviewPipeline(input: {
  readonly profile: MemberProfile;
  readonly locale: string | null;
}) {
  const projection = toPublicMemberProfile(input.profile, {
    viewerIsAuthenticated: true,
    viewerIsOwner: false,
    membership: null,
  });
  assert.ok(projection, "members_only + authenticated viewer must project");

  const localized = await applyParticipantPublicPlpToProjection({
    projection,
    locale: input.locale,
  });

  return {
    profile: localized,
    hiddenSections: resolvePublicMemberProfileHiddenSections(input.profile, localized),
  };
}

describe("/me/public-preview owner-preview PLP localization", () => {
  before(() => {
    setPublishedLocalizationPersistenceModeForTests("memory");
    if (!getPlpDomainAdapter(PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE)) {
      registerPlpDomainAdapter(participantPublicPlpDomainAdapter);
    }
  });

  beforeEach(() => {
    resetPublishedLocalizationPersistenceForTests();
    setPublishedLocalizationPersistenceModeForTests("memory");
    resetParticipantPublicPlpStoreForTests();
  });

  after(() => {
    resetPublishedLocalizationPersistenceForTests();
    resetParticipantPublicPlpStoreForTests();
  });

  it("wires public-preview locale → PLP; OwnerProfilePreview needs no anonymous route", () => {
    const routes = read("src/modules/member-profile/member-profile.routes.ts");
    const service = read("src/modules/member-profile/member-profile.service.ts");

    assert.match(routes, /\/me\/public-preview/);
    assert.match(routes, /resolveRequestPresentationLocale/);
    assert.match(routes, /getMyPublicMemberProfilePreview\(userId,\s*\{\s*locale\s*\}\)/);
    assert.match(routes, /X-HU-Presentation-Locale|x-hu-presentation-locale/);
    assert.match(service, /locale:\s*options\?\.locale/);
    assert.match(service, /applyParticipantPublicPlpToProjection/);
    assert.match(service, /viewerIsAuthenticated:\s*true/);
    assert.match(service, /viewerUserId:\s*undefined/);
    assert.doesNotMatch(service, /locale\s*===\s*["'](?:uk|ar|zh-Hant)["']/);
  });

  it("members_only + any locale: SOURCE_ORIGINAL Biography/Skills; privacy still hides organization", async () => {
    const profile = sampleMembersOnlyProfile();

    seedParticipantPublicPlpForTests({
      profileId: PROFILE_ID,
      displayName: profile.displayName,
      biography: profile.biography!,
      organization: profile.organization!,
      skills: profile.skills,
      visibility: "members_only",
    });

    const localized = await runOwnerPublicPreviewPipeline({
      profile,
      locale: FUTURE_LOCALE,
    });

    assert.equal(localized.profile.biography, "Canonical English biography.");
    assert.deepEqual(localized.profile.skills, ["Skill Alpha", "Skill Beta"]);
    // Privacy: showOrganization false + non-owner → organization omitted.
    assert.equal(localized.profile.organization, undefined);
    assert.equal(localized.hiddenSections.skills, false);

    const english = await runOwnerPublicPreviewPipeline({
      profile,
      locale: "en",
    });
    assert.equal(english.profile.biography, "Canonical English biography.");
    assert.deepEqual(english.profile.skills, ["Skill Alpha", "Skill Beta"]);
    assert.equal(english.profile.organization, undefined);
  });
});
