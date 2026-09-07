/**
 * RESET 05B — Initiative PLP thin diagnose/materialize operator acceptance.
 * No Gemini / live Mongo / staging execute.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  INITIATIVE_PLP_ENTITY_TYPE,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
  type WorldInitiativeCardProjection,
} from "@hu/types";

import {
  bindPublishedLocalizationMemoryPersistenceForTests,
  ensureInitiativeLifecyclePlpAdapterRegistered,
  isPlpBuildStaleAgainstLive,
  resetInitiativePlpAdapterRegistrationForTests,
  resetPlpDomainAdapterRegistryForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolvePublishedPresentation,
  runUniversalPlpBuild,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  assertInitiativeMachineNodesExcludeNonMachine,
  buildInitiativePlpCardFromThinDoc,
  buildInitiativePlpContractFromCard,
  getInitiativePlpOperatorCounters,
  parseInitiativePlpOperatorArgs,
  resetInitiativePlpOperatorCountersForTests,
  runInitiativePlpDiagnose,
  runInitiativePlpFakeLocalProvider,
  runInitiativePlpMaterialize,
} from "../../../src/modules/language/initiative-plp-operator/index.js";
import type { InitiativePlpOperatorSource } from "../../../src/modules/language/initiative-plp-operator/source-resolve.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function publicChoiceCard(): WorldInitiativeCardProjection {
  return {
    initiativeId: "init-election-staging-1",
    title: "Kelowna Mayor Election",
    summary: "Summary long enough for integrity checks in Ukrainian builds.",
    activityArea: "Democracy and Governance",
    geographyLabel: "British Columbia · Canada",
    countryCode: "CA",
    regionCode: "CA-BC",
    publicInitiativeHref: "/initiatives/public/init-election-staging-1",
    publishedAt: "2029-01-01T00:00:00.000Z",
    publicStatus: "Active",
    lifecycleProfile: "PUBLIC_CHOICE",
    electionName: "Community Mayor Election — Staging Test",
  };
}

function sourceFromCard(
  card: WorldInitiativeCardProjection,
  locale: string,
): InitiativePlpOperatorSource {
  const contract = buildInitiativePlpContractFromCard(card, locale);
  const autoPaths = [
    { path: "title", value: card.title },
    { path: "summary", value: card.summary },
    ...(card.electionName
      ? [{ path: "electionName", value: card.electionName }]
      : []),
  ];
  return {
    FOUND: true,
    PUBLIC: true,
    initiativeId: card.initiativeId,
    entityType: INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE,
    entityId: card.initiativeId,
    lifecycleProfile: String(card.lifecycleProfile ?? "STANDARD"),
    card,
    contract,
    canonicalPresentation: contract.canonicalPresentation,
    canonicalVersion: contract.canonicalVersion,
    schemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    autoPaths,
    machinePaths: ["title", "summary", "electionName"],
    fieldOwnership: contract.fieldPolicy as Record<string, string>,
  };
}

beforeEach(() => {
  resetPublishedLocalizationPersistenceForTests();
  bindPublishedLocalizationMemoryPersistenceForTests("reset05b");
  resetPlpDomainAdapterRegistryForTests();
  resetInitiativePlpAdapterRegistrationForTests();
  resetInitiativePlpOperatorCountersForTests();
  ensureInitiativeLifecyclePlpAdapterRegistered();
});

afterEach(() => {
  resetPublishedLocalizationPersistenceForTests();
  resetPlpDomainAdapterRegistryForTests();
  resetInitiativePlpAdapterRegistrationForTests();
  resetInitiativePlpOperatorCountersForTests();
});

describe("RESET 05B — Initiative PLP live acceptance operator", () => {
  it("parse requires mongo + initiative-id + locale; diagnose refuses execute", () => {
    const bad = parseInitiativePlpOperatorArgs(
      ["--initiative-id", "x", "--locale", "uk"],
      "diagnose",
    );
    assert.equal(bad.ok, false);

    const ok = parseInitiativePlpOperatorArgs(
      ["--mongo", "--initiative-id", "init-1", "--locale", "uk"],
      "diagnose",
    );
    assert.equal(ok.ok, true);

    const execOnDiagnose = parseInitiativePlpOperatorArgs(
      ["--mongo", "--initiative-id", "init-1", "--locale", "uk", "--execute"],
      "diagnose",
    );
    assert.equal(execOnDiagnose.ok, false);
  });

  it("PUBLIC_CHOICE tree includes title + electionName; excludes geography/lifecycle", () => {
    const card = publicChoiceCard();
    const fromDoc = buildInitiativePlpCardFromThinDoc({
      initiativeId: card.initiativeId,
      title: card.title,
      description: card.summary,
      status: "active",
      lifecycleProfile: "PUBLIC_CHOICE",
      updatedAt: card.publishedAt,
      visibility: { policy: "public" },
      metadata: {
        activityArea: card.activityArea,
        countrySlug: "CA",
        regionSlug: "CA-BC",
        communityAssociation: card.electionName,
      },
    });
    assert.ok(fromDoc);
    assert.equal(fromDoc!.electionName, card.electionName);
    assert.doesNotMatch(fromDoc!.geographyLabel, /Community Mayor/);

    const contract = buildInitiativePlpContractFromCard(fromDoc!, "uk");
    const presentation = contract.canonicalPresentation as Record<string, unknown>;
    assert.equal(presentation.title, card.title);
    assert.equal(presentation.electionName, card.electionName);
    const auto = sourceFromCard(fromDoc!, "uk").autoPaths.map((n) => n.path);
    assert.ok(auto.includes("title"));
    assert.ok(auto.includes("electionName"));
    assert.ok(auto.includes("summary"));
    assert.equal(
      assertInitiativeMachineNodesExcludeNonMachine(
        auto.map((path) => ({ path })),
      ).ok,
      true,
    );
    assert.ok(!auto.includes("geographyLabel"));
    assert.ok(!auto.includes("activityArea"));
    assert.ok(!auto.includes("currentStageLabel"));
  });

  it("consumer identity is Initiative id for rail/detail/sidebar", () => {
    const card = publicChoiceCard();
    const contract = buildInitiativePlpContractFromCard(card, "uk");
    assert.equal(contract.entityType, "initiative");
    assert.equal(contract.entityId, card.initiativeId);
  });

  it("dry-run performs zero provider/writes", async () => {
    const card = publicChoiceCard();
    const source = sourceFromCard(card, "uk");
    const result = await runInitiativePlpMaterialize(
      ["--mongo", "--initiative-id", card.initiativeId, "--locale", "uk"],
      {
        skipPersistenceRequire: true,
        skipExecuteGuards: true,
        skipProductionRefusal: true,
        isMongoConfigured: () => true,
        resolveSource: async () => source,
        loadLocale: async () => ({
          LOCALE_REGISTRY_FOUND: true,
          LOCALE_ENABLED: true,
          CONTENT_TRANSLATION_ENABLED: true,
        }),
        inspectPlp: async () => ({
          PLP_PERSISTENCE_MODE: "MEMORY",
          PLP_CURRENT_FOUND: false,
          PLP_STATE: null,
          PLP_CANONICAL_VERSION: null,
          PLP_SCHEMA_VERSION: null,
          EXISTING_PLP_USABILITY: "REBUILD_REQUIRED",
          EXISTING_PLP_USABILITY_REASON: "NO_PUBLISHED_SNAPSHOT",
          REBUILD_REQUIRED: true,
          RESOLVER_MODE: "CANONICAL_FALLBACK",
          RESOLVER_REASON: "NO_PUBLISHED_SNAPSHOT",
        }),
      },
    );
    assert.equal(result.exitCode, 0);
    assert.ok(result.report);
    assert.equal(result.report!.OPERATOR_MODE, "DRY_RUN");
    assert.equal(result.report!.WOULD_CALL_PROVIDER, true);
    assert.equal(result.report!.WOULD_PUBLISH_PLP, true);
    assert.equal(result.report!.PROVIDER_CALLS, 0);
    assert.equal(result.report!.PLP_WRITES, 0);
    assert.equal(result.report!.MONGO_WRITES, 0);
    assert.equal(getInitiativePlpOperatorCounters().PROVIDER_CALLS, 0);
  });

  it("execute publishes one initiative+locale; durability + PUBLISHED_LOCALIZED", async () => {
    const card = publicChoiceCard();
    const source = sourceFromCard(card, "uk");
    const result = await runInitiativePlpMaterialize(
      [
        "--mongo",
        "--initiative-id",
        card.initiativeId,
        "--locale",
        "uk",
        "--execute",
      ],
      {
        skipPersistenceRequire: true,
        skipExecuteGuards: true,
        skipProductionRefusal: true,
        isMongoConfigured: () => true,
        resolveSource: async () => source,
        loadLocale: async () => ({
          LOCALE_REGISTRY_FOUND: true,
          LOCALE_ENABLED: true,
          CONTENT_TRANSLATION_ENABLED: true,
        }),
        runProvider: runInitiativePlpFakeLocalProvider,
        verifyDurability: async () => ({
          ok: true,
          PLP_DURABILITY_VERIFIED: true,
        }),
      },
    );
    assert.equal(result.exitCode, 0, result.errorMessage ?? "");
    assert.equal(result.report!.OPERATOR_MODE, "EXECUTE");
    assert.equal(result.report!.PLP_OUTCOME, "COMPLETED");
    assert.equal(result.report!.PLP_WRITES, 1);
    assert.equal(result.report!.PROVIDER_CALLS, 1);
    assert.equal(result.report!.PLP_DURABILITY_VERIFIED, true);
    assert.equal(result.report!.RESOLVER_MODE, "PUBLISHED_LOCALIZED");
    assert.equal(result.report!.ENTITY_ID, card.initiativeId);

    const resolved = await resolvePublishedPresentation({
      entityType: source.entityType,
      entityId: source.entityId,
      locale: "uk",
      liveCanonicalVersion: source.canonicalVersion!,
      canonicalPresentation: source.canonicalPresentation!,
    });
    assert.equal(resolved.mode, "PUBLISHED_LOCALIZED");
  });

  it("stale snapshot is rebuild-eligible / fallback", async () => {
    const card = publicChoiceCard();
    const source = sourceFromCard(card, "uk");
    await runUniversalPlpBuild({
      contract: source.contract!,
      liveCanonicalVersion: source.canonicalVersion!,
      layers: [
        {
          source: "MACHINE",
          values: {
            title: "[uk] Kelowna Mayor Election",
            summary: "[uk] Summary long enough for integrity checks in Ukrainian builds.",
            electionName: "[uk] Community Mayor Election — Staging Test",
          },
        },
      ],
    });
    const staleVersion = source.canonicalVersion!;
    const liveVersion = "ffffffffffffffffffffffffffffffff";
    assert.equal(
      isPlpBuildStaleAgainstLive({
        buildTargetCanonicalVersion: staleVersion,
        liveCanonicalVersion: liveVersion,
      }),
      true,
    );
    const resolved = await resolvePublishedPresentation({
      entityType: source.entityType,
      entityId: source.entityId,
      locale: "uk",
      liveCanonicalVersion: liveVersion,
      canonicalPresentation: source.canonicalPresentation!,
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
  });

  it("diagnose reports zero provider/writes and required fields", async () => {
    const card = publicChoiceCard();
    const source = sourceFromCard(card, "uk");
    const result = await runInitiativePlpDiagnose(
      ["--mongo", "--initiative-id", card.initiativeId, "--locale", "uk"],
      {
        skipPersistenceRequire: true,
        isMongoConfigured: () => true,
        resolveSource: async () => source,
        loadLocale: async () => ({
          LOCALE_REGISTRY_FOUND: true,
          LOCALE_ENABLED: true,
          CONTENT_TRANSLATION_ENABLED: true,
        }),
        inspectPlp: async () => ({
          PLP_PERSISTENCE_MODE: "MEMORY",
          PLP_CURRENT_FOUND: false,
          PLP_STATE: null,
          PLP_CANONICAL_VERSION: null,
          PLP_SCHEMA_VERSION: null,
          EXISTING_PLP_USABILITY: "REBUILD_REQUIRED",
          EXISTING_PLP_USABILITY_REASON: "NO_PUBLISHED_SNAPSHOT",
          REBUILD_REQUIRED: true,
          RESOLVER_MODE: "CANONICAL_FALLBACK",
          RESOLVER_REASON: "NO_PUBLISHED_SNAPSHOT",
        }),
        connect: async () => undefined,
        disconnect: async () => undefined,
      },
    );
    assert.equal(result.exitCode, 0);
    assert.ok(result.report);
    assert.equal(result.report!.OPERATOR_MODE, "THIN_READ_ONLY");
    assert.equal(result.report!.PROVIDER_CALLS, 0);
    assert.equal(result.report!.PLP_WRITES, 0);
    assert.equal(result.report!.MONGO_WRITES, 0);
    assert.equal(result.report!.SCHEMA_VERSION, "PLP.2");
    assert.ok(result.report!.MACHINE_AUTO_PATHS.includes("title"));
    assert.ok(result.report!.MACHINE_AUTO_PATHS.includes("electionName"));
    assert.equal(result.report!.MACHINE_NODES_EXCLUDE_GEO_LIFECYCLE, true);
    assert.equal(result.report!.RESOLVER_MODE, "CANONICAL_FALLBACK");
    assert.equal(result.report!.RESOLVER_REASON, "NO_PUBLISHED_SNAPSHOT");
  });

  it("schema remains PLP.2; package scripts registered", () => {
    assert.equal(PUBLISHED_LOCALIZATION_SCHEMA_VERSION, "PLP.2");
    const pkg = readFileSync(join(apiRoot, "package.json"), "utf8");
    assert.match(pkg, /diagnose:initiative-plp/);
    assert.match(pkg, /materialize:initiative-plp/);
  });

  it("read path after publish makes zero additional provider calls", async () => {
    const card = publicChoiceCard();
    const source = sourceFromCard(card, "uk");
    resetInitiativePlpOperatorCountersForTests();
    await runInitiativePlpMaterialize(
      [
        "--mongo",
        "--initiative-id",
        card.initiativeId,
        "--locale",
        "uk",
        "--execute",
      ],
      {
        skipPersistenceRequire: true,
        skipExecuteGuards: true,
        skipProductionRefusal: true,
        isMongoConfigured: () => true,
        resolveSource: async () => source,
        loadLocale: async () => ({
          LOCALE_REGISTRY_FOUND: true,
          LOCALE_ENABLED: true,
          CONTENT_TRANSLATION_ENABLED: true,
        }),
        runProvider: runInitiativePlpFakeLocalProvider,
        verifyDurability: async () => ({
          ok: true,
          PLP_DURABILITY_VERIFIED: true,
        }),
      },
    );
    const callsAfterPublish = getInitiativePlpOperatorCounters().PROVIDER_CALLS;
    await resolvePublishedPresentation({
      entityType: source.entityType,
      entityId: source.entityId,
      locale: "uk",
      liveCanonicalVersion: source.canonicalVersion!,
      canonicalPresentation: source.canonicalPresentation!,
    });
    assert.equal(
      getInitiativePlpOperatorCounters().PROVIDER_CALLS,
      callsAfterPublish,
    );
  });
});
