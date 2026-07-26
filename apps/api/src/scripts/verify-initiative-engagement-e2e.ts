/**
 * TASK-103C — Initiative mobile layout, comments, and support persistence verification.
 * Run: npm run verify:initiative-engagement
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

function verifyMobileLayoutCss(): void {
  console.log("1. Mobile layout containment");

  const css = readRepoFile(
    "apps/web/src/features/public-initiative-experience/public-initiative-experience.css",
  );

  assert(css.includes("overflow-x: clip"), "Page root must clip horizontal overflow.");
  assert(
    css.includes("grid-auto-flow: column"),
    "Lifecycle must use horizontal scroll below 768px.",
  );
  assert(css.includes("@media (max-width: 767px)"), "768px breakpoint required.");
  assert(css.includes("@media (max-width: 499px)"), "500px mobile breakpoint required.");
  assert(css.includes("var(--hu-font-size-base"), "Mobile body text must stay readable.");
  assert(!css.includes("transform: scale"), "Layout must not use CSS scale hacks.");
}

function verifyFeedbackComponent(): void {
  console.log("2. Neutral/warning feedback styling");

  const component = readRepoFile("apps/web/src/design-system/components/HuFeedbackMessage.tsx");
  const styles = readRepoFile("apps/web/src/design-system/components/hu-feedback-message.css");

  assert(component.includes("role={role}"), "Feedback must expose status/alert roles.");
  assert(styles.includes("#df9815"), "Warning/neutral feedback must use Humanity Union amber.");
  assert(styles.includes(".hu-feedback--warning"), "Warning variant required.");
}

function verifyCommentModuleStructure(): void {
  console.log("3. Comment module structure");

  const required = [
    "apps/api/src/modules/initiative-comments/initiative-comment.service.ts",
    "apps/api/src/modules/initiative-comments/initiative-comment.routes.ts",
    "apps/api/src/modules/initiative-comments/initiative-comment.mongo.repository.ts",
    "packages/types/src/domain/initiative-comment.ts",
  ];

  for (const file of required) {
    assert(fs.existsSync(path.join(REPO_ROOT, file)), `Missing file: ${file}`);
  }

  const panel = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicDiscussionPanel.tsx",
  );
  assert(panel.includes("postInitiativeComment"), "Discussion panel must post to API.");
  assert(!panel.includes("not yet available"), "Placeholder comment message must be removed.");
  assert(panel.includes("HuFeedbackMessage"), "Discussion must use shared feedback component.");
}

function verifySupportPersistenceStructure(): void {
  console.log("4. Support signal persistence structure");

  const mongoRepo = readRepoFile(
    "apps/api/src/modules/initiative-support/initiative-support.mongo.repository.ts",
  );
  const indexes = readRepoFile("apps/api/src/infrastructure/mongodb/mongo-indexes.ts");

  assert(
    mongoRepo.includes("upsertRegisteredSupportRecordMongo"),
    "Registered support upsert required.",
  );
  assert(mongoRepo.includes("upsertVisitorSupportRecordMongo"), "Visitor support upsert required.");
  assert(
    indexes.includes("initiative_support_registered_unique"),
    "Unique registered signal index required.",
  );
}

async function verifyCommentRuntime(): Promise<void> {
  console.log("5. Comment persistence runtime");

  process.env.INITIATIVE_COMMENT_PERSISTENCE = "memory";

  const {
    createInitiativeComment,
    listApprovedInitiativeComments,
    resetInitiativeCommentsForTests,
  } = await import("../modules/initiative-comments/initiative-comment.service.js");

  resetInitiativeCommentsForTests();

  const initiativeId = "initiative-bootstrap-001";
  const comment = await createInitiativeComment({
    initiativeId,
    authorUserId: "verify-comment-user",
    body: "  Persisted initiative comment.  ",
  });

  assert(comment.initiativeId === initiativeId, "Comment must link to initiativeId.");
  assert(
    comment.body === "Persisted initiative comment.",
    "Comment body must be trimmed and sanitized.",
  );

  const listing = await listApprovedInitiativeComments({ initiativeId, limit: 40, offset: 0 });
  assert(listing.total >= 1, "Comment must persist in listing.");
  assert(listing.comments[0]?.commentId === comment.commentId, "Latest comment must be returned.");

  await assertRejects(
    () =>
      createInitiativeComment({
        initiativeId,
        authorUserId: "verify-comment-user-script",
        body: "<script>alert(1)</script>",
      }),
    /invalid characters/i,
  );

  await createInitiativeComment({
    initiativeId,
    authorUserId: "verify-comment-user-2",
    body: "First post",
  });

  await assertRejects(
    () =>
      createInitiativeComment({
        initiativeId,
        authorUserId: "verify-comment-user-2",
        body: "Rapid duplicate attempt",
      }),
    /wait/i,
  );
}

async function verifySupportRuntime(): Promise<void> {
  console.log("6. Support signal persistence runtime");

  process.env.INITIATIVE_SUPPORT_PERSISTENCE = "memory";

  const {
    getInitiativeSupportStatistics,
    resetInitiativeSupportStoreForTests,
    setInitiativeSupportSignal,
  } = await import("../modules/initiative-support/initiative-support.service.js");

  await resetInitiativeSupportStoreForTests();

  const initiativeId = "initiative-bootstrap-001";
  const userId = "verify-support-user";

  await setInitiativeSupportSignal({ initiativeId, userId, signal: "like" });
  let stats = await getInitiativeSupportStatistics({ initiativeId, userId });
  assert(stats.likes.total === 1, "Like must persist once.");
  assert(stats.currentUserSignal === "like", "Current user signal must be like.");

  await setInitiativeSupportSignal({ initiativeId, userId, signal: "like" });
  stats = await getInitiativeSupportStatistics({ initiativeId, userId });
  assert(stats.likes.total === 1, "Repeated like must not increment count.");

  await setInitiativeSupportSignal({ initiativeId, userId, signal: "dislike" });
  stats = await getInitiativeSupportStatistics({ initiativeId, userId });
  assert(stats.likes.total === 0, "Like count must decrease when switching to dislike.");
  assert(stats.dislikes.total === 1, "Dislike count must reflect switched signal.");
  assert(stats.currentUserSignal === "dislike", "Current user signal must update to dislike.");
}

async function assertRejects(fn: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await fn();
    throw new Error("Expected rejection.");
  } catch (error) {
    if (error instanceof Error && error.message === "Expected rejection.") {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    assert(pattern.test(message), `Expected rejection matching ${pattern}, got: ${message}`);
  }
}

function verifyPackageScript(): void {
  console.log("7. Verification script registration");

  const pkg = readRepoFile("package.json");
  assert(
    pkg.includes('"verify:initiative-engagement"'),
    "package.json must define verify:initiative-engagement.",
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:initiative-engagement pass ${pass} ===`);
  verifyMobileLayoutCss();
  verifyFeedbackComponent();
  verifyCommentModuleStructure();
  verifySupportPersistenceStructure();
  await verifyCommentRuntime();
  await verifySupportRuntime();
  verifyPackageScript();
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= PASS_COUNT; pass += 1) {
    await runPass(pass);
  }

  console.log("\nverify:initiative-engagement PASSED (3 consecutive passes).");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
