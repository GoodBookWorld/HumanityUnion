/**
 * TASK-072 — Civic Nomination Domain Foundation verification.
 * Run: npm run verify:civic-nomination
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const MODULE_DIR = path.join(REPO_ROOT, "apps/api/src/modules/civic-nomination");

dotenv.config({ path: path.resolve(REPO_ROOT, "apps/api/.env") });
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const TEST_PREFIX = `civic-nomination-verify-${Date.now()}`;

const FORBIDDEN_DOMAIN_FIELDS = [
  "voteCount",
  "supportVotes",
  "ranking",
  "score",
  "appointment",
  "posterUrl",
  "compactPoster",
] as const;

const FORBIDDEN_PERSONAL_FIELDS = ["gender", "age", "religion", "ethnicity"] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function sampleNominationInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    institutionRole: "humanity_council",
    nominationType: "self",
    nomineeName: "Jordan Example",
    countrySlug: "canada",
    expertiseAreas: ["law", "human_rights"],
    experienceSummary:
      "Twenty years of public interest law practice focused on civic accountability and human rights education.",
    confirmedAchievements:
      "Led a verified public service review panel and published an open civic accountability report.",
    evidenceLinks: [
      {
        title: "Public service review",
        url: "https://example.com/public-service-review",
        evidenceType: "public_service",
      },
    ],
    visionStatement:
      "Designed to strengthen transparent deliberation and responsible institutional coordination.",
    conflictOfInterest: { status: "none_known" },
    declarations: {
      supportsUdhr: true,
      supportsHumanityUnionPrinciples: true,
      understandsNoAutomaticAppointment: true,
      confirmsAccuracy: true,
    },
    ...overrides,
  };
}

function verifyModuleStructure(): void {
  console.log("1. Module structure and routes");

  const requiredFiles = [
    "civic-nomination.service.ts",
    "civic-nomination.store.ts",
    "civic-nomination.validation.ts",
    "civic-nomination.projection.ts",
    "civic-nomination.routes.ts",
    "public-civic-nomination.routes.ts",
    "persistence/civic-nomination-memory.persistence.ts",
    "persistence/civic-nomination-mongo.persistence.ts",
  ];

  for (const file of requiredFiles) {
    assert(fs.existsSync(path.join(MODULE_DIR, file)), `Missing civic nomination file: ${file}`);
  }

  const appSource = readRepoFile("apps/api/src/app.ts");
  assert(
    appSource.includes('app.use("/api/v1/civic-nominations"'),
    "app.ts must mount civic nominations router",
  );
  assert(
    appSource.includes('app.use("/api/v1/public/civic-nominations"'),
    "app.ts must mount public civic nominations router",
  );
  assert(
    appSource.includes('app.use("/api/v1/public/institutions"'),
    "app.ts must mount institution nominations router",
  );

  const domainSource = readRepoFile("packages/types/src/domain/civic-nomination.ts");
  assert(domainSource.includes("humanity_council"), "Domain must include humanity_council role");
  assert(
    !domainSource.includes("chamber_of_state_representatives"),
    "Domain must not include Chamber of State Representatives nomination role",
  );
  assert(
    !domainSource.includes("world_protection_corps"),
    "Domain must not include WPC nomination role",
  );

  for (const field of FORBIDDEN_DOMAIN_FIELDS) {
    assert(!domainSource.includes(field), `Domain must not include voting/poster field: ${field}`);
  }
}

async function verifyRuntimeBehavior(): Promise<void> {
  console.log("2. Civic nomination lifecycle and privacy");

  const { registerAndConfirmAuthUser } = await import("../modules/auth/auth.service.js");
  const { deleteAuthUsersByEmailPrefix } = await import("../modules/auth/auth-user.repository.js");
  const { deleteMemberProfilesByUserIdPrefix } =
    await import("../modules/member-profile/member-profile.repository.js");
  const { registerMemoryNotificationRecipient, clearMemoryNotificationRecipientsForTests } =
    await import("../modules/notifications/notification.recipients.js");
  const { listMyNotifications, drainCivicNotificationEventsForTests } =
    await import("../modules/notifications/notification.service.js");
  const { searchPublicCivicRecords } =
    await import("../modules/global-search/global-search.service.js");
  const { resetGlobalSearchIndexForTests } =
    await import("../modules/global-search/global-search.index.js");
  const {
    archiveCivicNomination,
    createCivicNominationDraft,
    getMyCivicNomination,
    getPublicCivicNominationProjection,
    listPublicCivicNominationProjections,
    publishCivicNomination,
    resolveCivicNominationAuthContext,
    resetCivicNominationStoreForTests,
    submitCivicNomination,
    updateCivicNominationDraft,
    withdrawCivicNomination,
  } = await import("../modules/civic-nomination/index.js");
  const { validateCivicNominationDraftInput } =
    await import("../modules/civic-nomination/civic-nomination.validation.js");

  resetCivicNominationStoreForTests();
  resetGlobalSearchIndexForTests();
  clearMemoryNotificationRecipientsForTests();

  const nominatorEmail = `${TEST_PREFIX}-nominator@example.com`;
  const otherEmail = `${TEST_PREFIX}-other@example.com`;

  const nominatorRegistration = await registerAndConfirmAuthUser({
    email: nominatorEmail,
    password: "verify-password-123",
    displayName: "Nomination Nominator",
  });
  const otherRegistration = await registerAndConfirmAuthUser({
    email: otherEmail,
    password: "verify-password-123",
    displayName: "Other Participant",
  });

  const nominatorAuth = await resolveCivicNominationAuthContext(nominatorRegistration.user.userId);
  const otherAuth = await resolveCivicNominationAuthContext(otherRegistration.user.userId);

  registerMemoryNotificationRecipient({
    memberId: nominatorAuth.memberId,
    userId: nominatorAuth.userId,
    profileId: nominatorAuth.profileId,
  });

  const adminIdentity: RequestIdentity = {
    participantId: "member-admin-verify-001",
    role: "admin",
    displayName: "Institution Moderator",
  };

  const selfDraft = createCivicNominationDraft(nominatorAuth, sampleNominationInput());
  assert(selfDraft.status === "draft", "Self nomination must start in draft");
  assert(selfDraft.nominationType === "self", "Self nomination type must be self");

  const otherDraft = createCivicNominationDraft(
    nominatorAuth,
    sampleNominationInput({
      nominationType: "other_person",
      nomineeName: "Taylor Candidate",
      institutionRole: "chamber_of_intellectual_analysis",
      countrySlug: undefined,
    }),
  );
  assert(otherDraft.nominationType === "other_person", "Other-person nomination must be created");

  let rejectedDeclarations = false;
  try {
    validateCivicNominationDraftInput(
      sampleNominationInput({
        declarations: {
          supportsUdhr: false,
          supportsHumanityUnionPrinciples: true,
          understandsNoAutomaticAppointment: true,
          confirmsAccuracy: true,
        },
      }),
    );
  } catch {
    rejectedDeclarations = true;
  }
  assert(rejectedDeclarations, "Validation must reject missing declarations");

  let rejectedPersonalTrait = false;
  try {
    validateCivicNominationDraftInput(
      sampleNominationInput({
        gender: "unspecified",
      }),
    );
  } catch {
    rejectedPersonalTrait = true;
  }
  assert(rejectedPersonalTrait, "Validation must reject personal-trait fields");

  updateCivicNominationDraft(selfDraft.nominationId, nominatorAuth.profileId, {
    visionStatement: "Updated vision for responsible institutional coordination.",
  });
  const updatedDraft = getMyCivicNomination(selfDraft.nominationId, nominatorAuth.profileId);
  assert(updatedDraft.nominationVersion === 2, "Draft update must increment nomination version");

  let blockedOtherEditor = false;
  try {
    updateCivicNominationDraft(selfDraft.nominationId, otherAuth.profileId, {
      visionStatement: "Unauthorized edit attempt.",
    });
  } catch {
    blockedOtherEditor = true;
  }
  assert(blockedOtherEditor, "Non-nominator must not edit draft");

  const submitted = submitCivicNomination(selfDraft.nominationId, nominatorAuth);
  assert(submitted.status === "submitted", "Submit must move nomination to submitted");

  const published = await publishCivicNomination(selfDraft.nominationId, adminIdentity);
  assert(published.status === "published", "Publish must move nomination to published");
  assert(Boolean(published.publishedAt), "Published nomination must record publishedAt");

  const projection = await getPublicCivicNominationProjection(selfDraft.nominationId);
  assert(projection !== null, "Published nomination must have public projection");
  assert(
    !("nominatedByUserId" in (projection as unknown as Record<string, unknown>)),
    "Public projection must not expose nominatedByUserId",
  );
  for (const field of FORBIDDEN_PERSONAL_FIELDS) {
    assert(
      !(field in (projection as unknown as Record<string, unknown>)),
      `Public projection must not expose ${field}`,
    );
  }

  const publicList = await listPublicCivicNominationProjections();
  assert(
    publicList.some((item) => item.nominationId === selfDraft.nominationId),
    "Public list must include published nomination",
  );
  assert(
    publicList.every((item) => item.status === "published"),
    "Public list must include published nominations only",
  );

  resetGlobalSearchIndexForTests();
  const searchResults = await searchPublicCivicRecords({
    q: "Jordan Example",
    entityTypes: ["civic_nomination"],
    limit: 10,
    offset: 0,
  });
  assert(
    searchResults.results.some((result) => result.entityId === selfDraft.nominationId),
    "Global search must index published civic nomination",
  );

  const withdrawn = withdrawCivicNomination(otherDraft.nominationId, nominatorAuth);
  assert(withdrawn.status === "withdrawn", "Withdraw must move nomination to withdrawn");

  const archived = archiveCivicNomination(selfDraft.nominationId, adminIdentity);
  assert(archived.status === "archived", "Archive must move nomination to archived");

  await drainCivicNotificationEventsForTests();
  const notifications = await listMyNotifications({ userId: nominatorAuth.userId });
  assert(
    notifications.notifications.some(
      (notification) => notification.eventType === "civic_nomination_submitted",
    ),
    "Submitted notification event must be recorded",
  );
  assert(
    notifications.notifications.some(
      (notification) => notification.eventType === "civic_nomination_published",
    ),
    "Published notification event must be recorded",
  );
  assert(
    notifications.notifications.some(
      (notification) => notification.eventType === "civic_nomination_withdrawn",
    ),
    "Withdrawn notification event must be recorded",
  );

  await deleteMemberProfilesByUserIdPrefix(TEST_PREFIX);
  await deleteAuthUsersByEmailPrefix(TEST_PREFIX);
}

function verifyNoVotingImplementation(): void {
  console.log("3. No voting storage in domain module");

  const moduleSources = fs
    .readdirSync(MODULE_DIR, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".ts"))
    .map((entry) => fs.readFileSync(path.join(MODULE_DIR, entry), "utf-8"))
    .join("\n");

  assert(!moduleSources.includes("supportVotes"), "Module must not implement voting storage");
  assert(!moduleSources.includes("do_not_support"), "Module must not implement vote choices");

  const projection = readRepoFile(
    "apps/api/src/modules/civic-nomination/civic-nomination.projection.ts",
  );
  assert(
    projection.includes("/institutions/nominations/"),
    "Public civic nomination URL must target institutions poster route",
  );
}

async function main(): Promise<void> {
  verifyModuleStructure();
  await verifyRuntimeBehavior();
  verifyNoVotingImplementation();
  console.log("\nverify:civic-nomination PASS");
}

const { runVerificationScript } = await import("./verification-script-lifecycle.js");
void runVerificationScript(main);
