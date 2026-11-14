/**
 * HU-LC-05C.4C.7E.9C — Initiative child records (revisions, proposals,
 * decisions, commitments, tracking, official responses, impacts, archives)
 * are publicly readable through Content Translation only while their parent
 * Initiative passes canExposePublicInitiativeProjection. Private parents look
 * exactly like unknown ids and never reach a provider or search discovery.
 */
import "./hu-lc-05c4c7e9c-civic-child-ct-privacy-env.ts";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import express from "express";
import type { ContentTranslationSourceKind, Initiative } from "@hu/types";

import {
  DeterministicTranslationProvider,
  TranslationProviderError,
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  getOrCreateContentTranslation,
  listSearchDiscoveryWarmTargets,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  resetTranslationProviderForTests,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  setTranslationProviderForTests,
} from "../../../src/modules/language/index.js";
import { discoverStagingInitiativePathWarmSources } from "../../../src/modules/language/content-translation-staging-warm-backfill.js";
import { processContentTranslationWarmRequested } from "../../../src/modules/language/content-translation-warm-consumer.js";
import { loadTranslatableSource } from "../../../src/modules/language/content-translation.service.js";
import { listContentTranslationsForSource } from "../../../src/modules/language/persistence/content-translation.repository.js";
import { createInitiative, deleteInitiative } from "../../../src/modules/initiatives/initiative.store.js";
import {
  createCollection,
  deleteCollectionsByAuthorIdForTests,
} from "../../../src/modules/initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.store.js";
import { createRevision } from "../../../src/modules/initiative-version-revision/initiative-version-revision.store.js";
import {
  createSession,
  deleteSessionsByStewardIdForTests,
} from "../../../src/modules/decision-session/decision-session.store.js";
import {
  createDecision,
  deleteDecisionsByStewardIdForTests,
} from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.store.js";
import {
  createCommitment,
  deleteCommitmentsByParticipantIdForTests,
} from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import {
  createTracking,
  deleteTrackingsByParticipantIdForTests,
} from "../../../src/modules/initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { createResponse, updateResponse } from "../../../src/modules/official-response/official-response.store.js";
import publicOfficialResponseRouter, {
  publicOfficialResponsesByInitiativeRouter,
} from "../../../src/modules/official-response/public-official-response.routes.js";
import {
  createImpact,
  deletePublicImpactsByParticipantIdForTests,
} from "../../../src/modules/initiative-public-impact/initiative-public-impact.store.js";
import {
  createArchiveRecord,
  deleteArchiveRecordsByAuthorIdForTests,
} from "../../../src/modules/public-civic-archive/public-civic-archive.store.js";

const RUN = randomBytes(4).toString("hex");
const LOCALE = "xx-C7E9C";
const STEWARD = `member-7e9c-steward-${RUN}`;
const AUTHOR = `member-7e9c-author-${RUN}`;
const NOW = new Date().toISOString();
const secret = (parent: ParentCase, kind: string) => `SECRET-${parent}-${kind}-${RUN}`;

const PARENTS = {
  Public: { lifecyclePhase: "projected", visibility: "public", blocked: false },
  Unpublished: { lifecyclePhase: "draft", visibility: "public", blocked: false },
  Private: { lifecyclePhase: "projected", visibility: "steward_only", blocked: false },
  Blocked: { lifecyclePhase: "projected", visibility: "public", blocked: true },
} as const;
type ParentCase = keyof typeof PARENTS;
const PRIVATE_PARENTS: readonly ParentCase[] = ["Unpublished", "Private", "Blocked"];

/** Kinds whose public projection loads without MongoDB in unit tests. */
const LOADABLE_KINDS = [
  "improvement_proposal",
  "initiative_revision",
  "decision_session",
  "collective_decision",
  "implementation_commitment",
  "implementation_tracking",
  "official_response",
  "public_impact",
] as const;
const ALL_KINDS = [...LOADABLE_KINDS, "civic_archive"] as const;
type ChildKind = (typeof ALL_KINDS)[number];

const initiativeIds = {} as Record<ParentCase, string>;
const childIds = {} as Record<ParentCase, Record<ChildKind, string>>;
const providerTexts: string[] = [];
let server: Server | null = null;
let baseUrl = "";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const readApi = (relative: string) => readFileSync(path.join(repoRoot, "apps/api", relative), "utf8");

