/**
 * RESET 05 — Initiative/Lifecycle + remaining domain PLP migration acceptance.
 * No Gemini / live Mongo writes / materialize / deploy.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  INITIATIVE_CARD_FIELD_OWNERSHIP,
  INITIATIVE_PLP_ENTITY_TYPE,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
  evaluateInitiativeLifecycleSemanticClosure,
  type WorldInitiativeCardProjection,
} from "@hu/types";

import {
  buildCanonicalInitiativeCardPresentation,
  ensureAllDefaultPlpAdaptersRegistered,
  ensureInitiativeLifecyclePlpAdapterRegistered,
  fingerprintInitiativePlpCanonicalVersion,
  getPlpDomainAdapter,
  getPlpSearchSeoInvalidationStatsForTests,
  isPlpBuildStaleAgainstLive,
  listRegisteredPlpEntityTypes,
  mayOverwriteProvenance,
  resetInitiativePlpAdapterRegistrationForTests,
  resetInitiativePlpLiveStoreForTests,
  resetMediaPlpAdapterRegistrationForTests,
  resetPlpConsumptionCheckersForTests,
  resetPlpDomainAdapterRegistryForTests,
  resetPlpSearchSeoInvalidationForTests,
  resetPublishedLocalizationPersistenceForTests,
  runUniversalPlpBuild,
  seedInitiativePlpLiveCardForTests,
  setPublishedLocalizationPersistenceModeForTests,
  BLOG_PLP_ENTITY_TYPE,
  DISCUSSION_PLP_ENTITY_TYPE,
  PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
  seedBlogPlpPostForTests,
  seedDiscussionPlpCommentForTests,
  seedParticipantPublicPlpForTests,
  resetBlogPlpStoreForTests,
  resetDiscussionPlpStoreForTests,
  resetParticipantPublicPlpStoreForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function sampleCard(
  overrides: Partial<WorldInitiativeCardProjection> = {},
): WorldInitiativeCardProjection {
  return {
    initiativeId: "init-1",
    title: "Clean Water Initiative",
    summary: "Summary long enough for integrity checks in Ukrainian builds.",
    activityArea: "Public Health",
    geographyLabel: "Kyiv, Ukraine",
    countryCode: "UA",
    regionCode: "UA-30",
    publicInitiativeHref: "/initiatives/public/init-1",
    publishedAt: "2029-01-01T00:00:00.000Z",
    publicStatus: "Active",
    ...overrides,
  };
}

beforeEach(() => {
  resetPublishedLocalizationPersistenceForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  resetInitiativePlpAdapterRegistrationForTests();
  resetPlpConsumptionCheckersForTests();
  resetInitiativePlpLiveStoreForTests();
  resetBlogPlpStoreForTests();
  resetDiscussionPlpStoreForTests();
  resetParticipantPublicPlpStoreForTests();
  resetPlpSearchSeoInvalidationForTests();
});

afterEach(() => {
  resetPublishedLocalizationPersistenceForTests();
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  resetInitiativePlpAdapterRegistrationForTests();
  resetPlpConsumptionCheckersForTests();
  resetInitiativePlpLiveStoreForTests();
  resetPlpSearchSeoInvalidationForTests();
});

describe("RESET 05 — Initiative/Lifecycle + remaining domain migration", () => {
  it("1: Initiative/Lifecycle is a second production PLP adapter", () => {
    ensureInitiativeLifecyclePlpAdapterRegistered();
    const adapter = getPlpDomainAdapter(INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE);
    assert.ok(adapter);
    assert.equal(adapter!.adapterId, "initiative_lifecycle");
    assert.equal(adapter!.usesConsumerIdentityAuthority, true);
  });

  it("2: PLP core has no Initiative-specific branching", () => {
    const coreFiles = [
      "src/modules/language/published-localized-presentation/publish-atomic.ts",
      "src/modules/language/published-localized-presentation/resolve-published-presentation.ts",
      "src/modules/language/published-localized-presentation/validate-build-result.ts",
      "src/modules/language/published-localized-presentation/universal/domain-adapter-registry.ts",
      "src/modules/language/published-localized-presentation/universal/build-pipeline.ts",
    ];
    for (const rel of coreFiles) {
      const text = readFileSync(join(apiRoot, rel), "utf8");
      assert.doesNotMatch(text, /initiative_lifecycle|INITIATIVE_PLP|WorldInitiativeCard/);
    }
  });

  it("3: country-initiative-rail-card__meta ownership — activityArea controlled + geography codes", () => {
    assert.equal(
      INITIATIVE_CARD_FIELD_OWNERSHIP.activityArea,
      "CONTROLLED_VOCABULARY",
    );
    assert.equal(
      INITIATIVE_CARD_FIELD_OWNERSHIP.geographyLabel,
      "PROTECTED_CANONICAL",
    );
    assert.equal(INITIATIVE_CARD_FIELD_OWNERSHIP.title, "MACHINE_CONTENT");
    assert.equal(INITIATIVE_CARD_FIELD_OWNERSHIP.summary, "MACHINE_CONTENT");
    const projection = readFileSync(
      join(
        apiRoot,
        "src/modules/initiatives/initiative-world-initiatives.projection.ts",
      ),
      "utf8",
    );
    assert.match(projection, /countryCode:/);
    assert.match(projection, /regionCode:/);
  });

  it("5: canonical Initiative update makes prior snapshot stale", async () => {
    ensureInitiativeLifecyclePlpAdapterRegistered();
    const card = sampleCard();
    seedInitiativePlpLiveCardForTests(card);
    const tree = buildCanonicalInitiativeCardPresentation(card);
    const v1 = fingerprintInitiativePlpCanonicalVersion(tree);
    const updated = sampleCard({ title: "Clean Water Initiative Revised" });
    const tree2 = buildCanonicalInitiativeCardPresentation(updated);
    const v2 = fingerprintInitiativePlpCanonicalVersion(tree2);
    assert.notEqual(v1, v2);
    assert.equal(
      isPlpBuildStaleAgainstLive({
        buildTargetCanonicalVersion: v1,
        liveCanonicalVersion: v2,
      }),
      true,
    );
  });

  it("6: both lifecycle profiles share the same Initiative entity type", () => {
    ensureInitiativeLifecyclePlpAdapterRegistered();
    const adapter = getPlpDomainAdapter(INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE);
    assert.deepEqual(adapter!.supportedEntityTypes, [
      INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE,
    ]);
  });

  it("7: machine cannot overwrite manual on Initiative trees", () => {
    assert.equal(
      mayOverwriteProvenance({
        existing: "MANUAL_APPROVED",
        incoming: "MACHINE",
      }),
      false,
    );
  });

  it("8–10: Blog / Discussion / Participant adapters registered with privacy gates", async () => {
    ensureAllDefaultPlpAdaptersRegistered();
    const types = listRegisteredPlpEntityTypes();
    assert.ok(types.includes(BLOG_PLP_ENTITY_TYPE));
    assert.ok(types.includes(DISCUSSION_PLP_ENTITY_TYPE));
    assert.ok(types.includes(PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE));

    seedBlogPlpPostForTests({
      postId: "post-1",
      title: "Hello",
      excerpt: "Excerpt long enough for integrity.",
    });
    seedDiscussionPlpCommentForTests({
      commentId: "c-private",
      initiativeId: "init-1",
      body: "secret",
      visibility: "private",
    });
    seedParticipantPublicPlpForTests({
      profileId: "p-hidden",
      displayName: "Alex",
      biography: "Bio",
      visibility: "hidden",
    });

    const discussion = getPlpDomainAdapter(DISCUSSION_PLP_ENTITY_TYPE)!;
    const privateResolved = await discussion.resolveCanonicalEntity({
      entityType: DISCUSSION_PLP_ENTITY_TYPE,
      entityId: "c-private",
      locale: "uk",
    });
    assert.equal(privateResolved, null);

    const participant = getPlpDomainAdapter(PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE)!;
    const hidden = await participant.resolveCanonicalEntity({
      entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
      entityId: "p-hidden",
      locale: "uk",
    });
    assert.equal(hidden, null);
  });

  it("11: Initiative universal build publishes title/summary without provider", async () => {
    ensureInitiativeLifecyclePlpAdapterRegistered();
    const card = sampleCard();
    seedInitiativePlpLiveCardForTests(card);
    const contract =
      await initiativeLifecycleContract(card.initiativeId, "uk");
    assert.ok(contract);
    const built = await runUniversalPlpBuild({
      contract: contract!,
      liveCanonicalVersion: contract!.canonicalVersion,
      layers: [
        {
          source: "MACHINE",
          values: {
            title: "[uk] Clean Water Initiative",
            summary:
              "[uk] Summary long enough for integrity checks in Ukrainian builds.",
          },
        },
      ],
    });
    assert.equal(built.status, "COMPLETED");
  });

  it("7b: lifecycle semantic closure covers all required stages", () => {
    const closure = evaluateInitiativeLifecycleSemanticClosure();
    assert.equal(closure.ok, true, JSON.stringify(closure));
  });

  it("14: Initiative PLP publish notifies search/SEO invalidation hooks", async () => {
    ensureInitiativeLifecyclePlpAdapterRegistered();
    const card = sampleCard();
    seedInitiativePlpLiveCardForTests(card);
    const contract = await initiativeLifecycleContract(card.initiativeId, "uk");
    assert.ok(contract);
    resetPlpSearchSeoInvalidationForTests();
    const built = await runUniversalPlpBuild({
      contract: contract!,
      liveCanonicalVersion: contract!.canonicalVersion,
      layers: [
        {
          source: "MACHINE",
          values: {
            title: "[uk] Clean Water Initiative",
            summary:
              "[uk] Summary long enough for integrity checks in Ukrainian builds.",
          },
        },
      ],
    });
    assert.equal(built.status, "COMPLETED");
    const stats = getPlpSearchSeoInvalidationStatsForTests();
    assert.equal(stats.count, 1);
    assert.equal(stats.last?.entityType, INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE);
    assert.equal(stats.last?.entityId, card.initiativeId);
    assert.equal(stats.last?.locale, "uk");
  });

  it("15: schema remains PLP.2", () => {
    assert.equal(PUBLISHED_LOCALIZATION_SCHEMA_VERSION, "PLP.2");
  });
});

async function initiativeLifecycleContract(entityId: string, locale: string) {
  const adapter = getPlpDomainAdapter(INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE)!;
  return adapter.resolveCanonicalEntity({
    entityType: INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE,
    entityId,
    locale,
  });
}
