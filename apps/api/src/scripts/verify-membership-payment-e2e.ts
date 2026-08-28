/**
 * TASK-092 — Stripe Membership Contribution verification.
 * Run: npm run verify:membership-payment
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

process.env.MEMBERSHIP_PAYMENT_PROVIDER = "mock";
process.env.STRIPE_WEBHOOK_SECRET = "mock_webhook_secret_verify";
process.env.WEB_ORIGIN = "http://localhost:3000";

import { readFileSync } from "node:fs";

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
  getMembershipStatusForUser,
  getOrCreateMembershipForUser,
  upsertMembershipApplication,
} from "../modules/membership/index.js";
import {
  createMembershipCheckoutSession,
  deleteMembershipContributionsByUserIdPrefix,
  deleteMembershipWebhookEventsByUserIdPrefix,
  MembershipPaymentConflictError,
  MembershipWebhookSignatureError,
  simulateMockMembershipCheckoutCompleted,
  verifyAndProcessMembershipStripeWebhook,
} from "../modules/membership-payment/index.js";
import {
  findLatestMembershipContributionByMembershipId,
  findMembershipContributionByCheckoutSessionId,
} from "../modules/membership-payment/membership-contribution.repository.js";
import { findMembershipWebhookEventByStripeEventId } from "../modules/membership-payment/membership-webhook-event.repository.js";
import { processMembershipStripeEvent } from "../modules/membership-payment/membership-payment.service.js";
import { findMemberProfileByUserId } from "../modules/member-profile/member-profile.repository.js";
import { toPublicMemberProfile } from "../modules/member-profile/member-profile.projection.js";
import { updateMemberProfilePrivacyForUser } from "../modules/member-profile/member-profile.service.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

const TEST_EMAIL_PREFIX = `membership-payment-${Date.now()}`;
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

async function cleanup(prefix: string): Promise<void> {
  await deleteMembershipWebhookEventsByUserIdPrefix(prefix);
  await deleteMembershipContributionsByUserIdPrefix(prefix);
  await deleteMembershipsByUserIdPrefix(prefix);
  await deleteAuthUsersByEmailPrefix(prefix);
}

async function createEligibleApplicant(suffix: string): Promise<{
  userId: string;
  membershipId: string;
}> {
  const email = `${TEST_EMAIL_PREFIX}-${suffix}@example.com`;
  await registerAndConfirmAuthUser({
    email,
    displayName: "Payment Eligible",
    password: PASSWORD,
  });

  const stored = await findRawAuthUserByEmail(email);
  assert(stored !== null, "Eligible user must exist.");

  await getOrCreateMembershipForUser({
    userId: stored.userId,
    displayName: "Payment Eligible",
  });

  await upsertMembershipApplication({
    userId: stored.userId,
    displayName: "Payment Eligible",
    application: {
      countryCode: "CA",
      displayNameConfirmed: "Payment Eligible",
      understandMembershipMeaning: true,
      understandNoVoteWeightChange: true,
      understandDataPolicy: true,
      submit: true,
    },
  });

  const membership = await findMembershipByUserId(stored.userId);
  assert(membership !== null, "Membership record must exist.");

  return { userId: stored.userId, membershipId: membership.membershipId };
}

async function verifyCheckoutCreation(): Promise<{
  userId: string;
  sessionId: string;
  contributionId: string;
}> {
  const { userId } = await createEligibleApplicant("checkout");

  const checkout = await createMembershipCheckoutSession({ userId });
  assert(checkout.checkoutUrl.includes("session_id="), "Checkout must return redirect URL.");
  assert(checkout.sessionId.startsWith("mock_cs_"), "Mock checkout must return mock session id.");

  const membership = await findMembershipByUserId(userId);
  assert(membership?.status === "pending_payment", "Checkout must set pending_payment.");

  const contribution = await findMembershipContributionByCheckoutSessionId(checkout.sessionId);
  assert(contribution !== null, "Contribution record must exist.");
  assert(contribution.amountCents === 100, "Contribution must be 1 CAD (100 cents).");
  assert(contribution.currency === "cad", "Contribution currency must be CAD.");
  assert(contribution.status === "checkout_created", "Contribution must be checkout_created.");

  return {
    userId,
    sessionId: checkout.sessionId,
    contributionId: contribution.contributionId,
  };
}

async function verifyWebhookSignature(): Promise<void> {
  await assertRejects(
    () =>
      verifyAndProcessMembershipStripeWebhook({
        rawBody: Buffer.from(
          JSON.stringify({
            id: "evt_bad",
            type: "checkout.session.completed",
            data: { object: {} },
          }),
        ),
        signatureHeader: "invalid",
      }),
    MembershipWebhookSignatureError,
  );
}

async function verifyActivationAndIdempotency(input: {
  userId: string;
  membershipId: string;
  sessionId: string;
  contributionId: string;
}): Promise<{ memberNumber: string; paymentIntentId: string }> {
  await simulateMockMembershipCheckoutCompleted({
    sessionId: input.sessionId,
    userId: input.userId,
    membershipId: input.membershipId,
    contributionId: input.contributionId,
  });

  const membership = await findMembershipByUserId(input.userId);
  assert(membership?.status === "active_member", "Webhook must activate Membership.");
  assert(Boolean(membership?.memberNumber), "Webhook must assign Member Number.");
  assert(Boolean(membership?.memberGrantedAt), "Webhook must set memberGrantedAt.");

  const contribution = await findLatestMembershipContributionByMembershipId(input.membershipId);
  assert(contribution?.status === "paid", "Contribution must be paid.");
  assert(contribution.webhookResult === "activated", "Webhook result must be activated.");

  const paymentIntentId = contribution.stripePaymentIntentId ?? "";
  assert(paymentIntentId.length > 0, "Payment intent id must be stored.");

  const eventId = `mock_evt_${input.sessionId}`;
  const webhookRecord = await findMembershipWebhookEventByStripeEventId(eventId);
  assert(webhookRecord?.processingStatus === "processed", "Webhook event must be processed.");

  const duplicate = await processMembershipStripeEvent({
    id: eventId,
    type: "checkout.session.completed",
    api_version: null,
    livemode: false,
    data: {
      object: {
        id: input.sessionId,
        created: Math.floor(Date.now() / 1000),
        payment_intent: paymentIntentId,
        metadata: {
          membershipId: input.membershipId,
          internalUserId: input.userId,
        },
      },
    },
  });

  assert(duplicate.ignored === true, "Duplicate webhook must be ignored.");

  const membershipAfterDuplicate = await findMembershipByUserId(input.userId);
  assert(
    membershipAfterDuplicate?.memberNumber === membership?.memberNumber,
    "Duplicate webhook must not regenerate Member Number.",
  );

  return { memberNumber: membership!.memberNumber!, paymentIntentId };
}

async function verifyRefundAndDispute(input: {
  userId: string;
  membershipId: string;
  paymentIntentId: string;
  memberNumber: string;
}): Promise<void> {
  await processMembershipStripeEvent({
    id: `mock_evt_refund_${input.paymentIntentId}`,
    type: "charge.refunded",
    api_version: null,
    livemode: false,
    data: {
      object: {
        payment_intent: input.paymentIntentId,
        metadata: { membershipId: input.membershipId },
      },
    },
  });

  const refunded = await findLatestMembershipContributionByMembershipId(input.membershipId);
  assert(refunded?.status === "refunded", "Refund must be recorded on contribution.");

  const membershipAfterRefund = await findMembershipByUserId(input.userId);
  assert(
    membershipAfterRefund?.status === "active_member",
    "Membership must remain active after refund.",
  );
  assert(
    membershipAfterRefund?.memberNumber === input.memberNumber,
    "Member Number must remain unchanged after refund.",
  );

  await processMembershipStripeEvent({
    id: `mock_evt_dispute_${input.paymentIntentId}`,
    type: "charge.dispute.created",
    api_version: null,
    livemode: false,
    data: {
      object: {
        payment_intent: input.paymentIntentId,
        metadata: { membershipId: input.membershipId },
      },
    },
  });

  const disputed = await findLatestMembershipContributionByMembershipId(input.membershipId);
  assert(disputed?.status === "disputed", "Dispute must be recorded on contribution.");

  const membershipAfterDispute = await findMembershipByUserId(input.userId);
  assert(
    membershipAfterDispute?.status === "active_member",
    "Membership must remain active after dispute.",
  );
}

async function verifyProfileAndStatus(input: {
  userId: string;
  memberNumber: string;
}): Promise<void> {
  const status = await getMembershipStatusForUser(input.userId);
  assert(status.status === "active_member", "Status endpoint must show active_member.");
  assert(status.memberNumber === input.memberNumber, "Status endpoint must expose Member Number.");

  const profile = await findMemberProfileByUserId(input.userId);
  const membership = await findMembershipByUserId(input.userId);
  assert(profile !== null && membership !== null, "Profile and membership must exist.");

  const publicProfileDefaultPrivacy = toPublicMemberProfile(profile, {
    viewerIsAuthenticated: true,
    viewerIsOwner: true,
    membership,
  });
  assert(publicProfileDefaultPrivacy !== null, "Public profile must be projectable.");
  assert(
    publicProfileDefaultPrivacy.membershipStatus === "member",
    "Public profile must show member status without number opt-in.",
  );
  assert(
    publicProfileDefaultPrivacy.memberBadgeVisible === true,
    "Public profile must show Member badge automatically.",
  );
  assert(
    publicProfileDefaultPrivacy.memberNumber === undefined,
    "Member Number must stay private until opt-in.",
  );

  await updateMemberProfilePrivacyForUser(input.userId, {
    membershipPubliclyVisible: true,
  });

  const profileAfterPrivacy = await findMemberProfileByUserId(input.userId);
  assert(profileAfterPrivacy !== null, "Profile must exist after privacy update.");

  const publicProfile = toPublicMemberProfile(profileAfterPrivacy, {
    viewerIsAuthenticated: true,
    viewerIsOwner: true,
    membership,
  });
  assert(publicProfile !== null, "Public profile must be projectable.");
  assert(publicProfile.membershipStatus === "member", "Public profile must show member status.");
  assert(
    publicProfile.memberNumber === input.memberNumber,
    "Public profile must show Member Number.",
  );
}

function verifyNoFrontendActivation(): void {
  const repoRoot = path.resolve(scriptDir, "../../../..");
  const successUi = readFileSync(
    path.join(
      repoRoot,
      "apps/web/src/features/membership/components/MembershipSuccessPageContent.tsx",
    ),
    "utf8",
  );
  const contributionUi = readFileSync(
    path.join(
      repoRoot,
      "apps/web/src/features/membership/components/MembershipContributionCard.tsx",
    ),
    "utf8",
  );

  assert(
    !successUi.includes("activateMembership"),
    "Success page must not activate Membership on the frontend.",
  );
  assert(
    !contributionUi.includes("activateMembership"),
    "Contribution card must not activate Membership on the frontend.",
  );
}

async function verifyActiveMemberCannotCheckout(): Promise<void> {
  const { userId } = await createEligibleApplicant("active-block");
  const checkout = await createMembershipCheckoutSession({ userId });
  const contribution = await findMembershipContributionByCheckoutSessionId(checkout.sessionId);
  assert(contribution !== null, "Contribution must exist.");

  const membership = await findMembershipByUserId(userId);
  await simulateMockMembershipCheckoutCompleted({
    sessionId: checkout.sessionId,
    userId,
    membershipId: membership!.membershipId,
    contributionId: contribution.contributionId,
  });

  await assertRejects(
    () => createMembershipCheckoutSession({ userId }),
    MembershipPaymentConflictError,
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:membership-payment pass ${pass} ===`);
  await cleanup(TEST_EMAIL_PREFIX);

  const checkout = await verifyCheckoutCreation();
  await verifyWebhookSignature();
  const activation = await verifyActivationAndIdempotency({
    userId: checkout.userId,
    membershipId: (await findMembershipByUserId(checkout.userId))!.membershipId,
    sessionId: checkout.sessionId,
    contributionId: checkout.contributionId,
  });
  await verifyRefundAndDispute({
    userId: checkout.userId,
    membershipId: (await findMembershipByUserId(checkout.userId))!.membershipId,
    paymentIntentId: activation.paymentIntentId,
    memberNumber: activation.memberNumber,
  });
  await verifyProfileAndStatus({
    userId: checkout.userId,
    memberNumber: activation.memberNumber,
  });
  verifyNoFrontendActivation();
  await verifyActiveMemberCannotCheckout();

  await cleanup(TEST_EMAIL_PREFIX);
  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  assert(isMongoConfigured(), "MONGODB_URI must be configured.");
  await bootstrapAuthPersistence();

  for (let pass = 1; pass <= 3; pass += 1) {
    await runPass(pass);
  }

  console.log("\nverify:membership-payment PASSED (3 consecutive passes).");
}

void runVerificationScript(main);
