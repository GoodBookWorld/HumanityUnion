/**
 * TASK-057 — Global Search Foundation verification.
 * Run: npm run verify:global-search
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

const GLOBAL_SEARCH_DIR = path.join(REPO_ROOT, "apps/api/src/modules/global-search");

const FORBIDDEN_TERMS = [
  "openai",
  "OpenAI",
  "anthropic",
  "embedding",
  "vector",
  "elasticsearch",
  "meilisearch",
  "algolia",
  "semantic",
  "popularity",
  "reputation",
  "leaderboard",
] as const;

const PRIVATE_FIELD_KEYS = [
  "participantId",
  "authorId",
  "stewardId",
  "email",
  "passwordHash",
  "refreshTokenHash",
  "voteId",
  "voteHistory",
  "rawSource",
  "messageHeaders",
  "providerMetadata",
] as const;

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const otherParticipant: RequestIdentity = {
  participantId: "member-participant-b-001",
  displayName: "Analyst B",
};

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function listFilesRecursive(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function verifyModuleStructure(): void {
  console.log("1. Global search module structure");

  const requiredFiles = [
    "global-search.types.ts",
    "global-search.service.ts",
    "global-search.index.ts",
    "global-search.routes.ts",
    "global-search.matching.ts",
    "global-search.facets.ts",
    "global-search.grouping.ts",
    "global-search.stages.ts",
    "index.ts",
  ];

  for (const file of requiredFiles) {
    assert(
      fs.existsSync(path.join(GLOBAL_SEARCH_DIR, file)),
      `Missing global search file: ${file}`,
    );
  }

  assert(
    readRepoFile("apps/api/src/app.ts").includes("globalSearchRouter"),
    "App must mount global search router",
  );
  assert(
    readRepoFile("packages/types/src/domain/global-search.ts").includes("CivicSearchResponse"),
    "Domain must define CivicSearchResponse",
  );
}

function verifyNoAiOrPopularityCode(): void {
  console.log("2. No AI, embeddings, vector, or popularity ranking");

  const files = listFilesRecursive(GLOBAL_SEARCH_DIR).filter((file) => file.endsWith(".ts"));

  for (const file of files) {
    const source = fs.readFileSync(file, "utf-8").toLowerCase();

    for (const term of FORBIDDEN_TERMS) {
      assert(
        !source.includes(term.toLowerCase()),
        `${path.relative(REPO_ROOT, file)} must not include ${term}`,
      );
    }
  }
}

async function seedSearchFixture(): Promise<{ initiativeId: string; impactTitle: string }> {
  const { seedMember } = await import("../modules/member/member.store.js");
  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { createInitiativeCollaborativeAnalysisDraft, publishInitiativeCollaborativeAnalysis } =
    await import("../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js");
  const {
    createInitiativeImprovementProposalDraft,
    submitInitiativeImprovementProposal,
    decideInitiativeImprovementProposal,
  } =
    await import("../modules/initiative-improvement-proposal/initiative-improvement-proposal.service.js");
  const { createInitiativeRevisionDraft, saveInitiativeRevisionDraft, publishInitiativeRevision } =
    await import("../modules/initiative-version-revision/initiative-version-revision.service.js");
  const { createDecisionSessionDraft, publishDecisionSession, closeDecisionSession } =
    await import("../modules/decision-session/decision-session.service.js");
  const {
    createInitiativeCollectiveDecisionDraft,
    openInitiativeCollectiveDecision,
    closeInitiativeCollectiveDecision,
  } =
    await import("../modules/initiative-collective-decision/initiative-collective-decision.service.js");
  const {
    createInitiativeImplementationCommitmentDraft,
    publishInitiativeImplementationCommitment,
  } =
    await import("../modules/initiative-implementation-commitment/initiative-implementation-commitment.service.js");
  const {
    createInitiativeImplementationTrackingDraft,
    activateInitiativeImplementationTracking,
    addImplementationTrackingUpdate,
    completeInitiativeImplementationTracking,
  } =
    await import("../modules/initiative-implementation-tracking/initiative-implementation-tracking.service.js");
  const {
    createInitiativePublicImpactDraft,
    addPublicImpactEvidence,
    publishInitiativePublicImpact,
    verifyInitiativePublicImpact,
  } = await import("../modules/initiative-public-impact/initiative-public-impact.service.js");

  function futureIsoDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString();
  }

  seedMember({
    id: otherParticipant.participantId,
    profile: {
      displayName: otherParticipant.displayName ?? "Analyst B",
      uniqueName: "search-analyst-b",
      languages: ["en"],
      country: "Canada",
      region: "British Columbia",
    },
    status: "active",
    verificationLevel: "email",
    roles: ["member"],
    fair: { personal: 0, community: 0, regional: 0, global: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const draft = createInitiativeDraft(steward, {
    title: "Global Search Fixture Initiative",
    description: "Verification initiative for global search foundation.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });

  const published = publishInitiative(steward, draft.initiativeId);

  const analysisDraft = await createInitiativeCollaborativeAnalysisDraft(otherParticipant, {
    initiativeId: published.initiativeId,
    title: "Search Analysis Evidence",
    summary: "Analysis supporting global search verification.",
    supportingEvidence: "Evidence",
    risks: "Risk",
    suggestedImprovements: "Improve",
    references: "Ref",
  });
  const analysis = await publishInitiativeCollaborativeAnalysis(
    otherParticipant,
    analysisDraft.analysisId,
  );

  const proposalDraft = await createInitiativeImprovementProposalDraft(otherParticipant, {
    analysisId: analysis.analysisId,
    targetSection: "Summary",
    currentIssue: "Issue",
    proposedChange: "Change",
    rationale: "Rationale",
    expectedImprovement: "Improvement",
    references: "References",
  });
  const submitted = submitInitiativeImprovementProposal(otherParticipant, proposalDraft.proposalId);
  const decided = decideInitiativeImprovementProposal(steward, submitted.proposalId, {
    decision: "accepted",
    decisionNote: "Accepted for search verification.",
  });

  createInitiativeRevisionDraft(steward, published.initiativeId);
  saveInitiativeRevisionDraft(steward, published.initiativeId, {
    revisionSummary: "Search revision",
    appliedProposalIds: [decided.proposalId],
    skippedProposalIds: [],
  });
  publishInitiativeRevision(steward, published.initiativeId);

  const sessionDraft = await createDecisionSessionDraft(steward, {
    initiativeId: published.initiativeId,
    title: "Search Decision Session",
    purpose: "Prepare search verification decision",
    decisionQuestion: "Proceed with search verification?",
    opensAt: futureIsoDate(1),
    closesAt: futureIsoDate(14),
  });
  publishDecisionSession(steward, sessionDraft.sessionId);
  closeDecisionSession(steward, sessionDraft.sessionId);

  const decisionDraft = await createInitiativeCollectiveDecisionDraft(steward, {
    initiativeId: published.initiativeId,
    decisionSessionId: sessionDraft.sessionId,
    participationScope: "community",
    closesAt: futureIsoDate(30),
  });
  const opened = openInitiativeCollectiveDecision(steward, decisionDraft.decisionId);
  await closeInitiativeCollectiveDecision(steward, opened.decisionId);

  const commitmentDraft = await createInitiativeImplementationCommitmentDraft(steward, {
    initiativeId: published.initiativeId,
    decisionId: opened.decisionId,
    commitmentTitle: "Search Commitment",
    commitmentSummary: "Commit to searchable civic records.",
    commitmentScope: "Community implementation scope.",
  });
  const commitment = publishInitiativeImplementationCommitment(
    steward,
    commitmentDraft.commitmentId,
  );

  const trackingDraft = await createInitiativeImplementationTrackingDraft(steward, {
    commitmentId: commitment.commitmentId,
    summary: "Search tracking record",
    currentStage: "Implementation",
  });
  const tracking = activateInitiativeImplementationTracking(steward, trackingDraft.trackingId);
  addImplementationTrackingUpdate(steward, tracking.trackingId, {
    title: "Search update",
    summary: "Tracking update for search verification.",
    evidence: "https://example.org/search-evidence",
  });
  completeInitiativeImplementationTracking(steward, tracking.trackingId);

  const impactDraft = await createInitiativePublicImpactDraft(steward, {
    trackingId: tracking.trackingId,
    title: "Search Verified Impact",
    summary: "Impact summary for search verification.",
    observedImpact: "Global search can discover this impact record.",
    affectedCommunity: "Nelson Community Garden",
    evidenceSummary: "Evidence summary",
  });
  addPublicImpactEvidence(steward, impactDraft.impactId, {
    title: "Search evidence",
    description: "Evidence for search verification.",
    referenceUrl: "https://example.org/search-evidence.pdf",
    referenceType: "document",
  });
  const impact = publishInitiativePublicImpact(steward, impactDraft.impactId);
  verifyInitiativePublicImpact(steward, impact.impactId);

  return { initiativeId: published.initiativeId, impactTitle: impact.title };
}

async function verifyIndexAndMatching(): Promise<void> {
  console.log("3. Search index builds and matching works");

  const { resetGlobalSearchIndexForTests, buildGlobalSearchIndex } =
    await import("../modules/global-search/global-search.index.js");
  const { searchPublicCivicRecords } =
    await import("../modules/global-search/global-search.service.js");

  resetGlobalSearchIndexForTests();
  const fixture = await seedSearchFixture();
  resetGlobalSearchIndexForTests();

  const index = await buildGlobalSearchIndex();
  assert(index.length > 0, "Search index must include public records");
  assert(
    index.some((entry) => entry.entityType === "public_impact"),
    "Search index must include public impact records",
  );

  const titleSearch = await searchPublicCivicRecords({
    q: fixture.impactTitle,
    limit: 20,
    offset: 0,
    view: "flat",
  });

  assert(titleSearch.total >= 1, "Title search must return matches");
  assert(
    titleSearch.results.some((result) => result.entityType === "public_impact"),
    "Title search must return public impact",
  );
  assert((titleSearch.results[0]?.explanation.length ?? 0) > 0, "Results must include explanation");
}

async function verifyDraftExclusion(): Promise<void> {
  console.log("4. Draft initiatives excluded");

  const { createInitiativeDraft } = await import("../modules/initiatives/initiative.service.js");
  const { resetGlobalSearchIndexForTests, buildGlobalSearchIndex } =
    await import("../modules/global-search/global-search.index.js");

  const draftOnly = createInitiativeDraft(steward, {
    title: "Draft Only Search Exclusion Initiative",
    description: "This draft must never appear in global search.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });

  resetGlobalSearchIndexForTests();
  const index = await buildGlobalSearchIndex();

  assert(
    !index.some(
      (entry) => entry.entityType === "initiative" && entry.entityId === draftOnly.initiativeId,
    ),
    "Draft initiatives must not appear in search index",
  );
}

async function verifyFiltersFacetsPagination(): Promise<void> {
  console.log("5. Filters, facets, and pagination");

  const { resetGlobalSearchIndexForTests } =
    await import("../modules/global-search/global-search.index.js");
  const { searchPublicCivicRecords } =
    await import("../modules/global-search/global-search.service.js");

  resetGlobalSearchIndexForTests();
  await seedSearchFixture();
  resetGlobalSearchIndexForTests();

  const filtered = await searchPublicCivicRecords({
    entityTypes: ["public_impact"],
    limit: 20,
    offset: 0,
    view: "flat",
  });

  assert(filtered.total >= 1, "Entity type filter must return results");
  assert(
    filtered.results.every((result) => result.entityType === "public_impact"),
    "Filter must restrict entity types",
  );
  assert(filtered.facets.entityTypes.length > 0, "Facets must include entity types");

  const paged = await searchPublicCivicRecords({ limit: 1, offset: 0, view: "flat" });
  const pagedNext = await searchPublicCivicRecords({ limit: 1, offset: 1, view: "flat" });

  assert(paged.results.length === 1, "Pagination limit must apply");
  assert(paged.total >= 2, "Fixture must have multiple searchable records for pagination test");

  if (pagedNext.results.length === 1) {
    assert(
      paged.results[0]?.entityId !== pagedNext.results[0]?.entityId,
      "Pagination offset must change results",
    );
  }
}

async function verifyPrivacy(): Promise<void> {
  console.log("6. Privacy scan passes");

  const { resetGlobalSearchIndexForTests } =
    await import("../modules/global-search/global-search.index.js");
  const { searchPublicCivicRecords, sanitizeCivicSearchResponse } =
    await import("../modules/global-search/global-search.service.js");

  resetGlobalSearchIndexForTests();
  await seedSearchFixture();

  const response = await searchPublicCivicRecords({ q: "Search", limit: 20, offset: 0, view: "flat" });
  const serialized = JSON.stringify(response).toLowerCase();

  for (const key of PRIVATE_FIELD_KEYS) {
    assert(
      !serialized.includes(`"${key.toLowerCase()}"`),
      `Search response must not expose ${key}`,
    );
  }

  try {
    sanitizeCivicSearchResponse({
      ...response,
      results: [
        {
          ...response.results[0]!,
          explanation: "leak",
          matchedFields: ["participantId"],
        },
      ],
    });
    throw new Error("Expected privacy sanitization failure");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(
      message.includes("must not expose"),
      "Sanitizer must reject private fields in matchedFields",
    );
  }
}

function verifyWebIntegration(): void {
  console.log("7. Web route, header link, and workspace quick action");

  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/src/app/search/page.tsx")),
    "/search page must exist",
  );
  assert(
    readRepoFile("apps/web/src/features/global-search/api.ts").includes("/api/v1/public/search"),
    "Web client must call public search API",
  );
  assert(
    readRepoFile("apps/web/src/features/public-experience/constants.ts").includes(
      'href: "/search"',
    ),
    "Primary navigation must include Search link",
  );
  assert(
    readRepoFile("apps/api/src/modules/workspace-home/workspace-home.service.ts").includes(
      "Search civic records",
    ),
    "Workspace home must include Search civic records quick action",
  );
  assert(
    readRepoFile(
      "apps/web/src/features/global-search/components/GlobalSearchPageContent.tsx",
    ).includes("View Public Page"),
    "Search results must link to public pages",
  );
  assert(
    readRepoFile(
      "apps/web/src/features/global-search/components/GlobalSearchPageContent.tsx",
    ).includes("GeographySearchSelect"),
    "Search page must use shared geography selectors",
  );
  assert(
    readRepoFile("apps/web/src/design-system/components.css").includes(
      "a.hu-button.hu-button--primary",
    ),
    "Design system must protect primary link buttons from color overrides",
  );
  assert(
    readRepoFile("apps/web/public/wdcr-js-map/map-config.js").includes("src='/wdcr-js-map/flags/"),
    "WDCR map config must use absolute flag paths",
  );
}

function verifyDocumentation(): void {
  console.log("8. Documentation");

  const docPath = path.join(REPO_ROOT, "docs/GLOBAL_SEARCH_FOUNDATION.md");
  assert(fs.existsSync(docPath), "GLOBAL_SEARCH_FOUNDATION.md must exist");

  const doc = fs.readFileSync(docPath, "utf-8");
  assert(doc.includes("CivicSearchMetadata"), "Documentation must reference CivicSearchMetadata");
  assert(doc.includes("Ranking v1"), "Documentation must describe ranking v1");
  assert(doc.includes("Meilisearch"), "Documentation must mention future search engines");
}

async function main(): Promise<void> {
  verifyModuleStructure();
  verifyNoAiOrPopularityCode();
  await verifyIndexAndMatching();
  await verifyDraftExclusion();
  await verifyFiltersFacetsPagination();
  await verifyPrivacy();
  verifyWebIntegration();
  verifyDocumentation();

  console.log("\nTASK-057 verify:global-search PASS");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
