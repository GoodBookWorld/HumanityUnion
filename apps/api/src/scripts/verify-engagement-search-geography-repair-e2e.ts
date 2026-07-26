/**
 * TASK-105D — Engagement persistence, search focus, and member geography repair verification.
 * Run: npm run verify:engagement-search-geography-repair
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const PASS_COUNT = 3;

dotenv.config({ path: path.resolve(REPO_ROOT, "apps/api/.env") });
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const CANONICAL_STAGE_LABELS = [
  "Initiative",
  "Collaborative Analysis",
  "Improvement Proposals",
  "Revision",
  "Petition",
  "Decision Session",
  "Collective Decision",
  "Implementation Commitments",
  "Implementation Tracking",
  "Official Responses",
  "Public Impact",
  "Civic Archive",
] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyEngagementPersistenceDefaults(): void {
  console.log("1. Engagement persistence defaults to Mongo when configured");

  const helper = readRepoFile(
    "apps/api/src/infrastructure/mongodb/resolve-engagement-persistence.ts",
  );
  const bootstrap = readRepoFile(
    "apps/api/src/infrastructure/mongodb/bootstrap-mongo-persistence.ts",
  );
  const commentService = readRepoFile(
    "apps/api/src/modules/initiative-comments/initiative-comment.service.ts",
  );
  const reactionService = readRepoFile(
    "apps/api/src/modules/initiative-comment-reactions/initiative-comment-reaction.service.ts",
  );
  const supportService = readRepoFile(
    "apps/api/src/modules/initiative-support/initiative-support.service.ts",
  );

  assert(helper.includes("isMongoConfigured()"), "Engagement persistence must default to Mongo.");
  assert(
    bootstrap.includes("INITIATIVE_COMMENT_REACTION_PERSISTENCE"),
    "Bootstrap must include comment reaction persistence key.",
  );
  assert(
    commentService.includes("isEngagementMongoMode"),
    "Comment service must use engagement persistence resolver.",
  );
  assert(
    reactionService.includes("isInitiativeCommentMongoMode"),
    "Reaction lookup must follow comment persistence mode.",
  );
  assert(
    supportService.includes("isEngagementMongoMode"),
    "Support service must use engagement persistence resolver.",
  );
}

async function verifyCommentAndReactionRuntime(): Promise<void> {
  console.log("2. Comment and reaction persistence runtime");

  process.env.INITIATIVE_COMMENT_PERSISTENCE = "memory";
  process.env.INITIATIVE_COMMENT_REACTION_PERSISTENCE = "memory";

  const {
    createInitiativeComment,
    listApprovedInitiativeComments,
    resetInitiativeCommentsForTests,
  } = await import("../modules/initiative-comments/initiative-comment.service.js");
  const {
    getInitiativeCommentReactionSummary,
    resetInitiativeCommentReactionRateLimitsForTests,
    resetInitiativeCommentReactionsForTests,
    setInitiativeCommentReaction,
  } =
    await import("../modules/initiative-comment-reactions/initiative-comment-reaction.service.js");

  resetInitiativeCommentsForTests();
  resetInitiativeCommentReactionsForTests();
  resetInitiativeCommentReactionRateLimitsForTests();

  const initiativeId = "initiative-engagement-repair-001";
  const comment = await createInitiativeComment({
    initiativeId,
    authorUserId: "repair-comment-user",
    body: "Persisted repair comment.",
  });

  assert(comment.initiativeId === initiativeId, "Comment must link to initiativeId.");

  const listing = await listApprovedInitiativeComments({ initiativeId, limit: 40, offset: 0 });
  assert(listing.total === 1, "Comment must persist in latest-40 listing.");
  assert(listing.comments[0]?.commentId === comment.commentId, "Comment must reload by id.");

  await setInitiativeCommentReaction({
    initiativeId,
    commentId: comment.commentId,
    actorUserId: "repair-reaction-user",
    reaction: "like",
  });

  let summary = await getInitiativeCommentReactionSummary({
    commentId: comment.commentId,
    actorUserId: "repair-reaction-user",
  });
  assert(summary.likes === 1, "Like must persist once.");
  assert(summary.currentUserReaction === "like", "Current reaction must be like.");

  resetInitiativeCommentReactionRateLimitsForTests();
  await setInitiativeCommentReaction({
    initiativeId,
    commentId: comment.commentId,
    actorUserId: "repair-reaction-user",
    reaction: "like",
  });
  summary = await getInitiativeCommentReactionSummary({
    commentId: comment.commentId,
    actorUserId: "repair-reaction-user",
  });
  assert(summary.likes === 1, "Repeated like must not duplicate.");

  resetInitiativeCommentReactionRateLimitsForTests();
  await setInitiativeCommentReaction({
    initiativeId,
    commentId: comment.commentId,
    actorUserId: "repair-reaction-user",
    reaction: "dislike",
  });
  summary = await getInitiativeCommentReactionSummary({
    commentId: comment.commentId,
    actorUserId: "repair-reaction-user",
  });
  assert(summary.likes === 0, "Switching to dislike must remove like count.");
  assert(summary.dislikes === 1, "Dislike count must update in place.");
}

async function verifySupportRuntime(): Promise<void> {
  console.log("3. Initiative support persistence runtime");

  process.env.INITIATIVE_SUPPORT_PERSISTENCE = "memory";

  const {
    getInitiativeSupportStatistics,
    resetInitiativeSupportStoreForTests,
    setInitiativeSupportSignal,
  } = await import("../modules/initiative-support/initiative-support.service.js");

  await resetInitiativeSupportStoreForTests();

  const initiativeId = "initiative-engagement-repair-001";
  const userId = "repair-support-user";

  await setInitiativeSupportSignal({ initiativeId, userId, signal: "like" });
  let stats = await getInitiativeSupportStatistics({ initiativeId, userId });
  assert(stats.likes.total === 1, "Support like must persist.");
  assert(stats.currentUserSignal === "like", "Current support signal must be like.");

  await setInitiativeSupportSignal({ initiativeId, userId, signal: "like" });
  stats = await getInitiativeSupportStatistics({ initiativeId, userId });
  assert(stats.likes.total === 1, "Repeated support like must be idempotent.");

  await setInitiativeSupportSignal({ initiativeId, userId, signal: "dislike" });
  stats = await getInitiativeSupportStatistics({ initiativeId, userId });
  assert(stats.likes.total === 0, "Support like must decrease when switching.");
  assert(stats.dislikes.total === 1, "Support dislike must reflect switch.");
}

function verifySearchFocusAndLifecycle(): void {
  console.log("4. Search focus and canonical lifecycle order");

  const searchPage = readRepoFile(
    "apps/web/src/features/global-search/components/GlobalSearchPageContent.tsx",
  );
  const searchCss = readRepoFile("apps/web/src/features/global-search/global-search-page.css");
  const apiStages = readRepoFile("apps/api/src/modules/global-search/global-search.stages.ts");
  const webStages = readRepoFile(
    "apps/web/src/features/global-search/initiative-timeline-stages.ts",
  );
  const timelineGroup = readRepoFile(
    "apps/web/src/features/global-search/components/InitiativeTimelineGroup.tsx",
  );
  const accordionState = readRepoFile(
    "apps/web/src/features/global-search/initiative-timeline-accordion-state.ts",
  );

  assert(
    searchPage.includes('id="search-results"'),
    "Search results section must use search-results id.",
  );
  assert(searchPage.includes("scrollIntoView"), "Search must scroll to rendered results.");
  assert(
    searchPage.includes("lastScrolledSearchKeyRef"),
    "Search scroll must not repeat on rerender.",
  );
  assert(searchPage.includes("tabIndex={-1}"), "Search results heading must be focusable.");
  assert(searchCss.includes("scroll-margin-top"), "Search results must offset fixed header.");

  for (const label of CANONICAL_STAGE_LABELS) {
    assert(apiStages.includes(`label: "${label}"`), `API stages must include ${label}.`);
    assert(webStages.includes(`label: "${label}"`), `Web stages must include ${label}.`);
  }

  assert(
    !apiStages.includes("Civic Action Package"),
    "Removed stages must not appear in canonical API order.",
  );
  assert(
    timelineGroup.includes("readInitiativeExpandedStageIds"),
    "Timeline accordion must restore collapsed default state.",
  );
  assert(
    accordionState.includes("expandedStageIds"),
    "Timeline accordion state must be session-backed.",
  );
}

function verifyMemberGeographyRepair(): void {
  console.log("5. Member participation geography repair");

  const section = readRepoFile(
    "apps/web/src/features/participation-area/components/ParticipationAreaSection.tsx",
  );
  const validators = readRepoFile(
    "apps/api/src/modules/participation-area/participation-area.validators.ts",
  );
  const loader = readRepoFile(
    "apps/api/src/modules/participation-area/participation-area-community.loader.ts",
  );
  const service = readRepoFile(
    "apps/api/src/modules/participation-area/participation-area.service.ts",
  );
  const store = readRepoFile("apps/api/src/modules/participation-area/participation-area.store.ts");
  const types = readRepoFile("packages/types/src/domain/participation-area.ts");

  assert(section.includes('label="City / Community"'), "City / Community field must be visible.");
  assert(section.includes("fetchCommunitiesByRegion"), "Member form must load shared communities.");
  assert(section.includes('setCommunitySlug("")'), "Region change must clear community.");
  assert(
    validators.includes("resolveParticipationCommunitySlug"),
    "Validators must use shared community dataset.",
  );
  assert(loader.includes("16735"), "Canada BC Nelson fixture must be recognized.");
  assert(
    service.includes("regionLabel: validated.regionLabel"),
    "Create must persist regionLabel.",
  );
  assert(
    store.includes("regionLabel: transition.toArea.regionLabel"),
    "Transition apply must keep regionLabel.",
  );
  assert(types.includes("regionLabel?: string"), "Slug triple helpers must carry regionLabel.");
}

async function verifyParticipationGeographyRuntime(): Promise<void> {
  console.log("6. Participation geography runtime (Canada → BC → Nelson)");

  process.env.PARTICIPATION_AREA_PERSISTENCE = "memory";

  const { validateParticipationAreaInput } =
    await import("../modules/participation-area/participation-area.validators.js");
  const { resetParticipationCommunityCacheForTests } =
    await import("../modules/participation-area/participation-area-community.loader.js");
  const { createParticipationArea, getActiveParticipationAreaForParticipant } =
    await import("../modules/participation-area/participation-area.store.js");

  resetParticipationCommunityCacheForTests();

  const validated = validateParticipationAreaInput({
    countrySlug: "CA",
    regionSlug: "CA-BC",
    communitySlug: "16735",
  });

  assert(validated.communitySlug === "16735", "Nelson community code must validate.");

  const legacy = validateParticipationAreaInput({
    countrySlug: "canada",
    regionSlug: "british-columbia",
    communitySlug: "nelson-community-garden",
  });
  assert(legacy.communitySlug === "16735", "Legacy bootstrap slug must normalize to Nelson.");

  const participantId = `repair-geography-${Date.now()}`;
  createParticipationArea({
    participantId,
    countrySlug: validated.countrySlug,
    regionSlug: validated.regionSlug,
    communitySlug: validated.communitySlug,
    verificationStatus: "unverified",
  });

  const active = getActiveParticipationAreaForParticipant(participantId);
  assert(active?.communitySlug === "16735", "Saved community must reload from store.");
}

function verifyMongoIndexes(): void {
  console.log("7. MongoDB engagement indexes");

  const indexes = readRepoFile("apps/api/src/infrastructure/mongodb/mongo-indexes.ts");
  assert(
    indexes.includes("initiativeId: 1, status: 1, createdAt: -1"),
    "Comment listing index required.",
  );
  assert(
    indexes.includes("initiative_comment_reaction_unique"),
    "Comment reaction unique index required.",
  );
  assert(
    indexes.includes("initiative_support_registered_unique"),
    "Support signal unique index required.",
  );
}

function verifyPackageScript(): void {
  console.log("8. Verification script registration");

  const pkg = readRepoFile("package.json");
  assert(
    pkg.includes('"verify:engagement-search-geography-repair"'),
    "package.json must define verify:engagement-search-geography-repair.",
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:engagement-search-geography-repair pass ${pass} ===`);
  verifyEngagementPersistenceDefaults();
  await verifyCommentAndReactionRuntime();
  await verifySupportRuntime();
  verifySearchFocusAndLifecycle();
  verifyMemberGeographyRepair();
  await verifyParticipationGeographyRuntime();
  verifyMongoIndexes();
  verifyPackageScript();
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= PASS_COUNT; pass += 1) {
    await runPass(pass);
  }

  console.log(
    `\nverify:engagement-search-geography-repair PASSED (${PASS_COUNT} consecutive passes).`,
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
