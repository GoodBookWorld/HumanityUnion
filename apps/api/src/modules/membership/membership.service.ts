import type {
  MembershipApplicationInput,
  MembershipMePayload,
  MembershipStatusPayload,
} from "@hu/types";

import { findAuthUserById } from "../auth/auth-user.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { getOrCreateMemberProfileForUser } from "../member-profile/member-profile.service.js";
import { MEMBERSHIP_TERMS_VERSION } from "./membership.constants.js";
import {
  MembershipAccessDeniedError,
  MembershipConflictError,
  MembershipNotFoundError,
  MembershipValidationError,
} from "./membership.errors.js";
import { generateMembershipMemberNumber } from "./membership-member-number.js";
import { toMembershipMePayload, toMembershipStatusPayload } from "./membership.projection.js";
import {
  buildDefaultMembershipRecord,
  findMembershipByUserId,
  insertMembershipRecord,
  updateMembershipRecord,
} from "./membership.repository.js";
import { validateApplicationInput } from "./membership.validators.js";

async function assertEmailConfirmedParticipant(userId: string): Promise<void> {
  const user = await findAuthUserById(userId);

  if (!user) {
    throw new MembershipAccessDeniedError("Authentication session is invalid.");
  }

  if (user.emailVerificationStatus !== "verified") {
    throw new MembershipAccessDeniedError("Email must be confirmed before accessing Membership.");
  }
}

async function resolveProfileId(userId: string, displayName: string): Promise<string> {
  const existingProfile = await findMemberProfileByUserId(userId);

  if (existingProfile) {
    return existingProfile.profileId;
  }

  const profile = await getOrCreateMemberProfileForUser({
    userId,
    displayName,
  });
  return profile.profileId;
}

export async function getOrCreateMembershipForUser(input: {
  userId: string;
  displayName: string;
}): Promise<MembershipMePayload> {
  const user = await findAuthUserById(input.userId);

  if (!user) {
    throw new MembershipAccessDeniedError("Authentication session is invalid.");
  }

  let record = await findMembershipByUserId(input.userId);

  if (!record) {
    const profileId = await resolveProfileId(input.userId, input.displayName);
    record = await insertMembershipRecord(
      buildDefaultMembershipRecord({
        userId: input.userId,
        profileId,
      }),
    );
  }

  return toMembershipMePayload({
    record,
    emailConfirmed: user.emailVerificationStatus === "verified",
  });
}

export async function getMembershipStatusForUser(userId: string): Promise<MembershipStatusPayload> {
  const user = await findAuthUserById(userId);

  if (!user) {
    throw new MembershipAccessDeniedError("Authentication session is invalid.");
  }

  const record = await findMembershipByUserId(userId);

  if (!record) {
    return {
      cohortLabel: "Participant",
      status: "not_started",
      applicationStatus: "not_started",
      memberNumber: null,
    };
  }

  return toMembershipStatusPayload(record);
}

function assertApplicationMutable(
  record: Awaited<ReturnType<typeof findMembershipByUserId>>,
): asserts record is NonNullable<typeof record> {
  if (!record) {
    throw new MembershipNotFoundError("Membership record not found.");
  }

  if (record.status === "active_member") {
    throw new MembershipConflictError("Membership is already active.");
  }

  if (record.applicationStatus === "submitted" || record.applicationStatus === "approved") {
    throw new MembershipConflictError("A submitted Membership application already exists.");
  }
}

export async function upsertMembershipApplication(input: {
  userId: string;
  displayName: string;
  application: MembershipApplicationInput;
}): Promise<MembershipMePayload> {
  await assertEmailConfirmedParticipant(input.userId);

  const validated = validateApplicationInput(input.application);
  let record = await findMembershipByUserId(input.userId);

  if (!record) {
    const profileId = await resolveProfileId(input.userId, input.displayName);
    record = await insertMembershipRecord(
      buildDefaultMembershipRecord({
        userId: input.userId,
        profileId,
      }),
    );
  }

  assertApplicationMutable(record);

  const now = new Date().toISOString();
  const patch = {
    participationCountryCodes: validated.participationCountryCodes,
    countryCode: validated.countryCode,
    displayNameConfirmed: validated.displayNameConfirmed,
    status: validated.submit
      ? ("application_completed" as const)
      : ("application_started" as const),
    applicationStatus: validated.submit ? ("submitted" as const) : ("draft" as const),
    termsVersion: validated.submit ? MEMBERSHIP_TERMS_VERSION : record.termsVersion,
    termsAcceptedAt: validated.submit ? now : record.termsAcceptedAt,
    applicationSubmittedAt: validated.submit ? now : record.applicationSubmittedAt,
  };

  const updated = await updateMembershipRecord(record.membershipId, patch);

  if (!updated) {
    throw new MembershipNotFoundError("Membership record could not be updated.");
  }

  return toMembershipMePayload({
    record: updated,
    emailConfirmed: true,
  });
}

/**
 * Future payment activation entry point (TASK-092).
 * Generates and assigns member number — not invoked until contribution confirmation.
 */
export async function activateMembershipMemberNumber(input: { userId: string }): Promise<string> {
  const record = await findMembershipByUserId(input.userId);

  if (!record) {
    throw new MembershipNotFoundError("Membership record not found.");
  }

  if (record.memberNumber) {
    throw new MembershipConflictError("Membership member number is immutable.");
  }

  if (record.memberGrantedAt) {
    throw new MembershipConflictError("Membership grant timestamp is immutable.");
  }

  const memberNumber = generateMembershipMemberNumber();
  const now = new Date().toISOString();

  const updated = await updateMembershipRecord(record.membershipId, {
    memberNumber,
    memberGrantedAt: now,
    status: "active_member",
    applicationStatus: "approved",
  });

  if (!updated?.memberNumber) {
    throw new MembershipValidationError("Unable to assign Membership member number.");
  }

  return updated.memberNumber;
}

export {
  generateMembershipMemberNumber,
  isValidMembershipMemberNumber,
} from "./membership-member-number.js";
