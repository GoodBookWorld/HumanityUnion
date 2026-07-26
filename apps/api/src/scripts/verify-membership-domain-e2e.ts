/**
 * TASK-090 — Membership domain foundation verification.
 * Run: npm run verify:membership-domain
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import { bootstrapAuthPersistence } from "../infrastructure/mongodb/bootstrap-auth-persistence.js";
import { registerAndConfirmAuthUser, registerAuthUser } from "../modules/auth/auth.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findRawAuthUserByEmail,
} from "../modules/auth/auth-user.repository.js";
import {
  deleteMembershipsByUserIdPrefix,
  findMembershipByUserId,
} from "../modules/membership/membership.repository.js";
import {
  activateMembershipMemberNumber,
  generateMembershipMemberNumber,
  getMembershipStatusForUser,
  getOrCreateMembershipForUser,
  isValidMembershipMemberNumber,
  upsertMembershipApplication,
} from "../modules/membership/index.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

const TEST_EMAIL_PREFIX = `membership-domain-${Date.now()}`;
const PASSWORD = "verify-password-123";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertRejects(fn: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await fn();
    throw new Error(`Expected rejection matching ${pattern}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("Expected rejection")) {
      throw error;
    }

    assert(pattern.test(message), `Expected ${pattern}, got "${message}"`);
  }
}

async function cleanup(prefix: string): Promise<void> {
  await deleteMembershipsByUserIdPrefix(prefix);
  await deleteAuthUsersByEmailPrefix(prefix);
}

async function createConfirmedUser(suffix: string): Promise<{ userId: string; email: string }> {
  const email = `${TEST_EMAIL_PREFIX}-${suffix}@example.com`;
  await registerAndConfirmAuthUser({
    email,
    displayName: `Membership ${suffix}`,
    password: PASSWORD,
  });

  const stored = await findRawAuthUserByEmail(email);
  assert(stored !== null, "Confirmed user must exist.");

  return { userId: stored.userId, email };
}

async function verifyOneRecordPerUser(): Promise<void> {
  const { userId } = await createConfirmedUser("single");

  const first = await getOrCreateMembershipForUser({
    userId,
    displayName: "Membership single",
  });
  const second = await getOrCreateMembershipForUser({
    userId,
    displayName: "Membership single",
  });

  assert(first.membership.status === "not_started", "Default status must be not_started.");
  assert(first.membership.cohortLabel === "Participant", "Default cohort must be Participant.");
  assert(first.membership.memberNumber === null, "Member number must not be assigned yet.");
  assert(first.membership.memberSince === null, "Member Since must be empty.");

  const stored = await findMembershipByUserId(userId);
  assert(stored !== null, "Membership record must exist in MongoDB.");
  assert(stored.membershipId.length > 0, "Membership id must be assigned.");
  assert(
    second.membership.status === "not_started",
    "Second load must not create duplicate state.",
  );
}

async function verifyUnconfirmedCannotApply(): Promise<void> {
  const email = `${TEST_EMAIL_PREFIX}-unconfirmed@example.com`;
  const registered = await registerAuthUser({
    email,
    displayName: "Unconfirmed Membership",
    password: PASSWORD,
  });
  assert(
    registered.kind === "email_confirmation_required",
    "Registration must require confirmation.",
  );

  const stored = await findRawAuthUserByEmail(email);
  assert(stored !== null, "Unconfirmed user must exist.");

  await assertRejects(
    () =>
      upsertMembershipApplication({
        userId: stored.userId,
        displayName: "Unconfirmed Membership",
        application: {
          countryCode: "US",
          displayNameConfirmed: "Unconfirmed Membership",
          understandMembershipMeaning: true,
          understandNoVoteWeightChange: true,
          understandDataPolicy: true,
          submit: true,
        },
      }),
    /Email must be confirmed/i,
  );
}

async function verifyParticipationCountryCodes(): Promise<void> {
  const { userId } = await createConfirmedUser("countries");

  const draft = await upsertMembershipApplication({
    userId,
    displayName: "Membership countries",
    application: {
      participationCountryCodes: ["us", "CA"],
      displayNameConfirmed: "Membership countries",
      understandMembershipMeaning: false,
      understandNoVoteWeightChange: false,
      understandDataPolicy: false,
      submit: false,
    },
  });

  assert(
    draft.application.participationCountryCodes?.join(",") === "US,CA",
    "Participation countries must normalize to uppercase ISO2.",
  );
  assert(
    draft.application.countryCode === "US",
    "Primary countryCode must mirror first selection.",
  );

  const { userId: legacyUserId } = await createConfirmedUser("legacy-country");
  const legacy = await upsertMembershipApplication({
    userId: legacyUserId,
    displayName: "Membership legacy",
    application: {
      countryCode: "gb",
      displayNameConfirmed: "Membership legacy",
      understandMembershipMeaning: false,
      understandNoVoteWeightChange: false,
      understandDataPolicy: false,
      submit: false,
    },
  });

  assert(
    legacy.application.participationCountryCodes?.join(",") === "GB",
    "Legacy countryCode must migrate to participationCountryCodes.",
  );

  const stored = await findMembershipByUserId(legacyUserId);
  assert(
    stored?.participationCountryCodes?.join(",") === "GB",
    "Legacy participation countries must persist in MongoDB.",
  );
}

async function verifyApplicationDraftAndSubmit(): Promise<void> {
  const { userId } = await createConfirmedUser("apply");

  const draft = await upsertMembershipApplication({
    userId,
    displayName: "Membership apply",
    application: {
      countryCode: "us",
      displayNameConfirmed: "Membership apply",
      understandMembershipMeaning: false,
      understandNoVoteWeightChange: false,
      understandDataPolicy: false,
      submit: false,
    },
  });

  assert(draft.membership.status === "application_started", "Draft must set application_started.");
  assert(draft.membership.applicationStatus === "draft", "Draft application status required.");
  assert(draft.application.countryCode === "US", "Country must normalize to uppercase.");
  assert(
    draft.application.participationCountryCodes?.join(",") === "US",
    "Legacy countryCode draft must expose participationCountryCodes.",
  );

  const submitted = await upsertMembershipApplication({
    userId,
    displayName: "Membership apply",
    application: {
      participationCountryCodes: ["US"],
      displayNameConfirmed: "Membership apply",
      understandMembershipMeaning: true,
      understandNoVoteWeightChange: true,
      understandDataPolicy: true,
      submit: true,
    },
  });

  assert(
    submitted.membership.status === "application_completed",
    "Submit must complete application.",
  );
  assert(submitted.membership.applicationStatus === "submitted", "Submit must mark submitted.");
  assert(submitted.application.applicationSubmittedAt !== null, "Submitted timestamp required.");
  assert(submitted.membership.memberNumber === null, "Member number must remain unassigned.");

  await assertRejects(
    () =>
      upsertMembershipApplication({
        userId,
        displayName: "Membership apply",
        application: {
          participationCountryCodes: ["US"],
          displayNameConfirmed: "Membership apply",
          understandMembershipMeaning: true,
          understandNoVoteWeightChange: true,
          understandDataPolicy: true,
          submit: true,
        },
      }),
    /already exists/i,
  );
}

async function verifyMemberNumberArchitecture(): Promise<void> {
  const generated = generateMembershipMemberNumber(new Date("2026-06-27T00:00:00.000Z"));
  assert(isValidMembershipMemberNumber(generated), "Generated member number must match format.");
  assert(generated.startsWith("HU-2026-"), "Member number must include year prefix.");

  const { userId } = await createConfirmedUser("number");
  await upsertMembershipApplication({
    userId,
    displayName: "Membership number",
    application: {
      participationCountryCodes: ["CA"],
      displayNameConfirmed: "Membership number",
      understandMembershipMeaning: true,
      understandNoVoteWeightChange: true,
      understandDataPolicy: true,
      submit: true,
    },
  });

  const assigned = await activateMembershipMemberNumber({ userId });
  assert(isValidMembershipMemberNumber(assigned), "Assigned member number must be valid.");

  const stored = await findMembershipByUserId(userId);
  assert(stored?.memberNumber === assigned, "Member number must persist.");
  assert(stored?.memberGrantedAt !== null, "memberGrantedAt must be set on activation.");

  await assertRejects(() => activateMembershipMemberNumber({ userId }), /immutable/i);
}

async function verifyStatusEndpoint(): Promise<void> {
  const { userId } = await createConfirmedUser("status");

  const status = await getMembershipStatusForUser(userId);
  assert(status.status === "not_started", "Status endpoint must reflect default state.");
  assert(status.memberNumber === null, "Status endpoint must not expose assigned number yet.");
}

async function verifyTimelineIncludesContributionStep(): Promise<void> {
  const { userId } = await createConfirmedUser("timeline");

  const payload = await getOrCreateMembershipForUser({
    userId,
    displayName: "Membership timeline",
  });

  const contributionStep = payload.timeline.find((step) => step.id === "contribution");
  assert(contributionStep !== undefined, "Timeline must include contribution step.");
  assert(
    contributionStep.detail?.includes("Membership Contribution") ?? false,
    "Contribution step must describe Membership Contribution.",
  );
}

async function verifyNoStripeArtifacts(): Promise<void> {
  const { readFileSync, readdirSync } = await import("node:fs");
  const membershipDir = path.resolve(scriptDir, "../modules/membership");
  const files = readdirSync(membershipDir);

  for (const file of files) {
    const contents = readFileSync(path.join(membershipDir, file), "utf8").toLowerCase();
    assert(!contents.includes("stripe"), `Membership module must not reference Stripe (${file}).`);
    assert(
      !contents.includes("webhook"),
      `Membership module must not implement webhooks (${file}).`,
    );
  }
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:membership-domain pass ${pass} ===`);
  await cleanup(TEST_EMAIL_PREFIX);

  await verifyOneRecordPerUser();
  await verifyUnconfirmedCannotApply();
  await verifyParticipationCountryCodes();
  await verifyApplicationDraftAndSubmit();
  await verifyMemberNumberArchitecture();
  await verifyStatusEndpoint();
  await verifyTimelineIncludesContributionStep();
  await verifyNoStripeArtifacts();

  await cleanup(TEST_EMAIL_PREFIX);
  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  assert(isMongoConfigured(), "MONGODB_URI must be configured.");
  await bootstrapAuthPersistence();

  for (let pass = 1; pass <= 3; pass += 1) {
    await runPass(pass);
  }

  console.log("\nverify:membership-domain PASSED (3 consecutive passes).");
}

void runVerificationScript(main);
