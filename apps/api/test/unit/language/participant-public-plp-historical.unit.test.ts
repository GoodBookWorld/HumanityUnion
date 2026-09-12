/**
 * Historical participant_public PLP materialize — bounded pages, Registry locales,
 * CURRENT skip, provider concurrency 1, no full-corpus array.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { MemberProfile } from "@hu/types";
import { PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION } from "@hu/types";

import {
  resetPublishedLocalizationPersistenceForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/persistence/repository.js";
import { publishPublishedLocalizedPresentation } from "../../../src/modules/language/published-localized-presentation/publish-atomic.js";
import {
  buildParticipantPublicCanonicalPresentation,
  PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
  participantPublicPlpDomainAdapter,
} from "../../../src/modules/language/published-localized-presentation/universal/adapters/participant-public-adapter.js";
import {
  parseParticipantPublicPlpMaterializeArgs,
} from "../../../src/modules/language/published-localized-presentation/universal/participant-public-plp-operator-args.js";
import { runParticipantPublicPlpMaterialize } from "../../../src/modules/language/published-localized-presentation/universal/participant-public-plp-operator.js";
import { mergeLocalizedLayersByProvenance } from "../../../src/modules/language/published-localized-presentation/validate-build-result.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../../..");

function read(relative: string): string {
  return readFileSync(path.join(apiRoot, relative), "utf8");
}

function sampleProfile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    profileId: "profile-hist-01",
    userId: "user-1",
    memberNumber: "HU-TEST",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    displayName: "Participant One",
    publicName: "participant-one",
    biography: "English biography for localization.",
    organization: "Humanity Union",
    skills: ["Skill Alpha"],
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

describe("materialize:participant-public-plp historical bounds", () => {
  before(() => {
    setPublishedLocalizationPersistenceModeForTests("memory");
  });
  beforeEach(() => {
    resetPublishedLocalizationPersistenceForTests();
    setPublishedLocalizationPersistenceModeForTests("memory");
  });
  after(() => {
    resetPublishedLocalizationPersistenceForTests();
  });

  it("parses --historical with page-size / after-profile-id / max-pages / max-provider-calls; refuses --all", () => {
    assert.equal(parseParticipantPublicPlpMaterializeArgs(["--mongo", "--all"]).ok, false);
    const hist = parseParticipantPublicPlpMaterializeArgs([
      "--mongo",
      "--historical",
      "--page-size",
      "5",
      "--after-profile-id",
      "profile-a",
      "--max-pages",
      "2",
      "--max-provider-calls",
      "40",
    ]);
    assert.equal(hist.ok, true);
    if (hist.ok) {
      assert.equal(hist.args.historical, true);
      assert.equal(hist.args.pageSize, 5);
      assert.equal(hist.args.afterProfileId, "profile-a");
      assert.equal(hist.args.maxPages, 2);
      assert.equal(hist.args.maxProviderCalls, 40);
    }
    const defaults = parseParticipantPublicPlpMaterializeArgs([
      "--mongo",
      "--historical",
    ]);
    assert.equal(defaults.ok, true);
    if (defaults.ok) {
      assert.equal(defaults.args.maxProviderCalls, 50);
    }
  });

  it("processes multiple profiles in bounded pages; never holds full corpus; concurrency 1", async () => {
    const corpus = [
      sampleProfile({ profileId: "p-a", publicName: "a", biography: "Bio A" }),
      sampleProfile({ profileId: "p-b", publicName: "b", biography: "Bio B" }),
      sampleProfile({ profileId: "p-c", publicName: "c", biography: "Bio C" }),
      sampleProfile({ profileId: "p-d", publicName: "d", biography: "Bio D" }),
    ];
    const pageLoads: number[] = [];
    let maxPageLen = 0;
    let providerInFlight = 0;
    let maxProviderInFlight = 0;
    let providerCalls = 0;

    const result = await runParticipantPublicPlpMaterialize(
      ["--mongo", "--historical", "--page-size", "2", "--execute"],
      {
        skipPersistenceRequire: true,
        skipProductionRefusal: true,
        skipExecuteGuards: true,
        isMongoConfigured: () => true,
        connect: async () => undefined,
        disconnect: async () => undefined,
        resolveLocales: async () => ["xx-Future"],
        listEligibleProfilesPage: async ({ pageSize, afterProfileId }) => {
          const start = afterProfileId
            ? corpus.findIndex((row) => row.profileId > afterProfileId)
            : 0;
          const from = start < 0 ? corpus.length : start;
          const page = corpus.slice(from, from + pageSize);
          pageLoads.push(page.length);
          maxPageLen = Math.max(maxPageLen, page.length);
          return page;
        },
        runProvider: async (input) => {
          providerInFlight += 1;
          maxProviderInFlight = Math.max(maxProviderInFlight, providerInFlight);
          providerCalls += 1;
          const values: Record<string, string> = {};
          for (const [k, v] of Object.entries(input.autoValues)) {
            values[k] = `[${input.locale}] ${v}`;
          }
          providerInFlight -= 1;
          return { ok: true, values };
        },
        publishBuild: async () => ({
          status: "COMPLETED",
          reasonCodes: [],
          snapshotId: "snap",
        }),
      },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.report?.TRAVERSAL, "historical");
    assert.equal(result.report?.pagesProcessed, 2);
    assert.equal(result.report?.profilesProcessed, 4);
    assert.equal(result.report?.hasMore, false);
    assert.equal(result.report?.PROVIDER_CONCURRENCY, 1);
    assert.equal(maxProviderInFlight, 1);
    assert.equal(providerCalls, 4);
    assert.ok(maxPageLen <= 2);
    assert.deepEqual(pageLoads.filter((n) => n > 0), [2, 2]);
    assert.ok(pageLoads.includes(0), "terminal empty page confirms corpus exhaustion");
    // Historical report retains last page only (not full corpus).
    assert.equal(result.report?.profiles.length, 2);
    assert.equal(result.report?.resumeAfterProfileId, "p-d");
    assert.equal(result.report?.totals.BUILT, 4);
  });

  it("skips usable CURRENT; builds missing locale; discovers Registry-added locale without hardcoding", async () => {
    const profile = sampleProfile({ profileId: "p-current", publicName: "current-one" });
    const full = buildParticipantPublicCanonicalPresentation({
      profileId: profile.profileId,
      displayName: profile.displayName,
      biography: profile.biography,
      organization: profile.organization,
      skills: profile.skills,
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
            biography: "Already localized biography.",
            "skills[0]": "Already localized skill",
          },
        },
      ],
    });
    await publishPublishedLocalizedPresentation({
      entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
      entityId: profile.profileId,
      locale: "xx-Present",
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

    let providerCalls = 0;
    const result = await runParticipantPublicPlpMaterialize(
      ["--mongo", "--historical", "--page-size", "10", "--execute"],
      {
        skipPersistenceRequire: true,
        skipProductionRefusal: true,
        skipExecuteGuards: true,
        isMongoConfigured: () => true,
        connect: async () => undefined,
        disconnect: async () => undefined,
        // Future Registry locale appears here without uk/ar/zh-Hant literals.
        resolveLocales: async () => ["xx-Present", "yy-Future"],
        listEligibleProfilesPage: async ({ afterProfileId }) => {
          if (afterProfileId) {
            return [];
          }
          return [profile];
        },
        runProvider: async (input) => {
          providerCalls += 1;
          assert.equal(input.locale, "yy-Future");
          const values: Record<string, string> = {};
          for (const [k, v] of Object.entries(input.autoValues)) {
            values[k] = `[yy] ${v}`;
          }
          return { ok: true, values };
        },
        publishBuild: async () => ({
          status: "COMPLETED",
          reasonCodes: [],
          snapshotId: "snap-yy",
        }),
      },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.report?.totals.SKIP_CURRENT, 1);
    assert.equal(result.report?.totals.BUILT, 1);
    assert.equal(providerCalls, 1);
    const locales = result.report?.profiles[0]?.locales ?? [];
    assert.equal(locales.find((row) => row.locale === "xx-Present")?.ACTION, "SKIP_CURRENT");
    assert.equal(locales.find((row) => row.locale === "yy-Future")?.ACTION, "BUILT");
  });

  it("provider budget mid-profile stops cleanly; resume re-enters profile; CURRENT skipped", async () => {
    const corpus = [
      sampleProfile({
        profileId: "p-munia",
        publicName: "munia",
        biography: "Munia biography.",
        skills: ["Facilitation"],
      }),
      sampleProfile({
        profileId: "p-next",
        publicName: "next-one",
        biography: "Next biography.",
      }),
    ];
    const builtLocales: string[] = [];
    let providerCalls = 0;

    const first = await runParticipantPublicPlpMaterialize(
      [
        "--mongo",
        "--historical",
        "--page-size",
        "10",
        "--max-provider-calls",
        "2",
        "--execute",
      ],
      {
        skipPersistenceRequire: true,
        skipProductionRefusal: true,
        skipExecuteGuards: true,
        isMongoConfigured: () => true,
        connect: async () => undefined,
        disconnect: async () => undefined,
        resolveLocales: async () => ["aa", "bb", "cc"],
        listEligibleProfilesPage: async ({ afterProfileId, pageSize }) => {
          const start = afterProfileId
            ? corpus.findIndex((row) => row.profileId > afterProfileId)
            : 0;
          const from = start < 0 ? corpus.length : start;
          return corpus.slice(from, from + pageSize);
        },
        runProvider: async (input) => {
          providerCalls += 1;
          builtLocales.push(`${input.sourceRecordId}:${input.locale}`);
          const values: Record<string, string> = {};
          for (const [k, v] of Object.entries(input.autoValues)) {
            values[k] = `[${input.locale}] ${v}`;
          }
          return { ok: true, values };
        },
        publishBuild: async ({ contract }) => {
          // Persist so resume can SKIP_CURRENT for aa/bb.
          const locale = String(contract.targetLocale);
          const full = buildParticipantPublicCanonicalPresentation({
            profileId: corpus[0]!.profileId,
            displayName: corpus[0]!.displayName,
            biography: corpus[0]!.biography,
            organization: corpus[0]!.organization,
            skills: corpus[0]!.skills,
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
                  biography: `[${locale}] bio`,
                  "skills[0]": `[${locale}] skill`,
                },
              },
            ],
          });
          await publishPublishedLocalizedPresentation({
            entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
            entityId: corpus[0]!.profileId,
            locale,
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
          return {
            status: "COMPLETED",
            reasonCodes: [],
            snapshotId: `snap-${locale}`,
          };
        },
      },
    );

    assert.equal(first.exitCode, 0);
    assert.equal(first.report?.abortReason, "PROVIDER_CALL_BUDGET_REACHED");
    assert.equal(first.report?.PROVIDER_CALLS, 2);
    assert.ok(first.report!.PROVIDER_CALLS <= first.report!.maxProviderCalls);
    assert.equal(first.report?.hasMore, true);
    // Budget hit on Munia cc — resume cursor must NOT advance past Munia.
    assert.equal(first.report?.resumeAfterProfileId, null);
    assert.equal(first.report?.profiles[0]?.COMPLETE, false);
    assert.equal(first.report?.totals.BUILT, 2);
    assert.equal(first.report?.totals.FAILED, 0);
    assert.equal(providerCalls, 2);

    const resumeLocales: string[] = [];
    let pageStarts: Array<string | null> = [];
    const second = await runParticipantPublicPlpMaterialize(
      [
        "--mongo",
        "--historical",
        "--page-size",
        "10",
        "--max-provider-calls",
        "10",
        "--execute",
        // resumeAfterProfileId was null → omit --after-profile-id (re-enter Munia).
      ],
      {
        skipPersistenceRequire: true,
        skipProductionRefusal: true,
        skipExecuteGuards: true,
        isMongoConfigured: () => true,
        connect: async () => undefined,
        disconnect: async () => undefined,
        resolveLocales: async () => ["aa", "bb", "cc"],
        listEligibleProfilesPage: async ({ afterProfileId, pageSize }) => {
          pageStarts.push(afterProfileId);
          const start = afterProfileId
            ? corpus.findIndex((row) => row.profileId > afterProfileId)
            : 0;
          const from = start < 0 ? corpus.length : start;
          return corpus.slice(from, from + pageSize);
        },
        runProvider: async (input) => {
          resumeLocales.push(`${input.sourceRecordId.split(":")[1]}:${input.locale}`);
          const values: Record<string, string> = {};
          for (const [k, v] of Object.entries(input.autoValues)) {
            values[k] = `[${input.locale}] ${v}`;
          }
          return { ok: true, values };
        },
        publishBuild: async () => ({
          status: "COMPLETED",
          reasonCodes: [],
          snapshotId: "snap-resume",
        }),
      },
    );

    assert.equal(second.exitCode, 0);
    assert.equal(second.report?.abortReason, null);
    assert.equal(pageStarts[0], null);
    // Unfinished Munia locale must be built; aa/bb must not re-call provider.
    assert.ok(resumeLocales.includes("p-munia:cc"));
    assert.equal(resumeLocales.includes("p-munia:aa"), false);
    assert.equal(resumeLocales.includes("p-munia:bb"), false);
    assert.ok((second.report?.totals.SKIP_CURRENT ?? 0) >= 2);
    assert.ok(second.report!.PROVIDER_CALLS <= second.report!.maxProviderCalls);
  });

  it("budget mid second profile resumes with --after-profile-id of last fully completed profile", async () => {
    const corpus = [
      sampleProfile({
        profileId: "p-a",
        publicName: "a-one",
        biography: "Bio A",
      }),
      sampleProfile({
        profileId: "p-b",
        publicName: "b-one",
        biography: "Bio B",
      }),
    ];
    let providerCalls = 0;
    const result = await runParticipantPublicPlpMaterialize(
      [
        "--mongo",
        "--historical",
        "--page-size",
        "10",
        "--max-provider-calls",
        "3",
        "--execute",
      ],
      {
        skipPersistenceRequire: true,
        skipProductionRefusal: true,
        skipExecuteGuards: true,
        isMongoConfigured: () => true,
        connect: async () => undefined,
        disconnect: async () => undefined,
        resolveLocales: async () => ["l1", "l2", "l3"],
        listEligibleProfilesPage: async ({ afterProfileId, pageSize }) => {
          const start = afterProfileId
            ? corpus.findIndex((row) => row.profileId > afterProfileId)
            : 0;
          const from = start < 0 ? corpus.length : start;
          return corpus.slice(from, from + pageSize);
        },
        runProvider: async (input) => {
          providerCalls += 1;
          const values: Record<string, string> = {};
          for (const [k, v] of Object.entries(input.autoValues)) {
            values[k] = `[${input.locale}] ${v}`;
          }
          return { ok: true, values };
        },
        publishBuild: async () => ({
          status: "COMPLETED",
          reasonCodes: [],
          snapshotId: "snap",
        }),
      },
    );

    // 3 calls: all of p-a, then stop before/at first unfinished p-b locale.
    assert.equal(result.report?.abortReason, "PROVIDER_CALL_BUDGET_REACHED");
    assert.equal(result.report?.PROVIDER_CALLS, 3);
    assert.equal(providerCalls, 3);
    assert.equal(result.report?.resumeAfterProfileId, "p-a");
    assert.equal(result.report?.hasMore, true);
    assert.equal(result.report?.totals.FAILED, 0);
    const unfinished = result.report?.profiles.find((row) => row.profileId === "p-b");
    assert.equal(unfinished?.COMPLETE, false);
    assert.ok((unfinished?.locales.length ?? 0) < 3);
  });

  it("NO_MACHINE_AUTO_PATHS is SKIP_NO_TRANSLATABLE, not FAILED; no provider call", async () => {
    const empty = sampleProfile({
      profileId: "p-empty",
      publicName: "leonardo-empty",
      biography: undefined,
      skills: [],
      organization: undefined,
    });
    let providerCalls = 0;
    const result = await runParticipantPublicPlpMaterialize(
      ["--mongo", "--historical", "--execute"],
      {
        skipPersistenceRequire: true,
        skipProductionRefusal: true,
        skipExecuteGuards: true,
        isMongoConfigured: () => true,
        connect: async () => undefined,
        disconnect: async () => undefined,
        resolveLocales: async () => ["uk", "ar"],
        listEligibleProfilesPage: async ({ afterProfileId }) =>
          afterProfileId ? [] : [empty],
        runProvider: async () => {
          providerCalls += 1;
          return { ok: false, reason: "SHOULD_NOT_RUN", message: "no" };
        },
        publishBuild: async () => ({
          status: "FAILED",
          reasonCodes: ["SHOULD_NOT_RUN"],
          snapshotId: null,
        }),
      },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(providerCalls, 0);
    assert.equal(result.report?.totals.FAILED, 0);
    assert.equal(result.report?.totals.SKIP_NO_TRANSLATABLE, 2);
    assert.equal(
      result.report?.profiles[0]?.locales.every(
        (row) => row.ACTION === "SKIP_NO_TRANSLATABLE",
      ),
      true,
    );
  });

  it("operator + enqueue remain Registry-driven (no hardcoded locale triple)", () => {
    const operator = read(
      "src/modules/language/published-localized-presentation/universal/participant-public-plp-operator.ts",
    );
    assert.match(operator, /listParticipantPublicPlpEligibleProfilesPage/);
    assert.match(operator, /--historical/);
    assert.match(operator, /PROVIDER_CONCURRENCY:\s*1/);
    assert.doesNotMatch(operator, /\["uk",\s*"ar",\s*"zh-Hant"\]/);
    assert.doesNotMatch(operator, /locale\s*===\s*["']uk["']/);

    const enqueue = read(
      "src/modules/language/published-localized-presentation/universal/adapters/enqueue-participant-public-plp.js".replace(
        /\.js$/,
        ".ts",
      ),
    );
    assert.match(enqueue, /resolvePlpAutoBuildLocales/);
    assert.doesNotMatch(enqueue, /\["uk",\s*"ar",\s*"zh-Hant"\]/);

    const service = read("src/modules/member-profile/member-profile.service.ts");
    assert.match(service, /enqueueParticipantPublicPlpBuilds/);
  });
});
