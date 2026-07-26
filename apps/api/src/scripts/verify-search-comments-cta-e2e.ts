/**
 * TASK-105A — Search stage accordions, comment reactions, and Home CTA verification.
 * Run: npm run verify:search-comments-cta
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const PASS_COUNT = 3;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifySearchAccordions(): void {
  console.log("1. Search lifecycle accordions");

  const timeline = readRepoFile(
    "apps/web/src/features/global-search/components/InitiativeTimelineGroup.tsx",
  );
  const css = readRepoFile(
    "apps/web/src/features/global-search/components/initiative-timeline-group.css",
  );
  const state = readRepoFile(
    "apps/web/src/features/global-search/initiative-timeline-accordion-state.ts",
  );

  assert(
    !timeline.includes("resolveDefaultExpandedStageId"),
    "Search must not auto-expand stages.",
  );
  assert(state.includes("sessionStorage"), "Accordion state must persist in sessionStorage.");
  assert(state.includes("::"), "Accordion keys must combine initiativeId and stageId.");
  assert(timeline.includes("aria-expanded"), "Stage toggles must expose aria-expanded.");
  assert(timeline.includes("aria-controls"), "Stage toggles must expose aria-controls.");
  assert(timeline.includes("Match found in"), "Matched stages must show collapsed match label.");
  assert(
    timeline.includes("Collapse all"),
    "Multiple expanded stages must offer collapse-all control.",
  );
  assert(
    css.includes("initiative-timeline-group__stage-toggle--expanded"),
    "Expanded stage toggle styling required.",
  );
}

function verifyCommentReactions(): void {
  console.log("2. Comment reaction model, API, and UI");

  const types = readRepoFile("packages/types/src/domain/initiative-comment-reaction.ts");
  const routes = readRepoFile(
    "apps/api/src/modules/initiative-comments/initiative-comment.routes.ts",
  );
  const service = readRepoFile(
    "apps/api/src/modules/initiative-comment-reactions/initiative-comment-reaction.service.ts",
  );
  const indexes = readRepoFile("apps/api/src/infrastructure/mongodb/mongo-indexes.ts");
  const panel = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicDiscussionPanel.tsx",
  );
  const api = readRepoFile("apps/web/src/features/public-initiative-experience/api.ts");

  assert(types.includes("actorUserId"), "Reaction model must include actorUserId.");
  assert(types.includes("commentId"), "Reaction model must include commentId.");
  assert(routes.includes("/comments/:commentId/reactions"), "Reaction route required.");
  assert(routes.includes("requireJwtAuthenticationMiddleware"), "Reactions must require auth.");
  assert(
    service.includes("Comment not available for reactions"),
    "Deleted comments must be protected.",
  );
  assert(
    indexes.includes("initiative_comment_reaction_unique"),
    "Unique commentId + actorUserId index required.",
  );
  assert(panel.includes("/icons/workspace/like.svg"), "Comment UI must render like icon.");
  assert(panel.includes("/icons/workspace/dislike.svg"), "Comment UI must render dislike icon.");
  assert(panel.includes("Like this comment."), "Like control must expose accessible label.");
  assert(panel.includes("Dislike this comment."), "Dislike control must expose accessible label.");
  assert(panel.includes("Log In"), "Guest reaction attempt must offer login.");
  assert(api.includes("updateInitiativeCommentReaction"), "Web client must call reaction API.");
}

function verifyHomeCreateInitiativeCta(): void {
  console.log("3. Home Create Initiative CTA");

  const hero = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeHeroSection.tsx",
  );
  const cta = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeCreateInitiativeCta.tsx",
  );
  const workspace = readRepoFile(
    "apps/web/src/features/initiatives/components/InitiativeWorkspace.tsx",
  );
  const startNew = readRepoFile(
    "apps/web/src/features/initiatives/components/StartNewInitiativeButton.tsx",
  );

  assert(hero.includes("PublicHomeCreateInitiativeCta"), "Hero must use auth-aware CTA component.");
  assert(cta.includes("useClientAuthStatus"), "CTA must read current auth state.");
  assert(
    cta.includes("/register?returnTo="),
    "Guest CTA must route to registration with return URL.",
  );
  assert(
    cta.includes("/workspace/initiatives#create"),
    "Authenticated CTA must route to workspace create.",
  );
  assert(workspace.includes('hash !== "#create"'), "Workspace must react to #create hash.");
  assert(workspace.includes('getElementById("create")'), "Workspace must focus create section.");
  assert(startNew.includes('id="create"'), "Create section must expose stable anchor.");
}

async function verifyCommentReactionRuntime(): Promise<void> {
  console.log("4. Comment reaction runtime");

  process.env.INITIATIVE_COMMENT_PERSISTENCE = "memory";
  process.env.INITIATIVE_COMMENT_REACTION_PERSISTENCE = "memory";

  const { createInitiativeComment, resetInitiativeCommentsForTests } =
    await import("../modules/initiative-comments/initiative-comment.service.js");
  const {
    getInitiativeCommentReactionSummary,
    resetInitiativeCommentReactionsForTests,
    resetInitiativeCommentReactionRateLimitsForTests,
    setInitiativeCommentReaction,
  } =
    await import("../modules/initiative-comment-reactions/initiative-comment-reaction.service.js");

  resetInitiativeCommentsForTests();
  resetInitiativeCommentReactionsForTests();

  const initiativeId = "initiative-bootstrap-001";
  const comment = await createInitiativeComment({
    initiativeId,
    authorUserId: "verify-reaction-author",
    body: "Reaction target comment",
  });

  await setInitiativeCommentReaction({
    initiativeId,
    commentId: comment.commentId,
    actorUserId: "verify-reaction-user",
    reaction: "like",
  });

  let summary = await getInitiativeCommentReactionSummary({
    commentId: comment.commentId,
    actorUserId: "verify-reaction-user",
  });

  assert(summary.likes === 1, "Like must persist once.");
  assert(summary.currentUserReaction === "like", "Current user reaction must be like.");

  await setInitiativeCommentReaction({
    initiativeId,
    commentId: comment.commentId,
    actorUserId: "verify-reaction-user",
    reaction: "like",
  });

  summary = await getInitiativeCommentReactionSummary({
    commentId: comment.commentId,
    actorUserId: "verify-reaction-user",
  });
  assert(summary.likes === 1, "Repeated like must not duplicate count.");

  resetInitiativeCommentReactionRateLimitsForTests();

  await setInitiativeCommentReaction({
    initiativeId,
    commentId: comment.commentId,
    actorUserId: "verify-reaction-user",
    reaction: "dislike",
  });

  summary = await getInitiativeCommentReactionSummary({
    commentId: comment.commentId,
    actorUserId: "verify-reaction-user",
  });
  assert(summary.likes === 0, "Like count must decrease when switching to dislike.");
  assert(summary.dislikes === 1, "Dislike count must reflect switched reaction.");
  assert(
    summary.currentUserReaction === "dislike",
    "Current user reaction must update to dislike.",
  );
}

function verifyPackageScript(): void {
  console.log("5. Verification script registration");

  const pkg = readRepoFile("package.json");
  assert(
    pkg.includes('"verify:search-comments-cta"'),
    "package.json must define verify:search-comments-cta.",
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:search-comments-cta pass ${pass} ===`);
  verifySearchAccordions();
  verifyCommentReactions();
  verifyHomeCreateInitiativeCta();
  await verifyCommentReactionRuntime();
  verifyPackageScript();
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= PASS_COUNT; pass += 1) {
    await runPass(pass);
  }

  console.log("\nverify:search-comments-cta PASSED (3 consecutive passes).");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
