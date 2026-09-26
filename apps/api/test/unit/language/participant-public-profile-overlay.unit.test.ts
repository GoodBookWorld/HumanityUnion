/**
 * Regression: CURRENT historical participant_public PLP must NOT override
 * SOURCE_ORIGINAL biography/skills (15D.14.B.2.1).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION } from "@hu/types";

import {
  resetPublishedLocalizationPersistenceForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/persistence/repository.js";
import { publishPublishedLocalizedPresentation } from "../../../src/modules/language/published-localized-presentation/publish-atomic.js";
import { applyParticipantPublicPlpToProjection } from "../../../src/modules/language/published-localized-presentation/universal/adapters/apply-participant-public-plp.js";
import {
  buildParticipantPublicCanonicalPresentation,
  PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
  resetParticipantPublicPlpStoreForTests,
  seedParticipantPublicPlpForTests,
  participantPublicPlpDomainAdapter,
} from "../../../src/modules/language/published-localized-presentation/universal/adapters/participant-public-adapter.js";
import {
  getPlpDomainAdapter,
  registerPlpDomainAdapter,
} from "../../../src/modules/language/published-localized-presentation/universal/domain-adapter-registry.js";
import { mergeLocalizedLayersByProvenance } from "../../../src/modules/language/published-localized-presentation/validate-build-result.js";

const PROFILE_ID = "c7ef47df-1078-41c6-bf96-b545d1508dc9";
const CANONICAL_BIO = "English biography for localization.";
const CANONICAL_SKILLS = ["Skill Alpha", "Skill Beta"] as const;

describe("participant_public /profile CURRENT overlay", () => {
  before(() => {
    resetPublishedLocalizationPersistenceForTests();
    setPublishedLocalizationPersistenceModeForTests("memory");
    resetParticipantPublicPlpStoreForTests();
    if (!getPlpDomainAdapter(PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE)) {
      registerPlpDomainAdapter(participantPublicPlpDomainAdapter);
    }
  });

  after(() => {
    resetPublishedLocalizationPersistenceForTests();
    resetParticipantPublicPlpStoreForTests();
  });

  it("keeps canonical Biography/Skills even when a historical CURRENT PLP exists", async () => {
    seedParticipantPublicPlpForTests({
      profileId: PROFILE_ID,
      displayName: "Vlad Shapran",
      biography: CANONICAL_BIO,
      organization: "Humanity Union",
      skills: [...CANONICAL_SKILLS],
      visibility: "public",
    });

    const full = buildParticipantPublicCanonicalPresentation({
      profileId: PROFILE_ID,
      displayName: "Vlad Shapran",
      biography: CANONICAL_BIO,
      organization: "Humanity Union",
      skills: [...CANONICAL_SKILLS],
      skillsVisibility: "public",
    });

    // Historical machine layer (may still exist in durable storage).
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: full.presentation,
      fieldPolicy: {
        profileId: "PROTECTED_CANONICAL",
        displayName: "PROTECTED_CANONICAL",
        biography: "MACHINE_CONTENT",
        organization: "PROTECTED_CANONICAL",
        skills: "MACHINE_CONTENT",
      },
      layers: [
        {
          source: "MACHINE",
          values: {
            biography: "Українська біографія для локалізації.",
            "skills[0]": "Навичка Альфа",
            "skills[1]": "Навичка Бета",
          },
        },
      ],
    });

    const published = await publishPublishedLocalizedPresentation({
      entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
      entityId: PROFILE_ID,
      locale: "uk",
      canonicalVersion: full.canonicalVersion,
      contentRevision: 1,
      localizationSchemaVersion: PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
      canonicalPresentation: full.presentation,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
      fieldPolicy: {
        profileId: "PROTECTED_CANONICAL",
        displayName: "PROTECTED_CANONICAL",
        biography: "MACHINE_CONTENT",
        organization: "PROTECTED_CANONICAL",
        skills: "MACHINE_CONTENT",
      },
    });
    assert.equal(published.ok, true);

    const overlaid = await applyParticipantPublicPlpToProjection({
      locale: "uk",
      projection: {
        profileId: PROFILE_ID,
        publicName: "vlad-shapran",
        displayName: "Vlad Shapran",
        biography: CANONICAL_BIO,
        skills: [...CANONICAL_SKILLS],
        messagingAvailability: "hidden",
      },
    });

    assert.equal(overlaid.biography, CANONICAL_BIO);
    assert.deepEqual(overlaid.skills, [...CANONICAL_SKILLS]);
    assert.equal(overlaid.organization, undefined);
  });
});
