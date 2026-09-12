/**
 * Regression: CURRENT participant_public usable for materializer fingerprint,
 * but privacy-filtered PublicMemberProfile fingerprint must not block `/profile`
 * overlay (Biography/Skills stay English).
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
} from "../../../src/modules/language/published-localized-presentation/universal/adapters/participant-public-adapter.js";
import {
  getPlpDomainAdapter,
  registerPlpDomainAdapter,
} from "../../../src/modules/language/published-localized-presentation/universal/domain-adapter-registry.js";
import { participantPublicPlpDomainAdapter } from "../../../src/modules/language/published-localized-presentation/universal/adapters/participant-public-adapter.js";
import { mergeLocalizedLayersByProvenance } from "../../../src/modules/language/published-localized-presentation/validate-build-result.js";

const PROFILE_ID = "c7ef47df-1078-41c6-bf96-b545d1508dc9";

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

  it("applies CURRENT uk Biography/Skills when projection omits organization (privacy filter)", async () => {
    seedParticipantPublicPlpForTests({
      profileId: PROFILE_ID,
      displayName: "Vlad Shapran",
      biography: "English biography for localization.",
      organization: "Humanity Union",
      skills: ["Skill Alpha", "Skill Beta"],
      visibility: "public",
    });

    const full = buildParticipantPublicCanonicalPresentation({
      profileId: PROFILE_ID,
      displayName: "Vlad Shapran",
      biography: "English biography for localization.",
      organization: "Humanity Union",
      skills: ["Skill Alpha", "Skill Beta"],
    });

    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: full.presentation,
      fieldPolicy: participantPublicPlpDomainAdapter.fieldPolicyFor(
        PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
      ),
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
      fieldPolicy: participantPublicPlpDomainAdapter.fieldPolicyFor(
        PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
      ),
    });
    assert.equal(published.ok, true);

    // Privacy-filtered public projection: organization hidden, skills+bio present.
    // Old apply fingerprinted this incomplete tree → CANONICAL_VERSION_MISMATCH.
    const overlaid = await applyParticipantPublicPlpToProjection({
      locale: "uk",
      projection: {
        profileId: PROFILE_ID,
        publicName: "vlad-shapran",
        displayName: "Vlad Shapran",
        biography: "English biography for localization.",
        skills: ["Skill Alpha", "Skill Beta"],
        messagingAvailability: "hidden",
      },
    });

    assert.equal(overlaid.biography, "Українська біографія для локалізації.");
    assert.deepEqual(overlaid.skills, ["Навичка Альфа", "Навичка Бета"]);
    assert.equal(overlaid.organization, undefined);
  });
});
