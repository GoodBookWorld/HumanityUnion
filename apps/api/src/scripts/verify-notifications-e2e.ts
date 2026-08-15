/**
 * TASK-058 — Notification Delivery Engine verification.
 * Run: npm run verify:notifications
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const NOTIFICATIONS_DIR = path.join(REPO_ROOT, "apps/api/src/modules/notifications");

const FORBIDDEN_TERMS = [
  "streak",
  "badge",
  "you missed",
  "engagement",
  "popularity",
  "like",
  "follow",
  "reaction",
  "push notification",
  "sendgrid",
  "twilio",
  "websocket",
] as const;

const PRIVATE_FIELD_KEYS = [
  "recipientUserId",
  "recipientProfileId",
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

const HOOK_FILES = [
  "apps/api/src/modules/initiatives/initiative.service.ts",
  "apps/api/src/modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.ts",
  "apps/api/src/modules/initiative-improvement-proposal/initiative-improvement-proposal.service.ts",
  "apps/api/src/modules/initiative-version-revision/initiative-version-revision.service.ts",
  "apps/api/src/modules/initiative-collective-decision/initiative-collective-decision.service.ts",
  "apps/api/src/modules/civic-action-package/civic-action-package.service.ts",
  "apps/api/src/modules/official-response/official-response.service.ts",
  "apps/api/src/modules/civic-accountability/civic-accountability.service.ts",
  "apps/api/src/modules/initiative-implementation-commitment/initiative-implementation-commitment.service.ts",
  "apps/api/src/modules/initiative-implementation-tracking/initiative-implementation-tracking.service.ts",
  "apps/api/src/modules/initiative-public-impact/initiative-public-impact.service.ts",
  "apps/api/src/modules/public-civic-archive/public-civic-archive.service.ts",
] as const;

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const analyst: RequestIdentity = {
  participantId: "member-notification-analyst-001",
  displayName: "Analyst B",
};

const STEWARD_USER_ID = "notification-user-steward-001";
const ANALYST_USER_ID = "notification-user-analyst-001";

function assert(condition: boolean, message: string): asserts condition {
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
  console.log("1. Notification module structure");

  const requiredFiles = [
    "notification.types.ts",
    "notification.service.ts",
    "notification.templates.ts",
    "notification.recipients.ts",
    "notification.store.ts",
    "notification.routes.ts",
    "persistence/notification-memory.persistence.ts",
    "persistence/notification-mongo.persistence.ts",
    "persistence/resolve-notification-persistence.ts",
    "index.ts",
  ];

  for (const file of requiredFiles) {
    assert(fs.existsSync(path.join(NOTIFICATIONS_DIR, file)), `Missing notification file: ${file}`);
  }

  assert(
    readRepoFile("apps/api/src/app.ts").includes('"/api/v1/notifications"'),
    "App must mount notification router",
  );
  assert(
    readRepoFile("packages/types/src/domain/member-notification.ts").includes("MemberNotification"),
    "Domain must define MemberNotification",
  );
  assert(
    readRepoFile("docs/NOTIFICATION_DELIVERY_ENGINE.md").includes("Notification Delivery Engine"),
    "Documentation must exist",
  );
}

function verifyNoPublicRoutesOrGamification(): void {
  console.log("2. No public routes or gamification language");

  const app = readRepoFile("apps/api/src/app.ts");
  assert(!app.includes("/api/v1/public/notifications"), "Notifications must not be public");

  const routes = readRepoFile("apps/api/src/modules/notifications/notification.routes.ts");
  assert(routes.includes('"/mine"'), "Notification routes must expose /mine");
  assert(
    routes.includes("requireAuthenticationMiddleware") ||
      routes.includes("requireJwtAuthenticationMiddleware"),
    "Notifications must require auth",
  );

  const files = listFilesRecursive(NOTIFICATIONS_DIR).filter(
    (file) => file.endsWith(".ts") && !file.endsWith("notification.types.ts"),
  );

  for (const file of files) {
    const source = fs.readFileSync(file, "utf-8").toLowerCase();

    for (const term of FORBIDDEN_TERMS) {
      const normalizedSource =
        term === "badge" ? source.replaceAll("member_badge", "member_item") : source;

      assert(
        !normalizedSource.includes(term.toLowerCase()),
        `${path.relative(REPO_ROOT, file)} must not include ${term}`,
      );
    }
  }
}

function verifyEventHooks(): void {
  console.log("3. Civic event hooks");

  for (const relativePath of HOOK_FILES) {
    const source = readRepoFile(relativePath);
    assert(
      source.includes("emitCivicNotificationEvent"),
      `${relativePath} must emit civic notification events`,
    );
  }
}

function verifyWebIntegration(): void {
  console.log("4. Web notification center and header integration");

  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/src/app/notifications/page.tsx")),
    "Web must expose /notifications page",
  );
  assert(
    readRepoFile("apps/web/src/design-system/components/AuthenticatedHeaderTools.tsx").includes(
      "humanity-header__notification-badge",
    ),
    "Header must include unread badge styles",
  );
  assert(
    readRepoFile("apps/web/src/design-system/components/AuthenticatedHeaderTools.tsx").includes(
      "humanity-header__notification-status-dot",
    ),
    "Header must include zero-state indicator",
  );
  assert(
    readRepoFile("apps/web/src/features/notifications/notification-events.ts").includes(
      "dispatchNotificationsChanged",
    ),
    "Notification center must be able to refresh header count",
  );
  assert(
    readRepoFile(
      "apps/web/src/features/workspace-home/components/WorkspaceHomeDashboard.tsx",
    ).includes("Open Notification Center"),
    "Workspace home must include notifications card",
  );
  assert(
    readRepoFile("apps/web/src/features/notifications/api.ts").includes(
      "/api/v1/notifications/mine",
    ),
    "Web client must call notification API",
  );
}

async function verifyRuntimeBehavior(): Promise<void> {
  console.log("5. Notification runtime behavior");

  const { seedMember } = await import("../modules/member/member.store.js");
  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { createInitiativeImprovementProposalDraft } =
    await import("../modules/initiative-improvement-proposal/initiative-improvement-proposal.service.js");
  const { createInitiativeCollaborativeAnalysisDraft, publishInitiativeCollaborativeAnalysis } =
    await import("../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js");
  const {
    createNotificationsForEvent,
    listMyNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    archiveNotification,
    countUnreadNotifications,
    resetNotificationsForTests,
    sanitizeNotificationResponse,
  } = await import("../modules/notifications/notification.service.js");
  const { registerMemoryNotificationRecipient, clearMemoryNotificationRecipientsForTests } =
    await import("../modules/notifications/notification.recipients.js");

  resetNotificationsForTests();
  clearMemoryNotificationRecipientsForTests();

  registerMemoryNotificationRecipient({
    memberId: steward.participantId,
    userId: STEWARD_USER_ID,
    profileId: "profile-steward-001",
  });
  registerMemoryNotificationRecipient({
    memberId: analyst.participantId,
    userId: ANALYST_USER_ID,
    profileId: "profile-analyst-001",
  });

  seedMember({
    id: analyst.participantId,
    profile: {
      displayName: analyst.displayName ?? "Analyst B",
      uniqueName: "notification-analyst-b",
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
    title: "Notification Fixture Initiative",
    description: "Verification initiative for notification delivery.",
    communitySlug: "nelson-community-garden",
    activityArea: "Governance",
  });

  publishInitiative(steward, draft.initiativeId);
  await new Promise((resolve) => setTimeout(resolve, 50));

  const stewardAfterPublish = await listMyNotifications({
    userId: STEWARD_USER_ID,
    status: "all",
    limit: 20,
    offset: 0,
  });

  assert(
    stewardAfterPublish.notifications.some((item) => item.eventType === "initiative_published"),
    "Initiative publish hook must create steward notification",
  );

  const analysisDraft = await createInitiativeCollaborativeAnalysisDraft(analyst, {
    initiativeId: draft.initiativeId,
    title: "Notification Analysis",
    summary: "Analysis for notification verification.",
    supportingEvidence: "Evidence",
    risks: "Risk",
    suggestedImprovements: "Improve",
    references: "Ref",
  });
  await publishInitiativeCollaborativeAnalysis(analyst, analysisDraft.analysisId);

  const proposalDraft = await createInitiativeImprovementProposalDraft(analyst, {
    analysisId: analysisDraft.analysisId,
    targetSection: "Summary",
    currentIssue: "Issue",
    proposedChange: "Change",
    rationale: "Rationale",
    expectedImprovement: "Improvement",
    references: "References",
  });

  await createNotificationsForEvent({
    eventType: "proposal_submitted",
    entityType: "improvement_proposal",
    entityId: proposalDraft.proposalId,
    initiativeId: draft.initiativeId,
    actorMemberId: analyst.participantId,
  });

  const stewardProposalNotifications = await listMyNotifications({
    userId: STEWARD_USER_ID,
    status: "all",
    limit: 20,
    offset: 0,
  });

  assert(
    stewardProposalNotifications.notifications.some(
      (item) => item.eventType === "proposal_submitted",
    ),
    "Steward must receive proposal submitted notification",
  );

  const analystNotifications = await listMyNotifications({
    userId: ANALYST_USER_ID,
    status: "all",
    limit: 20,
    offset: 0,
  });

  assert(
    !analystNotifications.notifications.some((item) => item.eventType === "proposal_submitted"),
    "Analyst must not receive own proposal submitted notification",
  );

  const unreadBeforeRead = await countUnreadNotifications(STEWARD_USER_ID);
  assert(unreadBeforeRead > 0, "Unread count must be greater than zero");

  const firstUnread = stewardProposalNotifications.notifications.find(
    (item) => item.status === "unread",
  );
  assert(firstUnread !== undefined, "Steward must have unread notifications");

  const unreadId = firstUnread.notificationId;
  const markedRead = await markNotificationRead(unreadId, STEWARD_USER_ID);
  assert(markedRead.status === "read", "Mark read must update status");

  const archived = await archiveNotification(unreadId, STEWARD_USER_ID);
  assert(archived.status === "archived", "Archive must update status");

  await markAllNotificationsRead(STEWARD_USER_ID);
  const unreadAfterMarkAll = await countUnreadNotifications(STEWARD_USER_ID);
  assert(unreadAfterMarkAll === 0, "Mark all read must clear unread count");

  const sanitized = sanitizeNotificationResponse(
    await listMyNotifications({ userId: STEWARD_USER_ID, status: "all", limit: 10, offset: 0 }),
  );
  const serialized = JSON.stringify(sanitized).toLowerCase();

  for (const key of PRIVATE_FIELD_KEYS) {
    assert(!serialized.includes(`"${key.toLowerCase()}"`), `Response must not expose ${key}`);
  }
}

async function runVerificationPass(pass: number): Promise<void> {
  console.log(`\n=== verify:notifications pass ${pass} ===`);
  verifyModuleStructure();
  verifyNoPublicRoutesOrGamification();
  verifyEventHooks();
  verifyWebIntegration();
  await verifyRuntimeBehavior();
  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= 3; pass += 1) {
    await runVerificationPass(pass);
  }

  console.log("\nverify:notifications — all passes succeeded.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
