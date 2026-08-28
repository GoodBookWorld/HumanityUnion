/**
 * Pack 25B — Member Badge Application Mongo e2e (eligibility, ownership, upsert).
 * Run: npm run verify:member-badge-application
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

process.env.EMAIL_PROVIDER = "mock";
process.env.HU_VERIFICATION_MODE = "true";
process.env.MEMBER_BADGE_PAYMENT_PROVIDER = "mock";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "mock_webhook_secret_verify";
process.env.WEB_ORIGIN = process.env.WEB_ORIGIN?.trim() || "http://localhost:3000";

import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import { bootstrapAuthPersistence } from "../infrastructure/mongodb/bootstrap-auth-persistence.js";
import { registerAndConfirmAuthUser } from "../modules/auth/auth.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findRawAuthUserByEmail,
  updateAuthUserAccountStatus,
} from "../modules/auth/auth-user.repository.js";
import {
  deleteMembershipsByUserIdPrefix,
  findMembershipByUserId,
} from "../modules/membership/membership.repository.js";
import {
  activateMembershipMemberNumber,
  upsertMembershipApplication,
} from "../modules/membership/index.js";
import {
  continueMemberBadgeApplicationPaymentForUser,
  getCurrentMemberBadgeApplicationForUser,
  saveMemberBadgeApplicationForUser,
  simulateMockMemberBadgeApplicationCheckoutCompleted,
} from "../modules/member-badge-application/index.js";
import { MemberBadgeApplicationAccessDeniedError } from "../modules/member-badge-application/member-badge-application.errors.js";
import { deleteMemberBadgeApplicationsByUserIdPrefix } from "../modules/member-badge-application/member-badge-application.repository.js";
import { dispatchStripeMembershipWebhookEvent } from "../modules/membership-payment/stripe-webhook-dispatcher.js";
import { MEMBER_BADGE_APPLICATION_AMOUNT_CENTS } from "../modules/member-badge-application/member-badge-application.constants.js";
import { toPublicMemberProfile } from "../modules/member-profile/member-profile.projection.js";
import { findMemberProfileByUserId } from "../modules/member-profile/member-profile.repository.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

const TEST_EMAIL_PREFIX = `member-badge-app-${Date.now()}`;
const PASSWORD = "verify-password-123";

const shippingAddress = {
  recipientName: "Badge Applicant",
  addressLine1: "514 Vernon St",
  addressLine2: null as string | null,
  city: "Nelson",
  provinceStateRegion: "BC",
  postalCode: "V1L 5R4",
  country: "Canada",
  phone: null as string | null,
};

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

async function createActiveMember(input: {
  email: string;
  displayName: string;
}): Promise<{ userId: string }> {
  await registerAndConfirmAuthUser({
    email: input.email,
    displayName: input.displayName,
    password: PASSWORD,
  });
  const authUser = await findRawAuthUserByEmail(input.email);
  assert(authUser !== null, "Auth user must exist.");

  await upsertMembershipApplication({
    userId: authUser.userId,
    displayName: input.displayName,
    application: {
      countryCode: "CA",
      displayNameConfirmed: input.displayName,
      understandMembershipMeaning: true,
      understandNoVoteWeightChange: true,
      understandDataPolicy: true,
      submit: true,
    },
  });
  await activateMembershipMemberNumber({ userId: authUser.userId });
  return { userId: authUser.userId };
}

async function cleanup(prefix: string): Promise<void> {
  await deleteMemberBadgeApplicationsByUserIdPrefix(prefix);
  await deleteMembershipsByUserIdPrefix(prefix);
  await deleteAuthUsersByEmailPrefix(prefix);
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:member-badge-application pass ${pass} ===`);
  await cleanup(TEST_EMAIL_PREFIX);

  const member = await createActiveMember({
    email: `${TEST_EMAIL_PREFIX}-member@example.com`,
    displayName: "Badge Member",
  });

  const saved = await saveMemberBadgeApplicationForUser(member.userId, { shippingAddress });
  assert(saved.paymentStatus === "unpaid", "Save for Later must remain unpaid.");
  assert(saved.fulfillmentStatus === "not_ready", "Fulfillment must stay not_ready.");
  assert(saved.priceLabel === "CA$28", "Price label must be CA$28.");
  assert(saved.deliveryLabel === "Delivery included", "Delivery included label required.");

  const savedAgain = await saveMemberBadgeApplicationForUser(member.userId, {
    shippingAddress: { ...shippingAddress, addressLine1: "100 Main St" },
  });
  assert(
    savedAgain.applicationId === saved.applicationId,
    "Repeated save must update the same application.",
  );
  assert(savedAgain.shippingAddress.addressLine1 === "100 Main St", "Address must update.");

  const paymentBoundary = await continueMemberBadgeApplicationPaymentForUser(member.userId, {
    shippingAddress: { ...shippingAddress, addressLine1: "100 Main St" },
  });
  assert(paymentBoundary.checkoutReady === true, "Mock Checkout must be ready in Pack 25C.");
  assert(Boolean(paymentBoundary.checkoutUrl), "Checkout URL required.");
  assert(Boolean(paymentBoundary.sessionId), "Checkout session id required.");
  assert(paymentBoundary.application.paymentStatus === "unpaid", "Must not mark paid before webhook.");
  assert(
    paymentBoundary.application.applicationId === saved.applicationId,
    "Checkout must use the same application.",
  );

  await simulateMockMemberBadgeApplicationCheckoutCompleted({
    applicationId: saved.applicationId,
    userId: member.userId,
    sessionId: paymentBoundary.sessionId!,
  });

  const paid = await getCurrentMemberBadgeApplicationForUser(member.userId);
  assert(paid !== null, "Paid application must remain current.");
  assert(paid.applicationId === saved.applicationId, "Same application after payment.");
  assert(paid.paymentStatus === "paid", "Webhook must mark paid.");
  assert(paid.fulfillmentStatus === "awaiting_fulfillment", "Fulfillment must await.");
  assert(Boolean(paid.paidAt), "paidAt must be set.");

  const membershipBeforeReplay = await findMembershipByUserId(member.userId);
  assert(membershipBeforeReplay?.status === "active_member", "Membership must stay active.");
  const memberNumberBefore = membershipBeforeReplay?.memberNumber;

  const replay = await dispatchStripeMembershipWebhookEvent({
    id: `mock_evt_badge_app_replay_${saved.applicationId}`,
    type: "checkout.session.completed",
    api_version: "mock",
    livemode: false,
    data: {
      object: {
        id: paymentBoundary.sessionId,
        object: "checkout.session",
        payment_status: "paid",
        amount_total: MEMBER_BADGE_APPLICATION_AMOUNT_CENTS,
        currency: "cad",
        metadata: {
          paymentPurpose: "member_badge_contribution",
          applicationId: saved.applicationId,
          internalUserId: member.userId,
        },
      },
    },
  });
  assert(replay.processed === true, "Replay must be acknowledged.");

  const afterReplay = await getCurrentMemberBadgeApplicationForUser(member.userId);
  assert(afterReplay?.paymentStatus === "paid", "Replay must remain paid once.");
  const membershipAfterReplay = await findMembershipByUserId(member.userId);
  assert(
    membershipAfterReplay?.memberNumber === memberNumberBefore,
    "Badge payment must not reassign Member Number.",
  );
  assert(
    membershipAfterReplay?.status === "active_member",
    "Badge payment must not change Membership status.",
  );

  const current = await getCurrentMemberBadgeApplicationForUser(member.userId);
  assert(current !== null, "Current application must exist.");
  assert(current.applicationId === saved.applicationId, "Same application after continue.");

  const profile = await findMemberProfileByUserId(member.userId);
  const membership = await findMembershipByUserId(member.userId);
  assert(profile !== null && membership !== null, "Profile and membership required.");
  const publicProfile = toPublicMemberProfile(profile, {
    viewerIsAuthenticated: true,
    viewerIsOwner: false,
    membership,
  });
  assert(publicProfile !== null, "Public profile must project.");
  assert(
    !("shippingAddress" in publicProfile) && !("addressLine1" in publicProfile),
    "Public profile must not expose shipping address.",
  );
  assert(publicProfile.membershipStatus === "member", "Pack 25A.1 Member status must remain auto-public.");
  assert(publicProfile.memberBadgeVisible === true, "Pack 25A.1 Member badge must remain auto-public.");

  const participantSession = await registerAndConfirmAuthUser({
    email: `${TEST_EMAIL_PREFIX}-participant@example.com`,
    displayName: "Non Member",
    password: PASSWORD,
  });
  await assertRejects(
    () => saveMemberBadgeApplicationForUser(participantSession.user.userId, { shippingAddress }),
    MemberBadgeApplicationAccessDeniedError,
  );

  await updateAuthUserAccountStatus(member.userId, "disabled");
  await assertRejects(
    () => saveMemberBadgeApplicationForUser(member.userId, { shippingAddress }),
    MemberBadgeApplicationAccessDeniedError,
  );
  await updateAuthUserAccountStatus(member.userId, "active");

  const otherMember = await createActiveMember({
    email: `${TEST_EMAIL_PREFIX}-other@example.com`,
    displayName: "Other Member",
  });
  const otherApp = await saveMemberBadgeApplicationForUser(otherMember.userId, {
    shippingAddress,
  });
  assert(
    otherApp.applicationId !== saved.applicationId,
    "Other Member must get a distinct application.",
  );
  const memberView = await getCurrentMemberBadgeApplicationForUser(member.userId);
  assert(
    memberView?.applicationId === saved.applicationId,
    "Member must only see their own application.",
  );

  await cleanup(TEST_EMAIL_PREFIX);
  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  assert(isMongoConfigured(), "MONGODB_URI must be configured.");
  await bootstrapAuthPersistence();

  for (let pass = 1; pass <= 3; pass += 1) {
    await runPass(pass);
  }

  console.log("\nverify:member-badge-application PASSED (3 consecutive passes).");
}

void runVerificationScript(main);