function idFor(parent: ParentCase, kind: string): string {
  return `${kind.replace(/_/g, "-")}-7e9c-${parent.toLowerCase()}-${RUN}`;
}

function initiative(parent: ParentCase): Initiative {
  const shape = PARENTS[parent];
  return {
    initiativeId: `initiative-7e9c-${parent.toLowerCase()}-${RUN}`,
    stewardId: STEWARD,
    createdAt: NOW,
    updatedAt: NOW,
    title: `Initiative ${parent} ${RUN}`,
    description: `Initiative ${parent} description.`,
    status: "proposal",
    lifecyclePhase: shape.lifecyclePhase,
    lifecycleProfile: "STANDARD",
    visibility: { policy: shape.visibility },
    ...(shape.blocked ? { administrativelyBlocked: true } : {}),
    metadata: {
      category: "Community",
      tags: [],
      region: "Test",
      language: "en",
      communitySlug: "test",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  } as unknown as Initiative;
}

async function seedChildren(parent: ParentCase): Promise<void> {
  const initiativeId = initiativeIds[parent];
  const ids = {} as Record<ChildKind, string>;
  for (const kind of ALL_KINDS) {
    ids[kind] = idFor(parent, kind);
  }
  childIds[parent] = ids;
  const text = (kind: ChildKind) => secret(parent, kind);

  await createCollection({
    collectionId: idFor(parent, "collection"),
    initiativeId,
    authorId: AUTHOR,
    analysisId: null,
    status: "published",
    publishedAt: NOW,
    sourceSnapshotCreatedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    proposals: [
      {
        proposalId: ids.improvement_proposal,
        title: text("improvement_proposal"),
        summary: `${text("improvement_proposal")} summary`,
        description: `${text("improvement_proposal")} description`,
        reason: "Reason.",
        expectedImprovement: "Expected improvement.",
        supportingSources: "Sources.",
        relatedDiscussionReferences: "References.",
        originalAuthorDisplayNames: [],
        sourceCommentIds: [],
        groupId: null,
        status: "published",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
  } as never);

  createRevision({
    revisionId: ids.initiative_revision,
    initiativeId,
    version: 1,
    previousVersion: null,
    authorId: STEWARD,
    createdAt: NOW,
    publishedAt: NOW,
    revisionSummary: text("initiative_revision"),
    title: `${text("initiative_revision")} title`,
    description: `${text("initiative_revision")} description`,
    metadata: initiative(parent).metadata,
    acceptedProposalIds: [],
    partiallyAcceptedProposalIds: [],
    declinedProposalIds: [],
    changes: [
      {
        changeId: idFor(parent, "change"),
        section: "description",
        sectionLabel: "Description",
        before: "Before.",
        after: `${text("initiative_revision")} after`,
        origin: "author_originated",
        proposalIds: [],
        authorOriginatedReason: "Reason.",
        explanation: "Explanation.",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
  } as never);

  createSession({
    sessionId: ids.decision_session,
    initiativeId,
    initiativeVersion: 1,
    stewardId: STEWARD,
    title: text("decision_session"),
    purpose: `${text("decision_session")} purpose`,
    decisionQuestion: `${text("decision_session")} question?`,
    status: "published",
    opensAt: NOW,
    closesAt: new Date(Date.now() + 86_400_000).toISOString(),
    createdAt: NOW,
    updatedAt: NOW,
    publishedAt: NOW,
    structuredContent: null,
    traceability: null,
    packageReferences: { revisionIds: [], analysisIds: [], proposalIds: [], petitionId: null },
  } as never);

  createDecision({
    decisionId: ids.collective_decision,
    initiativeId,
    decisionSessionId: ids.decision_session,
    stewardId: STEWARD,
    sequenceNumber: 1,
    participationScope: "community",
    status: "closed",
    question: text("collective_decision"),
    openedAt: NOW,
    closesAt: NOW,
    closedAt: NOW,
    structuredContent: null,
    traceability: null,
    createdAt: NOW,
    updatedAt: NOW,
  } as never);

  createCommitment({
    commitmentId: ids.implementation_commitment,
    initiativeId,
    decisionId: ids.collective_decision,
    participantId: AUTHOR,
    organizationName: "Organization",
    commitmentTitle: text("implementation_commitment"),
    commitmentSummary: `${text("implementation_commitment")} summary`,
    commitmentScope: "Scope.",
    status: "published",
    publishedAt: NOW,
    requiredResources: [],
    relatedRisks: [],
    references: [],
    createdAt: NOW,
    updatedAt: NOW,
  } as never);

  createTracking({
    trackingId: ids.implementation_tracking,
    commitmentId: ids.implementation_commitment,
    initiativeId,
    participantId: AUTHOR,
    status: "active",
    currentStage: "In Progress",
    summary: text("implementation_tracking"),
    activatedAt: NOW,
    notes: `${text("implementation_tracking")} notes`,
    approvedAction: "",
    dependencies: [],
    obstacles: [],
    evidenceReferences: [],
    createdAt: NOW,
    updatedAt: NOW,
  } as never);

  createResponse({
    responseId: ids.official_response,
    responseNumber: `OR-${parent}-${RUN}`,
    capId: idFor(parent, "cap"),
    deliveryId: idFor(parent, "delivery"),
    recipientId: idFor(parent, "recipient"),
    initiativeId,
    decisionId: ids.collective_decision,
    organizationName: "City Council",
    recordedByParticipantId: STEWARD,
    receivedAt: NOW,
    publishedAt: NOW,
    subject: text("official_response"),
    summary: `${text("official_response")} summary`,
    responseReference: "REF-1",
    responseType: "official_letter",
    verificationState: "verified",
    publicationStatus: "published",
    createdAt: NOW,
    updatedAt: NOW,
  } as never);

  createImpact({
    impactId: ids.public_impact,
    initiativeId,
    trackingId: ids.implementation_tracking,
    participantId: AUTHOR,
    title: text("public_impact"),
    summary: `${text("public_impact")} summary`,
    observedImpact: "Observed.",
    affectedCommunity: "Community.",
    evidenceSummary: "Evidence.",
    status: "published",
    publishedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  } as never);

  createArchiveRecord({
    archiveRecordId: ids.civic_archive,
    initiativeId,
    impactId: ids.public_impact,
    authorId: AUTHOR,
    stewardId: STEWARD,
    references: {
      initiativeId,
      initiativeVersion: 1,
      decisionId: ids.collective_decision,
      commitmentId: ids.implementation_commitment,
      trackingId: ids.implementation_tracking,
      impactId: ids.public_impact,
    },
    title: text("civic_archive"),
    summary: `${text("civic_archive")} summary`,
    country: "Testland",
    region: "Test",
    community: "test",
    activityArea: "Environment",
    participationScope: "community",
    implementationPeriod: "2026",
    lessonsLearned: {
      whatWorked: "Worked.",
      whatDidNotWork: "Did not.",
      recommendationsForFuture: "Recommend.",
      transferableExperience: "Transfer.",
    },
    knowledgeContribution: {
      socialBenefits: "Social.",
      environmentalBenefits: "Environmental.",
      economicBenefits: "Economic.",
      governanceBenefits: "Governance.",
      educationalBenefits: "Educational.",
      additionalObservations: "Observations.",
    },
    status: "published",
    archivedVersion: 1,
    archivedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  } as never);
}

async function getJson(url: string): Promise<{ status: number; text: string; json: unknown }> {
  const response = await fetch(`${baseUrl}${url}`);
  const text = await response.text();
  return { status: response.status, text, json: JSON.parse(text) as unknown };
}

const resolveOverHttp = (kind: ContentTranslationSourceKind, id: string) =>
  getJson(`/api/v1/translations/resolve/${kind}/${encodeURIComponent(id)}?language=${LOCALE}`);

function assertNoPrivateTextSentToProvider(): void {
  for (const text of providerTexts) {
    for (const parent of PRIVATE_PARENTS) {
      assert.equal(text.includes(`SECRET-${parent}-`), false, `${parent} child text reached the provider`);
    }
  }
}

describe("HU-LC-05C.4C.7E.9C — Initiative child Content Translation privacy", () => {
  before(async () => {
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    setContentTranslationWarmForceMemoryForTests(true);
    setLanguageRegistryForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await ensureTerminologyGlossarySeeded();

    const deterministic = new DeterministicTranslationProvider();
    setTranslationProviderForTests({
      providerId: "gemini",
      translate: async (request) => {
        providerTexts.push(request.text);
        const result = await deterministic.translate(request);
        return {
          ...result,
          providerId: "gemini",
          isPlaceholder: false,
          translatedText: result.translatedText.split(`[${request.targetLanguage}] `).join("Localized "),
        };
      },
    });

    await createLanguageRegistryRecord({
      languageId: `lang-${LOCALE.toLowerCase()}`,
      locale: LOCALE,
      englishName: "Civic Privacy Synthetic",
      nativeName: "Civic Privacy Synthetic",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: true,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
      uiTranslationStatus: "none",
    });

    for (const parent of Object.keys(PARENTS) as ParentCase[]) {
      initiativeIds[parent] = createInitiative(initiative(parent)).initiativeId;
      await seedChildren(parent);
    }

    const app = express();
    app.use(express.json());
    app.use(
      "/api/v1/translations",
      (await import("../../../src/modules/language/language.routes.js")).default,
    );
    app.use("/api/v1/public/official-responses", publicOfficialResponseRouter);
    app.use("/api/v1/public/initiatives", publicOfficialResponsesByInitiativeRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    await deleteCollectionsByAuthorIdForTests(AUTHOR);
    deleteSessionsByStewardIdForTests(STEWARD);
    deleteDecisionsByStewardIdForTests(STEWARD);
    deleteCommitmentsByParticipantIdForTests(AUTHOR);
    deleteTrackingsByParticipantIdForTests(AUTHOR);
    deletePublicImpactsByParticipantIdForTests(AUTHOR);
    deleteArchiveRecordsByAuthorIdForTests(AUTHOR);
    for (const parent of Object.keys(PARENTS) as ParentCase[]) {
      updateResponse(childIds[parent].official_response, { publicationStatus: "draft" });
      deleteInitiative(initiativeIds[parent]);
    }
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    setContentTranslationWarmForceMemoryForTests(false);
    resetTerminologyGlossaryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("loaders report public readability from the parent Initiative, not the child status", async () => {
    for (const kind of LOADABLE_KINDS) {
      for (const parent of Object.keys(PARENTS) as ParentCase[]) {
        const source = await loadTranslatableSource({
          sourceKind: kind,
          sourceRecordId: childIds[parent][kind],
        });
        assert.ok(source, `${kind}/${parent} should load`);
        assert.equal(source.isPublished, parent === "Public", `${kind}/${parent}`);
      }
    }
  });

  it("anonymous resolve: children of private, blocked or unpublished Initiatives look like unknown ids", async () => {
    for (const kind of LOADABLE_KINDS) {
      const unknown = await resolveOverHttp(kind, idFor("Public", `${kind}-unknown`));
      assert.ok(unknown.status >= 400, `${kind} unknown: ${unknown.text}`);
      for (const parent of PRIVATE_PARENTS) {
        const result = await resolveOverHttp(kind, childIds[parent][kind]);
        assert.equal(result.status, unknown.status, `${kind}/${parent}: ${result.text}`);
        assert.deepEqual(result.json, unknown.json, `${kind}/${parent} differs from an unknown id`);
        assert.equal(result.text.includes("SECRET"), false, `${kind}/${parent} leaks originalContent`);
      }
      const open = await resolveOverHttp(kind, childIds.Public[kind]);
      assert.equal(open.status, 200, `${kind}/Public: ${open.text}`);
      assert.ok(open.text.includes(secret("Public", kind)), `${kind}/Public original content`);
    }
  });

  it("warm and on-demand generation never send private child text to the provider", async () => {
    for (const kind of LOADABLE_KINDS) {
      for (const parent of PRIVATE_PARENTS) {
        const id = childIds[parent][kind];
        const result = await processContentTranslationWarmRequested({
          commandName: "ContentTranslationWarmRequested",
          sourceKind: kind,
          sourceRecordId: id,
          requestedAt: new Date().toISOString(),
          reason: "public_mutation",
        });
        assert.equal(result.outcome, "skipped_ineligible", `${kind}/${parent}`);
        await assert.rejects(
          getOrCreateContentTranslation({
            sourceKind: kind,
            sourceRecordId: id,
            targetLanguage: LOCALE,
            generateIfMissing: true,
            intent: "on_demand",
          }),
          (error: unknown) => error instanceof TranslationProviderError && error.code === "forbidden",
          `${kind}/${parent}`,
        );
        assert.deepEqual(
          await listContentTranslationsForSource({ sourceKind: kind, sourceRecordId: id }),
          [],
          `${kind}/${parent} produced translation rows`,
        );
      }
    }
    assertNoPrivateTextSentToProvider();
  });

  it("children of a public Initiative still warm through the provider", async () => {
    for (const kind of LOADABLE_KINDS) {
      const before = providerTexts.length;
      const result = await processContentTranslationWarmRequested({
        commandName: "ContentTranslationWarmRequested",
        sourceKind: kind,
        sourceRecordId: childIds.Public[kind],
        requestedAt: new Date().toISOString(),
        reason: "public_mutation",
      });
      assert.notEqual(result.outcome, "skipped_ineligible", `${kind}: ${JSON.stringify(result)}`);
      assert.ok(
        providerTexts.slice(before).some((text) => text.includes(secret("Public", kind))),
        `${kind} public text should reach the provider`,
      );
    }
    assertNoPrivateTextSentToProvider();
  });

  it("search discovery and staging backfill select only children of public Initiatives", async () => {
    const searched = await listSearchDiscoveryWarmTargets();
    const staged = await discoverStagingInitiativePathWarmSources({ kinds: [...ALL_KINDS] });
    for (const [label, targets] of [
      ["search discovery", searched],
      ["staging backfill", staged.candidates],
    ] as const) {
      const ofRun = targets.filter((target) => target.sourceRecordId.includes(RUN));
      for (const kind of ALL_KINDS) {
        assert.deepEqual(
          ofRun.filter((target) => target.sourceKind === kind).map((target) => target.sourceRecordId),
          [childIds.Public[kind]],
          `${label}: ${kind}`,
        );
      }
    }
  });

  it("public official response routes hide children of non-public Initiatives like unknown ids", async () => {
    const unknownDetail = await getJson(`/api/v1/public/official-responses/${idFor("Public", "or-unknown")}`);
    assert.equal(unknownDetail.status, 404);
    const unknownList = await getJson(
      `/api/v1/public/initiatives/${idFor("Public", "initiative-unknown")}/official-responses`,
    );
    assert.equal(unknownList.status, 200);
    for (const parent of PRIVATE_PARENTS) {
      const detail = await getJson(`/api/v1/public/official-responses/${childIds[parent].official_response}`);
      assert.equal(detail.status, unknownDetail.status, parent);
      assert.deepEqual(detail.json, unknownDetail.json, parent);
      const list = await getJson(`/api/v1/public/initiatives/${initiativeIds[parent]}/official-responses`);
      assert.equal(list.status, unknownList.status, parent);
      assert.deepEqual(
        (list.json as { data: unknown }).data,
        (unknownList.json as { data: unknown }).data,
        parent,
      );
      assert.equal(detail.text.includes("SECRET") || list.text.includes("SECRET"), false, parent);
    }
    const publicDetail = await getJson(`/api/v1/public/official-responses/${childIds.Public.official_response}`);
    assert.equal(publicDetail.status, 200);
    assert.ok(publicDetail.text.includes(secret("Public", "official_response")));
    const publicList = await getJson(`/api/v1/public/initiatives/${initiativeIds.Public}/official-responses`);
    assert.deepEqual(
      ((publicList.json as { data: { responseId: string }[] }).data).map((row) => row.responseId),
      [childIds.Public.official_response],
    );
  });

  it("every Initiative child kind is resolve-gated and checks its parent Initiative", () => {
    const service = readApi("src/modules/language/content-translation.service.ts");
    const gate = /PUBLIC_RESOLVE_GATED_SOURCE_KINDS[^=]*= new Set\(\[([\s\S]*?)\]\)/.exec(service)?.[1] ?? "";
    for (const kind of ALL_KINDS) {
      assert.match(gate, new RegExp(`"${kind}"`), `${kind} missing from the public resolve gate`);
    }
    const loaders = readApi("src/modules/language/content-translation-civic-loaders.ts");
    assert.doesNotMatch(
      loaders.slice(0, loaders.indexOf("export async function loadCivicMediaTranslationSource")),
      /isPublished: true/,
    );
    assert.equal((loaders.match(/isPublished: isParentInitiativePublic\(/g) ?? []).length, ALL_KINDS.length);
    const discovery = readApi("src/modules/language/content-translation-search-discovery-enumerate.ts");
    assert.doesNotMatch(discovery, /lifecyclePhase !== "draft"|lifecyclePhase === "draft"/);
    const routes = readApi("src/modules/official-response/public-official-response.routes.ts");
    assert.match(routes, /listPublicOfficialResponsesForCap\(capId\)\.filter\(\(response\) =>\s*isPublicInitiativeId\(response\.initiativeId\)/);
  });
});
