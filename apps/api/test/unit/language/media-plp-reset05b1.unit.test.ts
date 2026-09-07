/**
 * RESET 05B.1 — thin PUBLIC_CHOICE Initiative discovery for staging acceptance.
 * No Gemini / live Mongo / materialize.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  INITIATIVE_PLP_ENTITY_TYPE,
  type WorldInitiativeCardProjection,
} from "@hu/types";

import {
  ensureInitiativeLifecyclePlpAdapterRegistered,
  resetInitiativePlpAdapterRegistrationForTests,
  resetPlpDomainAdapterRegistryForTests,
  resetPublishedLocalizationPersistenceForTests,
  bindPublishedLocalizationMemoryPersistenceForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  INITIATIVE_PLP_PUBLIC_CHOICE_DISCOVERY_DEFAULT_LIMIT,
  buildInitiativePlpCardFromThinDoc,
  buildInitiativePlpContractFromCard,
  getInitiativePlpOperatorCounters,
  mapPublicChoiceDiscoveryRows,
  parseInitiativePlpOperatorArgs,
  resetInitiativePlpOperatorCountersForTests,
  runInitiativePlpDiagnose,
} from "../../../src/modules/language/initiative-plp-operator/index.js";
import type { InitiativePlpOperatorSource } from "../../../src/modules/language/initiative-plp-operator/source-resolve.js";
import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const operatorRoot = join(
  apiRoot,
  "src/modules/language/initiative-plp-operator",
);

function kelownaDoc() {
  return {
    initiativeId: "init-kelowna-election-staging",
    title: "Kelowna Mayor Election",
    description: "Public choice election for Kelowna staging acceptance.",
    status: "active",
    lifecycleProfile: "PUBLIC_CHOICE",
    lifecyclePhase: "projected",
    updatedAt: "2029-03-01T00:00:00.000Z",
    visibility: { policy: "public" as const },
    metadata: {
      activityArea: "Democracy and Governance",
      countrySlug: "CA",
      regionSlug: "CA-BC",
      communitySlug: "kelowna",
      region: "British Columbia",
      communityAssociation: "Community Mayor Election — Kelowna",
    },
  };
}

function standardDoc() {
  return {
    initiativeId: "init-standard-should-not-appear",
    title: "Standard Civic Initiative",
    description: "Must never appear in PUBLIC_CHOICE discovery.",
    status: "active",
    lifecycleProfile: "STANDARD",
    lifecyclePhase: "projected",
    updatedAt: "2029-04-01T00:00:00.000Z",
    visibility: { policy: "public" as const },
    metadata: {
      activityArea: "Education",
      countrySlug: "CA",
      regionSlug: "CA-BC",
    },
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
  bindPublishedLocalizationMemoryPersistenceForTests("reset05b1");
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

describe("RESET 05B.1 — PUBLIC_CHOICE Initiative discovery", () => {
  it("parse accepts --list-public-choice; mutually exclusive with identity flags", () => {
    const list = parseInitiativePlpOperatorArgs(
      ["--mongo", "--list-public-choice"],
      "diagnose",
    );
    assert.equal(list.ok, true);
    if (!list.ok) return;
    assert.equal(list.args.mode, "list_public_choice");
    if (list.args.mode !== "list_public_choice") return;
    assert.equal(
      list.args.limit,
      INITIATIVE_PLP_PUBLIC_CHOICE_DISCOVERY_DEFAULT_LIMIT,
    );

    const withLimit = parseInitiativePlpOperatorArgs(
      ["--mongo", "--list-public-choice", "--limit", "5"],
      "diagnose",
    );
    assert.equal(withLimit.ok, true);
    if (!withLimit.ok || withLimit.args.mode !== "list_public_choice") return;
    assert.equal(withLimit.args.limit, 5);

    const overMax = parseInitiativePlpOperatorArgs(
      ["--mongo", "--list-public-choice", "--limit", "99"],
      "diagnose",
    );
    assert.equal(overMax.ok, false);

    const mixed = parseInitiativePlpOperatorArgs(
      [
        "--mongo",
        "--list-public-choice",
        "--initiative-id",
        "x",
      ],
      "diagnose",
    );
    assert.equal(mixed.ok, false);

    const withLocale = parseInitiativePlpOperatorArgs(
      ["--mongo", "--list-public-choice", "--locale", "uk"],
      "diagnose",
    );
    assert.equal(withLocale.ok, false);

    const materializeList = parseInitiativePlpOperatorArgs(
      ["--mongo", "--list-public-choice"],
      "materialize",
    );
    assert.equal(materializeList.ok, false);

    const identity = parseInitiativePlpOperatorArgs(
      ["--mongo", "--initiative-id", "init-1", "--locale", "uk"],
      "diagnose",
    );
    assert.equal(identity.ok, true);
    if (!identity.ok) return;
    assert.equal(identity.args.mode, "identity");
  });

  it("discovery returns only PUBLIC_CHOICE and is bounded", () => {
    const docs = [
      kelownaDoc(),
      standardDoc(),
      {
        ...kelownaDoc(),
        initiativeId: "init-public-choice-2",
        title: "Second Public Choice",
        updatedAt: "2029-02-01T00:00:00.000Z",
      },
      {
        ...kelownaDoc(),
        initiativeId: "init-public-choice-3",
        title: "Third Public Choice",
        updatedAt: "2029-01-01T00:00:00.000Z",
      },
    ];
    const mapped = mapPublicChoiceDiscoveryRows(docs, 2);
    assert.equal(mapped.LIMIT, 2);
    assert.equal(mapped.FOUND_COUNT, 2);
    assert.equal(mapped.ROWS.length, 2);
    assert.ok(
      mapped.ROWS.every((row) => row.lifecycleProfile === "PUBLIC_CHOICE"),
    );
    assert.ok(
      mapped.ROWS.every(
        (row) => row.initiativeId !== "init-standard-should-not-appear",
      ),
    );
    assert.equal(mapped.ROWS[0]?.initiativeId, "init-kelowna-election-staging");
    assert.equal(mapped.ROWS[0]?.countryCode, "CA");
    assert.equal(mapped.ROWS[0]?.regionCode, "CA-BC");
    assert.equal(mapped.ROWS[0]?.communitySlug, "kelowna");
    assert.equal(mapped.ROWS[0]?.consumerVisible, true);
    assert.match(mapped.ROWS[0]?.electionName ?? "", /Kelowna/);
  });

  it("canonical identity matches PLP adapter / diagnose identity", () => {
    const doc = kelownaDoc();
    const card = buildInitiativePlpCardFromThinDoc(doc);
    assert.ok(card);
    const contract = buildInitiativePlpContractFromCard(card!, "uk");
    const mapped = mapPublicChoiceDiscoveryRows([doc], 1);
    assert.equal(mapped.ROWS.length, 1);
    const row = mapped.ROWS[0]!;
    assert.equal(row.entityType, INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE);
    assert.equal(row.entityId, card!.initiativeId);
    assert.equal(row.initiativeId, contract.entityId);
    assert.equal(contract.entityType, "initiative");
    assert.equal(row.title, card!.title);
  });

  it("list diagnose reports zero writes/provider calls", async () => {
    const doc = kelownaDoc();
    const discovery = mapPublicChoiceDiscoveryRows([doc, standardDoc()], 20);
    const result = await runInitiativePlpDiagnose(
      ["--mongo", "--list-public-choice"],
      {
        isMongoConfigured: () => true,
        discoverPublicChoice: async () => discovery,
        connect: async () => undefined,
        disconnect: async () => undefined,
      },
    );
    assert.equal(result.exitCode, 0);
    assert.ok(result.report);
    assert.equal(result.report.DISCOVERY_MODE, "list_public_choice");
    if (result.report.DISCOVERY_MODE !== "list_public_choice") return;
    assert.equal(result.report.PROVIDER_CALLS, 0);
    assert.equal(result.report.PLP_WRITES, 0);
    assert.equal(result.report.MONGO_WRITES, 0);
    assert.equal(getInitiativePlpOperatorCounters().PROVIDER_CALLS, 0);
    assert.equal(getInitiativePlpOperatorCounters().PLP_WRITES, 0);
    assert.equal(getInitiativePlpOperatorCounters().MONGO_WRITES, 0);
    assert.equal(result.report.FOUND_COUNT, 1);
    assert.equal(
      result.report.ROWS[0]?.initiativeId,
      "init-kelowna-election-staging",
    );
  });

  it("discovered initiativeId is accepted by existing identity diagnose", async () => {
    const doc = kelownaDoc();
    const card = buildInitiativePlpCardFromThinDoc(doc)!;
    const discovery = mapPublicChoiceDiscoveryRows([doc], 1);
    const discoveredId = discovery.ROWS[0]!.initiativeId;

    const listResult = await runInitiativePlpDiagnose(
      ["--mongo", "--list-public-choice", "--limit", "1"],
      {
        isMongoConfigured: () => true,
        discoverPublicChoice: async () => discovery,
        connect: async () => undefined,
        disconnect: async () => undefined,
      },
    );
    assert.equal(listResult.exitCode, 0);
    assert.equal(
      listResult.report &&
        listResult.report.DISCOVERY_MODE === "list_public_choice"
        ? listResult.report.ROWS[0]?.initiativeId
        : null,
      discoveredId,
    );

    const source = sourceFromCard(card, "uk");
    const identity = await runInitiativePlpDiagnose(
      ["--mongo", "--initiative-id", discoveredId, "--locale", "uk"],
      {
        skipPersistenceRequire: true,
        isMongoConfigured: () => true,
        resolveSource: async (input) => {
          assert.equal(input.initiativeId, discoveredId);
          return source;
        },
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
    assert.equal(identity.exitCode, 0);
    assert.ok(identity.report);
    assert.equal(identity.report.DISCOVERY_MODE, "identity");
    if (identity.report.DISCOVERY_MODE !== "identity") return;
    assert.equal(identity.report.INITIATIVE_ID, discoveredId);
    assert.equal(identity.report.ENTITY_ID, discoveredId);
    assert.equal(identity.report.ENTITY_TYPE, "initiative");
    assert.equal(identity.report.PROVIDER_CALLS, 0);
    assert.equal(identity.report.PLP_WRITES, 0);
    assert.equal(identity.report.MONGO_WRITES, 0);
  });

  it("operator sources stay free of TranslationProvider import; scripts documented", () => {
    for (const file of [
      "discover-public-choice.ts",
      "run-diagnose.ts",
      "parse-args.ts",
      "source-resolve.ts",
    ]) {
      const src = readFileSync(join(operatorRoot, file), "utf8");
      assert.doesNotMatch(src, /import\s+.*TranslationProvider/);
      assert.doesNotMatch(src, /from\s+["'][^"']*translation-provider/);
    }
    const script = readFileSync(
      join(apiRoot, "src/scripts/diagnose-initiative-plp.ts"),
      "utf8",
    );
    assert.match(script, /list-public-choice/);
  });
});
