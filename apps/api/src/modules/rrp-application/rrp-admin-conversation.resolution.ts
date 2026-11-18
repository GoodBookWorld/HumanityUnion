/**
 * HU-RRP-03K.2 — owner-safe resolution of an existing RRP admin DM.
 * Derives conversationId server-side from durable intents; never creates conversations.
 */

import type {
  DirectConversation,
  RrpAdminConversationAvailability,
  RrpAdminConversationResolution,
} from "@hu/types";

import { findAuthUserById } from "../auth/auth-user.repository.js";
import { findDirectConversationById } from "../direct-messaging/persistence/direct-messaging.repository.js";
import { buildDirectConversationId } from "../direct-messaging/persistence/direct-messaging.mongo-document.js";
import {
  RrpApplicationAccessDeniedError,
  RrpApplicationNotFoundError,
} from "./rrp-application.errors.js";
import { findRrpApplicationByIdForUser } from "./rrp-application.repository.js";
import {
  listRrpMessageIntentsByApplicationId,
  type RrpAppointmentMessageIntentRecord,
} from "./rrp-appointment-message-intent.repository.js";

export type RrpAdminConversationLookup = (
  conversationId: string,
) => Promise<Pick<DirectConversation, "conversationId" | "participantIds"> | null>;

let conversationLookupForTests: RrpAdminConversationLookup | null = null;

/** Test-only: inject conversation existence/membership without Mongo. */
export function setRrpAdminConversationLookupForTests(
  lookup: RrpAdminConversationLookup | null,
): void {
  conversationLookupForTests = lookup;
}

async function lookupConversation(
  conversationId: string,
): Promise<Pick<DirectConversation, "conversationId" | "participantIds"> | null> {
  if (conversationLookupForTests) {
    return conversationLookupForTests(conversationId);
  }
  return findDirectConversationById(conversationId);
}

async function assertVerifiedActiveParticipant(userId: string): Promise<{
  userId: string;
  participantId: string;
}> {
  const user = await findAuthUserById(userId);

  if (!user) {
    throw new RrpApplicationAccessDeniedError("Authentication session is invalid.");
  }

  if (user.status !== "active") {
    throw new RrpApplicationAccessDeniedError("Your account access is suspended.");
  }

  if (user.emailVerificationStatus !== "verified") {
    throw new RrpApplicationAccessDeniedError(
      "Confirm your email before applying for the Regional Representative Program.",
    );
  }

  return { userId: user.userId, participantId: user.memberId };
}

/**
 * Deterministic intent selection for Open Messages.
 * For information_requested flows, prefer the latest DELIVERED request_information intent.
 */
export function selectRrpAdminConversationIntent(
  intents: readonly RrpAppointmentMessageIntentRecord[],
): {
  intent: RrpAppointmentMessageIntentRecord | null;
  availability: RrpAdminConversationAvailability;
} {
  if (intents.length === 0) {
    return { intent: null, availability: "none" };
  }

  const deliveredRequestInfo = intents
    .filter(
      (intent) =>
        intent.status === "delivered" && intent.kind === "request_information",
    )
    .sort(compareNewestFirst);
  if (deliveredRequestInfo[0]) {
    return { intent: deliveredRequestInfo[0], availability: "available" };
  }

  const deliveredAny = intents
    .filter((intent) => intent.status === "delivered")
    .sort(compareNewestFirst);
  if (deliveredAny[0]) {
    return { intent: deliveredAny[0], availability: "available" };
  }

  const pending = intents.filter((intent) => intent.status === "pending");
  if (pending.length > 0) {
    return { intent: null, availability: "pending" };
  }

  const failed = intents.filter((intent) => intent.status === "failed");
  if (failed.length > 0) {
    return { intent: null, availability: "failed" };
  }

  return { intent: null, availability: "none" };
}

function compareNewestFirst(
  left: RrpAppointmentMessageIntentRecord,
  right: RrpAppointmentMessageIntentRecord,
): number {
  const byUpdated = right.updatedAt.localeCompare(left.updatedAt);
  if (byUpdated !== 0) {
    return byUpdated;
  }
  return right.createdAt.localeCompare(left.createdAt);
}

/**
 * Resolve an existing admin DM for the application owner.
 * Ownership is verified before any intent or conversation id is exposed.
 * Does not create conversations or bypass Messages membership checks.
 */
export async function resolveOwnRrpAdminConversationForUser(input: {
  userId: string;
  applicationId: string;
}): Promise<RrpAdminConversationResolution> {
  const actor = await assertVerifiedActiveParticipant(input.userId);
  const applicationId = input.applicationId.trim();

  if (!applicationId) {
    throw new RrpApplicationNotFoundError();
  }

  const record = await findRrpApplicationByIdForUser({
    applicationId,
    userId: actor.userId,
  });

  if (!record) {
    // Same as getOwn — do not leak whether another user's application exists.
    throw new RrpApplicationNotFoundError();
  }

  const intents = await listRrpMessageIntentsByApplicationId(applicationId);
  const selected = selectRrpAdminConversationIntent(intents);

  if (!selected.intent) {
    return {
      applicationId,
      conversationId: null,
      availability: selected.availability,
    };
  }

  // Owner must be the intent recipient (applicant). Never expose admin-only linkage.
  if (selected.intent.recipientParticipantId !== actor.participantId) {
    return {
      applicationId,
      conversationId: null,
      availability: "unavailable",
    };
  }

  const conversationId = buildDirectConversationId(
    selected.intent.adminParticipantId,
    selected.intent.recipientParticipantId,
  );

  const conversation = await lookupConversation(conversationId);
  if (!conversation) {
    return {
      applicationId,
      conversationId: null,
      availability: "unavailable",
    };
  }

  if (!conversation.participantIds.includes(actor.participantId)) {
    return {
      applicationId,
      conversationId: null,
      availability: "unavailable",
    };
  }

  return {
    applicationId,
    conversationId,
    availability: "available",
  };
}
