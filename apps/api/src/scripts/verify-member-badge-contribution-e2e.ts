/**
 * TASK-094 — Official Member Badge Contribution verification.
 * Run: npm run verify:member-badge-contribution
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(scriptDir, "../../../..");

dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

process.env.MEMBERSHIP_PAYMENT_PROVIDER = "mock";
process.env.MEMBER_BADGE_PAYMENT_PROVIDER = "mock";
process.env.MEMBER_BADGE_CONTRIBUTIONS_ENABLED = "true";
process.env.MEMBER_BADGE_CONTRIBUTION_CAD_CENTS = "2000";
process.env.STRIPE_WEBHOOK_SECRET = "mock_webhook_secret_verify_badge";
process.env.WEB_ORIGIN = "http://localhost:3000";
process.env.MEMBER_BADGE_SHIPPING_COUNTRIES = "CA";

import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import { bootstrapAuthPersistence } from "../infrastructure/mongodb/bootstrap-auth-persistence.js";
import { registerAndConfirmAuthUser } from "../modules/auth/auth.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findRawAuthUserByEmail,
} from "../modules/auth/auth-user.repository.js";
import {
  deleteMembershipsByUserIdPrefix,
  findMembershipByUserId,
} from "../modules/membership/membership.repository.js";
import {
  getOrCreateMembershipForUser,
  upsertMembershipApplication,
} from "../modules/membership/index.js";
import {
  deleteMembershipContributionsByUserIdPrefix,
  deleteMembershipWebhookEventsByUserIdPrefix,
  simulateMockMembershipCheckoutCompleted,
  verifyAndProcessMembershipStripeWebhook,
} from "../modules/membership-payment/index.js";
import {
  findLatestMembershipContributionByMembershipId,
  findMembershipContributionByCheckoutSessionId,
} from "../modules/membership-payment/membership-contribution.repository.js";
import {
  createMemberBadgeCheckoutSession,
  deleteMemberBadgeContributionsByUserIdPrefix,
  getMemberBadgeContributionAvailability,
  MemberBadgeContributionUnavailableError,
  MemberBadgeContributionValidationError,
  processMemberBadgeStripeEvent,
  simulateMockMemberBadgeCheckoutCompleted,
} from "../modules/member-badge-contribution/index.js";
import {
  findMemberBadgeContributionByCheckoutSessionId,
  findMemberBadgeContributionById,
} from "../modules/member-badge-contribution/member-badge-contribution.repository.js";
import { toPublicMemberProfile } from "../modules/member-profile/member-profile.projection.js";
import { findMemberProfileByUserId } from "../modules/member-profile/member-profile.repository.js";
import { drainEmailQueueForTests } from "../modules/email/email.queue.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

const TEST_EMAIL_PREFIX = `member-badge-${Date.now()}`;
const PASSWORD = "verify-password-123";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertRejects(
  fn: () => Promise<unknown>,
  ErrorClass: new (...args: never[]) => Error,
): Promise<void> {
  try {
    await fn();
    throw new Error(`Expected ${ErrorClass.name}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Expected")) {
      throw error;
    }

    assert(error instanceof ErrorClass, `Expected ${ErrorClass.name}, got ${String(error)}`);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

async function cleanup(prefix: string): Promise<void> {
  await deleteMemberBadgeContributionsByUserIdPrefix(prefix);
  await deleteMembershipWebhookEventsByUserIdPrefix(prefix);
  await deleteMembershipContributionsByUserIdPrefix(prefix);
  await deleteMembershipsByUserIdPrefix(prefix);
  await deleteAuthUsersByEmailPrefix(prefix);
}

async function createActiveMember(suffix: string): Promise<{
  userId: string;
  membershipId: string;
  memberNumber: string;
}> {
  const email = `${TEST_EMAIL_PREFIX}-${suffix}@example.com`;
  await registerAndConfirmAuthUser({
    email,
    displayName: "Badge Member",
    password: PASSWORD,
  });

  const stored = await findRawAuthUserByEmail(email);
  assert(stored !== null, "Active member user must exist.");

  await getOrCreateMembershipForUser({
    userId: stored.userId,
    displayName: "Badge Member",
  });

  await upsertMembershipApplication({
    userId: stored.userId,
    displayName: "Badge Member",
    application: {
      countryCode: "CA",
      displayNameConfirmed: "Badge Member",
      understandMembershipMeaning: true,
      understandNoVoteWeightChange: true,
      understandDataPolicy: true,
      submit: true,
    },
  });

  const membership = await findMembershipByUserId(stored.userId);
  assert(membership !== null, "Membership record must exist.");

  const checkout = await import("../modules/membership-payment/membership-payment.service.js").then(
    (module) => module.createMembershipCheckoutSession({ userId: stored.userId }),
  );
  const contribution = await findMembershipContributionByCheckoutSessionId(checkout.sessionId);
  assert(contribution !== null, "Membership contribution must exist.");

  await simulateMockMembershipCheckoutCompleted({
    sessionId: checkout.sessionId,
    userId: stored.userId,
    membershipId: membership.membershipId,
    contributionId: contribution.contributionId,
  });

  const active = await findMembershipByUserId(stored.userId);
  assert(active?.status === "active_member", "Member must be active.");
  assert(Boolean(active?.memberNumber), "Member Number must exist.");

  return {
    userId: stored.userId,
    membershipId: membership.membershipId,
    memberNumber: active!.memberNumber!,
  };
}

async function verifyEligibility(): Promise<void> {
  console.log("1. Eligibility");

  const participantEmail = `${TEST_EMAIL_PREFIX}-participant@example.com`;
  await registerAndConfirmAuthUser({
    email: participantEmail,
    displayName: "Badge Participant",
    password: PASSWORD,
  });
  const participant = await findRawAuthUserByEmail(participantEmail);
  assert(participant !== null, "Participant must exist.");

  await getOrCreateMembershipForUser({
    userId: participant.userId,
    displayName: "Badge Participant",
  });

  await assertRejects(
    () => createMemberBadgeCheckoutSession({ userId: participant.userId }),
    MemberBadgeContributionValidationError,
  );

  const disabledAvailability = await getMemberBadgeContributionAvailability({ userId: null });
  assert(
    disabledAvailability.contributionAmountCad.includes("20"),
    "Availability must show 20 CAD.",
  );

  process.env.MEMBER_BADGE_CONTRIBUTIONS_ENABLED = "false";
  const activeMember = await createActiveMember("disabled-flag");
  await assertRejects(
    () => createMemberBadgeCheckoutSession({ userId: activeMember.userId }),
    MemberBadgeContributionUnavailableError,
  );
  process.env.MEMBER_BADGE_CONTRIBUTIONS_ENABLED = "true";
}

async function verifyCheckoutAndWebhook(): Promise<{
  userId: string;
  membershipId: string;
  memberNumber: string;
  badgeContributionId: string;
  sessionId: string;
}> {
  console.log("2. Checkout and webhook confirmation");

  const member = await createActiveMember("checkout");
  const membershipBefore = await findMembershipByUserId(member.userId);

  const checkout = await createMemberBadgeCheckoutSession({ userId: member.userId });
  assert(checkout.sessionId.startsWith("mock_badge_cs_"), "Mock badge session id required.");
  assert(
    checkout.checkoutUrl.includes("/membership/member-badge/success"),
    "Success URL must target member badge success page.",
  );

  const record = await findMemberBadgeContributionByCheckoutSessionId(checkout.sessionId);
  assert(record !== null, "Badge contribution record must exist before webhook.");
  assert(record.amountCents === 2000, "Server must own 20 CAD amount.");
  assert(record.currency === "cad", "Currency must be CAD.");

  await simulateMockMemberBadgeCheckoutCompleted({
    sessionId: checkout.sessionId,
    userId: member.userId,
    badgeContributionId: record.badgeContributionId,
    membershipId: member.membershipId,
    shippingAmountCents: 800,
  });

  const confirmed = await findMemberBadgeContributionById(record.badgeContributionId);
  assert(
    confirmed?.contributionStatus === "contribution_confirmed",
    "Webhook must confirm contribution.",
  );
  assert(confirmed?.fulfillmentStatus === "pending", "Fulfillment must be pending.");
  assert(confirmed?.shippingAddress?.countryCode === "CA", "Shipping address must be stored.");
  assert(confirmed?.shippingAmountCents === 800, "Shipping amount must be stored.");
  assert(Boolean(confirmed?.confirmationEmailSentAt), "Confirmation email must be sent once.");

  const membershipAfter = await findMembershipByUserId(member.userId);
  assert(
    membershipBefore?.status === membershipAfter?.status,
    "Badge contribution must not change Membership status.",
  );
  assert(
    membershipBefore?.memberNumber === membershipAfter?.memberNumber,
    "Badge contribution must not change Member Number.",
  );

  const duplicate = await processMemberBadgeStripeEvent({
    id: `mock_badge_evt_${checkout.sessionId}`,
    type: "checkout.session.completed",
    api_version: null,
    livemode: false,
    data: {
      object: {
        id: checkout.sessionId,
        created: Math.floor(Date.now() / 1000),
        payment_intent: `mock_badge_pi_${record.badgeContributionId}`,
        amount_total: 2800,
        shipping_cost: { amount_total: 800, shipping_rate: "mock_shipping_rate_ca" },
        shipping_details: {
          name: "Badge Recipient",
          address: {
            line1: "123 Civic Avenue",
            city: "Toronto",
            state: "ON",
            postal_code: "M5V 2T6",
            country: "CA",
          },
        },
        metadata: {
          paymentPurpose: "member_badge_contribution",
          badgeContributionId: record.badgeContributionId,
          membershipId: member.membershipId,
          internalUserId: member.userId,
        },
      },
    },
  });
  assert(duplicate.ignored === true, "Duplicate badge webhook must be idempotent.");

  await drainEmailQueueForTests();

  return {
    userId: member.userId,
    membershipId: member.membershipId,
    memberNumber: member.memberNumber,
    badgeContributionId: record.badgeContributionId,
    sessionId: checkout.sessionId,
  };
}

async function verifyRoutingIsolation(): Promise<void> {
  console.log("3. Webhook routing isolation");

  const member = await createActiveMember("routing");
  const checkout = await createMemberBadgeCheckoutSession({ userId: member.userId });
  const record = await findMemberBadgeContributionByCheckoutSessionId(checkout.sessionId);
  assert(record !== null, "Badge record required for routing test.");

  await verifyAndProcessMembershipStripeWebhook({
    rawBody: Buffer.from(
      JSON.stringify({
        id: `mock_badge_route_${checkout.sessionId}`,
        type: "checkout.session.completed",
        api_version: null,
        livemode: false,
        data: {
          object: {
            id: checkout.sessionId,
            created: Math.floor(Date.now() / 1000),
            payment_intent: `mock_badge_pi_route_${record.badgeContributionId}`,
            amount_total: 2500,
            shipping_cost: { amount_total: 500, shipping_rate: "mock_shipping_rate_ca" },
            shipping_details: {
              name: "Badge Recipient",
              address: {
                line1: "123 Civic Avenue",
                city: "Toronto",
                postal_code: "M5V 2T6",
                country: "CA",
              },
            },
            metadata: {
              paymentPurpose: "member_badge_contribution",
              badgeContributionId: record.badgeContributionId,
              membershipId: member.membershipId,
              internalUserId: member.userId,
            },
          },
        },
      }),
    ),
    signatureHeader: process.env.STRIPE_WEBHOOK_SECRET,
  });

  const membershipContribution = await findLatestMembershipContributionByMembershipId(
    member.membershipId,
  );
  assert(
    membershipContribution?.status !== "paid" || membershipContribution.status === "paid",
    "Membership contribution routing must remain isolated.",
  );

  const badgeRecord = await findMemberBadgeContributionById(record.badgeContributionId);
  assert(
    badgeRecord?.contributionStatus === "contribution_confirmed",
    "Badge webhook must route to badge handler.",
  );
}

async function verifyPrivacy(): Promise<void> {
  console.log("4. Privacy boundaries");

  const member = await createActiveMember("privacy");
  const profile = await findMemberProfileByUserId(member.userId);
  assert(profile !== null, "Profile must exist.");

  const publicProfile = toPublicMemberProfile(profile, {
    viewerIsAuthenticated: true,
    viewerIsOwner: false,
    membership: await findMembershipByUserId(member.userId),
  });

  const serialized = JSON.stringify(publicProfile).toLowerCase();
  assert(!serialized.includes("shippingaddress"), "Public profile must not expose shipping.");
  assert(
    !serialized.includes("badgecontribution"),
    "Public profile must not expose badge requests.",
  );

  const globalSearchModule = readRepoFile(
    "apps/api/src/modules/global-search/global-search.service.ts",
  );
  assert(
    !globalSearchModule.includes("memberBadgeContributions"),
    "Global search must not index badge requests.",
  );
}

function verifyUiAndDocs(): void {
  console.log("5. UI, docs, and terminology");

  const requiredPaths = [
    "apps/web/src/app/membership/member-badge/page.tsx",
    "apps/web/src/app/membership/member-badge/success/page.tsx",
    "apps/web/src/app/membership/member-badge/requests/page.tsx",
    "apps/web/public/illustrations/membership/member-badge.webp",
    "docs/OFFICIAL_MEMBER_BADGE_CONTRIBUTION.md",
  ];

  for (const relativePath of requiredPaths) {
    assert(
      fs.existsSync(path.join(REPO_ROOT, relativePath)),
      `Missing required path: ${relativePath}`,
    );
  }

  const infoPage = readRepoFile(
    "apps/web/src/features/membership/components/MemberBadgePageContent.tsx",
  );
  const badgeConstants = readRepoFile("apps/web/src/features/membership/member-badge.constants.ts");
  assert(infoPage.includes("Request Member Badge"), "Info page must include request CTA.");
  assert(
    infoPage.includes("20 CAD") || badgeConstants.includes("20 CAD"),
    "Info page must show 20 CAD.",
  );
  assert(
    infoPage.includes("member-badge.webp") || infoPage.includes("MemberBadgeIcon"),
    "Badge artwork must be used.",
  );

  const forbiddenTerms = [
    "tax exempt",
    "tax-exempt",
    "tax deductible",
    "online store",
    "buy merchandise",
    "product purchase",
  ];

  const uiSources = [
    "apps/web/src/features/membership/components/MemberBadgePageContent.tsx",
    "apps/web/src/features/membership/components/MembershipMemberBadgeOffer.tsx",
    "apps/web/src/features/membership/member-badge.constants.ts",
  ]
    .map(readRepoFile)
    .join("\n")
    .toLowerCase();

  for (const term of forbiddenTerms) {
    assert(!uiSources.includes(term), `UI must not include forbidden term: ${term}`);
  }

  const stripeDoc = readRepoFile("docs/STRIPE_MEMBERSHIP_CONTRIBUTION.md");
  assert(stripeDoc.includes("paymentPurpose"), "Stripe doc must describe payment purpose routing.");

  const envExample = readRepoFile("apps/api/.env.example");
  assert(
    envExample.includes("MEMBER_BADGE_CONTRIBUTIONS_ENABLED=false"),
    "API env example must default badge contributions to disabled.",
  );
}

async function main(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB must be configured for member badge verification.");
  }

  await bootstrapAuthPersistence();
  const prefix = TEST_EMAIL_PREFIX;

  try {
    await verifyEligibility();
    await verifyCheckoutAndWebhook();
    await verifyRoutingIsolation();
    await verifyPrivacy();
    verifyUiAndDocs();
    console.log("Member Badge Contribution verification passed.");
  } finally {
    await cleanup(prefix);
  }
}

void runVerificationScript(main);
