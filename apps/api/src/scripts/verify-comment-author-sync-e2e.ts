/**
 * TASK-105E — Comment author name synchronization verification.
 * Run: npm run verify:comment-author-sync
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

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyProjectionStructure(): void {
  console.log("1. Shared public comment author projection");

  const projection = readRepoFile(
    "apps/api/src/modules/initiative-comments/public-comment-author.projection.ts",
  );
  const service = readRepoFile(
    "apps/api/src/modules/initiative-comments/initiative-comment.service.ts",
  );
  const routes = readRepoFile(
    "apps/api/src/modules/initiative-comments/initiative-comment.routes.ts",
  );
  const types = readRepoFile("packages/types/src/domain/initiative-comment.ts");
  const panel = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicDiscussionPanel.tsx",
  );

  assert(types.includes("PublicCommentAuthor"), "Types must define PublicCommentAuthor.");
  assert(
    projection.includes("resolvePublicCommentAuthorsForComments"),
    "Projection must batch-resolve comment authors.",
  );
  assert(
    service.includes("resolvePublicCommentAuthorsForComments"),
    "Comment mapping must use shared author projection.",
  );
  assert(
    service.includes("resolveCommentAuthorNameSnapshot"),
    "Create path must derive snapshot server-side.",
  );
  assert(
    !routes.includes("resolveAuthorDisplayNameFromAuth"),
    "Routes must not accept client author names.",
  );
  assert(
    routes.includes("mapCommentsToPublicDiscussionComments([comment]"),
    "Create response must project author at read time.",
  );
  assert(
    panel.includes("comment.author.displayName"),
    "Discussion UI must render projected author display name.",
  );
  assert(
    readRepoFile("apps/api/src/modules/member-profile/member-profile.repository.ts").includes(
      "findMemberProfilesByUserIds",
    ),
    "Member profile repository must support batch lookup.",
  );
  assert(
    projection.includes("findMemberProfilesByUserIds(uniqueUserIds)"),
    "Author projection must batch lookup profiles to avoid N+1 queries.",
  );
}

async function verifyAuthorNameSynchronizationRuntime(): Promise<void> {
  console.log("2. Comment author name synchronization runtime");

  process.env.INITIATIVE_COMMENT_PERSISTENCE = "memory";

  const {
    createInitiativeComment,
    mapCommentsToPublicDiscussionComments,
    resetInitiativeCommentsForTests,
  } = await import("../modules/initiative-comments/initiative-comment.service.js");
  const { resetInitiativeCommentRateLimitsMemoryForTests } =
    await import("../modules/initiative-comments/initiative-comment.memory.store.js");
  const { updateMemberProfileForUser } =
    await import("../modules/member-profile/member-profile.service.js");
  const { registerAndConfirmAuthUser } = await import("../modules/auth/auth.service.js");
  const { findRawAuthUserByEmail, deleteAuthUsersByEmailPrefix } =
    await import("../modules/auth/auth-user.repository.js");
  const { deleteMemberProfilesByUserIdPrefix } =
    await import("../modules/member-profile/member-profile.repository.js");

  const prefix = `comment-author-sync-${Date.now()}`;
  const email = `${prefix}@example.com`;

  resetInitiativeCommentsForTests();

  const session = await registerAndConfirmAuthUser({
    email,
    password: "verify-password-123",
    displayName: "Display Name A",
  });

  const authUser = await findRawAuthUserByEmail(email);
  assert(authUser !== null, "Auth user must exist.");

  const userId = authUser!.userId;
  const initiativeId = "initiative-comment-author-sync-001";

  const comment = await createInitiativeComment({
    initiativeId,
    authorUserId: userId,
    body: "Comment with synchronized author name.",
  });

  assert(comment.authorUserId === userId, "Comment ownership must remain authorUserId.");

  let projected = await mapCommentsToPublicDiscussionComments([comment], userId);
  assert(
    projected[0]?.author.displayName === "Display Name A",
    "Initial comment must show Name A.",
  );
  assert(
    projected[0]?.authorDisplayName === "Display Name A",
    "Compatibility authorDisplayName must mirror author.displayName.",
  );

  await updateMemberProfileForUser(userId, { displayName: "Display Name B" });

  projected = await mapCommentsToPublicDiscussionComments([comment], userId);
  assert(
    projected[0]?.author.displayName === "Display Name B",
    "Existing comment must show updated Display Name B after profile change.",
  );

  resetInitiativeCommentRateLimitsMemoryForTests();
  const secondComment = await createInitiativeComment({
    initiativeId,
    authorUserId: userId,
    body: "Second comment after rename.",
  });

  projected = await mapCommentsToPublicDiscussionComments([secondComment], userId);
  assert(projected[0]?.author.displayName === "Display Name B", "New comment must show Name B.");

  const otherSession = await registerAndConfirmAuthUser({
    email: `${prefix}-other@example.com`,
    password: "verify-password-123",
    displayName: "Other Participant",
  });
  const otherAuthUser = await findRawAuthUserByEmail(`${prefix}-other@example.com`);
  assert(otherAuthUser !== null, "Other auth user must exist.");

  resetInitiativeCommentRateLimitsMemoryForTests();
  const otherComment = await createInitiativeComment({
    initiativeId,
    authorUserId: otherAuthUser!.userId,
    body: "Other participant comment.",
  });

  const both = await mapCommentsToPublicDiscussionComments([comment, otherComment], userId);
  assert(
    both.find((entry) => entry.commentId === comment.commentId)?.author.displayName ===
      "Display Name B",
    "Renamed author comment must stay synchronized.",
  );
  assert(
    both.find((entry) => entry.commentId === otherComment.commentId)?.author.displayName ===
      "Other Participant",
    "Other participant comment must remain unaffected.",
  );

  const snapshotOnly = await mapCommentsToPublicDiscussionComments([
    {
      ...comment,
      authorUserId: "missing-profile-user",
      authorDisplayName: "Legacy Snapshot Name",
    },
  ]);
  assert(
    snapshotOnly[0]?.author.displayName === "Legacy Snapshot Name",
    "Snapshot fallback must be used when profile is unavailable.",
  );

  for (const entry of snapshotOnly) {
    const serialized = JSON.stringify(entry);
    assert(!serialized.includes("missing-profile-user"), "Public comment must not expose userId.");
    assert(!serialized.includes("@example.com"), "Public comment must not expose email.");
  }

  await updateMemberProfileForUser(userId, {
    avatarUrl: "https://cdn.example.com/avatar-sync.webp",
  });

  projected = await mapCommentsToPublicDiscussionComments([comment], userId);
  assert(
    projected[0]?.author.avatarUrl === "https://cdn.example.com/avatar-sync.webp",
    "Comment author avatar must reflect current profile avatar.",
  );

  await deleteMemberProfilesByUserIdPrefix(prefix);
  await deleteAuthUsersByEmailPrefix(prefix);
  void session;
  void otherSession;
}

function verifyPackageScript(): void {
  console.log("3. Verification script registration");

  const pkg = readRepoFile("package.json");
  assert(
    pkg.includes('"verify:comment-author-sync"'),
    "package.json must define verify:comment-author-sync.",
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:comment-author-sync pass ${pass} ===`);
  verifyProjectionStructure();
  await verifyAuthorNameSynchronizationRuntime();
  verifyPackageScript();
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= PASS_COUNT; pass += 1) {
    await runPass(pass);
  }

  console.log(`\nverify:comment-author-sync PASSED (${PASS_COUNT} consecutive passes).`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
