/**
 * TASK-024 — Civic Compatibility Review end-to-end verification.
 * Run: npm run verify:civic-compatibility-review
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const participantA: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const participantB: RequestIdentity = {
  participantId: "member-participant-b-001",
  displayName: "Analyst B",
};

const PRIVATE_FIELD_KEYS = [
  "authorId",
  "stewardId",
  "memberId",
  "email",
  "participantId",
  "requestedByStewardId",
  "providerId",
];

const AI_SPECIFIC_TERMS = ["llmPrompt", "modelOutput", "rawAiResponse", "tokenUsage", "embedding"];

const CENSORSHIP_TERMS = [
  "blockPublish",
  "rejectInitiative",
  "autoArchive",
  "censor",
  "moderationBlock",
];

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(fn: () => unknown, message: string): void {
  try {
    fn();
    throw new Error(`Expected failure: ${message}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Expected failure:")) {
      throw error;
    }
  }
}

function assertNoPrivateFields(value: unknown, label: string): void {
  const serialized = JSON.stringify(value);

  for (const key of PRIVATE_FIELD_KEYS) {
    assert(!serialized.includes(`"${key}"`), `${label} leaked private field: ${key}`);
  }
}

function assertReviewReloadsFromFile(
  reviewId: string,
  expectedReviewVersion: number,
  expectedInitiativeVersion: number,
  filePath: string,
): void {
  const reloadScriptPath = path.resolve(
    path.dirname(SCRIPT_PATH),
    "verify-civic-compatibility-review-store-reload.ts",
  );
  const result = spawnSync(
    "npx",
    [
      "tsx",
      reloadScriptPath,
      reviewId,
      String(expectedReviewVersion),
      String(expectedInitiativeVersion),
    ],
    {
      cwd: path.resolve(path.dirname(SCRIPT_PATH), "../.."),
      env: {
        ...process.env,
        CIVIC_COMPATIBILITY_REVIEW_PERSISTENCE: "file",
        CIVIC_COMPATIBILITY_REVIEW_PERSISTENCE_PATH: filePath,
      },
      stdio: "pipe",
      encoding: "utf-8",
    },
  );

  assert(result.status === 0, "Review should reload after simulated API restart");
}

function verifyPublicExperienceUnchanged(): void {
  const publicExperienceScriptPath = path.resolve(
    path.dirname(SCRIPT_PATH),
    "../../../web/src/scripts/verify-decision-session-public-experience.ts",
  );
  const result = spawnSync("npx", ["tsx", publicExperienceScriptPath], {
    cwd: path.resolve(path.dirname(SCRIPT_PATH), "../../.."),
    stdio: "inherit",
    encoding: "utf-8",
  });

  assert(result.status === 0, "Public experience providers should remain unchanged");
}

async function runMainVerification(): Promise<void> {
  const { createInitiativeDraft, publishInitiative, republishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { canExposePublicInitiativeProjection } =
    await import("../modules/initiatives/public-initiative.projection.js");
  const {
    runInitiativeCompatibilityReview,
    listInitiativeCompatibilityReviews,
    compareInitiativeCompatibilityReviews,
  } = await import("../modules/civic-compatibility-review/civic-compatibility-review.service.js");
  const {
    computeCivicCompatibilityReviewMetrics,
    getLatestPublicCivicCompatibilityReview,
    getPublicCivicCompatibilityReviewById,
    listPublicCivicCompatibilityReviews,
  } =
    await import("../modules/civic-compatibility-review/public-civic-compatibility-review.projection.js");
  const { getFrameworkEntry } =
    await import("../modules/civic-compatibility-review/reference-framework/civic-reference-framework.js");
  const { resolveCivicCompatibilityReviewProvider } =
    await import("../modules/civic-compatibility-review/review-engine/civic-compatibility-review-provider.js");
  const { createInitiativeRevisionDraft, saveInitiativeRevisionDraft, publishInitiativeRevision } =
    await import("../modules/initiative-version-revision/initiative-version-revision.service.js");
  const { getInitiativeById } = await import("../modules/initiatives/initiative.store.js");
  const initiativeServiceSource = fs.readFileSync(
    path.resolve(path.dirname(SCRIPT_PATH), "../modules/initiatives/initiative.service.ts"),
    "utf-8",
  );
  const reviewServiceSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/civic-compatibility-review/civic-compatibility-review.service.ts",
    ),
    "utf-8",
  );
  const domainTypeSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../../../../packages/types/src/domain/civic-compatibility-review.ts",
    ),
    "utf-8",
  );

  console.log("1. Steward-only review generation");

  const draft = createInitiativeDraft(participantA, {
    title: "E2E Civic Compatibility Initiative",
    description: "Short text.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });

  assertThrows(
    () => runInitiativeCompatibilityReview(participantA, draft.initiativeId),
    "Draft initiative cannot receive review",
  );

  const projected = publishInitiative(participantA, draft.initiativeId);
  assert(projected.lifecyclePhase === "projected", "Initiative should publish without review");

  const firstReview = runInitiativeCompatibilityReview(participantA, projected.initiativeId);
  assert(firstReview.initiativeVersion === 1, "Review should attach to version 1");
  assert(firstReview.reviewVersion === 1, "First review version should be 1");

  const rerunReview = runInitiativeCompatibilityReview(participantA, projected.initiativeId);
  assert(rerunReview.reviewVersion === 2, "Re-run on same version increments reviewVersion");
  assert(rerunReview.initiativeVersion === 1, "Re-run remains on version 1 until revision publish");

  assertThrows(
    () => runInitiativeCompatibilityReview(participantB, projected.initiativeId),
    "Non-steward cannot run review",
  );

  assertThrows(
    () => listInitiativeCompatibilityReviews(participantB, projected.initiativeId),
    "Non-steward cannot list steward reviews",
  );

  console.log("2. Advisory behavior — publication never blocked");

  const exclusionDraft = createInitiativeDraft(participantA, {
    title: "E2E Exclusion Review Initiative",
    description: "This initiative will exclude certain groups from participation.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const exclusionProjected = publishInitiative(participantA, exclusionDraft.initiativeId);
  assert(
    exclusionProjected.lifecyclePhase === "projected",
    "Publication must succeed regardless of future review concerns",
  );

  const concernReview = runInitiativeCompatibilityReview(
    participantA,
    exclusionProjected.initiativeId,
  );
  assert(
    concernReview.compatibilityStatus === "manual_review_recommended",
    "Exclusionary language should trigger manual review recommendation",
  );

  const afterReviewInitiative = getInitiativeById(exclusionProjected.initiativeId);
  assert(
    afterReviewInitiative?.lifecyclePhase === "projected",
    "Review must not mutate initiative lifecycle",
  );
  assert(
    canExposePublicInitiativeProjection(afterReviewInitiative!),
    "Review must not change public projection eligibility",
  );

  const republished = republishInitiative(participantA, projected.initiativeId, {
    description:
      "Expanded community garden initiative with transparent voluntary participation and evidence-based improvements.",
  });
  assert(republished.lifecyclePhase === "projected", "Republish remains allowed after review");

  console.log("3. Revision awareness");

  createInitiativeRevisionDraft(participantA, projected.initiativeId);
  saveInitiativeRevisionDraft(participantA, projected.initiativeId, {
    title: "E2E Civic Compatibility Initiative (Revised)",
    description:
      "Revised community garden initiative with transparent voluntary participation and evidence-based improvements.",
    revisionSummary: "Expanded description and voluntary participation framing.",
  });
  publishInitiativeRevision(participantA, projected.initiativeId);

  const versionTwoReview = runInitiativeCompatibilityReview(participantA, projected.initiativeId);
  assert(versionTwoReview.initiativeVersion === 2, "New review attaches to version 2");
  assert(versionTwoReview.reviewVersion === 1, "Review version resets for new initiative version");

  const stewardReviews = listInitiativeCompatibilityReviews(participantA, projected.initiativeId);
  const versionOneReviews = stewardReviews.filter((review) => review.initiativeVersion === 1);
  const versionTwoReviews = stewardReviews.filter((review) => review.initiativeVersion === 2);
  assert(versionOneReviews.length >= 2, "Older version 1 reviews remain readable");
  assert(versionTwoReviews.length >= 1, "Version 2 review exists");

  const comparison = compareInitiativeCompatibilityReviews(
    participantA,
    versionOneReviews[0]!.reviewId,
    versionTwoReview.reviewId,
  );
  assert(comparison.initiativeVersionChanged, "Comparison detects initiative version change");

  console.log("4. Provider boundary");

  const provider = resolveCivicCompatibilityReviewProvider();
  assert(provider.providerId === "rule-based-v1", "Default provider should be rule-based");
  assert(typeof provider.generateReview === "function", "Provider must implement generateReview");

  for (const term of AI_SPECIFIC_TERMS) {
    assert(
      !domainTypeSource.includes(term),
      `Domain model must not include AI-specific field ${term}`,
    );
  }

  console.log("5. Reference framework");

  assert(
    getFrameworkEntry("hu-constitution-article-i") !== undefined,
    "Constitution reference resolves",
  );
  assert(getFrameworkEntry("hu-principle-evidence") !== undefined, "Principles reference resolves");
  assert(getFrameworkEntry("udhr-article-2") !== undefined, "UDHR reference resolves");

  for (const concern of concernReview.detectedConcerns) {
    assert(concern.explanation.trim().length > 0, "Every concern must include explanation");
    assert(concern.summary.trim().length > 0, "Every concern must include summary");
  }

  for (const recommendation of concernReview.recommendations) {
    assert(
      recommendation.explanation.trim().length > 0,
      "Every recommendation must include explanation",
    );
    assert(
      recommendation.suggestedImprovement.trim().length > 0,
      "Every recommendation must include suggested improvement",
    );
  }

  assert(
    concernReview.referencedHumanRightsArticles.some((entry) =>
      entry.referenceCode.startsWith("UDHR"),
    ),
    "Human rights references should appear in exclusion review",
  );
  assert(
    firstReview.referencedPrinciples.some((entry) => entry.sourceLabel.includes("Humanity Union")),
    "Humanity Union references should appear in review output",
  );

  console.log("6. Public integration and privacy");

  const publicLatest = getLatestPublicCivicCompatibilityReview(projected.initiativeId);
  assert(publicLatest !== null, "Public initiative should expose latest review summary");
  if (!publicLatest) {
    throw new Error("Public initiative should expose latest review summary");
  }
  assert(publicLatest.compatibilitySummary.length > 0, "Public review summary required");
  assertNoPrivateFields(publicLatest, "Public latest review");

  const publicDetail = getPublicCivicCompatibilityReviewById(versionTwoReview.reviewId);
  assert(publicDetail !== null, "Public review detail endpoint should resolve");
  assertNoPrivateFields(publicDetail, "Public review detail");

  const publicList = listPublicCivicCompatibilityReviews(projected.initiativeId);
  assert(publicList.length >= 3, "Public list should include historical reviews");
  assertNoPrivateFields(publicList, "Public review list");

  if (publicLatest.reviewAvailableNotice) {
    assert(
      publicLatest.reviewAvailableNotice.includes("Civic Compatibility Review Available"),
      "Non-perfect status should expose advisory notice only",
    );
  }

  console.log("7. Metrics readiness");

  const metrics = computeCivicCompatibilityReviewMetrics(projected.initiativeId);
  assert(metrics.reviewCount >= 3, "reviewCount should include all stored reviews");
  assert(metrics.averageCompatibilityScore > 0, "averageCompatibilityScore should be computed");
  assert(
    metrics.recommendationAcceptanceRate === null,
    "recommendationAcceptanceRate remains null",
  );
  assert(metrics.potentialConflictRate >= 0, "potentialConflictRate should be computed");
  assert(
    metrics.manualReviewRecommendationRate >= 0,
    "manualReviewRecommendationRate should be computed",
  );

  console.log("8. No censorship");

  for (const term of CENSORSHIP_TERMS) {
    assert(!initiativeServiceSource.includes(term), `Initiative service must not include ${term}`);
    assert(!reviewServiceSource.includes(term), `Review service must not include ${term}`);
  }

  assert(
    !initiativeServiceSource.includes("civic-compatibility-review"),
    "Publish flow must not call civic compatibility review",
  );

  console.log("9. Public Experience stability");

  verifyPublicExperienceUnchanged();
}

async function runPersistenceVerification(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hu-civic-review-e2e-"));
  const persistencePath = path.join(tempDir, "civic-compatibility-reviews.json");

  process.env.CIVIC_COMPATIBILITY_REVIEW_PERSISTENCE = "file";
  process.env.CIVIC_COMPATIBILITY_REVIEW_PERSISTENCE_PATH = persistencePath;

  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { runInitiativeCompatibilityReview } =
    await import("../modules/civic-compatibility-review/civic-compatibility-review.service.js");
  const { createFileCivicCompatibilityReviewPersistenceAdapter } =
    await import("../modules/civic-compatibility-review/persistence/civic-compatibility-review-file.persistence.js");
  const { listReviewsByInitiative } =
    await import("../modules/civic-compatibility-review/civic-compatibility-review.store.js");

  const draft = createInitiativeDraft(participantA, {
    title: "Persistence Civic Review Initiative",
    description: "Short description for persistence verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  publishInitiative(participantA, draft.initiativeId);

  const first = runInitiativeCompatibilityReview(participantA, draft.initiativeId);
  const second = runInitiativeCompatibilityReview(participantA, draft.initiativeId);

  const adapter = createFileCivicCompatibilityReviewPersistenceAdapter();
  const snapshot = adapter.load();
  assert(snapshot.reviews[first.reviewId] !== undefined, "First review should persist");
  assert(snapshot.reviews[second.reviewId] !== undefined, "Second review should persist");
  assert(
    snapshot.reviews[second.reviewId]?.reviewVersion === 2,
    "reviewVersion ordering should persist",
  );

  assertReviewReloadsFromFile(first.reviewId, 1, 1, persistencePath);
  assertReviewReloadsFromFile(second.reviewId, 2, 1, persistencePath);

  const ordered = listReviewsByInitiative(draft.initiativeId);
  assert(ordered.length === 2, "Both persisted reviews should be readable");
  assert(
    ordered.some((review) => review.reviewVersion === 1),
    "reviewVersion 1 should remain readable after restart",
  );
  assert(
    ordered.some((review) => review.reviewVersion === 2),
    "reviewVersion 2 should remain readable after restart",
  );

  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log("10. Persistence — reviews and reviewVersion ordering survive restart");
}

async function main(): Promise<void> {
  if (process.env.VERIFY_CIVIC_COMPATIBILITY_REVIEW_PERSISTENCE === "1") {
    await runPersistenceVerification();
    console.log("Civic Compatibility Review persistence checks passed.");
    return;
  }

  await runMainVerification();

  const persistenceResult = spawnSync("npx", ["tsx", SCRIPT_PATH], {
    env: {
      ...process.env,
      VERIFY_CIVIC_COMPATIBILITY_REVIEW_PERSISTENCE: "1",
      INITIATIVE_PERSISTENCE: "memory",
      INITIATIVE_ANALYSIS_PERSISTENCE: "memory",
      INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE: "memory",
      INITIATIVE_VERSION_REVISION_PERSISTENCE: "memory",
      CIVIC_COMPATIBILITY_REVIEW_PERSISTENCE: "memory",
    },
    stdio: "inherit",
  });

  assert(persistenceResult.status === 0, "Persistence verification subprocess failed");

  console.log("All Civic Compatibility Review E2E checks passed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`E2E verification FAILED: ${message}`);
  process.exit(1);
});
