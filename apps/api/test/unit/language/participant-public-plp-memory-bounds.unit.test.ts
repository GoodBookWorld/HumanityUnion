/**
 * Memory-bounded participant_public materializer — single-profile / single-locale.
 * Proves discovery + heavy import graph are not used in identity mode.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { MemberProfile } from "@hu/types";

import {
  resetPublishedLocalizationPersistenceForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/persistence/repository.js";
import { runParticipantPublicPlpMaterialize } from "../../../src/modules/language/published-localized-presentation/universal/participant-public-plp-operator.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../../..");

function read(relative: string): string {
  return readFileSync(path.join(apiRoot, relative), "utf8");
}

function sampleProfile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    profileId: "profile-bounded-1",
    userId: "user-1",
    memberNumber: "HU-TEST",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    displayName: "Vlad",
    publicName: "vlad-shapran",
    biography: "English biography.",
    organization: "Humanity Union",
    skills: ["Skill A"],
    profileVisibility: "public",
    showOrganization: true,
    showLocation: true,
    showParticipationArea: true,
    membershipPubliclyVisible: false,
    skillsVisibility: "public",
    professionalLinksVisibility: "public",
    showInitiativesStatistics: true,
    showCollectiveDecisionsStatistics: true,
    showAlliesStatistics: true,
    showProposalsStatistics: true,
    showPetitionsStatistics: true,
    showCommitmentsStatistics: true,
    messagingPolicy: "active_allies",
    status: "active",
    ...overrides,
  };
}

describe("materialize:participant-public-plp memory bounds", () => {
  before(() => {
    resetPublishedLocalizationPersistenceForTests();
    setPublishedLocalizationPersistenceModeForTests("memory");
  });
  after(() => {
    resetPublishedLocalizationPersistenceForTests();
  });

  it("single-profile mode loads only that profile + requested locale; no list discovery", async () => {
    let listCalls = 0;
    let loadByIdCalls = 0;
    let loadByNameCalls = 0;
    const localeResolveArgs: Array<string | null> = [];
    let providerCalls = 0;
    let publishCalls = 0;

    const result = await runParticipantPublicPlpMaterialize(
      [
        "--mongo",
        "--public-name",
        "vlad-shapran",
        "--locale",
        "uk",
        "--execute",
      ],
      {
        skipPersistenceRequire: true,
        skipProductionRefusal: true,
        skipExecuteGuards: true,
        isMongoConfigured: () => true,
        connect: async () => undefined,
        disconnect: async () => undefined,
        listEligibleProfiles: async () => {
          listCalls += 1;
          return [];
        },
        loadProfileById: async () => {
          loadByIdCalls += 1;
          return null;
        },
        loadProfileByPublicName: async (name) => {
          loadByNameCalls += 1;
          assert.equal(name, "vlad-shapran");
          return sampleProfile();
        },
        resolveLocales: async (filter) => {
          localeResolveArgs.push(filter);
          assert.equal(filter, "uk");
          return filter ? [filter] : ["uk", "ar"];
        },
        runProvider: async (input) => {
          providerCalls += 1;
          assert.equal(input.locale, "uk");
          assert.equal("organization" in input.autoValues, false);
          assert.ok("biography" in input.autoValues);
          const values: Record<string, string> = {};
          for (const [pathKey, value] of Object.entries(input.autoValues)) {
            values[pathKey] = `[uk] ${value}`;
          }
          return { ok: true, values };
        },
        publishBuild: async () => {
          publishCalls += 1;
          return {
            status: "COMPLETED",
            reasonCodes: [],
            snapshotId: "snap-1",
          };
        },
      },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(listCalls, 0);
    assert.equal(loadByIdCalls, 0);
    assert.equal(loadByNameCalls, 1);
    assert.deepEqual(localeResolveArgs, ["uk"]);
    assert.equal(providerCalls, 1);
    assert.equal(publishCalls, 1);
    assert.equal(result.report?.profiles.length, 1);
    assert.equal(result.report?.profiles[0]?.publicName, "vlad-shapran");
    assert.equal(result.report?.profiles[0]?.locales.length, 1);
    assert.equal(result.report?.profiles[0]?.locales[0]?.locale, "uk");
    assert.equal(result.report?.profiles[0]?.locales[0]?.ACTION, "BUILT");
  });

  it("operator source avoids heavy PLP/CT/global-search import graph", () => {
    const operator = read(
      "src/modules/language/published-localized-presentation/universal/participant-public-plp-operator.ts",
    );
    assert.doesNotMatch(operator, /from ["'].*process-plp-build-request/);
    assert.doesNotMatch(operator, /ensureAllDefaultPlpAdaptersRegistered/);
    assert.doesNotMatch(operator, /resolvePlpAutoBuildLocales/);
    assert.doesNotMatch(operator, /public-source-mutation-bridge/);
    assert.doesNotMatch(operator, /language-registry\/index/);
    assert.doesNotMatch(operator, /language-registry\.service/);
    assert.doesNotMatch(operator, /global-search/);
    assert.doesNotMatch(operator, /from ["'].*build-request-queue/);
    assert.match(operator, /runUniversalPlpBuild/);
    assert.match(operator, /listParticipantPublicPlpRegistryLocales/);
    assert.match(operator, /PROFILE_PROJECTION/);
    assert.match(operator, /registerPlpDomainAdapter\(participantPublicPlpDomainAdapter\)/);

    const pipeline = read(
      "src/modules/language/published-localized-presentation/universal/build-pipeline.ts",
    );
    assert.match(pipeline, /build-request-stale/);
    assert.doesNotMatch(pipeline, /from ["'].*build-request-queue/);
  });
});
